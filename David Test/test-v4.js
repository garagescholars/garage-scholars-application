#!/usr/bin/env node
/**
 * Garage Scholars Mockup Test v4
 *
 * Single layout — Zach's custom spec:
 *   1. Polyaspartic flooring with decorative flakes
 *   2. Narrow overhead rack above garage door (left side of header zone)
 *   3. 5-tier shelving unit on left back wall
 *   4. 6-bike wall rack on right side wall
 *   5. 2-bike wall rack on back wall right side
 *
 * Usage: FAL_API_KEY=your_key node test-v4.js
 */

const fs   = require("fs");
const path = require("path");

const FAL_API_KEY = process.env.FAL_API_KEY;
if (!FAL_API_KEY) { console.error("Set FAL_API_KEY"); process.exit(1); }

const WIDE_URL = "https://storage.googleapis.com/garage-scholars-v2.firebasestorage.app/gs_consultation_photos/david_test/wide_angle.jpg";
const OUT_DIR  = path.join(__dirname, "test_v4");
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const REFS = {
  overhead_rack:  "https://i.ebayimg.com/images/g/3DkAAeSwOt5pfvBE/s-l500.jpg",
  shelving_5tier: "https://i.ebayimg.com/images/g/kSwAAeSwYVFobJMm/s-l500.jpg",
  bins_greenmade: "https://i.ebayimg.com/images/g/CasAAOSw7kRlX3Ef/s-l500.jpg",
  bike_rack:      "https://i.ebayimg.com/images/g/RykAAeSwK1pok4r0/s-l500.jpg",
  // Polyaspartic floor reference — full-chip flake garage floor
  poly_floor:     "https://i.ebayimg.com/images/g/nW8AAOSwjXtlx~Rz/s-l500.jpg",
};

