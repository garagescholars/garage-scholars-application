"use strict";
/**
 * Garage Scholars — Consultation Mockup Generation (v2)
 *
 * Dual-mode AI mockup generation for luxury garage transformations:
 *   A) Kontext 2-Pass — Paint walls first, then add storage (iterative)
 *   B) FLUX.2 Pro Edit — Single powerful edit pass (heavier transformations)
 *
 * Uses fal.ai models:
 *   - FLUX.1 Kontext [pro]: fal-ai/flux-pro/kontext
 *   - FLUX.2 [pro] Edit:    fal-ai/flux-2-pro/edit
 *
 * Monkey Bars bike rack reference (model 01004):
 *   Gray powder-coated steel wall-mounted bar with sliding J-hooks,
 *   holds 2-4 bikes vertically. Industrial-grade, lifetime warranty.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GS_PACKAGES = exports.gsGenerateConsultMockup = void 0;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-admin/firestore");
const storage_1 = require("firebase-admin/storage");
const gs_constants_1 = require("./gs-constants");
const db = (0, firestore_1.getFirestore)();
const storage = (0, storage_1.getStorage)();
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
};
exports.GS_PACKAGES = GS_PACKAGES;
// ── Backward compatibility helpers ──
function normalizeGarageAddons(raw) {
    if (!raw)
        return { shelving: "none", overheadStorage: "none", cabinets: "none", wallOrg: "none", flooringType: "none", flooringColor: null, bikeRack: "none" };
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
            bikeRack: raw.bikeRack || "none",
        };
    }
    // Handle transitional shape with boolean `flooring` field
    if (typeof raw.flooring === "boolean") {
        return { ...raw, flooringType: raw.flooring ? "polyaspartic" : "none", bikeRack: raw.bikeRack || "none" };
    }
    return { ...raw, bikeRack: raw.bikeRack || "none" };
}
function normalizeGymAddons(raw) {
    if (!raw)
        return { flooringType: "none", flooringColor: null, rackSystem: "none", bench: "none", cableMachine: "none", accessories: [] };
    if (typeof raw.rubberFlooring === "boolean" || typeof raw.cableSystem === "boolean") {
        const accessories = [];
        if (raw.mirrorWall)
            accessories.push("mirrors");
        if (raw.pullUpRig)
            accessories.push("pull-up-rig");
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
// LUXURY PROMPT SYSTEM — Dramatic before/after transformations
// ══════════════════════════════════════════════════════════════
const LUXURY_PREAMBLE = "Professional interior design photography of a luxury garage transformation. Magazine-quality, photorealistic, bright even LED lighting, clean lines, premium materials throughout.";
const MONKEY_BARS_DESC = {
    "wall-2": "a Monkey Bars wall-mounted 2-bike storage rack — a sleek gray powder-coated steel horizontal bar with two adjustable sliding J-hooks, bikes hung vertically by their front wheels, mounted high on the wall to save floor space",
    "wall-4": "a Monkey Bars wall-mounted 4-bike storage rack — a 53-inch gray powder-coated industrial steel bar with four adjustable sliding J-hooks with rubber coating, four bikes hung vertically by their front wheels in a neat row, mounted high on the wall",
};
function buildSpaceContext(doc) {
    const parts = [];
    const size = doc.garageSize || "2-car";
    const ceiling = doc.ceilingHeight;
    let sizeStr = `${size} garage`;
    if (ceiling === "open-joists")
        sizeStr += " with exposed open joist ceilings";
    else if (ceiling === "10ft+")
        sizeStr += " with tall 10-foot ceilings";
    else if (ceiling)
        sizeStr += ` with ${ceiling} ceilings`;
    parts.push(sizeStr);
    const states = doc.currentState || [];
    if (states.includes("cluttered"))
        parts.push("currently cluttered");
    if (states.includes("cars-parked"))
        parts.push("cars may be parked");
    return parts.join(", ");
}
function getStyleText(style) {
    switch (style) {
        case "workshop": return "high-end workshop aesthetic with premium tool organization";
        case "minimalist": return "ultra-clean minimalist design with hidden storage and seamless surfaces";
        default: return "sleek modern luxury garage with magazine-quality design";
    }
}
function buildFloorInstruction(addons, _serviceType) {
    const flooringType = addons.flooringType || "none";
    if (flooringType === "none")
        return "";
    const color = addons.flooringColor;
    const colorStr = color?.name && color?.code
        ? `Benjamin Moore ${color.name} (${color.code}) `
        : color?.name
            ? `${color.name} `
            : "";
    const flooringMap = {
        "polyaspartic": `pristine ${colorStr}polyaspartic flake floor coating with a glossy showroom finish`,
        "click-in-plate": `premium ${colorStr}click-in diamond plate garage flooring tiles with a factory-fresh metallic sheen`,
        "stall-mats": `thick ${colorStr}rubber stall mat flooring (3/4" commercial grade)`,
        "rubber-tiles": `professional ${colorStr}interlocking rubber floor tiles with clean seams`,
    };
    return flooringMap[flooringType] || `${colorStr}premium flooring`;
}
function buildBikeRackInstruction(addons) {
    const rack = addons.bikeRack || "none";
    if (rack === "none")
        return "";
    return MONKEY_BARS_DESC[rack] || "";
}
// ── Paint-Only Prompt (Kontext Pass 1) ──
function buildPaintPrompt(doc) {
    const addons = normalizeGarageAddons(doc.garageAddons);
    const color = addons.flooringColor;
    // Use floor color for walls too if available, otherwise default to clean white
    const wallColor = color?.name && color?.code
        ? `Benjamin Moore ${color.name} (${color.code})`
        : "crisp bright white";
    return `Transform this garage with a complete luxury paint job. Paint ALL walls and ceiling ${wallColor} with a smooth, even, professional finish. Cover all drywall tape, mud, seams, and imperfections completely — no raw drywall showing anywhere. The walls should look freshly painted by a professional crew with clean, crisp lines. Bright, even lighting. Remove all clutter and debris from the floor. Photorealistic result.`;
}
// ── Storage/Items Prompt (Kontext Pass 2) ──
function buildStoragePrompt(tier, doc) {
    const addons = normalizeGarageAddons(doc.garageAddons);
    const items = [];
    const dream = doc.dreamDescription ? `Client vision: "${doc.dreamDescription}".` : "";
    // Bike rack
    const bikeRackDesc = buildBikeRackInstruction(addons);
    if (bikeRackDesc)
        items.push(bikeRackDesc);
    switch (tier) {
        case "tier1": {
            const overhead = addons.overheadStorage !== "none"
                ? `${addons.overheadStorage === "4-racks" ? "four" : "two"} heavy-duty white powder-coated overhead ceiling storage racks with wire mesh decking`
                : "two heavy-duty white overhead ceiling storage racks mounted flush against the ceiling joists";
            items.push(overhead);
            if (addons.shelving !== "none") {
                const count = addons.shelving === "3-units" ? "three" : addons.shelving === "2-units" ? "two" : "one";
                items.push(`${count} commercial-grade black wire shelving unit${count !== "one" ? "s" : ""} with matching clear labeled bins`);
            }
            break;
        }
        case "tier2": {
            const overhead = addons.overheadStorage !== "none"
                ? `${addons.overheadStorage === "4-racks" ? "four" : "two"} heavy-duty overhead ceiling storage racks`
                : "two heavy-duty overhead ceiling storage racks";
            items.push(overhead);
            const shelvingCount = addons.shelving === "3-units" ? "three" : addons.shelving === "2-units" ? "two" : addons.shelving === "1-unit" ? "one" : "two";
            items.push(`${shelvingCount} commercial-grade black wire shelving unit${shelvingCount !== "one" ? "s" : ""} neatly loaded with matching labeled clear plastic storage bins`);
            if (addons.wallOrg === "pegboard")
                items.push("a large pegboard tool organization wall with premium hooks and tool silhouettes");
            else if (addons.wallOrg === "slatwall")
                items.push("a commercial gray slatwall organization panel with premium hooks, baskets, and shelves");
            break;
        }
        case "tier3": {
            if (addons.cabinets === "premium-newage")
                items.push("a full run of NewAge Bold Series glossy black steel garage cabinets with stainless steel tops lining the walls");
            else if (addons.cabinets === "basic-wire")
                items.push("wall-mounted commercial wire storage cabinets with doors");
            else
                items.push("a full run of NewAge Bold Series glossy black steel garage cabinets with stainless steel countertops lining the walls");
            const overhead = addons.overheadStorage !== "none"
                ? `${addons.overheadStorage === "4-racks" ? "four" : "two"} heavy-duty overhead ceiling storage racks`
                : "four heavy-duty overhead ceiling storage racks";
            items.push(overhead);
            if (addons.wallOrg === "slatwall")
                items.push("a full-wall commercial gray slatwall organization system with premium accessories");
            else
                items.push("a large premium pegboard tool wall with custom tool silhouettes and heavy-duty hooks");
            if (addons.shelving !== "none") {
                const count = addons.shelving === "3-units" ? "three" : addons.shelving === "2-units" ? "two" : "one";
                items.push(`${count} additional commercial shelving unit${count !== "one" ? "s" : ""}`);
            }
            break;
        }
    }
    const floor = buildFloorInstruction(addons, "garage");
    const floorStr = floor ? ` The floor has been upgraded to ${floor}.` : "";
    return `Add the following premium storage systems to this garage: ${items.join("; ")}. Everything is brand new, professionally installed, perfectly level and aligned.${floorStr} ${dream} Photorealistic, match original lighting and perspective.`;
}
// ── Full Combined Prompt (for FLUX.2 Pro Edit) ──
function buildFullLuxuryPrompt(tier, doc) {
    const addons = normalizeGarageAddons(doc.garageAddons);
    const context = buildSpaceContext(doc);
    const style = getStyleText(doc.stylePreference);
    const dream = doc.dreamDescription ? ` Client vision: "${doc.dreamDescription}".` : "";
    // Wall color
    const wallColor = addons.flooringColor?.name && addons.flooringColor?.code
        ? `Benjamin Moore ${addons.flooringColor.name} (${addons.flooringColor.code})`
        : "crisp bright white";
    // Build complete item list
    const items = [];
    // Bike rack
    const bikeRackDesc = buildBikeRackInstruction(addons);
    if (bikeRackDesc)
        items.push(bikeRackDesc);
    switch (tier) {
        case "tier1": {
            const overhead = addons.overheadStorage !== "none"
                ? `${addons.overheadStorage === "4-racks" ? "four" : "two"} heavy-duty white powder-coated overhead ceiling storage racks`
                : "two heavy-duty white overhead ceiling storage racks";
            items.push(overhead);
            if (addons.shelving !== "none") {
                const count = addons.shelving === "3-units" ? "three" : addons.shelving === "2-units" ? "two" : "one";
                items.push(`${count} commercial-grade black wire shelving unit${count !== "one" ? "s" : ""} with labeled bins`);
            }
            break;
        }
        case "tier2": {
            const overhead = addons.overheadStorage !== "none"
                ? `${addons.overheadStorage === "4-racks" ? "four" : "two"} overhead ceiling storage racks`
                : "two overhead ceiling storage racks";
            items.push(overhead);
            const sc = addons.shelving === "3-units" ? "three" : addons.shelving === "2-units" ? "two" : addons.shelving === "1-unit" ? "one" : "two";
            items.push(`${sc} black wire shelving unit${sc !== "one" ? "s" : ""} with matching labeled clear bins`);
            if (addons.wallOrg === "pegboard")
                items.push("a pegboard tool organization wall");
            else if (addons.wallOrg === "slatwall")
                items.push("a slatwall organization panel with hooks and baskets");
            break;
        }
        case "tier3": {
            if (addons.cabinets === "premium-newage")
                items.push("NewAge Bold Series glossy black steel cabinets with stainless tops lining the walls");
            else if (addons.cabinets === "basic-wire")
                items.push("wall-mounted wire storage cabinets");
            else
                items.push("NewAge Bold Series glossy black steel cabinets with stainless countertops lining the walls");
            const overhead = addons.overheadStorage !== "none"
                ? `${addons.overheadStorage === "4-racks" ? "four" : "two"} overhead ceiling storage racks`
                : "four overhead ceiling storage racks";
            items.push(overhead);
            if (addons.wallOrg === "slatwall")
                items.push("a full-wall slatwall organization system");
            else
                items.push("a premium pegboard tool wall");
            if (addons.shelving !== "none") {
                const count = addons.shelving === "3-units" ? "three" : addons.shelving === "2-units" ? "two" : "one";
                items.push(`${count} additional shelving unit${count !== "one" ? "s" : ""}`);
            }
            break;
        }
    }
    const floor = buildFloorInstruction(addons, "garage");
    const floorStr = floor ? `Replace the entire floor with ${floor}.` : "";
    return `${LUXURY_PREAMBLE} Complete transformation of this ${context}. Paint ALL walls and ceiling ${wallColor} — smooth, even, professional finish, no raw drywall, tape, or mud visible. ${floorStr} Install: ${items.join("; ")}. All items brand new, professionally installed, perfectly aligned. ${style}. Remove all clutter, debris, and mess — this is a showroom-ready luxury garage.${dream} Photorealistic, preserve the exact garage geometry, perspective, and proportions.`;
}
// ── Gym prompts (luxury version) ──
function buildGymInstallPrompt(tier, doc) {
    const addons = normalizeGymAddons(doc.gymAddons);
    const context = buildSpaceContext(doc);
    const style = getStyleText(doc.stylePreference);
    const dream = doc.dreamDescription ? ` Client vision: "${doc.dreamDescription}".` : "";
    const items = [];
    const rackMap = {
        "wall-mount": "a premium wall-mounted pull-up bar and dumbbell rack system",
        "half-rack": "a commercial-grade half squat rack with Olympic barbell and bumper plates",
        "full-power-cage": "a full power cage/squat rack with Olympic barbell, competition plates, and safety bars",
    };
    const benchMap = {
        "flat": "a commercial flat weight bench",
        "adjustable-fid": "a premium adjustable FID weight bench",
    };
    const cableMap = {
        "single-stack": "a commercial single-stack cable machine",
        "functional-trainer": "a premium functional trainer with dual adjustable pulleys",
        "crossover": "a full cable crossover machine",
    };
    switch (tier) {
        case "tier1": {
            if (addons.flooringType && addons.flooringType !== "none") {
                items.push(addons.flooringType === "stall-mats" ? "thick rubber stall mat flooring wall-to-wall" : "interlocking rubber floor tiles wall-to-wall");
            }
            items.push(rackMap[addons.rackSystem] || "a wall-mounted dumbbell rack with adjustable dumbbells (5-50 lbs) and a fold-flat wall-mounted pull-up bar");
            break;
        }
        case "tier2": {
            items.push(rackMap[addons.rackSystem] || "a full power cage/squat rack with barbell and plates");
            if (addons.bench !== "none")
                items.push(benchMap[addons.bench] || "a premium adjustable FID bench");
            else
                items.push("a premium adjustable FID bench");
            if (addons.cableMachine !== "none")
                items.push(cableMap[addons.cableMachine] || "a cable machine");
            else
                items.push("a cable machine in the corner");
            items.push("a wall-mounted dumbbell rack");
            break;
        }
        case "tier3": {
            items.push(rackMap[addons.rackSystem] || "a full power rack system with Olympic barbell and competition plates");
            items.push(cableMap[addons.cableMachine] || "a cable crossover machine");
            items.push("a commercial dumbbell rack (5-100 lbs)");
            if (addons.bench !== "none")
                items.push(benchMap[addons.bench] || "a premium adjustable FID bench");
            const acc = addons.accessories || [];
            if (acc.includes("pull-up-rig"))
                items.push("a freestanding pull-up/muscle-up rig");
            if (acc.includes("mirrors"))
                items.push("full-length mirrors across the back wall");
            if (acc.includes("kettlebells"))
                items.push("a kettlebell set on a storage rack");
            break;
        }
    }
    const floor = buildFloorInstruction(addons, "gym");
    const floorStr = floor ? `Replace the floor with ${floor}.` : "";
    return `${LUXURY_PREAMBLE} Complete transformation of this ${context} into a premium home gym. ${floorStr} Install: ${items.join("; ")}. ${style} home gym with professional lighting. All equipment brand new, premium quality, perfectly positioned. Remove all clutter.${dream} Photorealistic, preserve garage geometry and perspective.`;
}
// ══════════════════════════════════════════════════════════════
// fal.ai API Callers
// ══════════════════════════════════════════════════════════════
async function callKontext(imageUrl, prompt, falApiKey) {
    const response = await fetch("https://fal.run/fal-ai/flux-pro/kontext", {
        method: "POST",
        headers: {
            Authorization: `Key ${falApiKey}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            image_url: imageUrl,
            prompt,
            num_images: 1,
            guidance_scale: 7.0, // Higher than default 3.5 for more dramatic edits
            output_format: "png",
        }),
    });
    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Kontext returned ${response.status}: ${errText}`);
    }
    const result = await response.json();
    const url = result.images?.[0]?.url;
    if (!url)
        throw new Error("Kontext did not return an image URL");
    return url;
}
async function callFlux2Edit(imageUrl, prompt, falApiKey) {
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
    if (!url)
        throw new Error("FLUX.2 Edit did not return an image URL");
    return url;
}
async function callClassicFill(imageUrl, prompt, falApiKey) {
    const response = await fetch("https://fal.run/fal-ai/flux-pro/v1/fill", {
        method: "POST",
        headers: {
            Authorization: `Key ${falApiKey}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            image_url: imageUrl,
            prompt,
            num_images: 1,
        }),
    });
    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`FLUX Fill returned ${response.status}: ${errText}`);
    }
    const result = await response.json();
    const url = result.images?.[0]?.url;
    if (!url)
        throw new Error("FLUX Fill did not return an image URL");
    return url;
}
// ── Upload helper ──
async function downloadAndUpload(generatedUrl, storagePath) {
    const imageResponse = await fetch(generatedUrl);
    if (!imageResponse.ok)
        throw new Error("Failed to download generated image");
    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
    const bucket = storage.bucket();
    const file = bucket.file(storagePath);
    await file.save(imageBuffer, { metadata: { contentType: "image/png" } });
    await file.makePublic();
    return `https://storage.googleapis.com/${bucket.name}/${storagePath}`;
}
// ══════════════════════════════════════════════════════════════
// Callable: Generate a single consultation mockup via fal.ai
// ══════════════════════════════════════════════════════════════
exports.gsGenerateConsultMockup = (0, https_1.onCall)({
    cors: true,
    timeoutSeconds: 300,
    memory: "512MiB",
    secrets: ["FAL_API_KEY"],
}, async (request) => {
    const { consultationId, tier, mode } = request.data;
    if (!consultationId || !tier) {
        throw new https_1.HttpsError("invalid-argument", "consultationId and tier are required");
    }
    if (!["tier1", "tier2", "tier3"].includes(tier)) {
        throw new https_1.HttpsError("invalid-argument", "tier must be tier1, tier2, or tier3");
    }
    const genMode = mode || "classic";
    const falApiKey = process.env.FAL_API_KEY;
    if (!falApiKey)
        throw new https_1.HttpsError("internal", "FAL_API_KEY not configured");
    const consultRef = db.collection(gs_constants_1.GS_COLLECTIONS.CONSULTATIONS).doc(consultationId);
    const snap = await consultRef.get();
    if (!snap.exists) {
        throw new https_1.HttpsError("not-found", "Consultation not found");
    }
    const doc = snap.data();
    const serviceType = doc.serviceType;
    const widePhotoUrl = doc.spacePhotoUrls?.wide;
    if (!widePhotoUrl) {
        throw new https_1.HttpsError("failed-precondition", "Wide-angle photo is required");
    }
    // Determine status/url field paths based on mode
    const isKontext = genMode === "kontext-2pass";
    const isFlux2 = genMode === "flux2-edit";
    const statusField = isKontext
        ? `mockups.${tier}.kontextStatus`
        : isFlux2
            ? `mockups.${tier}.flux2Status`
            : `mockups.${tier}.status`;
    const urlField = isKontext
        ? `mockups.${tier}.kontextUrl`
        : isFlux2
            ? `mockups.${tier}.flux2Url`
            : `mockups.${tier}.imageUrl`;
    // Mark as generating
    await consultRef.update({
        [statusField]: "generating",
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
    });
    try {
        // Check for custom prompts in platformConfig
        const promptDoc = await db
            .collection(gs_constants_1.GS_COLLECTIONS.PLATFORM_CONFIG)
            .doc("consultationPrompts")
            .get();
        const customPrompts = promptDoc.exists ? promptDoc.data() : null;
        let generatedUrl;
        const timestamp = Date.now();
        const modeSuffix = genMode === "classic" ? "" : `_${genMode.replace("-", "")}`;
        if (genMode === "kontext-2pass") {
            // ═══ OPTION A: Kontext 2-Pass (Paint → Storage) ═══
            console.log(`[Mockup ${consultationId}/${tier}/kontext] Starting 2-pass generation...`);
            // Pass 1: Paint walls + ceiling + clean up
            const paintPrompt = customPrompts?.[serviceType]?.[`${tier}_paint`]
                || buildPaintPrompt(doc);
            console.log(`[Kontext Pass 1] Paint prompt: ${paintPrompt}`);
            const paintedUrl = await callKontext(widePhotoUrl, paintPrompt, falApiKey);
            console.log(`[Kontext Pass 1] Done — painted image ready`);
            // Pass 2: Add storage systems to the painted garage
            let storagePrompt;
            if (serviceType === "gym_install") {
                storagePrompt = customPrompts?.[serviceType]?.[`${tier}_storage`]
                    || buildGymInstallPrompt(tier, doc);
            }
            else {
                storagePrompt = customPrompts?.[serviceType]?.[`${tier}_storage`]
                    || buildStoragePrompt(tier, doc);
            }
            console.log(`[Kontext Pass 2] Storage prompt: ${storagePrompt}`);
            generatedUrl = await callKontext(paintedUrl, storagePrompt, falApiKey);
            console.log(`[Kontext Pass 2] Done — final image ready`);
        }
        else if (genMode === "flux2-edit") {
            // ═══ OPTION B: FLUX.2 Pro Edit (Single powerful pass) ═══
            let prompt;
            if (customPrompts?.[serviceType]?.[tier]) {
                prompt = customPrompts[serviceType][tier];
            }
            else if (serviceType === "gym_install") {
                prompt = buildGymInstallPrompt(tier, doc);
            }
            else {
                prompt = buildFullLuxuryPrompt(tier, doc);
            }
            console.log(`[Mockup ${consultationId}/${tier}/flux2] Prompt: ${prompt}`);
            generatedUrl = await callFlux2Edit(widePhotoUrl, prompt, falApiKey);
            console.log(`[FLUX.2 Edit] Done — image ready`);
        }
        else {
            // ═══ Classic FLUX.1 Fill (original behavior) ═══
            let prompt;
            if (customPrompts?.[serviceType]?.[tier]) {
                prompt = customPrompts[serviceType][tier];
            }
            else if (serviceType === "gym_install") {
                prompt = buildGymInstallPrompt(tier, doc);
            }
            else {
                prompt = buildFullLuxuryPrompt(tier, doc);
            }
            console.log(`[Mockup ${consultationId}/${tier}/classic] Prompt: ${prompt}`);
            generatedUrl = await callClassicFill(widePhotoUrl, prompt, falApiKey);
        }
        // Upload to Firebase Storage
        const storagePath = `gs_consultation_mockups/${consultationId}/${tier}${modeSuffix}_${timestamp}.png`;
        const imageUrl = await downloadAndUpload(generatedUrl, storagePath);
        // Update Firestore
        await consultRef.update({
            [statusField]: "ready",
            [urlField]: imageUrl,
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        });
        // Check if all tiers are done for this mode — if so, mark consultation as ready
        const updatedSnap = await consultRef.get();
        const updatedDoc = updatedSnap.data();
        if (genMode === "classic") {
            const allReady = ["tier1", "tier2", "tier3"].every((t) => updatedDoc.mockups?.[t]?.status === "ready");
            if (allReady)
                await consultRef.update({ status: "ready" });
        }
        return { tier, mode: genMode, imageUrl };
    }
    catch (err) {
        console.error(`Mockup generation failed for ${consultationId}/${tier}/${genMode}:`, err);
        await consultRef.update({
            [statusField]: "failed",
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        });
        throw new https_1.HttpsError("internal", `Mockup generation failed (${genMode}): ${err.message}`);
    }
});
