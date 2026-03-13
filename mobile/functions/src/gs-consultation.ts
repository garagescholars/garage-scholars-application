/**
 * Garage Scholars — Consultation Mockup Generation (v4 — Multi-Pass Kontext)
 *
 * Pipeline per consultation:
 *   Pass 1 : Clean + white walls  (Kontext, guidance scales with clutter level)
 *   Pass 2+: Add one product type per pass  (Kontext, decreasing guidance 7→5)
 *   Pass N : Apply BM shade color to finished layout  (Kontext, guidance 3.5)
 *
 * Efficiency: Pass 1 and product passes run ONCE and are cached in Firestore.
 *   Shade calls check for cached base; only the final color-wash differs per shade.
 *
 * Photo routing: each product pass uses the best available source angle:
 *   back/wide → cabinets, shelving  |  left → left-wall items
 *   right → right-wall items, bike rack  |  ceiling → overhead racks
 *   floor → flooring products
 *
 * Product references: fetched from Firestore gs_platformConfig/productCatalog
 *   and injected into the Kontext images[] array so the model sees real products.
 *
 * Photo protocol (enforced in new.tsx):
 *   Garage org : wide* + back + left + right + ceiling  (* = hard required)
 *   Gym install : wide* + back + left + right + floor
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { GS_COLLECTIONS } from "./gs-constants";

const db = getFirestore();
const storage = getStorage();

type ServiceType = "garage_org" | "gym_install";
type ShadeKey = "shade1" | "shade2" | "shade3";

// ── Default BM shades ──────────────────────────────────────────────────────

const DEFAULT_SHADES: Record<ShadeKey, { bmCode: string; bmName: string; hex: string }> = {
  shade1: { bmCode: "HC-169", bmName: "Coventry Gray",   hex: "#A7A9A5" },
  shade2: { bmCode: "HC-170", bmName: "Stonington Gray", hex: "#9A9E9A" },
  shade3: { bmCode: "HC-168", bmName: "Chelsea Gray",    hex: "#8A8C8A" },
};

// ── Normalizers (backward compat) ──────────────────────────────────────────

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
        ? { code: "", name: raw.flooringColor } : raw.flooringColor || null,
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
    if (raw.mirrorWall)  accessories.push("mirrors");
    if (raw.pullUpRig)   accessories.push("pull-up-rig");
    return {
      flooringType: raw.rubberFlooring ? "rubber-tiles" : "none",
      flooringColor: raw.flooringColor && typeof raw.flooringColor === "string"
        ? { code: "", name: raw.flooringColor } : raw.flooringColor || null,
      rackSystem: "none", bench: "none",
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
// GEOMETRY CONSTRAINT SYSTEM
// Converts garage metadata into natural-language constraints
// that anchor product placement to actual dimensions and layout.
// ══════════════════════════════════════════════════════════════

const SIZE_DESC: Record<string, string> = {
  "1-car":      "single-car garage (approximately 12 ft wide × 20 ft deep)",
  "2-car":      "two-car garage (approximately 20 ft wide × 20 ft deep)",
  "3-car":      "three-car garage (approximately 30 ft wide × 20 ft deep)",
  "oversized":  "oversized garage (24+ ft wide)",
};

const CEILING_DESC: Record<string, string> = {
  "8ft":         "low 8-foot ceiling — overhead racks mount within 6 inches of the ceiling joists with short drop rods",
  "9ft":         "standard 9-foot ceiling",
  "10ft+":       "tall 10-foot or higher ceiling — overhead racks can hang lower on longer drop rods",
  "open-joists": "open exposed ceiling joists — overhead racks bolt directly to the structural joists",
};

// Maps garageSize to realistic cabinet run and shelving quantities
const SIZE_CABINET_LENGTH: Record<string, string> = {
  "1-car": "8 to 10 feet",
  "2-car": "14 to 18 feet",
  "3-car": "20 to 24 feet",
  "oversized": "20 to 28 feet",
};

const SIZE_SHELVING_COUNT: Record<string, string> = {
  "1-car": "one",
  "2-car": "two",
  "3-car": "three",
  "oversized": "three to four",
};

const SIZE_OVERHEAD_COUNT: Record<string, string> = {
  "1-car": "one",
  "2-car": "two",
  "3-car": "three",
  "oversized": "four",
};

/**
 * Builds a natural-language geometry constraint string for prompt injection.
 * This ensures products are sized and placed to match the actual garage.
 */
