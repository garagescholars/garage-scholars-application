#!/usr/bin/env node
/**
 * test-v6.js — Two grey variants, fixed
 *
 * Fixes from v5:
 *   - Clean + paint done in ONE pass at guidance 12 (no split = no dirty floor)
 *   - Stronger, more distinct grey colors
 *   - Two overhead racks: one high on left wall, one high on right wall
 *   - Bike rack on right wall
 */

const fs   = require("fs");
const path = require("path");

const FAL_API_KEY = process.env.FAL_API_KEY;
if (!FAL_API_KEY) { console.error("Set FAL_API_KEY"); process.exit(1); }

const WIDE_URL = "https://storage.googleapis.com/garage-scholars-v2.firebasestorage.app/gs_consultation_photos/david_test/wide_angle.jpg";
const OUT_DIR  = path.join(__dirname, "test_v6");
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

// ── Variant A: Warm medium grey ───────────────────────────────────────────────
const CLEAN_WARM_GREY =
  "Transform this garage completely. " +
  "Remove EVERY SINGLE item: all bikes, racks, hooks, couches, sofas, boxes, bins, shelving, tools, bags, and all clutter. Completely empty. " +
  "Paint ALL walls and ceiling a warm medium gray — a rich, saturated warm gray with distinct beige and taupe undertones, noticeably warm in tone, similar to Benjamin Moore Revere Pewter HC-172 but slightly deeper. " +
  "The gray is clearly visible and distinct — not off-white, not pale, but a real medium warm gray that reads strongly on all walls and ceiling. " +
  "Smooth, even, professional painted finish. Bare concrete floor unchanged. Bright even lighting. Photorealistic result.";

// ── Variant B: Cool medium grey ───────────────────────────────────────────────
const CLEAN_COOL_GREY =
  "Transform this garage completely. " +
  "Remove EVERY SINGLE item: all bikes, racks, hooks, couches, sofas, boxes, bins, shelving, tools, bags, and all clutter. Completely empty. " +
  "Paint ALL walls and ceiling a cool medium gray — a rich, saturated cool gray with distinct blue and slate undertones, noticeably cool in tone, similar to Benjamin Moore Stonington Gray HC-170. " +
  "The gray is clearly visible and distinct — not off-white, not pale, but a real medium cool gray that reads strongly on all walls and ceiling. " +
  "Smooth, even, professional painted finish. Bare concrete floor unchanged. Bright even lighting. Photorealistic result.";

// ── Overhead rack — LEFT UPPER WALL ──────────────────────────────────────────
const OVERHEAD_LEFT_WALL =
  S +
  "Add a wall-mounted overhead storage rack mounted HIGH on the LEFT SIDE WALL — " +
  "a steel bracket shelf system installed at ceiling height on the left wall, extending approximately 24 inches out from the wall. " +
  "The rack is bolted into the left wall studs at the very top of the wall near the ceiling. " +
  "It holds 3-4 storage bins sitting on the shelf surface. " +
  "Mounted on the LEFT WALL ONLY — does not attach to the ceiling, garage door, or any other surface. Nothing else changes.";

// ── Overhead rack — RIGHT UPPER WALL ─────────────────────────────────────────
const OVERHEAD_RIGHT_WALL =
  S +
  "Add a wall-mounted overhead storage rack mounted HIGH on the RIGHT SIDE WALL — " +
  "a steel bracket shelf system installed at ceiling height on the right wall, extending approximately 24 inches out from the wall. " +
  "The rack is bolted into the right wall studs at the very top of the wall near the ceiling. " +
  "It holds 3-4 storage bins sitting on the shelf surface. " +
  "Mounted on the RIGHT WALL ONLY — does not attach to the ceiling, garage door, or any other surface. Nothing else changes.";

// ── Bike rack — right wall ────────────────────────────────────────────────────
const BIKES_RIGHT_WALL =
  S +
  "On the RIGHT SIDE WALL, show two bicycles hanging vertically by their front wheels — " +
  "front wheels hooked high on the wall, rear wheels hanging straight down, bikes flush against the right wall. " +
  "Mounted on the right wall only, below the overhead rack. Nothing else changes.";

async function runVariant(paintPrompt, label, prefix) {
  console.log(`\n--- VARIANT ${label} ---`);

  console.log(`P1: Clean + paint ${label} (guidance 12)...`);
  const p1 = await callKontext(WIDE_URL, paintPrompt, [], 12.0);
  await save(p1, `${prefix}_p1_painted.png`);

  console.log(`P2: Overhead rack left upper wall (guidance 6)...`);
  const p2 = await callKontext(p1, OVERHEAD_LEFT_WALL, [REFS.overhead_rack], 6.0);
  await save(p2, `${prefix}_p2_rack_left.png`);

  console.log(`P3: Overhead rack right upper wall (guidance 5)...`);
  const p3 = await callKontext(p2, OVERHEAD_RIGHT_WALL, [REFS.overhead_rack], 5.0);
  await save(p3, `${prefix}_p3_rack_right.png`);

  console.log(`P4: Bikes on right wall (guidance 5)...`);
  const p4 = await callKontext(p3, BIKES_RIGHT_WALL, [REFS.bike_rack], 5.0);
  await save(p4, `${prefix}_p4_final.png`);

  console.log(`Variant ${label} done.`);
}

async function main() {
  console.log("\n=== GARAGE SCHOLARS v6 — TWO GREY VARIANTS ===\n");
  await runVariant(CLEAN_WARM_GREY, "A (Warm Grey)", "varA");
  await runVariant(CLEAN_COOL_GREY, "B (Cool Grey)", "varB");
  console.log(`\n=== Complete. Check: ${OUT_DIR} ===\n`);
  process.exit(0);
}

main().catch(e => { console.error("Fatal:", e.message); process.exit(1); });