async function callKontext(imageUrl, prompt, refs = [], guidance = 7.0, retries = 6) {
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
          await new Promise(r => setTimeout(r, 8000 * attempt));
          continue;
        }
        throw new Error(`Kontext ${res.status}: ${text}`);
      }
      return (await res.json()).images[0].url;
    } catch (e) {
      if (attempt === retries) throw e;
      console.log(`   Retry ${attempt}/${retries}: ${e.message}`);
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

// Spatial anchor — preserve everything, only add the new item
const S = "Preserve all original perspective, proportions, and lighting exactly. Keep every item already in the garage exactly as-is — only add the new item described. Photorealistic, brand new, professionally installed. ";

// ── Pass 1: Clean ──────────────────────────────────────────────────────────────
const PASS1 =
  "Transform this garage completely. Paint ALL walls and ceiling crisp bright white with a smooth, even, professional finish — no raw drywall, tape, mud, or seams visible anywhere. " +
  "Remove EVERY SINGLE item from the garage: all bikes, bicycle racks, bike hooks, couches, sofas, boxes, bins, shelving units, wall-mounted storage, overhead racks, grid panels, pegboard, tools, bags, and all clutter. " +
  "Completely empty garage — nothing on the walls, nothing hanging, nothing on the floor. " +
  "Only the bare garage structure remains: painted walls, ceiling, bare concrete floor, garage door, window, interior door on the left wall. Bright even LED lighting. Photorealistic result.";

// ── Pass 2: Polyaspartic flooring ─────────────────────────────────────────────
const FLOOR_POLY =
  S +
  "Replace the entire concrete floor with a professionally installed polyaspartic garage floor coating. " +
  "The base coat color is medium gray. The surface is covered with a full broadcast of decorative vinyl color flakes — a mix of gray, white, beige, and black chips scattered densely and evenly across the entire floor surface. " +
  "The finish is high-gloss, smooth, and sealed — the flakes are embedded under a clear topcoat giving the floor a deep, shiny, showroom-quality appearance. " +
  "The coated floor covers the entire garage floor from wall to wall with no bare concrete visible. " +
  "Walls, ceiling, and all other elements remain completely unchanged. Nothing else changes.";

// ── Pass 3: Overhead rack above door — left side of header zone ───────────────
const OVERHEAD_ABOVE_DOOR_LEFT =
  S +
  "Add one narrow overhead ceiling storage rack (approximately 6 feet wide, 18 inches deep) mounted flush against the ceiling in the dead space directly above the LEFT SIDE of the garage door header — " +
  "the narrow zone between the top of the garage door and the ceiling, positioned on the left half of that zone. " +
  "The rack is suspended from the ceiling framing by four short vertical steel drop rods. " +
  "It does NOT touch, rest on, or connect to the garage door itself, the door tracks, or the door opener motor rail. " +
  "Stack 3–4 flat storage bins on top of the rack. Nothing else changes.";

// ── Pass 4: Shelving rack on left back wall ───────────────────────────────────
const SHELVING_LEFT_BACK =
  S +
  "Add one 5-tier gray steel shelving unit (72 inches tall, 48 inches wide) standing flush against the LEFT SECTION of the back wall — " +
  "positioned to the left of the center window, NOT blocking the window. " +
  "The unit has 5 shelves fully loaded with Greenmade 27-gallon storage bins (gray body, green snap lid), neatly organized. " +
  "Leave at least 3 feet of clear floor space in front of the interior door on the left wall so it can swing open. " +
  "Nothing else changes.";

// ── Pass 5: 6-bike rack on right side wall ────────────────────────────────────
const BIKE_RACK_RIGHT_6 =
  S +
  "Add a wall-mounted bike storage system on the RIGHT SIDE WALL that holds 6 bikes. " +
  "Install TWO horizontal gray powder-coated steel bars, each with three J-hooks, mounted side by side high on the right wall approximately 5 feet up — " +
  "three bikes hanging vertically by their front wheels from each bar, totaling 6 bikes hanging on the right wall. " +
  "All bars are bolted directly into the right wall studs — NOT touching the garage door tracks, ceiling, or floor. " +
  "The bikes hang flush against the right wall, wheels up, frames down. Nothing else changes.";

// ── Pass 6: 2-bike rack on back wall right side ───────────────────────────────
const BIKE_RACK_BACK_RIGHT_2 =
  S +
  "Add a wall-mounted horizontal bike storage bar on the RIGHT SECTION of the back wall — " +
  "a gray powder-coated steel bar with two J-hooks, mounted high on the back wall right section (to the right of the window) approximately 5 feet up. " +
  "Two bikes hang vertically by their front wheels from the hooks. " +
  "The bar is bolted directly into the back wall studs. Nothing else changes.";

async function main() {
  console.log("\n=== GARAGE SCHOLARS MOCKUP TEST v4 — ZACH'S CUSTOM LAYOUT ===\n");

  console.log("Pass 1: Clean + paint white (guidance 12)...");
  const p1url = await callKontext(WIDE_URL, PASS1, [], 12.0);
  await save(p1url, "pass1_clean.png");
  console.log("Pass 1 done.\n");

  console.log("Pass 2: Polyaspartic flooring with flakes (guidance 7)...");
  const p2url = await callKontext(p1url, FLOOR_POLY, [REFS.poly_floor], 7.0);
  await save(p2url, "pass2_flooring.png");
  console.log("Pass 2 done.\n");

  console.log("Pass 3: Overhead rack above door left (guidance 5)...");
  const p3url = await callKontext(p2url, OVERHEAD_ABOVE_DOOR_LEFT, [REFS.overhead_rack], 5.0);
  await save(p3url, "pass3_overhead.png");
  console.log("Pass 3 done.\n");

  console.log("Pass 4: Shelving on left back wall (guidance 5)...");
  const p4url = await callKontext(p3url, SHELVING_LEFT_BACK, [REFS.shelving_5tier, REFS.bins_greenmade], 5.0);
  await save(p4url, "pass4_shelving.png");
  console.log("Pass 4 done.\n");

  console.log("Pass 5: 6-bike rack on right side wall (guidance 5)...");
  const p5url = await callKontext(p4url, BIKE_RACK_RIGHT_6, [REFS.bike_rack], 5.0);
  await save(p5url, "pass5_bikes_right_wall.png");
  console.log("Pass 5 done.\n");

  console.log("Pass 6: 2-bike rack on back wall right (guidance 5)...");
  const p6url = await callKontext(p5url, BIKE_RACK_BACK_RIGHT_2, [REFS.bike_rack], 5.0);
  await save(p6url, "pass6_final.png");
  console.log("Pass 6 done.\n");

  console.log(`=== Complete. Check: ${OUT_DIR} ===\n`);
  process.exit(0);
}

main().catch(e => { console.error("Fatal:", e.message); process.exit(1); });