function buildGeometryConstraints(doc: any): string {
  const size    = doc.garageSize    || "2-car";
  const ceiling = doc.ceilingHeight || "9ft";
  const states: string[] = doc.currentState || [];
  const hasCars = states.includes("cars-parked");

  const parts = [
    `Garage type: ${SIZE_DESC[size] || SIZE_DESC["2-car"]}.`,
    `Ceiling: ${CEILING_DESC[ceiling] || CEILING_DESC["9ft"]}.`,
    "The garage has an interior door on one side wall — do NOT place cabinets, shelving, or storage in front of or blocking this door.",
    hasCars ? "There may be cars or vehicles parked — remove them entirely from the transformed view." : "",
  ];

  return parts.filter(Boolean).join(" ");
}

/**
 * Dynamic Pass 1 guidance scale — more clutter needs higher guidance
 * to force the model to fully commit to removing everything.
 * Proven values from test-3pass.js testing.
 */
function getCleanGuidanceScale(doc: any): number {
  const states: string[] = doc.currentState || [];
  if (states.includes("cluttered") && states.includes("cars-parked")) return 14.0;
  if (states.includes("cluttered"))        return 13.0;
  if (states.includes("cars-parked"))      return 12.0;
  if (states.includes("partial-storage")) return 11.0;
  return 10.0; // empty or minimal clutter
}

// ══════════════════════════════════════════════════════════════
// PROMPT BUILDERS
// ══════════════════════════════════════════════════════════════

// Spatial anchor prepended to all product passes —
// prevents the model from drifting the scene or moving existing objects.
const SPATIAL =
  "Preserve all original perspective, proportions, and lighting exactly. " +
  "Keep every item already in the garage exactly as-is — only add the new item described. " +
  "Photorealistic, brand new, professionally installed. ";

/**
 * Pass 1: Remove everything, paint walls/ceiling white.
 * High guidance (10-14 depending on clutter) forces full removal.
 */
function buildPaintPrompt(doc: any): string {
  const geo = buildGeometryConstraints(doc);
  const states: string[] = doc.currentState || [];
  const hasCars = states.includes("cars-parked");

  const vehicleNote = hasCars
    ? "Remove all vehicles, cars, and any other motorized equipment from the floor. "
    : "";

  return (
    `Transform this garage completely. ${geo} ` +
    "Paint ALL walls and ceiling crisp bright white with a smooth, even, professional finish — " +
    "no raw drywall, tape, mud, or seams visible anywhere. " +
    "Remove EVERY SINGLE item from the garage: all bikes, bicycle racks, bike hooks, " +
    "furniture, couches, sofas, boxes, bins, shelving units, wall-mounted storage, overhead racks, " +
    "grid panels, pegboard, slatwall, tools, bags, sports equipment, and ALL clutter. " +
    vehicleNote +
    "Completely empty garage — nothing on the walls, nothing hanging from the ceiling, nothing on the floor. " +
    "Only the bare garage structure remains: painted walls, ceiling, concrete floor, garage door, " +
    "window (if present), interior door on the side wall. " +
    "Bright even LED lighting throughout. Photorealistic result."
  );
}

/**
 * Overhead rack prompt — anchored to BACK HALF of ceiling, forbidden from
 * connecting to garage door/tracks. Proven placement from v3 testing.
 */
