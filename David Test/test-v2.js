#!/usr/bin/env node
/**
 * Garage Scholars Mockup Test v2
 *
 * Fixes:
 *   - Overhead racks now explicitly mount to CEILING JOISTS ONLY (not garage door)
 *   - Products now match actual GS catalog:
 *       Tier 2: HD metal shelving + Greenmade bins + overhead rack
 *       Tier 3: NewAge Bold Series cabinets + overhead racks
 *
 * Usage: FAL_API_KEY=your_key node test-v2.js
 */

const fs   = require("fs");
const path = require("path");

const FAL_API_KEY = process.env.FAL_API_KEY;
if (!FAL_API_KEY) { console.error("Set FAL_API_KEY"); process.exit(1); }

const WIDE_URL = "https://storage.googleapis.com/garage-scholars-v2.firebasestorage.app/gs_consultation_photos/david_test/wide_angle.jpg";
const OUT_DIR  = path.join(__dirname, "test_v2");
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

// ── Product reference images matching actual GS catalog ──────────────────────
// Overhead rack: HD-style ceiling storage rack (black wire, drop rods)
// Shelving: 5-tier metal shelving unit (HD/Edsal style)
// Bins: Greenmade 27-gal (gray body, green lid)
// Cabinets: NewAge Bold Series (black steel)
const REFS = {
  overhead_rack: "https://i.ebayimg.com/images/g/3DkAAeSwOt5pfvBE/s-l500.jpg",
  shelving_5tier: "https://i.ebayimg.com/images/g/kSwAAeSwYVFobJMm/s-l500.jpg",
  bins_greenmade: "https://i.ebayimg.com/images/g/CasAAOSw7kRlX3Ef/s-l500.jpg",
  cabinets_newage: "https://i.ebayimg.com/images/g/CyMAAOSwNuFk0RCB/s-l500.jpg",
};

