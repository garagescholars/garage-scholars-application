/**
 * Garage Scholars — Consultation Mockup Generation (v3 — Shade-Based)
 *
 * Generates 3 mockups per consultation — one per Benjamin Moore wall paint shade.
 * Same items/addons in all 3, only the wall color changes.
 *
 * Uses fal.ai FLUX.2 Pro Edit (single-pass, proven best quality).
 *
 * Monkey Bars bike rack reference (model 01004):
 *   Gray powder-coated steel wall-mounted bar with sliding J-hooks,
 *   holds 2-4 bikes vertically. Industrial-grade, lifetime warranty.
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { GS_COLLECTIONS } from "./gs-constants";

const db = getFirestore();
const storage = getStorage();

type ServiceType = "garage_org" | "gym_install";
type ShadeKey = "shade1" | "shade2" | "shade3";

// ── Default BM grays (used when shades not pre-configured) ──

const DEFAULT_SHADES: Record<ShadeKey, { bmCode: string; bmName: string; hex: string }> = {
  shade1: { bmCode: "HC-169", bmName: "Coventry Gray", hex: "#A7A9A5" },
  shade2: { bmCode: "HC-170", bmName: "Stonington Gray", hex: "#9A9E9A" },
  shade3: { bmCode: "HC-168", bmName: "Chelsea Gray", hex: "#8A8C8A" },
};

// ── Backward compatibility helpers ──

function normalizeGarageAddons(raw: any) {
  if (!raw) return { shelving: "none", overheadStorage: "none", cabinets: "none", wallOrg: "none", flooringType: "none", flooringColor: null, bikeRack: "none" };
  if (typeof raw.overheadStorage === "boolean" || typeof raw.polyasparticFlooring === "boolean") {
    return {
      shelving: raw.extraShelving ? "1-unit" : "none",
      overheadStorage: raw.overheadStorage ? "2-racks" : "none",
      cabinets: "none",
      wallOrg: "none",
      flooringType: raw.polyasparticFlooring ? "polyaspartic" : "none",
      flooringColor: raw.flooringColor && typeof raw.flooringColor === "string"
        ? { code: "", name: raw.flooringColor }
        : raw.flooringColor || null,
      bikeRack: raw.bikeRack || "none",
    };
  }
  if (typeof raw.flooring === "boolean") {
    return { ...raw, flooringType: raw.flooring ? "polyaspartic" : "none", bikeRack: raw.bikeRack || "none" };
  }
  return { ...raw, bikeRack: raw.bikeRack || "none" };
}

function normalizeGymAddons(raw: any) {
  if (!raw) return { flooringType: "none", flooringColor: null, rackSystem: "none", bench: "none", cableMachine: "none", accessories: [] };
  if (typeof raw.rubberFlooring === "boolean" || typeof raw.cableSystem === "boolean") {
    const accessories: string[] = [];
    if (raw.mirrorWall) accessories.push("mirrors");
    if (raw.pullUpRig) accessories.push("pull-up-rig");
    return {
      flooringType: raw.rubberFlooring ? "rubber-tiles" : "none",
      flooringColor: raw.flooringColor && typeof raw.flooringColor === "string"
        ? { code: "", name: raw.flooringColor }
        : raw.flooringColor || null,
      rackSystem: "none",
      bench: "none",
      cableMachine: raw.cableSystem ? "single-stack" : "none",
      accessories,
    };
  }
  if (typeof raw.flooring === "boolean") {
    return { ...raw, flooringType: raw.flooring ? "rubber-tiles" : "none" };
  }
  return raw;
}

// ══════════════════════════════════════════════════════════════
// LUXURY PROMPT SYSTEM
// ══════════════════════════════════════════════════════════════

const LUXURY_PREAMBLE = "Professional interior design photography of a luxury garage transformation. Magazine-quality, photorealistic, bright even LED lighting, clean lines, premium materials throughout.";

const MONKEY_BARS_DESC: Record<string, string> = {
  "wall-2": "a Monkey Bars wall-mounted 2-bike storage rack — a sleek gray powder-coated steel horizontal bar with two adjustable sliding J-hooks, bikes hung vertically by their front wheels, mounted high on the wall to save floor space",
  "wall-4": "a Monkey Bars wall-mounted 4-bike storage rack — a 53-inch gray powder-coated industrial steel bar with four adjustable sliding J-hooks with rubber coating, four bikes hung vertically by their front wheels in a neat row, mounted high on the wall",
};

function buildSpaceContext(doc: any): string {
  const parts: string[] = [];
  const size = doc.garageSize || "2-car";
  const ceiling = doc.ceilingHeight;
  let sizeStr = `${size} garage`;
  if (ceiling === "open-joists") sizeStr += " with exposed open joist ceilings";
  else if (ceiling === "10ft+") sizeStr += " with tall 10-foot ceilings";
  else if (ceiling) sizeStr += ` with ${ceiling} ceilings`;
  parts.push(sizeStr);

  const states: string[] = doc.currentState || [];
  if (states.includes("cluttered")) parts.push("currently cluttered");
  if (states.includes("cars-parked")) parts.push("cars may be parked");

  return parts.join(", ");
}

function getStyleText(style: string | undefined): string {
  switch (style) {
    case "workshop": return "high-end workshop aesthetic with premium tool organization";
    case "minimalist": return "ultra-clean minimalist design with hidden storage and seamless surfaces";
    default: return "sleek modern luxury garage with magazine-quality design";
  }
}

function buildFloorInstruction(addons: any): string {
  const flooringType = addons.flooringType || "none";
  if (flooringType === "none") return "";

  const color = addons.flooringColor;
  const colorStr = color?.name && color?.code
    ? `Benjamin Moore ${color.name} (${color.code}) `
    : color?.name
    ? `${color.name} `
    : "";

  const flooringMap: Record<string, string> = {
    "polyaspartic": `pristine ${colorStr}polyaspartic flake floor coating with a glossy showroom finish`,
    "click-in-plate": `premium ${colorStr}click-in diamond plate garage flooring tiles with a factory-fresh metallic sheen`,
    "stall-mats": `thick ${colorStr}rubber stall mat flooring (3/4" commercial grade)`,
    "rubber-tiles": `professional ${colorStr}interlocking rubber floor tiles with clean seams`,
  };

  return flooringMap[flooringType] || `${colorStr}premium flooring`;
}

// ── Garage Prompt (shade-based) ──

function buildGarageShadePrompt(doc: any, wallColor: { bmCode: string; bmName: string }): string {
  const addons = normalizeGarageAddons(doc.garageAddons);
  const context = buildSpaceContext(doc);
  const style = getStyleText(doc.stylePreference);
  const dream = doc.dreamDescription ? ` Client vision: "${doc.dreamDescription}".` : "";
  const wallColorStr = `Benjamin Moore ${wallColor.bmName} (${wallColor.bmCode})`;

  const items: string[] = [];

  // Bike rack
  const rack = addons.bikeRack || "none";
  if (rack !== "none" && MONKEY_BARS_DESC[rack]) items.push(MONKEY_BARS_DESC[rack]);

  // Overhead storage
  if (addons.overheadStorage !== "none") {
    const count = addons.overheadStorage === "4-racks" ? "four" : "two";
    items.push(`${count} heavy-duty white powder-coated overhead ceiling storage racks with wire mesh decking`);
  }

  // Shelving
  if (addons.shelving !== "none") {
    const count = addons.shelving === "3-units" ? "three" : addons.shelving === "2-units" ? "two" : "one";
    items.push(`${count} commercial-grade black wire shelving unit${count !== "one" ? "s" : ""} neatly loaded with matching labeled clear plastic storage bins`);
  }

  // Cabinets
  if (addons.cabinets === "premium-newage") items.push("a full run of NewAge Bold Series glossy black steel garage cabinets with stainless steel countertops lining the walls");
  else if (addons.cabinets === "basic-wire") items.push("wall-mounted commercial wire storage cabinets with doors");

  // Wall org
  if (addons.wallOrg === "pegboard") items.push("a large pegboard tool organization wall with premium hooks and tool silhouettes");
  else if (addons.wallOrg === "slatwall") items.push("a commercial gray slatwall organization panel with premium hooks, baskets, and shelves");

  // Floor
  const floor = buildFloorInstruction(addons);
  const floorStr = floor ? `Replace the entire floor with ${floor}.` : "";

  const installStr = items.length > 0 ? `Install: ${items.join("; ")}.` : "";

  return `${LUXURY_PREAMBLE} Complete transformation of this ${context}. Paint ALL walls and ceiling ${wallColorStr} — smooth, even, professional finish, no raw drywall, tape, or mud visible. ${floorStr} ${installStr} All items brand new, professionally installed, perfectly aligned. ${style}. Remove all clutter, debris, and mess — this is a showroom-ready luxury garage.${dream} Photorealistic, preserve the exact garage geometry, perspective, and proportions.`;
}

// ── Gym Prompt (shade-based) ──

function buildGymShadePrompt(doc: any, wallColor: { bmCode: string; bmName: string }): string {
  const addons = normalizeGymAddons(doc.gymAddons);
  const context = buildSpaceContext(doc);
  const style = getStyleText(doc.stylePreference);
  const dream = doc.dreamDescription ? ` Client vision: "${doc.dreamDescription}".` : "";
  const wallColorStr = `Benjamin Moore ${wallColor.bmName} (${wallColor.bmCode})`;

  const items: string[] = [];

  const rackMap: Record<string, string> = {
    "wall-mount": "a premium wall-mounted pull-up bar and dumbbell rack system",
    "half-rack": "a commercial-grade half squat rack with Olympic barbell and bumper plates",
    "full-power-cage": "a full power cage/squat rack with Olympic barbell, competition plates, and safety bars",
  };

  const benchMap: Record<string, string> = {
    "flat": "a commercial flat weight bench",
    "adjustable-fid": "a premium adjustable FID weight bench",
  };

  const cableMap: Record<string, string> = {
    "single-stack": "a commercial single-stack cable machine",
    "functional-trainer": "a premium functional trainer with dual adjustable pulleys",
    "crossover": "a full cable crossover machine",
  };

  if (addons.rackSystem && addons.rackSystem !== "none") {
    items.push(rackMap[addons.rackSystem] || "a squat rack with barbell and plates");
  }
  if (addons.bench && addons.bench !== "none") {
    items.push(benchMap[addons.bench] || "a premium adjustable bench");
  }
  if (addons.cableMachine && addons.cableMachine !== "none") {
    items.push(cableMap[addons.cableMachine] || "a cable machine");
  }

  const acc: string[] = addons.accessories || [];
  if (acc.includes("mirrors")) items.push("full-length mirrors across the back wall");
  if (acc.includes("pull-up-rig")) items.push("a freestanding pull-up/muscle-up rig");
  if (acc.includes("dumbbell-rack")) items.push("a commercial dumbbell rack");
  if (acc.includes("kettlebells")) items.push("a kettlebell set on a storage rack");

  const floor = buildFloorInstruction(addons);
  const floorStr = floor ? `Replace the floor with ${floor}.` : "";

  const installStr = items.length > 0 ? `Install: ${items.join("; ")}.` : "";

  return `${LUXURY_PREAMBLE} Complete transformation of this ${context} into a premium home gym. Paint ALL walls and ceiling ${wallColorStr} — smooth, even, professional finish. ${floorStr} ${installStr} ${style} home gym with professional lighting. All equipment brand new, premium quality, perfectly positioned. Remove all clutter.${dream} Photorealistic, preserve garage geometry and perspective.`;
}

// ══════════════════════════════════════════════════════════════
// fal.ai FLUX.2 Pro Edit
// ══════════════════════════════════════════════════════════════

async function callFlux2Edit(imageUrl: string, prompt: string, falApiKey: string): Promise<string> {
  const response = await fetch("https://fal.run/fal-ai/flux-2-pro/edit", {
    method: "POST",
    headers: {
      Authorization: `Key ${falApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      image_urls: [imageUrl],
      prompt,
      image_size: "auto",
      output_format: "png",
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`FLUX.2 Edit returned ${response.status}: ${errText}`);
  }

  const result = await response.json();
  const url = result.images?.[0]?.url;
  if (!url) throw new Error("FLUX.2 Edit did not return an image URL");
  return url;
}

// ── Upload helper ──

async function downloadAndUpload(generatedUrl: string, storagePath: string): Promise<string> {
  const imageResponse = await fetch(generatedUrl);
  if (!imageResponse.ok) throw new Error("Failed to download generated image");
  const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());

  const bucket = storage.bucket();
  const file = bucket.file(storagePath);
  await file.save(imageBuffer, { metadata: { contentType: "image/png" } });
  await file.makePublic();
  return `https://storage.googleapis.com/${bucket.name}/${storagePath}`;
}

// ══════════════════════════════════════════════════════════════
// Callable: Generate a single shade mockup via FLUX.2 Pro Edit
// ══════════════════════════════════════════════════════════════

export const gsGenerateConsultMockup = onCall(
  {
    cors: true,
    timeoutSeconds: 300,
    memory: "512MiB",
    secrets: ["FAL_API_KEY"],
  },
  async (request) => {
    const { consultationId, shade } = request.data as {
      consultationId: string;
      shade: ShadeKey;
    };

    if (!consultationId || !shade) {
      throw new HttpsError("invalid-argument", "consultationId and shade are required");
    }
    if (!["shade1", "shade2", "shade3"].includes(shade)) {
      throw new HttpsError("invalid-argument", "shade must be shade1, shade2, or shade3");
    }

    const falApiKey = process.env.FAL_API_KEY;
    if (!falApiKey) throw new HttpsError("internal", "FAL_API_KEY not configured");

    const consultRef = db.collection(GS_COLLECTIONS.CONSULTATIONS).doc(consultationId);
    const snap = await consultRef.get();
    if (!snap.exists) {
      throw new HttpsError("not-found", "Consultation not found");
    }

    const doc = snap.data()!;
    const serviceType = doc.serviceType as ServiceType;
    const widePhotoUrl = doc.spacePhotoUrls?.wide;

    if (!widePhotoUrl) {
      throw new HttpsError("failed-precondition", "Wide-angle photo is required");
    }

    // Get wall color for this shade from the doc, or use defaults
    const shadeData = doc.mockups?.[shade];
    const wallColor = {
      bmCode: shadeData?.bmCode || DEFAULT_SHADES[shade].bmCode,
      bmName: shadeData?.bmName || DEFAULT_SHADES[shade].bmName,
      hex: shadeData?.hex || DEFAULT_SHADES[shade].hex,
    };

    // Mark as generating
    await consultRef.update({
      [`mockups.${shade}.status`]: "generating",
      updatedAt: FieldValue.serverTimestamp(),
    });

    try {
      // Check for custom prompts in platformConfig
      const promptDoc = await db
        .collection(GS_COLLECTIONS.PLATFORM_CONFIG)
        .doc("consultationPrompts")
        .get();
      const customPrompts = promptDoc.exists ? promptDoc.data() : null;

      // Build prompt
      let prompt: string;
      if (customPrompts?.[serviceType]?.[shade]) {
        prompt = customPrompts[serviceType][shade];
      } else if (serviceType === "gym_install") {
        prompt = buildGymShadePrompt(doc, wallColor);
      } else {
        prompt = buildGarageShadePrompt(doc, wallColor);
      }

      console.log(`[Mockup ${consultationId}/${shade}] Wall: ${wallColor.bmName} (${wallColor.bmCode})`);
      console.log(`[Mockup ${consultationId}/${shade}] Prompt: ${prompt}`);

      // Generate via FLUX.2 Pro Edit
      const generatedUrl = await callFlux2Edit(widePhotoUrl, prompt, falApiKey);
      console.log(`[Mockup ${consultationId}/${shade}] Done — image ready`);

      // Upload to Firebase Storage
      const timestamp = Date.now();
      const storagePath = `gs_consultation_mockups/${consultationId}/${shade}_${timestamp}.png`;
      const imageUrl = await downloadAndUpload(generatedUrl, storagePath);

      // Update Firestore
      await consultRef.update({
        [`mockups.${shade}.status`]: "ready",
        [`mockups.${shade}.imageUrl`]: imageUrl,
        updatedAt: FieldValue.serverTimestamp(),
      });

      // Check if all shades are done — if so, mark consultation as ready
      const updatedSnap = await consultRef.get();
      const updatedDoc = updatedSnap.data()!;
      const allReady = ["shade1", "shade2", "shade3"].every(
        (s) => updatedDoc.mockups?.[s]?.status === "ready"
      );
      if (allReady) await consultRef.update({ status: "ready" });

      return { shade, wallColor, imageUrl };

    } catch (err: any) {
      console.error(`Mockup generation failed for ${consultationId}/${shade}:`, err);

      await consultRef.update({
        [`mockups.${shade}.status`]: "failed",
        updatedAt: FieldValue.serverTimestamp(),
      });

      throw new HttpsError("internal", `Mockup generation failed: ${err.message}`);
    }
  }
);