function buildOverheadRackPrompt(doc: any, rackCount: "one" | "two" | "three" | "four"): string {
  const ceiling = doc.ceilingHeight || "9ft";
  const joistsNote = ceiling === "open-joists"
    ? "The rack bolts directly to the exposed structural ceiling joists."
    : "The rack is suspended from the ceiling ONLY by four short vertical steel drop rods bolted into the ceiling joists.";

  const countNote = rackCount === "one"
    ? "one large overhead ceiling storage rack (approximately 8 feet wide, 4 feet deep)"
    : `${rackCount} overhead ceiling storage racks (each approximately 8 feet wide, 4 feet deep), spaced evenly across the ceiling`;

  return (
    SPATIAL +
    `Add ${countNote} mounted in the BACK HALF of the ceiling — directly above the back wall area, ` +
    "as far from the garage door and garage door motor as possible. " +
    joistsNote + " " +
    "The rack is completely separate from and does NOT overlap with, attach to, or touch the garage door opener motor, " +
    "garage door chain rail, garage door tracks, or garage door in any way. " +
    "The garage door opener motor remains visible and unchanged on its own rail closer to the front of the garage. " +
    "The rack hangs flat and level in the back ceiling zone, with gray wire mesh decking. " +
    "Stack Greenmade 27-gallon storage bins (gray body, green lid) neatly on top of the rack. " +
    "Nothing else changes."
  );
}

/**
 * Small overhead rack above the garage door header —
 * uses the dead space between the top of the door and the ceiling.
 */
function buildOverheadAboveDoorPrompt(): string {
  return (
    SPATIAL +
    "Add one narrow overhead ceiling storage rack (approximately 8 feet wide, 18 inches deep) " +
    "mounted flush against the ceiling in the space directly above the garage door — " +
    "this is the narrow zone between the top of the closed garage door and the ceiling. " +
    "The rack is suspended from the ceiling framing by four short vertical steel drop rods. " +
    "It does NOT touch, rest on, or connect to the garage door itself, the door tracks, or the door opener motor rail. " +
    "Stack 4 flat storage bins on top of the rack. Nothing else changes."
  );
}

/**
 * Shelving prompt — scaled to garage size.
 */
function buildShelvingPrompt(doc: any): string {
  const size = doc.garageSize || "2-car";
  const count = SIZE_SHELVING_COUNT[size] || "two";

  return (
    SPATIAL +
    `Add ${count} 5-tier gray steel shelving unit${count !== "one" ? "s" : ""} ` +
    "(each approximately 72 inches tall, 48 inches wide) standing flush against the CENTER of the back wall. " +
    "Each unit has 5 shelves fully loaded with Greenmade 27-gallon storage bins (gray body, green snap lid). " +
    "The shelving units do not block any windows or the interior door. " +
    "Nothing else changes."
  );
}

/**
 * Cabinet prompt — scaled to garage size, respects interior door.
 */
function buildCabinetPrompt(doc: any): string {
  const size = doc.garageSize || "2-car";
  const runLength = SIZE_CABINET_LENGTH[size] || "14 to 18 feet";

  return (
    SPATIAL +
    `Add NewAge Bold Series black steel garage cabinets along the back wall: ` +
    `base cabinets (36 inches tall, 18 inches deep) running ${runLength} across the full back wall ` +
    "with a continuous stainless steel countertop, and matching black steel wall cabinets mounted above the countertop. " +
    "The cabinets run wall-to-wall across the back wall only — do NOT extend onto the left or right walls. " +
    "Do NOT place cabinets in front of or blocking the interior door on the side wall. " +
    "Do NOT attach anything to the garage door, door tracks, or door rails. " +
    "Nothing else changes."
  );
}

/**
 * Bike rack prompt — places on right wall by default.
 */
function buildBikeRackPrompt(bikeRack: string): string {
  const count = bikeRack === "wall-4" ? "four" : "two";
  const barLength = bikeRack === "wall-4" ? "53-inch" : "30-inch";

  return (
    SPATIAL +
    `Add a wall-mounted horizontal bike storage bar on the RIGHT SIDE WALL — ` +
    `a gray powder-coated ${barLength} steel bar with ${count} J-hooks, ` +
    `mounted 5 to 6 feet high on the right wall, with ${count} bikes hanging vertically by their front wheels. ` +
    "The bar is bolted directly into the right wall studs — " +
    "NOT touching the garage door tracks, ceiling, floor, or any other structure. " +
    "Nothing else changes."
  );
}

