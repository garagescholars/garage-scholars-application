/**
 * Garage Scholars — Consultation Mockup Generation
 *
 * Uses fal.ai FLUX.1 [pro] Fill (inpainting) to generate AI mockups
 * of garage organization and home gym installations during live sales consults.
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { GS_COLLECTIONS } from "./gs-constants";

const db = getFirestore();
const storage = getStorage();

type ServiceType = "garage_org" | "gym_install";
type Tier = "tier1" | "tier2" | "tier3";

// ── Package metadata ──

const GS_PACKAGES = {
  garage_org: {
    tier1: { name: "The Undergraduate", price: 1197 },
    tier2: { name: "The Graduate", price: 2197 },
    tier3: { name: "The Doctorate", price: 3797 },
  },
  gym_install: {
    tier1: { name: "Warm Up", price: 997 },
    tier2: { name: "Super Set", price: 1997 },
    tier3: { name: "1 Rep Max", price: 4797 },
  },
} as const;

// ── Backward compatibility helpers ──

function normalizeGarageAddons(raw: any) {
  if (!raw) return { shelving: "none", overheadStorage: "none", cabinets: "none", wallOrg: "none", flooringType: "none", flooringColor: null };
  // Old boolean shape
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
    };
  }
  // Handle transitional shape with boolean `flooring` field
  if (typeof raw.flooring === "boolean") {
    return { ...raw, flooringType: raw.flooring ? "polyaspartic" : "none" };
  }
  return raw;
}

function normalizeGymAddons(raw: any) {
  if (!raw) return { flooringType: "none", flooringColor: null, rackSystem: "none", bench: "none", cableMachine: "none", accessories: [] };
  // Old boolean shape
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
  // Handle transitional shape with boolean `flooring` field
  if (typeof raw.flooring === "boolean") {
    return { ...raw, flooringType: raw.flooring ? "rubber-tiles" : "none" };
  }
  return raw;
}

// ── Prompt builders ──

function buildSpaceContext(doc: any): string {
  const parts: string[] = [];

  const size = doc.garageSize || "2-car";
  const ceiling = doc.ceilingHeight;
  let sizeStr = `This is a ${size} garage`;
  if (ceiling === "open-joists") sizeStr += " with open joist ceilings";
  else if (ceiling === "10ft+") sizeStr += " with tall 10-foot ceilings";
  else if (ceiling) sizeStr += ` with ${ceiling} ceilings`;
  parts.push(sizeStr + ".");

  const states: string[] = doc.currentState || [];
  if (states.includes("cluttered")) parts.push("The space is currently cluttered with items.");
  if (states.includes("cars-parked")) parts.push("Cars may be parked in the space.");

  if (doc.itemsToPreserve) {
    parts.push(`Keep the following items unchanged: ${doc.itemsToPreserve}.`);
  }

  return parts.join(" ");
}

function getStyleText(style: string | undefined): string {
  switch (style) {
    case "workshop": return "Functional workshop-style";
    case "minimalist": return "Clean, minimalist";
    default: return "Sleek, modern, magazine-quality";
  }
}

function buildFloorInstruction(addons: any, serviceType: "garage" | "gym"): string {
  const flooringType = addons.flooringType || "none";
  if (flooringType === "none") return "Keep existing floor surface.";

  const color = addons.flooringColor;
  const colorStr = color?.name && color?.code
    ? `Benjamin Moore ${color.name} (${color.code}) `
    : color?.name
    ? `${color.name} `
    : "";

  const flooringMap: Record<string, string> = {
    "polyaspartic": `${colorStr}polyaspartic flake floor coating`,
    "click-in-plate": `${colorStr}click-in diamond plate garage flooring tiles`,
    "stall-mats": `${colorStr}rubber stall mat flooring (3/4" thick)`,
    "rubber-tiles": `${colorStr}interlocking rubber floor tiles`,
  };

  const flooringDesc = flooringMap[flooringType] || `${colorStr}flooring`;
  return `Replace the floor with ${flooringDesc}.`;
}

function buildGarageOrgPrompt(tier: Tier, doc: any): string {
  const addons = normalizeGarageAddons(doc.garageAddons);
  const context = buildSpaceContext(doc);
  const style = getStyleText(doc.stylePreference);
  const floor = buildFloorInstruction(addons, "garage");
  const dream = doc.dreamDescription ? ` Client vision: ${doc.dreamDescription}.` : "";

  // Build item list based on tier + addon selections
  const items: string[] = [];

  switch (tier) {
    case "tier1": {
      // Entry: overhead + optional shelving
      const overhead = addons.overheadStorage !== "none"
        ? `${addons.overheadStorage === "4-racks" ? "four" : "two"} white overhead metal ceiling storage racks mounted near the ceiling joists`
        : "two white overhead metal ceiling storage racks mounted near the ceiling joists";
      items.push(overhead);
      if (addons.shelving !== "none") {
        const count = addons.shelving === "3-units" ? "three" : addons.shelving === "2-units" ? "two" : "one";
        items.push(`${count} black wire shelving unit${count !== "one" ? "s" : ""} along the walls`);
      }
      break;
    }
    case "tier2": {
      // Mid: overhead + shelving with bins + wall org
      const overhead = addons.overheadStorage !== "none"
        ? `${addons.overheadStorage === "4-racks" ? "four" : "two"} overhead ceiling storage racks`
        : "two overhead ceiling storage racks";
      items.push(overhead);
      const shelvingCount = addons.shelving === "3-units" ? "three" : addons.shelving === "2-units" ? "two" : addons.shelving === "1-unit" ? "one" : "two";
      items.push(`${shelvingCount} black wire shelving unit${shelvingCount !== "one" ? "s" : ""} with labeled clear plastic bins along the walls`);
      if (addons.wallOrg === "pegboard") items.push("a pegboard tool wall");
      else if (addons.wallOrg === "slatwall") items.push("a slatwall organization panel");
      break;
    }
    case "tier3": {
      // Premium: cabinets + overhead + wall org + everything
      if (addons.cabinets === "premium-newage") items.push("NewAge Bold Series black steel cabinets lining the walls");
      else if (addons.cabinets === "basic-wire") items.push("wall-mounted wire storage cabinets");
      else items.push("NewAge Bold Series black steel cabinets lining the walls");
      const overhead = addons.overheadStorage !== "none"
        ? `${addons.overheadStorage === "4-racks" ? "four" : "two"} overhead ceiling storage racks`
        : "four overhead ceiling storage racks";
      items.push(overhead);
      if (addons.wallOrg === "slatwall") items.push("a slatwall organization system");
      else items.push("a pegboard tool wall");
      if (addons.shelving !== "none") {
        const count = addons.shelving === "3-units" ? "three" : addons.shelving === "2-units" ? "two" : "one";
        items.push(`${count} additional shelving unit${count !== "one" ? "s" : ""}`);
      }
      break;
    }
  }

  const itemsStr = items.join(", ");
  return `${context} Add ${itemsStr}. ${floor} ${style} home garage. Photorealistic, match original lighting and shadows.${dream}`;
}

function buildGymInstallPrompt(tier: Tier, doc: any): string {
  const addons = normalizeGymAddons(doc.gymAddons);
  const context = buildSpaceContext(doc);
  const style = getStyleText(doc.stylePreference);
  const floor = buildFloorInstruction(addons, "gym");
  const dream = doc.dreamDescription ? ` Client vision: ${doc.dreamDescription}.` : "";

  const items: string[] = [];

  // Rack
  const rackMap: Record<string, string> = {
    "wall-mount": "a wall-mounted pull-up bar and dumbbell rack",
    "half-rack": "a half squat rack with barbell and plates",
    "full-power-cage": "a full power cage/squat rack with barbell, plates, and safety bars",
  };

  // Bench
  const benchMap: Record<string, string> = {
    "flat": "a flat weight bench",
    "adjustable-fid": "an adjustable FID weight bench",
  };

  // Cable
  const cableMap: Record<string, string> = {
    "single-stack": "a single-stack cable machine",
    "functional-trainer": "a functional trainer with dual adjustable pulleys",
    "crossover": "a cable crossover machine",
  };

  switch (tier) {
    case "tier1": {
      if (addons.flooringType && addons.flooringType !== "none") {
        items.push(addons.flooringType === "stall-mats" ? "rubber stall mat flooring covering the garage floor" : "interlocking rubber floor tiles covering the garage floor");
      }
      items.push(rackMap[addons.rackSystem] || "a wall-mounted dumbbell rack with adjustable dumbbells (5-50 lbs) and a fold-flat wall-mounted pull-up bar");
      break;
    }
    case "tier2": {
      items.push(rackMap[addons.rackSystem] || "a full power cage/squat rack with barbell and plates");
      if (addons.bench !== "none") items.push(benchMap[addons.bench] || "an adjustable FID bench");
      else items.push("an adjustable FID bench");
      if (addons.cableMachine !== "none") items.push(cableMap[addons.cableMachine] || "a cable machine in the corner");
      else items.push("a cable machine in the corner");
      items.push("a wall-mounted dumbbell rack");
      break;
    }
    case "tier3": {
      items.push(rackMap[addons.rackSystem] || "a full squat rack system with barbell and competition plates");
      items.push(cableMap[addons.cableMachine] || "a cable crossover machine");
      items.push("a commercial dumbbell rack (5-100 lbs)");
      if (addons.bench !== "none") items.push(benchMap[addons.bench] || "an adjustable FID bench");
      // Accessories
      const acc: string[] = addons.accessories || [];
      if (acc.includes("pull-up-rig")) items.push("a freestanding pull-up/muscle-up rig");
      if (acc.includes("mirrors")) items.push("full-length mirrors on the back wall");
      if (acc.includes("kettlebells")) items.push("a kettlebell set on a storage rack");
      break;
    }
  }

  const itemsStr = items.join(", ");
  return `${context} Add ${itemsStr}. ${floor} ${style} home gym, bright clean lighting. Photorealistic, match original lighting and shadows.${dream}`;
}

function buildPrompt(serviceType: ServiceType, tier: Tier, doc: any): string {
  if (serviceType === "garage_org") {
    return buildGarageOrgPrompt(tier, doc);
  }
  return buildGymInstallPrompt(tier, doc);
}

// ═══════════════════════════════════════════════════════════════
// Callable: Generate a single consultation mockup via fal.ai
// ═══════════════════════════════════════════════════════════════

export const gsGenerateConsultMockup = onCall(
  {
    cors: true,
    timeoutSeconds: 300,
    memory: "512MiB",
    secrets: ["FAL_API_KEY"],
  },
  async (request) => {
    const { consultationId, tier } = request.data as {
      consultationId: string;
      tier: Tier;
    };

    if (!consultationId || !tier) {
      throw new HttpsError("invalid-argument", "consultationId and tier are required");
    }
    if (!["tier1", "tier2", "tier3"].includes(tier)) {
      throw new HttpsError("invalid-argument", "tier must be tier1, tier2, or tier3");
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

    // Mark as generating
    await consultRef.update({
      [`mockups.${tier}.status`]: "generating",
      updatedAt: FieldValue.serverTimestamp(),
    });

    try {
      // Check for custom prompts in platformConfig
      let prompt: string;
      const promptDoc = await db
        .collection(GS_COLLECTIONS.PLATFORM_CONFIG)
        .doc("consultationPrompts")
        .get();
      const customPrompts = promptDoc.exists ? promptDoc.data() : null;

      if (customPrompts?.[serviceType]?.[tier]) {
        prompt = customPrompts[serviceType][tier];
      } else {
        prompt = buildPrompt(serviceType, tier, doc);
      }

      console.log(`[Mockup ${consultationId}/${tier}] Prompt: ${prompt}`);

      // Call fal.ai FLUX.1 [pro] Fill
      const falResponse = await fetch("https://fal.run/fal-ai/flux-pro/v1/fill", {
        method: "POST",
        headers: {
          Authorization: `Key ${falApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          image_url: widePhotoUrl,
          prompt,
          num_images: 1,
        }),
      });

      if (!falResponse.ok) {
        const errText = await falResponse.text();
        throw new Error(`fal.ai returned ${falResponse.status}: ${errText}`);
      }

      const falResult = await falResponse.json();
      const generatedUrl = falResult.images?.[0]?.url;

      if (!generatedUrl) {
        throw new Error("fal.ai did not return an image URL");
      }

      // Download the generated image and upload to Firebase Storage
      const imageResponse = await fetch(generatedUrl);
      if (!imageResponse.ok) throw new Error("Failed to download generated image");
      const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());

      const timestamp = Date.now();
      const storagePath = `gs_consultation_mockups/${consultationId}/${tier}_${timestamp}.png`;
      const bucket = storage.bucket();
      const file = bucket.file(storagePath);

      await file.save(imageBuffer, {
        metadata: { contentType: "image/png" },
      });

      // Make publicly readable and get download URL
      await file.makePublic();
      const imageUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;

      // Update Firestore with the result
      await consultRef.update({
        [`mockups.${tier}.status`]: "ready",
        [`mockups.${tier}.imageUrl`]: imageUrl,
        updatedAt: FieldValue.serverTimestamp(),
      });

      // Check if all tiers are done — if so, mark consultation as ready
      const updatedSnap = await consultRef.get();
      const updatedDoc = updatedSnap.data()!;
      const allReady = ["tier1", "tier2", "tier3"].every(
        (t) => updatedDoc.mockups?.[t]?.status === "ready"
      );
      if (allReady) {
        await consultRef.update({ status: "ready" });
      }

      return { tier, imageUrl };
    } catch (err: any) {
      console.error(`Mockup generation failed for ${consultationId}/${tier}:`, err);

      await consultRef.update({
        [`mockups.${tier}.status`]: "failed",
        updatedAt: FieldValue.serverTimestamp(),
      });

      throw new HttpsError("internal", `Mockup generation failed: ${err.message}`);
    }
  }
);

// Export package metadata for use in mobile screens
export { GS_PACKAGES };
