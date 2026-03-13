#!/usr/bin/env node
/**
 * test-v3-bc.js — Options B and C only (with retry logic)
 * Run after Option A already completed in test-v3.js
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
  cabinets_newage: "https://i.ebayimg.com/images/g/CyMAAOSwNuFk0RCB/s-l500.jpg",
  bike_rack:       "https://i.ebayimg.com/images/g/RykAAeSwK1pok4r0/s-l500.jpg",
};

async function callKontext(imageUrl, prompt, refs = [], guidance = 7.0, retries = 3) {
  const body = { image_url: imageUrl, prompt, num_images: 1, guidance_scale: guidance, output_format: "png" };
  if (refs.length > 0) body.images = [imageUrl, ...refs];
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch("https://fal.run/fal-ai/flux-pro/kontext", {
        method: "POST",
        headers: { Authorization: `Key ${FAL_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const text = await res.text();
        if (res.status === 500 && attempt < retries) {
          console.log(`   Retry ${attempt}/${retries} after 500...`);
          await new Promise(r => setTimeout(r, 5000 * attempt));
          continue;
        }
        throw new Error(`Kontext ${res.status}: ${text}`);
      }
      return (await res.json()).images[0].url;
    } catch (e) {
      if (attempt === retries) throw e;
      console.log(`   Retry ${attempt}/${retries} after error: ${e.message}`);
      await new Promise(r => setTimeout(r, 5000 * attempt));
    }
  }
}

async function save(url, name) {
  const res = await fetch(url);
  const buf = Buffer.from(await res.arrayBuffer());
  const fp  = path.join(OUT_DIR, name);
  fs.writeFileSync(fp, buf);
  console.log(`   Saved: ${name} (${(buf.length/1024).toFixed(0)}KB)`);
  return fp;
}

const S = "Preserve all original perspective, proportions, and lighting exactly. Keep every item already in the garage exactly as-is — only add the new item described. Photorealistic, brand new, professionally installed. ";

const PASS1 =
  "Transform this garage completely. Paint ALL walls and ceiling crisp bright white with a smooth, even, professional finish — no raw drywall, tape, mud, or seams visible anywhere. " +
  "Remove EVERY SINGLE item from the garage: all bikes, bicycle racks, bike hooks, couches, sofas, boxes, bins, shelving units, wall-mounted storage, overhead racks, grid panels, pegboard, tools, bags, and all clutter. " +
  "Completely empty garage — nothing on the walls, nothing hanging, nothing on the floor. " +
  "Only the bare garage structure remains: painted walls, ceiling, concrete floor, garage door, window, interior door on the left wall. Bright even LED lighting. Photorealistic result.";

const OVERHEAD_ABOVE_DOOR =
  S +
  "Add one narrow overhead ceiling storage rack (approximately 8 feet wide, 18 inches deep) mounted flush against the ceiling in the space directly above the garage door — " +
  "this is the narrow zone between the top of the garage door and the ceiling. " +
  "The rack is suspended from the ceiling framing by four short vertical steel drop rods. " +
  "It does NOT touch, rest on, or connect to the garage door itself, the door tracks, or the door opener motor rail. " +
  "Stack 4–5 flat storage bins on top of the rack. Nothing else changes.";

const BIKE_RACK_BACK_LEFT =
  S +
  "Add a wall-mounted horizontal bike storage bar on the LEFT SIDE of the back wall — a gray powder-coated steel bar with two J-hooks, mounted high on the back wall about 5 feet up, with two bikes hanging vertically by their front wheels. " +
  "The bar is bolted into the back wall studs. Nothing else changes.";

const BIKE_RACK_RIGHT =
  S +
  "Add a wall-mounted horizontal bike storage bar on the RIGHT SIDE WALL — a gray powder-coated steel bar with four J-hooks, mounted high on the right wall about 5 feet up, with two bikes hanging vertically by their front wheels from the hooks. " +
  "The bar is bolted directly into the right wall studs — NOT touching the garage door tracks, ceiling, or floor. Nothing else changes.";

const OPTION_B_CABINETS =
  S +
  "Add NewAge Bold Series black steel garage cabinets along the back wall in TWO MODULAR SECTIONS split around the window: " +
  "Section 1: base cabinets from the LEFT corner of the back wall to the LEFT edge of the window, with stainless countertop and matching upper wall cabinets above on that section. " +
  "Section 2: base cabinets from the RIGHT edge of the window to the RIGHT corner of the back wall, with stainless countertop and matching upper wall cabinets above on that section. " +
  "The window is LEFT COMPLETELY OPEN between the two sections — NO upper cabinets, NO base cabinets, and NO shelving placed in front of or covering the window. " +
  "Do NOT place any cabinets on the left or right side walls. " +
  "Do NOT place cabinets within the swing arc of the interior door — leave at least 3 feet clear in front of the interior door. " +
  "Do NOT attach anything to the garage door, door tracks, or door rails. Nothing else changes.";

const OPTION_C_CABINETS =
  S +
  "Add NewAge Bold Series black steel garage cabinets along the back wall in TWO MODULAR SECTIONS split around the window: " +
  "Section 1: base cabinets from the LEFT corner of the back wall to the LEFT edge of the window, with stainless countertop and upper wall cabinets above on that section. " +
  "Section 2: base cabinets from the RIGHT edge of the window to the RIGHT corner of the back wall, with stainless countertop and upper wall cabinets above on that section. " +
  "The window is LEFT COMPLETELY OPEN between the two sections — no cabinets in front of or covering the window. " +
  "Do NOT extend cabinets onto the left or right side walls. " +
  "Do NOT place anything within the swing arc of the interior door — leave 3 feet of clearance in front of it. " +
  "Do NOT attach anything to the garage door, door tracks, or rails. Nothing else changes.";

const OPTION_C_SLATWALL =
  S +
  "Add a full commercial gray slatwall panel system covering the RIGHT SIDE WALL from floor to ceiling. " +
  "Mount premium slatwall hooks, wire baskets, and small shelves on the slatwall to organize tools, sports equipment, and accessories. " +
  "The slatwall is flush against the right wall only — do not extend it to other walls. Nothing else changes.";

async function main() {
  console.log("\n=== OPTIONS B + C (with retry) ===\n");

  // Re-run Pass 1 to get a fresh URL for B and C
  console.log("Pass 1: Cleaning + painting white (guidance 12)...");
  const p1url = await callKontext(WIDE_URL, PASS1, [], 12.0);
  await save(p1url, "pass1_clean_bc.png");
  console.log("Pass 1 done.\n");

  // ════════════════════════════════════════
  // OPTION B: THE WORKSHOP
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