/**
 * Slatwall prompt — covers right or left wall.
 */
function buildSlatwallPrompt(wall: "left" | "right"): string {
  return (
    SPATIAL +
    `Add a full commercial gray slatwall panel system covering the ${wall.toUpperCase()} SIDE WALL from 12 inches above the floor to the ceiling. ` +
    "Mount premium slatwall hooks, wire baskets, and small shelves to organize tools, sports equipment, and accessories. " +
    `The slatwall is flush against the ${wall} wall only — do not extend it to other walls. ` +
    "Nothing else changes."
  );
}

/**
 * Pegboard prompt.
 */
function buildPegboardPrompt(wall: "left" | "right"): string {
  return (
    SPATIAL +
    `Add a large commercial pegboard system on the ${wall.toUpperCase()} SIDE WALL — ` +
    "a full-height painted pegboard panel with organized premium hooks, small shelves, and labeled bins. " +
    "Tools and accessories are neatly arranged in visible silhouette patterns. " +
    "Nothing else changes."
  );
}

/**
 * Shade application — last pass, low guidance (3.5) to preserve all products.
 */
function buildShadePrompt(wallColor: { bmCode: string; bmName: string }): string {
  return (
    `Change the wall and ceiling color to Benjamin Moore ${wallColor.bmName} (${wallColor.bmCode}). ` +
    "Smooth even satin finish. Do not change anything else — keep all furniture, products, equipment, " +
    "bins, and all installed items exactly as they are. Only the wall and ceiling color changes."
  );
}

// ══════════════════════════════════════════════════════════════
// PRODUCT PASS BUILDER
// Returns an ordered list of passes — one product type per pass.
// Order: overhead → cabinets/shelving → wall-org → bike rack → flooring
// Guidance decreases each pass to preserve accumulated work.
// ══════════════════════════════════════════════════════════════

interface ProductPass {
  label:      string;
  prompt:     string;
  refs:       string[];
  guidance:   number;
  wallTarget: "back" | "left" | "right" | "ceiling" | "floor" | "wide";
}

