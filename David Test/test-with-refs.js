#!/usr/bin/env node
/**
 * Reference Image Test — Multi-Image Kontext Pipeline
 *
 * Tests the new product reference approach against David's garage photo.
 *
 * How it works:
 *   Pass 1: Clean garage + paint walls white (no product refs — clean scene only)
 *   Pass 2: Add storage WITH actual product photos as reference images
 *
 * The model receives the cleaned garage + product photos and composites
 * the real product visuals into the scene rather than hallucinating from text.
 *
 * Usage:
 *   FAL_API_KEY=your_key node test-with-refs.js
 *
 * To populate PRODUCT_REFS: find clean studio/product photos from manufacturer sites.
 *   - Monkey Bars: monkeybarstorage.com (product images)
 *   - Overhead racks: safracks.com or fleximounts.com (product photos)
 *   - NewAge Bold: newageindustrial.com/garage-cabinets
 *   - Slatwall: costco.com or rubbermaidproducts.com
 * Paste direct image URLs (HTTPS, publicly accessible JPEG or PNG) below.
 */

const fs = require("fs");
const path = require("path");

const FAL_API_KEY = process.env.FAL_API_KEY;
if (!FAL_API_KEY) { console.error("Set FAL_API_KEY env var"); process.exit(1); }

const WIDE_URL = "https://storage.googleapis.com/garage-scholars-v2.firebasestorage.app/gs_consultation_photos/david_test/wide_angle.jpg";
const OUT_DIR  = path.join(__dirname, "test_with_refs");

// ── Product Reference Image URLs ──────────────────────────────────────────
// Replace empty strings with actual product photo URLs.
// Leave empty ("") to skip — the test will still run without refs for that tier.
//
// IMPORTANT: URLs must be direct links to publicly accessible JPEG/PNG images.
// No login-gated images, no CDN that blocks hotlinking.
const PRODUCT_REFS = {
  overhead_2rack:     "https://i.ebayimg.com/images/g/3DkAAeSwOt5pfvBE/s-l500.jpg",   // Fleximounts 4x8 overhead rack
  overhead_4rack:     "https://i.ebayimg.com/images/g/3DkAAeSwOt5pfvBE/s-l500.jpg",   // Fleximounts 4x8 overhead rack
  bikerack_wall2:     "https://i.ebayimg.com/images/g/fi8AAOSwVAVmL-Q-/s-l500.jpg",   // Monkey Bars 3-bike vertical rack
  bikerack_wall4:     "https://i.ebayimg.com/images/g/RykAAeSwK1pok4r0/s-l500.jpg",   // Monkey Bars 4-bike wall rack (gray)
  shelving_wire_unit: "https://i.ebayimg.com/images/g/kSwAAeSwYVFobJMm/s-l500.jpg",   // STANI 4-Tier metal wire shelving
  cabinets_newage:    "https://i.ebayimg.com/images/g/CyMAAOSwNuFk0RCB/s-l500.jpg",   // NewAge Bold Series black cabinet
  wallorg_slatwall:   "",  // No clean image found yet
  wallorg_pegboard:   "",  // No clean image found yet
};
// ─────────────────────────────────────────────────────────────────────────

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

// ── fal.ai callers ────────────────────────────────────────────────────────

