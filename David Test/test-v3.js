#!/usr/bin/env node
/**
 * Garage Scholars Mockup Test v3
 *
 * 3 distinct layout options, all sharing the same clean Pass 1 base.
 *
 * OPTION A — The Organizer (shelving + bins + bike rack on right wall)
 * OPTION B — The Workshop (NewAge cabinets + bike rack on left + overhead above door)
 * OPTION C — The Maximizer (cabinets + slatwall + bike rack + overhead above door)
 *
 * Fixes from v2:
 *   - Cabinets start AFTER interior door on the left — no floating edge
 *   - Overhead rack above garage door uses the dead space over the door header
 *   - Bike rack explicitly on right wall or left wall (not floating)
 *   - Garage door rails treated as forbidden anchor points in all prompts
 *
 * Usage: FAL_API_KEY=your_key node test-v3.js
 */

const fs   = require("fs");
const path = require("path");

const FAL_API_KEY = process.env.FAL_API_KEY;
if (!FAL_API_KEY) { console.error("Set FAL_API_KEY"); process.exit(1); }

const WIDE_URL = "https://storage.googleapis.com/garage-scholars-v2.firebasestorage.app/gs_consultation_photos/david_test/wide_angle.jpg";
const OUT_DIR  = path.join(__dirname, "test_v3");
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const REFS = {
  overhead_rack:   "https://i.ebayimg.com/images/g/3DkAAeSwOt5pfvBE/s-l500.jpg",
  shelving_5tier:  "https://i.ebayimg.com/images/g/kSwAAeSwYVFobJMm/s-l500.jpg",
  bins_greenmade:  "https://i.ebayimg.com/images/g/CasAAOSw7kRlX3Ef/s-l500.jpg",
  cabinets_newage: "https://i.ebayimg.com/images/g/CyMAAOSwNuFk0RCB/s-l500.jpg",
  bike_rack:       "https://i.ebayimg.com/images/g/RykAAeSwK1pok4r0/s-l500.jpg",
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

// ── Pass 1 ────────────────────────────────────────────────────────────────────
const PASS1 =
  "Transform this garage completely. Paint ALL walls and ceiling crisp bright white with a smooth, even, professional finish — no raw drywall, tape, mud, or seams visible anywhere. " +
  "Remove EVERY SINGLE item from the garage: all bikes, bicycle racks, bike hooks, couches, sofas, boxes, bins, shelving units, wall-mounted storage, overhead racks, grid panels, pegboard, tools, bags, and all clutter. " +
  "Completely empty garage — nothing on the walls, nothing hanging, nothing on the floor. " +
  "Only the bare garage structure remains: painted walls, ceiling, concrete floor, garage door, window, interior door on the left wall. Bright even LED lighting. Photorealistic result.";

// Spatial anchor reused in all product passes
const S = "Preserve all original perspective, proportions, and lighting exactly. Keep every item already in the garage exactly as-is — only add the new item described. Photorealistic, brand new, professionally installed. ";

// ── Shared: small overhead rack above the garage door header ─────────────────
// The dead space between the top of the garage door and the ceiling is real
// usable space — a narrow rack mounts to the framing above the door header.
const OVERHEAD_ABOVE_DOOR =
  S +
  "Add one narrow overhead ceiling storage rack (approximately 8 feet wide, 18 inches deep) mounted flush against the ceiling in the space directly above the garage door — " +
  "this is the narrow zone between the top of the garage door and the ceiling. " +
  "The rack is suspended from the ceiling framing by four short vertical steel drop rods. " +
  "It does NOT touch, rest on, or connect to the garage door itself, the door tracks, or the door opener motor rail. " +
  "Stack 4–5 flat storage bins on top of the rack. Nothing else changes.";

// ── Shared: bike rack on right wall ──────────────────────────────────────────
const BIKE_RACK_RIGHT =
  S +
  "Add a wall-mounted horizontal bike storage bar on the RIGHT SIDE WALL — a gray powder-coated steel bar with four J-hooks, mounted high on the right wall about 5 feet up, with two bikes hanging vertically by their front wheels from the hooks. " +
  "The bar is bolted directly into the right wall studs — NOT touching the garage door tracks, ceiling, or floor. Nothing else changes.";

// ── Shared: bike rack on back wall left side ──────────────────────────────────
const BIKE_RACK_BACK_LEFT =
  S +
  "Add a wall-mounted horizontal bike storage bar on the LEFT SIDE of the back wall — a gray powder-coated steel bar with two J-hooks, mounted high on the back wall about 5 feet up, with two bikes hanging vertically by their front wheels. " +
  "The bar is bolted into the back wall studs. Nothing else changes.";

// ── OPTION A: The Organizer ───────────────────────────────────────────────────
// Overhead above door + shelving units on back wall + bike rack right wall
const OPTION_A_SHELVING =
  S +
  "Add two 5-tier gray steel shelving units (each 72 inches tall, 48 inches wide) standing side by side flush against the CENTER of the back wall. " +
  "Each unit has 5 shelves fully loaded with Greenmade 27-gallon storage bins (gray body, green snap lid). " +
  "The shelving units do not block the back wall window. Nothing else changes.";

// ── OPTION B: The Workshop ────────────────────────────────────────────────────
// NewAge Bold cabinets on back wall (starting AFTER interior door) + bike rack left
// Key fix: explicitly start cabinets to the right of the interior door
const OPTION_B_CABINETS =
  S +
  "Add NewAge Bold Series black steel garage cabinets along the back wall only: " +
  "base cabinets (36 inches tall, 18 inches deep) running the full length of the back wall with a continuous stainless steel countertop, " +
  "and matching black steel wall cabinets mounted above the countertop on the back wall. " +
  "The cabinets run wall-to-wall across the back, flush and level. " +
  "Do NOT place any cabinets on the left wall — only the back wall. " +
  "Do NOT block or cover the interior door on the left wall. " +
  "Do NOT attach anything to the garage door, door tracks, or door rails. Nothing else changes.";

// ── OPTION C: The Maximizer ───────────────────────────────────────────────────
// Cabinets back wall + slatwall left wall + bike rack integrated
const OPTION_C_CABINETS =
  S +
  "Add NewAge Bold Series black steel garage cabinets along the back wall: " +
  "base cabinets (36 inches tall) running the full length of the back wall with a stainless steel countertop, " +
  "and matching wall cabinets mounted above on the back wall. " +
  "The cabinets run wall-to-wall on the back wall only — do NOT extend onto the left wall or block the interior door. " +
  "Do NOT attach anything to the garage door, door tracks, or rails. Nothing else changes.";

const OPTION_C_SLATWALL =
  S +
  "Add a full commercial gray slatwall panel system covering the RIGHT SIDE WALL from floor to ceiling. " +
  "Mount premium slatwall hooks, wire baskets, and small shelves on the slatwall to organize tools, sports equipment, and accessories. " +
  "The slatwall is flush against the right wall only — do not extend it to other walls. Nothing else changes.";

async function main() {
  console.log("\n=== GARAGE SCHOLARS MOCKUP TEST v3 — 3 LAYOUT OPTIONS ===\n");

  // ── Pass 1: Clean ────────────────────────────────────────────────────────
  console.log("Pass 1: Cleaning + painting white (guidance 12)...");
  const p1url = await callKontext(WIDE_URL, PASS1, [], 12.0);
  await save(p1url, "pass1_clean.png");
  console.log("Pass 1 done.\n");

  // ════════════════════════════════════════
  // OPTION A: THE ORGANIZER
  // Overhead above door → Shelving back wall → Bike rack right wall
  // ════════════════════════════════════════
  console.log("--- OPTION A: THE ORGANIZER ---");

  console.log("A1: Small overhead rack above garage door...");
  const a1url = await callKontext(p1url, OVERHEAD_ABOVE_DOOR, [REFS.overhead_rack], 7.0);
  await save(a1url, "optionA_1_overhead_above_door.png");

  console.log("A2: Shelving units on back wall...");
  const a2url = await callKontext(a1url, OPTION_A_SHELVING, [REFS.shelving_5tier, REFS.bins_greenmade], 5.0);
  await save(a2url, "optionA_2_shelving.png");

  console.log("A3: Bike rack on right wall...");
  const a3url = await callKontext(a2url, BIKE_RACK_RIGHT, [REFS.bike_rack], 5.0);
  await save(a3url, "optionA_final.png");
  console.log("Option A done.\n");

  // ════════════════════════════════════════
  // OPTION B: THE WORKSHOP
  // NewAge cabinets back wall → Overhead above door → Bike rack back wall left
  // ════════════════════════════════════════
  console.log("--- OPTION B: THE WORKSHOP ---");

  console.log("B1: NewAge Bold cabinets on back wall only...");
  const b1url = await callKontext(p1url, OPTION_B_CABINETS, [REFS.cabinets_newage], 7.0);
  await save(b1url, "optionB_1_cabinets.png");

  console.log("B2: Overhead rack above garage door...");
  const b2url = await callKontext(b1url, OVERHEAD_ABOVE_DOOR, [REFS.overhead_rack], 5.0);
  await save(b2url, "optionB_2_overhead.png");

  console.log("B3: Bike rack on back wall left side...");
  const b3url = await callKontext(b2url, BIKE_RACK_BACK_LEFT, [REFS.bike_rack], 5.0);
  await save(b3url, "optionB_final.png");
  console.log("Option B done.\n");

  // ════════════════════════════════════════
  // OPTION C: THE MAXIMIZER
  // NewAge cabinets back wall → Slatwall right wall → Overhead above door → Bike rack on slatwall
  // ════════════════════════════════════════
  console.log("--- OPTION C: THE MAXIMIZER ---");

  console.log("C1: NewAge Bold cabinets on back wall...");
  const c1url = await callKontext(p1url, OPTION_C_CABINETS, [REFS.cabinets_newage], 7.0);
  await save(c1url, "optionC_1_cabinets.png");

  console.log("C2: Slatwall on right wall...");
  const c2url = await callKontext(c1url, OPTION_C_SLATWALL, [], 5.0);
  await save(c2url, "optionC_2_slatwall.png");

  console.log("C3: Overhead rack above garage door...");
  const c3url = await callKontext(c2url, OVERHEAD_ABOVE_DOOR, [REFS.overhead_rack], 5.0);
  await save(c3url, "optionC_3_overhead.png");

  console.log("C4: Bike rack on right wall (on slatwall)...");
  const c4url = await callKontext(c3url, BIKE_RACK_RIGHT, [REFS.bike_rack], 5.0);
  await save(c4url, "optionC_final.png");
  console.log("Option C done.\n");

  console.log(`=== Complete. Check: ${OUT_DIR} ===\n`);
  process.exit(0);
}

main().catch(e => { console.error("Fatal:", e.message); process.exit(1); });