async function callKontext(imageUrl, prompt, refs = [], guidance = 7.0) {
  const body = { image_url: imageUrl, prompt, num_images: 1, guidance_scale: guidance, output_format: "png" };
  if (refs.length > 0) body.images = [imageUrl, ...refs];
  const res = await fetch("https://fal.run/fal-ai/flux-pro/kontext", {
    method: "POST",
    headers: { Authorization: `Key ${FAL_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Kontext ${res.status}: ${await res.text()}`);
  return (await res.json()).images[0].url;
}

async function save(url, name) {
  const res = await fetch(url);
  const buf = Buffer.from(await res.arrayBuffer());
  const fp  = path.join(OUT_DIR, name);
  fs.writeFileSync(fp, buf);
  console.log(`   Saved: ${name} (${(buf.length/1024).toFixed(0)}KB)`);
  return fp;
}

// ── Prompts ──────────────────────────────────────────────────────────────────

const PASS1 =
  "Transform this garage completely. Paint ALL walls and ceiling crisp bright white with a smooth, even, professional finish — no raw drywall, tape, mud, or seams visible anywhere. " +
  "Remove EVERY SINGLE item from the garage: all bikes, bicycle racks, bike hooks, couches, sofas, boxes, bins, shelving units, wall-mounted storage, overhead racks, grid panels, pegboard, tools, bags, and all clutter. " +
  "Completely empty garage — nothing on the walls, nothing hanging, nothing on the floor. " +
  "Only the bare garage structure remains: painted walls, ceiling, concrete floor, garage door, window, door to house. Bright even LED lighting. Photorealistic result.";

// Spatial anchor used in all product passes
const SPATIAL =
  "Preserve all original perspective, proportions, and lighting exactly. " +
  "Keep every item already in the garage exactly as-is — only add the new item described. " +
  "Photorealistic, brand new, professionally installed. ";

// ── OVERHEAD RACK — key fix: explicitly forbid garage door attachment ─────────
// The rack anchors ONLY to ceiling joists via steel drop rods.
// Naming the forbidden anchor points prevents the model from latching onto door tracks.
const OVERHEAD_RACK_PROMPT =
  SPATIAL +
  "Add one large overhead ceiling storage rack (approximately 8 feet wide, 4 feet deep) mounted in the CENTER of the ceiling — in the open space between the garage door and the back wall. " +
  "The rack is suspended from the ceiling ONLY by four short vertical steel rods (drop rods) bolted directly into the ceiling joists above. " +
  "The rack does NOT touch, connect to, or attach to the garage door, garage door tracks, garage door rails, any wall, or any other structure. " +
  "The rack hangs flat and level, roughly 18 inches below the ceiling, with gray wire mesh shelving surface. " +
  "Stack 6–8 large gray Greenmade storage bins (gray body, green lid) neatly on top of the rack. " +
  "Nothing else changes.";

// ── TIER 2: THE GRADUATE — shelving + bins + 1 overhead rack ─────────────────
// Products: 5-tier HD metal shelving + Greenmade 27-gal bins + overhead rack
const TIER2_SHELVING_PROMPT =
  SPATIAL +
  "Add two 5-tier gray metal shelving units (each approximately 72 inches tall, 48 inches wide) standing side by side flush against the center of the back wall. " +
  "Each unit has 5 shelves loaded with large Greenmade 27-gallon storage bins (gray body with green snap lid). " +
  "The shelves are perfectly level, evenly spaced, and the bins are neatly organized. " +
  "Nothing else changes.";

// ── TIER 3: THE DOCTORATE — NewAge Bold Series cabinets ──────────────────────
// Products: NewAge Bold Series black steel base + wall cabinets, stainless countertop
const TIER3_CABINETS_PROMPT =
  SPATIAL +
  "Add a full run of NewAge Bold Series black steel garage cabinets along the back wall: " +
  "base cabinets (36 inches tall, 18 inches deep) running the full length of the back wall, " +
  "with a continuous stainless steel countertop on top of the base cabinets, " +
  "and matching black steel wall cabinets mounted above the countertop on the back wall. " +
  "All cabinets are flush to the wall, perfectly level, with clean brushed stainless hardware. " +
  "Do NOT attach anything to the garage door, door tracks, or door rails. " +
  "Nothing else changes.";

async function main() {
  console.log("\n=== GARAGE SCHOLARS MOCKUP TEST v2 ===\n");

  // ── Pass 1: Clean ────────────────────────────────────────────────────────
  console.log("Pass 1: Cleaning + painting white (guidance 12)...");
  const p1url = await callKontext(WIDE_URL, PASS1, [], 12.0);
  await save(p1url, "pass1_clean.png");
  console.log("Pass 1 done.\n");

  // ── TIER 2: THE GRADUATE ─────────────────────────────────────────────────
  console.log("--- TIER 2: THE GRADUATE ---");

  console.log("Pass 2a: Overhead rack (guidance 7)...");
  const t2_rack_url = await callKontext(p1url, OVERHEAD_RACK_PROMPT, [REFS.overhead_rack], 7.0);
  await save(t2_rack_url, "tier2_pass2a_overhead.png");

  console.log("Pass 2b: Metal shelving + Greenmade bins (guidance 5)...");
  const t2_final_url = await callKontext(t2_rack_url, TIER2_SHELVING_PROMPT, [REFS.shelving_5tier, REFS.bins_greenmade], 5.0);
  await save(t2_final_url, "tier2_final.png");
  console.log("Tier 2 done.\n");

  // ── TIER 3: THE DOCTORATE ─────────────────────────────────────────────────
  console.log("--- TIER 3: THE DOCTORATE ---");

  console.log("Pass 2a: NewAge Bold cabinets (guidance 7)...");
  const t3_cab_url = await callKontext(p1url, TIER3_CABINETS_PROMPT, [REFS.cabinets_newage], 7.0);
  await save(t3_cab_url, "tier3_pass2a_cabinets.png");

  console.log("Pass 2b: Overhead racks above cabinets (guidance 5)...");
  const t3_rack_prompt =
    SPATIAL +
    "Add one overhead ceiling storage rack (approximately 8 feet wide, 4 feet deep) mounted in the CENTER of the ceiling in the open space above the garage floor — " +
    "suspended ONLY from ceiling joists by four short vertical steel drop rods, NOT connected to the garage door, door tracks, rails, or walls. " +
    "The rack hangs flat and level with 6 gray Greenmade bins stacked on top. Nothing else changes.";
  const t3_final_url = await callKontext(t3_cab_url, t3_rack_prompt, [REFS.overhead_rack], 5.0);
  await save(t3_final_url, "tier3_final.png");
  console.log("Tier 3 done.\n");

  console.log(`=== Complete. Check: ${OUT_DIR} ===\n`);
  process.exit(0);
}

main().catch(e => { console.error("Fatal:", e.message); process.exit(1); });
