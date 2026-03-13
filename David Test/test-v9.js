#!/usr/bin/env node
/**
 * test-v9.js — Back to basics
 *
 * Problem: White base + tint gets washed out by natural light in this garage.
 * Fix: Clean + MEDIUM grey in ONE pass at guidance 12. Medium grey fights light better.
 *
 * 3 passes only — less drift, better quality:
 *   P1: Clean + medium grey (guidance 12)
 *   P2: Overhead rack above door (guidance 5)
 *   P3: Bikes on right wall (guidance 7)
 *
 * Variant A: Medium warm grey (BM Revere Pewter tone)
 * Variant B: Medium cool grey (BM Stonington Gray tone)
 */

const fs   = require("fs");
const path = require("path");

const FAL_API_KEY = process.env.FAL_API_KEY;
if (!FAL_API_KEY) { console.error("Set FAL_API_KEY"); process.exit(1); }

const WIDE_URL = "https://storage.googleapis.com/garage-scholars-v2.firebasestorage.app/gs_consultation_photos/david_test/wide_angle.jpg";
const OUT_DIR  = path.join(__dirname, "test_v9");
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

const LOCK = "Preserve all original perspective, proportions, and lighting exactly. Keep every item already in the garage exactly as-is. ";
const END  = " Nothing else changes.";

// ── P1A: Clean + medium warm grey ─────────────────────────────────────────────
// Medium grey (not light) so it reads through natural light
const P1_WARM_GREY =
  "Remove every single item from this garage — all bikes, racks, hooks, couches, boxes, bins, shelving, tools, bags, and all clutter. " +
  "Paint every wall and the ceiling a medium warm grey — a noticeable, saturated warm grey with tan-brown undertones, clearly grey not white, like Benjamin Moore Revere Pewter HC-172. " +
  "The grey is MEDIUM in depth — clearly visible even in bright light, not pale, not off-white. Every wall and the ceiling are uniformly this warm grey color. " +
  "Smooth, professional painted finish. Concrete floor unchanged. Bright even lighting. Photorealistic result.";

// ── P1B: Clean + medium cool grey ─────────────────────────────────────────────
const P1_COOL_GREY =
  "Remove every single item from this garage — all bikes, racks, hooks, couches, boxes, bins, shelving, tools, bags, and all clutter. " +
  "Paint every wall and the ceiling a medium cool grey — a noticeable, saturated cool grey with blue-slate undertones, clearly grey not white, like Benjamin Moore Stonington Gray HC-170. " +
  "The grey is MEDIUM in depth — clearly visible even in bright light, not pale, not off-white. Every wall and the ceiling are uniformly this cool grey color. " +
  "Smooth, professional painted finish. Concrete floor unchanged. Bright even lighting. Photorealistic result.";

// ── P2: Overhead storage — left upper ceiling ─────────────────────────────────
const P2_OVERHEAD_LEFT =
  LOCK +
  "On the LEFT SIDE of the ceiling, near the left wall, " +
  "a steel overhead storage rack is mounted to the ceiling joists — 6 feet wide, 2 feet deep, " +
  "loaded with 3 gray storage bins on top, hanging close to the ceiling. " +
  "It hangs from the ceiling only — does NOT touch the left wall, garage door, tracks, or opener." +
  END;

// ── P3: Overhead storage — right upper ceiling ────────────────────────────────
const P3_OVERHEAD_RIGHT =
  LOCK +
  "On the RIGHT SIDE of the ceiling, near the right wall, " +
  "a steel overhead storage rack is mounted to the ceiling joists — 6 feet wide, 2 feet deep, " +
  "loaded with 3 gray storage bins on top, hanging close to the ceiling. " +
  "It hangs from the ceiling only — does NOT touch the right wall, garage door, tracks, or opener." +
  END;

// ── P4: 3 bikes on left wall ──────────────────────────────────────────────────
const P4_BIKES_LEFT =
  LOCK +
  "On the LEFT SIDE WALL, three bicycles hang vertically side by side — " +
  "each bike's front wheel on a wall hook at shoulder height, bike hanging down against the left wall. " +
  "Three bikes in a row on the left wall only — not the back wall, not the floor, not touching the door." +
  END;

// ── P5: 3 bikes on right wall ─────────────────────────────────────────────────
const P5_BIKES_RIGHT =
  LOCK +
  "On the RIGHT SIDE WALL, three bicycles hang vertically side by side — " +
  "each bike's front wheel on a wall hook at shoulder height, bike hanging down against the right wall. " +
  "Three bikes in a row on the right wall only — not the back wall, not the floor, not touching the door." +
  END;

async function runVariant(p1prompt, label, prefix) {
  console.log(`\n--- VARIANT ${label} ---`);

  console.log(`P1: Clean + ${label} (guidance 12)...`);
  const p1 = await callKontext(WIDE_URL, p1prompt, [], 12.0);
  await save(p1, `${prefix}_p1_painted.png`);

  console.log(`P2: Overhead left ceiling (guidance 5)...`);
  const p2 = await callKontext(p1, P2_OVERHEAD_LEFT, [REFS.overhead_rack], 5.0);
  await save(p2, `${prefix}_p2_overhead_left.png`);

  console.log(`P3: Overhead right ceiling (guidance 5)...`);
  const p3 = await callKontext(p2, P3_OVERHEAD_RIGHT, [REFS.overhead_rack], 5.0);
  await save(p3, `${prefix}_p3_overhead_right.png`);

  console.log(`P4: 3 bikes left wall (guidance 7)...`);
  const p4 = await callKontext(p3, P4_BIKES_LEFT, [REFS.bike_rack], 7.0);
  await save(p4, `${prefix}_p4_bikes_left.png`);

  console.log(`P5: 3 bikes right wall (guidance 7)...`);
  const p5 = await callKontext(p4, P5_BIKES_RIGHT, [REFS.bike_rack], 7.0);
  await save(p5, `${prefix}_p5_final.png`);

  console.log(`Variant ${label} done.`);
}

async function main() {
  console.log("\n=== GARAGE SCHOLARS v9 — MEDIUM GREY, 3 PASSES ===\n");
  await runVariant(P1_WARM_GREY, "A Warm Grey", "varA");
  await runVariant(P1_COOL_GREY, "B Cool Grey", "varB");
  console.log(`\n=== Complete. Check: ${OUT_DIR} ===\n`);
  const { execSync } = require("child_process");
  execSync(`start "" "${OUT_DIR}\\varA_p5_final.png"`);
  execSync(`start "" "${OUT_DIR}\\varB_p5_final.png"`);
  process.exit(0);
}

main().catch(e => { console.error("Fatal:", e.message); process.exit(1); });