async function callKontext(imageUrl, prompt, referenceImageUrls = [], guidance = 7.0) {
  const body = {
    image_url: imageUrl,
    prompt,
    num_images: 1,
    guidance_scale: guidance,
    output_format: "png",
  };
  if (referenceImageUrls.length > 0) {
    body.images = [imageUrl, ...referenceImageUrls];
  }

  const res = await fetch("https://fal.run/fal-ai/flux-pro/kontext", {
    method: "POST",
    headers: { Authorization: `Key ${FAL_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Kontext ${res.status}: ${await res.text()}`);
  return (await res.json()).images[0].url;
}

async function saveImage(url, filename) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Download failed");
  const buf = Buffer.from(await res.arrayBuffer());
  const filepath = path.join(OUT_DIR, filename);
  fs.writeFileSync(filepath, buf);
  console.log(`      Saved: ${filename} (${(buf.length / 1024).toFixed(0)}KB)`);
  return filepath;
}

// ── Prompt builders ───────────────────────────────────────────────────────

// Pass 1 — Aggressive cleanup + paint
// High guidance (12.0) forces the model to fully commit to removing everything.
// Explicitly names every item category so the model can't leave anything behind.
const PAINT_PROMPT =
  "Transform this garage completely. Paint ALL walls and ceiling crisp bright white with a smooth, even, professional finish — no raw drywall, tape, mud, or seams visible anywhere. Remove EVERY SINGLE item from the garage: all bikes, bicycle racks, bike hooks, couch, sofa, boxes, bins, shelving units, wall-mounted storage, overhead racks, grid panels, tools, bags, and all clutter. Completely empty garage — nothing on the walls, nothing hanging, nothing on the floor. Only the bare garage structure remains: painted walls, ceiling, concrete floor, garage door, window, door to house. Bright even LED lighting. Photorealistic result.";

// Shared spatial preamble to orient the model before placing objects
const SPATIAL_PREAMBLE = "This is an empty painted garage. The concrete floor is flat and completely clear. The back wall runs straight across, right wall is on the right side, ceiling joists run front-to-back overhead. Preserve all original perspective, proportions, and lighting exactly. ";

const STORAGE_PROMPTS = {
  // Garage org — tier 2 (bikes + overhead + shelving)
  garage_tier2_text_only:
    SPATIAL_PREAMBLE +
    "Install the following premium storage — photorealistic, brand new, perfectly level and aligned: " +
    "1) Two large white powder-coated overhead ceiling storage racks (each 4ft x 8ft) mounted flat against the ceiling joists in the center of the garage, loaded with plastic storage bins. " +
    "2) One Monkey Bars wall-mounted 4-bike horizontal storage bar mounted high on the right wall — a gray powder-coated steel bar with four J-hooks holding four bikes vertically by their front wheels, bikes hanging off the floor. " +
    "3) Two tall black wire shelving units standing against the back wall, each loaded with neat rows of labeled clear storage bins.",

  garage_tier2_with_refs:
    "Reference product images are provided — use them as the visual template for exact product appearance (color, finish, form). " +
    SPATIAL_PREAMBLE +
    "Install the following premium storage — photorealistic, brand new, perfectly level and aligned: " +
    "1) Two large white powder-coated overhead ceiling storage racks (each 4ft x 8ft) mounted flat against the ceiling joists in the center of the garage, loaded with plastic storage bins. " +
    "2) One Monkey Bars wall-mounted 4-bike horizontal storage bar mounted high on the right wall — a gray powder-coated steel bar with four J-hooks holding four bikes vertically by their front wheels, bikes hanging off the floor. " +
    "3) Two tall black wire shelving units standing against the back wall, each loaded with neat rows of labeled clear storage bins.",

  // Garage org — tier 3 (cabinets + overhead + slatwall)
  garage_tier3_text_only:
    SPATIAL_PREAMBLE +
    "Install the following premium storage — photorealistic, brand new, perfectly level and aligned: " +
    "1) A full continuous run of NewAge Bold Series glossy black steel garage cabinets with stainless steel countertops — base cabinets (36 inches tall) running the entire length of the back wall and wrapping down the right wall, with upper wall cabinets above them. " +
    "2) Four large white overhead ceiling storage racks mounted flat against the ceiling joists, loaded with bins. " +
    "3) A full-wall commercial gray slatwall panel system on the left wall with premium hooks, wire baskets, and small shelves.",

  garage_tier3_with_refs:
    "Reference product images are provided — use them as the visual template for exact product appearance (color, finish, form). " +
    SPATIAL_PREAMBLE +
    "Install the following premium storage — photorealistic, brand new, perfectly level and aligned: " +
    "1) A full continuous run of NewAge Bold Series glossy black steel garage cabinets with stainless steel countertops — base cabinets (36 inches tall) running the entire length of the back wall and wrapping down the right wall, with upper wall cabinets above them. " +
    "2) Four large white overhead ceiling storage racks mounted flat against the ceiling joists, loaded with bins. " +
    "3) A full-wall commercial gray slatwall panel system on the left wall with premium hooks, wire baskets, and small shelves.",
};

// ── Test runner ───────────────────────────────────────────────────────────

async function runTest(label, baseImageUrl, storagePrompt, productRefs = []) {
  const refCount = productRefs.length;
  console.log(`\n   [${label}]${refCount > 0 ? ` (${refCount} product ref${refCount > 1 ? "s" : ""})` : " (text-only)"}`);

  console.log("      Pass 1: Cleaning + painting walls (guidance 12)...");
  const paintedUrl = await callKontext(baseImageUrl, PAINT_PROMPT, [], 12.0);
  await saveImage(paintedUrl, `${label}_step1_painted.png`);

  console.log(`      Pass 2: Adding storage${refCount > 0 ? " with product refs" : " (text only)"} (guidance 7)...`);
  const finalUrl = await callKontext(paintedUrl, storagePrompt, productRefs, 7.0);
  await saveImage(finalUrl, `${label}_step2_final.png`);

  console.log(`      Done.`);
}

async function main() {
  console.log("\n=== REFERENCE IMAGE TEST — David Garage ===\n");

  // Collect available product refs
  const tier2Refs  = [PRODUCT_REFS.overhead_2rack, PRODUCT_REFS.bikerack_wall4, PRODUCT_REFS.shelving_wire_unit].filter(Boolean);
  const tier3Refs  = [PRODUCT_REFS.cabinets_newage, PRODUCT_REFS.overhead_4rack, PRODUCT_REFS.wallorg_slatwall].filter(Boolean);

  console.log(`Product refs available: tier2=${tier2Refs.length}/3, tier3=${tier3Refs.length}/3`);
  if (tier2Refs.length === 0 && tier3Refs.length === 0) {
    console.log("\nNo product refs set — running text-only control tests.\nFill in PRODUCT_REFS at the top of this script to run the comparison.\n");
  }

  // Always run text-only controls (baseline comparison)
  await runTest("tier2_A_text_only", WIDE_URL, STORAGE_PROMPTS.garage_tier2_text_only, []);
  await runTest("tier3_A_text_only", WIDE_URL, STORAGE_PROMPTS.garage_tier3_text_only, []);

  // Run with refs if any are available
  if (tier2Refs.length > 0) {
    await runTest("tier2_B_with_refs", WIDE_URL, STORAGE_PROMPTS.garage_tier2_with_refs, tier2Refs);
  }
  if (tier3Refs.length > 0) {
    await runTest("tier3_B_with_refs", WIDE_URL, STORAGE_PROMPTS.garage_tier3_with_refs, tier3Refs);
  }

  console.log(`\n=== Complete. Outputs in: ${OUT_DIR} ===\n`);
  console.log("Compare *_A_text_only vs *_B_with_refs — objects should look more realistic in B.\n");
  process.exit(0);
}

main().catch(e => { console.error("Fatal:", e.message); process.exit(1); });