function buildProductPasses(
  serviceType: ServiceType,
  doc: any,
  catalog: Record<string, any>
): ProductPass[] {
  const passes: ProductPass[] = [];
  const cat = catalog[serviceType] || {};

  if (serviceType === "garage_org") {
    const addons = normalizeGarageAddons(doc.garageAddons);
    const size   = doc.garageSize || "2-car";

    // 1. Overhead rack above the door (always — it uses the dead space)
    passes.push({
      label: "overhead-above-door",
      prompt: buildOverheadAboveDoorPrompt(),
      refs: [cat.overhead_rack].filter(Boolean),
      guidance: 7.0,
      wallTarget: "ceiling",
    });

    // 2. Overhead racks on the back ceiling (if selected)
    if (addons.overheadStorage !== "none") {
      const count = (SIZE_OVERHEAD_COUNT[size] || "two") as "one" | "two" | "three" | "four";
      passes.push({
        label: "overhead-racks",
        prompt: buildOverheadRackPrompt(doc, count),
        refs: [cat.overhead_rack].filter(Boolean),
        guidance: 6.0,
        wallTarget: "ceiling",
      });
    }

    // 3. Cabinets (if selected)
    if (addons.cabinets === "premium-newage" || addons.cabinets === "basic-wire") {
      passes.push({
        label: "cabinets",
        prompt: buildCabinetPrompt(doc),
        refs: [cat.cabinets_newage].filter(Boolean),
        guidance: 7.0,
        wallTarget: "back",
      });
    }

    // 4. Shelving (if selected — or default for tier2)
    if (addons.shelving !== "none") {
      passes.push({
        label: "shelving",
        prompt: buildShelvingPrompt(doc),
        refs: [cat.shelving_5tier, cat.bins_greenmade].filter(Boolean),
        guidance: 5.0,
        wallTarget: "back",
      });
    }

    // 5. Wall organization
    if (addons.wallOrg === "slatwall") {
      passes.push({
        label: "slatwall",
        prompt: buildSlatwallPrompt("right"),
        refs: [],
        guidance: 5.0,
        wallTarget: "right",
      });
    } else if (addons.wallOrg === "pegboard") {
      passes.push({
        label: "pegboard",
        prompt: buildPegboardPrompt("right"),
        refs: [],
        guidance: 5.0,
        wallTarget: "right",
      });
    }

    // 6. Bike rack
    if (addons.bikeRack !== "none") {
      passes.push({
        label: "bike-rack",
        prompt: buildBikeRackPrompt(addons.bikeRack),
        refs: [cat.bike_rack].filter(Boolean),
        guidance: 5.0,
        wallTarget: "right",
      });
    }

  } else if (serviceType === "gym_install") {
    const addons = normalizeGymAddons(doc.gymAddons);

    // Rack system
    if (addons.rackSystem && addons.rackSystem !== "none") {
      const rackPrompts: Record<string, string> = {
        "wall-mount": SPATIAL + "Add a premium wall-mounted pull-up bar and dumbbell rack system mounted on the back wall. Nothing else changes.",
        "half-rack": SPATIAL + "Add a commercial-grade half squat rack with an Olympic barbell and bumper plates positioned in the center of the floor, facing the back wall. Nothing else changes.",
        "full-power-cage": SPATIAL + "Add a full power cage/squat rack with Olympic barbell, competition bumper plates, and safety bars, positioned in the center of the floor. Nothing else changes.",
      };
      passes.push({
        label: "rack",
        prompt: rackPrompts[addons.rackSystem] || rackPrompts["half-rack"],
        refs: [cat.rack_half, cat.rack_full_cage].filter(Boolean),
        guidance: 7.0,
        wallTarget: "wide",
      });
    }

    // Cable machine
    if (addons.cableMachine && addons.cableMachine !== "none") {
      const cablePrompts: Record<string, string> = {
        "single-stack": SPATIAL + "Add a commercial single-stack cable machine positioned along the right wall. Nothing else changes.",
        "functional-trainer": SPATIAL + "Add a premium functional trainer with dual adjustable pulleys positioned along the right wall. Nothing else changes.",
        "crossover": SPATIAL + "Add a full cable crossover machine positioned against the back wall. Nothing else changes.",
      };
      passes.push({
        label: "cable",
        prompt: cablePrompts[addons.cableMachine] || cablePrompts["single-stack"],
        refs: [cat.cable_single_stack, cat.cable_functional_trainer].filter(Boolean),
        guidance: 5.0,
        wallTarget: "right",
      });
    }

    // Accessories
    const acc: string[] = addons.accessories || [];
    if (acc.includes("mirrors")) {
      passes.push({
        label: "mirrors",
        prompt: SPATIAL + "Add full-length floor-to-ceiling mirrors mounted on the back wall, covering the entire back wall width. Nothing else changes.",
        refs: [],
        guidance: 5.0,
        wallTarget: "back",
      });
    }
    if (acc.includes("dumbbell-rack")) {
      passes.push({
        label: "dumbbell-rack",
        prompt: SPATIAL + "Add a commercial 3-tier dumbbell rack with a full set of dumbbells against the right wall. Nothing else changes.",
        refs: [],
        guidance: 5.0,
        wallTarget: "right",
      });
    }
  }

  return passes;
}

/**
 * Selects the best available source photo for a given pass.
 * Falls back to wide if the ideal angle wasn't captured.
 */
function selectSourcePhoto(
  wallTarget: ProductPass["wallTarget"],
  photoUrls: Record<string, string | undefined>
): string {
  const candidates: (string | undefined)[] = [];
  if (wallTarget === "ceiling")  candidates.push(photoUrls.ceiling, photoUrls.wide);
  else if (wallTarget === "back") candidates.push(photoUrls.back, photoUrls.wide);
  else if (wallTarget === "left") candidates.push(photoUrls.left, photoUrls.wide);
  else if (wallTarget === "right") candidates.push(photoUrls.right, photoUrls.wide);
  else if (wallTarget === "floor") candidates.push(photoUrls.floor, photoUrls.wide);
  else candidates.push(photoUrls.wide);

  return (candidates.find(Boolean) as string) || (photoUrls.wide as string);
}

