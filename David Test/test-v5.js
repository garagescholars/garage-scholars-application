#!/usr/bin/env node
/**
 * test-v5.js — Two grey paint variants, same layout
 *
 * Layout (both variants):
 *   - Light grey paint on all walls + ceiling
 *   - Overhead rack above garage door header
 *   - Overhead rack in back half of ceiling
 *   - Bike rack on right wall (2-3 bikes)
 *
 * Variant A: Warm light grey (BM Revere Pewter tone — beige-grey undertones)
 * Variant B: Cool light grey (BM Gray Owl tone — clean blue-grey undertones)
 */

const fs   = require("fs");
const path = require("path");

const FAL_API_KEY = process.env.FAL_API_KEY;
if (!FAL_API_KEY) { console.error("Set FAL_API_KEY"); process.exit(1); }

const WIDE_URL = "https://storage.googleapis.com/garage-scholars-v2.firebasestorage.app/gs_consultation_photos/david_test/wide_angle.jpg";
const OUT_DIR  = path.join(__dirname, "test_v5");
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const REFS = {
  overhead_rack: "https://i.ebayimg.com/images/g/3DkAAeSwOt5pfvBE/s-l500.jpg",
  bike_rack:     "https://i.ebayimg.com/images/g/RykAAeSwK1pok4r0/s-l500.jpg",
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
          console.log(`   Retry ${attempt}/${retries}...`);
          await new Promise(r => setTimeout(r, 8000 * attempt));
          continue;
        }
        throw new Error(`Kontext ${res.status}: ${text}`);
      }
      return (await res.json()).images[0].url;
    } catch (e) {
      if (attempt === retries) throw e;
      await new Promise(r => setTimeout(r, 8000 * attempt));
    }
  }
}

async function save(url, name) {
  const res = await fetch(url);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(path.join(OUT_DIR, name), buf);
  console.log(`   Saved: ${name} (${(buf.length/1024).toFixed(0)}KB)`);
}

const S = "Preserve all original perspective, proportions, and lighting exactly. Keep every item already in the garage exactly as-is — only add the new item described. Photorealistic, brand new, professionally installed. ";

// ── Shared paint base (clean only — no color yet) ─────────────────────────────
const CLEAN_ONLY =
  "Remove EVERY SINGLE item from the garage: all bikes, bicycle racks, hooks, couches, sofas, boxes, bins, shelving units, wall-mounted storage, overhead racks, pegboard, tools, bags, and all clutter. " +
  "Leave the bare garage structure only: walls, ceiling, concrete floor, garage door, window, interior door on left wall. " +
  "Do NOT paint the walls yet — leave them as raw bare walls. Remove all items only. Photorealistic result.";

// ── Grey Variant A: Warm light grey ──────────────────────────────────────────
const PAINT_WARM_GREY =
  "Paint ALL walls and ceiling a warm light gray color — soft, muted, slightly warm with subtle beige-gray undertones, similar to Benjamin Moore Revere Pewter. " +
  "Smooth, even, professional finish. No streaks, no texture, no raw drywall visible. Keep the floor, garage door, and all other structure unchanged. Nothing else changes.";

// ── Grey Variant B: Cool light grey ──────────────────────────────────────────
const PAINT_COOL_GREY =
  "Paint ALL walls and ceiling a cool light gray color — clean, crisp, slightly cool with blue-gray undertones, similar to Benjamin Moore Gray Owl. " +
  "Smooth, even, professional finish. No streaks, no texture, no raw drywall visible. Keep the floor, garage door, and all other structure unchanged. Nothing else changes.";

// ── Product passes (same for both variants) ───────────────────────────────────
const OVERHEAD_ABOVE_DOOR =
  S +
  "Add one narrow overhead ceiling storage rack (approximately 8 feet wide, 18 inches deep) mounted flush against the ceiling in the dead space directly above the garage door — " +
  "the narrow zone between the top of the garage door and the ceiling. " +
  "Suspended from the ceiling framing by four short vertical steel drop rods. " +
  "Does NOT touch, rest on, or connect to the garage door, door tracks, or opener motor rail. " +
  "Stack 4 flat storage bins on top of the rack. Nothing else changes.";

const OVERHEAD_BACK_CEILING =
  S +
  "Add one large overhead ceiling storage rack (approximately 8 feet wide, 4 feet deep) mounted in the BACK HALF of the ceiling, " +
  "directly above the back wall area — as far from the garage door as possible. " +
  "Suspended from the ceiling joists by four short vertical steel drop rods. " +
  "Completely separate from the garage door opener motor and its rail. " +
  "The rack hangs flat and level with 4-5 large gray storage bins stacked on top. Nothing else changes.";

const BIKES_RIGHT_WALL =
  S +
  "On the RIGHT SIDE WALL, show two to three bicycles hanging vertically by their front wheels — " +
  "front wheel hooked high on the wall, rear wheel hanging straight down. " +
  "The bikes are mounted on the right wall only, bolted into the wall studs. " +
  "Nothing else changes.";

async function runVariant(paintPrompt, label, prefix) {
  console.log(`\n--- VARIANT ${label} ---`);

  console.log(`P1: Clean + empty (guidance 12)...`);
  const p1 = await callKontext(WIDE_URL, CLEAN_ONLY, [], 12.0);
  await save(p1, `${prefix}_p1_clean.png`);

  console.log(`P2: Paint ${label} grey (guidance 10)...`);
  const p2 = await callKontext(p1, paintPrompt, [], 10.0);
  await save(p2, `${prefix}_p2_paint.png`);

  console.log(`P3: Overhead above door (guidance 5)...`);
  const p3 = await callKontext(p2, OVERHEAD_ABOVE_DOOR, [REFS.overhead_rack], 5.0);
  await save(p3, `${prefix}_p3_overhead_door.png`);

  console.log(`P4: Overhead back ceiling (guidance 5)...`);
  const p4 = await callKontext(p3, OVERHEAD_BACK_CEILING, [REFS.overhead_rack], 5.0);
  await save(p4, `${prefix}_p4_overhead_back.png`);

  console.log(`P5: Bike rack right wall (guidance 5)...`);
  const p5 = await callKontext(p4, BIKES_RIGHT_WALL, [REFS.bike_rack], 5.0);
  await save(p5, `${prefix}_p5_final.png`);

  console.log(`Variant ${label} done.`);
  return p5;
}

async function main() {
  console.log("\n=== GARAGE SCHOLARS v5 — TWO GREY VARIANTS ===\n");
  await runVariant(PAINT_WARM_GREY, "A (Warm Grey)", "varA");
  await runVariant(PAINT_COOL_GREY, "B (Cool Grey)", "varB");
  console.log(`\n=== Complete. Check: ${OUT_DIR} ===\n`);
  process.exit(0);
}

main().catch(e => { console.error("Fatal:", e.message); process.exit(1); });