// ══════════════════════════════════════════════════════════════
// fal.ai FLUX Kontext Pro
// ══════════════════════════════════════════════════════════════

async function callKontext(
  imageUrl: string,
  prompt: string,
  falApiKey: string,
  referenceImageUrls: string[] = [],
  guidanceScale = 7.0
): Promise<string> {
  const body: any = {
    image_url: imageUrl,
    prompt,
    num_images: 1,
    guidance_scale: guidanceScale,
    output_format: "png",
  };
  if (referenceImageUrls.length > 0) {
    body.images = [imageUrl, ...referenceImageUrls];
  }

  const res = await fetch("https://fal.run/fal-ai/flux-pro/kontext", {
    method: "POST",
    headers: { Authorization: `Key ${falApiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`Kontext ${res.status}: ${await res.text()}`);
  const result = await res.json();
  const url = result.images?.[0]?.url;
  if (!url) throw new Error("Kontext did not return an image URL");
  return url;
}

// ── Upload helper ──────────────────────────────────────────────────────────

async function downloadAndUpload(generatedUrl: string, storagePath: string): Promise<string> {
  const res = await fetch(generatedUrl);
  if (!res.ok) throw new Error("Failed to download generated image");
  const buf = Buffer.from(await res.arrayBuffer());

  const bucket = storage.bucket();
  const file   = bucket.file(storagePath);
  await file.save(buf, { metadata: { contentType: "image/png" } });
  await file.makePublic();
  return `https://storage.googleapis.com/${bucket.name}/${storagePath}`;
}

// ══════════════════════════════════════════════════════════════
// Callable: Generate mockup for one shade
// ══════════════════════════════════════════════════════════════

export const gsGenerateConsultMockup = onCall(
  {
    cors: true,
    timeoutSeconds: 540,
    memory: "512MiB",
    secrets: ["FAL_API_KEY"],
  },
  async (request) => {
    const { consultationId, shade } = request.data as {
      consultationId: string;
      shade: ShadeKey;
    };

    if (!consultationId || !shade) throw new HttpsError("invalid-argument", "consultationId and shade required");
    if (!["shade1", "shade2", "shade3"].includes(shade)) throw new HttpsError("invalid-argument", "shade must be shade1|shade2|shade3");

    const falApiKey = process.env.FAL_API_KEY;
    if (!falApiKey) throw new HttpsError("internal", "FAL_API_KEY not configured");

    const consultRef = db.collection(GS_COLLECTIONS.CONSULTATIONS).doc(consultationId);
    const snap       = await consultRef.get();
    if (!snap.exists) throw new HttpsError("not-found", "Consultation not found");

    const doc         = snap.data()!;
    const serviceType = doc.serviceType as ServiceType;
    const photoUrls   = doc.spacePhotoUrls || {};
    const widePhotoUrl = photoUrls.wide;

    if (!widePhotoUrl) throw new HttpsError("failed-precondition", "Wide-angle photo is required");

    // Get shade config
    const shadeData  = doc.mockups?.[shade];
    const wallColor  = {
      bmCode: shadeData?.bmCode || DEFAULT_SHADES[shade].bmCode,
      bmName: shadeData?.bmName || DEFAULT_SHADES[shade].bmName,
      hex:    shadeData?.hex    || DEFAULT_SHADES[shade].hex,
    };

    // Mark this shade as generating
    await consultRef.update({
      [`mockups.${shade}.status`]: "generating",
      updatedAt: FieldValue.serverTimestamp(),
    });

    try {
      // ── Fetch platform config in parallel ─────────────────────────────
      const [promptDoc, catalogDoc] = await Promise.all([
        db.collection(GS_COLLECTIONS.PLATFORM_CONFIG).doc("consultationPrompts").get(),
        db.collection(GS_COLLECTIONS.PLATFORM_CONFIG).doc("productCatalog").get(),
      ]);
      const customPrompts = promptDoc.exists ? promptDoc.data() : null;
      const catalog       = catalogDoc.exists ? (catalogDoc.data() || {}) : {};

      // ── Check for cached base image (products placed, no shade applied) ─
      // The base image is generated once and reused across all 3 shade calls.
      let baseImageUrl: string | undefined = doc.mockups?.base?.imageUrl;

      if (!baseImageUrl) {
        console.log(`[${consultationId}/${shade}] Building base image (Pass 1 + products)...`);

        // Pass 1: Clean + white walls
        const paintGuidance = getCleanGuidanceScale(doc);
        const paintPrompt   = customPrompts?.[serviceType]?.pass1 || buildPaintPrompt(doc);
        console.log(`[${consultationId}] Pass 1: clean (guidance ${paintGuidance})`);
        let currentUrl = await callKontext(widePhotoUrl, paintPrompt, falApiKey, [], paintGuidance);

        // Product passes: one product type per pass
        const passes = buildProductPasses(serviceType, doc, catalog);
        for (let i = 0; i < passes.length; i++) {
          const pass     = passes[i];
          const sourceUrl = selectSourcePhoto(pass.wallTarget, { ...photoUrls, wide: currentUrl });
          console.log(`[${consultationId}] Pass ${i + 2}: ${pass.label} (guidance ${pass.guidance}, angle: ${pass.wallTarget})`);
          currentUrl = await callKontext(sourceUrl, pass.prompt, falApiKey, pass.refs, pass.guidance);
        }

        // Upload base image
        const ts           = Date.now();
        const basePath     = `gs_consultation_mockups/${consultationId}/base_${ts}.png`;
        baseImageUrl       = await downloadAndUpload(currentUrl, basePath);

        // Cache base in Firestore so other shade calls skip straight to color
        await consultRef.update({
          "mockups.base": { status: "ready", imageUrl: baseImageUrl },
          updatedAt: FieldValue.serverTimestamp(),
        });

        console.log(`[${consultationId}] Base image cached`);
      } else {
        console.log(`[${consultationId}/${shade}] Using cached base image`);
      }

      // ── Shade application: color wash on the base image ───────────────
      const shadePrompt = customPrompts?.[serviceType]?.[shade]
        || buildShadePrompt(wallColor);

      console.log(`[${consultationId}/${shade}] Applying shade: ${wallColor.bmName} (${wallColor.bmCode})`);
      const shadedUrl = await callKontext(baseImageUrl, shadePrompt, falApiKey, [], 3.5);

      // Upload final shaded image
      const ts         = Date.now();
      const shadePath  = `gs_consultation_mockups/${consultationId}/${shade}_${ts}.png`;
      const finalUrl   = await downloadAndUpload(shadedUrl, shadePath);

      await consultRef.update({
        [`mockups.${shade}.status`]:   "ready",
        [`mockups.${shade}.imageUrl`]: finalUrl,
        updatedAt: FieldValue.serverTimestamp(),
      });

      // Mark overall consultation ready when all 3 shades complete
      const updated   = (await consultRef.get()).data()!;
      const allReady  = (["shade1", "shade2", "shade3"] as ShadeKey[]).every(
        (s) => updated.mockups?.[s]?.status === "ready"
      );
      if (allReady) await consultRef.update({ status: "ready" });

      console.log(`[${consultationId}/${shade}] Done`);
      return { shade, wallColor, imageUrl: finalUrl };

    } catch (err: any) {
      console.error(`[${consultationId}/${shade}] FAILED:`, err);
      await consultRef.update({
        [`mockups.${shade}.status`]: "failed",
        updatedAt: FieldValue.serverTimestamp(),
      });
      throw new HttpsError("internal", `Mockup generation failed: ${err.message}`);
    }
  }
);
