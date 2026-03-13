#!/usr/bin/env node
/**
 * test-v8.js — Rules-compliant prompts
 *
 * PROMPT TEMPLATE STRUCTURE (applied to every product pass):
 *   [SPATIAL LOCK] + [ONE ITEM — visual description] + [FORBIDDEN ZONES] + [LOCKOUT]
 *
 * GUIDANCE SCALE RULES:
 *   12 = Clean/remove everything
 *    6 = Wall color change only
 *    7 = Bikes (needs more force to appear)
 *    5 = All other products
 *
 * 6-BIKE SOLUTION:
 *   3 bikes on right wall (visible sliver) + 3 bikes on back wall right section (fully visible)
 *
 * TWO GREY VARIANTS from shared white base:
 *   A = Warm greige (grey-beige, like BM Pale Oak)
 *   B = Neutral grey (pure grey, like BM Repose Gray)
 */

const fs   = require("fs");
const path = require("path");

const FAL_API_KEY = process.env.FAL_API_KEY;
if (!FAL_API_KEY) { console.error("Set FAL_API_KEY"); process.exit(1); }

const WIDE_URL = "https://storage.googleapis.com/garage-scholars-v2.firebasestorage.app/gs_consultation_photos/david_test/wide_angle.jpg";
const OUT_DIR  = path.join(__dirname, "test_v8");
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

// ── SPATIAL LOCK (prepended to every product prompt) ──────────────────────────
// Rule: Preserve perspective + lockout clause on every pass
const LOCK = "Preserve all original perspective, proportions, and lighting exactly. Keep every item already in the garage exactly as-is. ";
const END  = " Nothing else changes.";

// ══════════════════════════════════════════════════════════════════════════════
// PASS 1 — Clean + White  (guidance 12)
// Rule: Remove everything + white walls in one aggressive pass
// ══════════════════════════════════════════════════════════════════════════════
const P1_CLEAN_WHITE =
  "Remove every single item from this garage — all bikes, racks, hooks, couches, boxes, bins, shelving, tools, bags, and all clutter. " +
  "Paint every wall surface and the ceiling crisp bright white, smooth and even, like a freshly painted showroom. " +
  "No raw drywall, no seams, no texture — clean white everywhere. " +
  "Keep the bare structure only: white walls, white ceiling, concrete floor, garage door, window, interior door on the left wall. " +
  "Photorealistic result.";

// ══════════════════════════════════════════════════════════════════════════════
// PASS 2 — Wall color (guidance 6)
// Rule: Color only — one wall surface change, nothing else
// ══════════════════════════════════════════════════════════════════════════════
const P2_WARM_GREIGE =
  LOCK +
  "Change the wall and ceiling color from white to a warm light greige — " +
  "a soft grey-beige with warm undertones, like a freshly painted garage in Benjamin Moore Pale Oak. " +
  "The color covers every wall and the ceiling uniformly. " +
  "The floor, garage door, window, and trim stay exactly as they are." +
  END;

const P2_NEUTRAL_GREY =
  LOCK +
  "Change the wall and ceiling color from white to a neutral light grey — " +
  "a pure medium-light grey with no warm or cool bias, like a freshly painted garage in Benjamin Moore Repose Gray. " +
  "The color covers every wall and the ceiling uniformly. " +
  "The floor, garage door, window, and trim stay exactly as they are." +
  END;

// ══════════════════════════════════════════════════════════════════════════════
// PASS 3 — Overhead rack above door  (guidance 5)
// Rule: One item. Visual description. Explicit forbidden zones.
// ══════════════════════════════════════════════════════════════════════════════
const P3_OVERHEAD_DOOR =
  LOCK +
  "In the photo, there is a narrow gap between the top of the garage door and the ceiling — the dead space above the door header. " +
  "In that gap, a steel overhead storage shelf is mounted flush to the ceiling, 8 feet wide, with 4 gray storage bins sitting on top of it. " +
  "The shelf hangs from the ceiling only — it does NOT touch the garage door panels, door tracks, opener chain rail, or opener motor." +
  END;

// ══════════════════════════════════════════════════════════════════════════════
// PASS 4 — Overhead rack back ceiling  (guidance 5)
// Rule: One item. Different location from pass 3 — back half of ceiling.
// ══════════════════════════════════════════════════════════════════════════════
const P4_OVERHEAD_BACK =
  LOCK +
  "In the back half of the ceiling — directly above the back wall, far from the garage door — " +
  "a steel overhead storage rack is mounted to the ceiling joists, 8 feet wide and 4 feet deep, loaded with 5 gray storage bins on top. " +
  "The rack hangs level from the ceiling — it does NOT touch the garage door, opener motor, door tracks, or back wall." +
  END;

// ══════════════════════════════════════════════════════════════════════════════
// PASS 5 — Bikes on right wall  (guidance 7)
// Rule: Visual result description. Right wall only. Exact count.
// ══════════════════════════════════════════════════════════════════════════════
const P5_BIKES_RIGHT =
  LOCK +
  "On the right side wall, three bicycles are hanging vertically — " +
  "each bike's front wheel is hooked onto the wall at shoulder height, and the bike hangs down against the wall. " +
  "The three bikes are side by side in a row along the right wall, spaced evenly. " +
  "They hang on the RIGHT WALL only — not touching the floor, ceiling, back wall, or garage door." +
  END;

// ══════════════════════════════════════════════════════════════════════════════
// PASS 6 — Bikes on back wall right section  (guidance 7)
// Rule: One item. Different wall than pass 5. Right side of back wall only.
// ══════════════════════════════════════════════════════════════════════════════
const P6_BIKES_BACK_RIGHT =
  LOCK +
  "On the right section of the back wall — to the right of the window — " +
  "three bicycles are hanging vertically side by side. " +
  "Each bike's front wheel is hooked onto the back wall at shoulder height, the bike hanging down against the wall. " +
  "They hang on the BACK WALL right section only — not touching the floor, ceiling, or right side wall." +
  END;

// ─────────────────────────────────────────────────────────────────────────────

async function runVariant(p2prompt, label, prefix, whiteUrl) {
  console.log(`\n--- VARIANT ${label} ---`);

  console.log(`P2: Color — ${label} (guidance 6)...`);
  const p2 = await callKontext(whiteUrl, p2prompt, [], 6.0);
  await save(p2, `${prefix}_p2_color.png`);

  console.log(`P3: Overhead rack above door (guidance 5)...`);
  const p3 = await callKontext(p2, P3_OVERHEAD_DOOR, [REFS.overhead_rack], 5.0);
  await save(p3, `${prefix}_p3_overhead_door.png`);

  console.log(`P4: Overhead rack back ceiling (guidance 5)...`);
  const p4 = await callKontext(p3, P4_OVERHEAD_BACK, [REFS.overhead_rack], 5.0);
  await save(p4, `${prefix}_p4_overhead_back.png`);

  console.log(`P5: 3 bikes right wall (guidance 7)...`);
  const p5 = await callKontext(p4, P5_BIKES_RIGHT, [REFS.bike_rack], 7.0);
  await save(p5, `${prefix}_p5_bikes_right.png`);

  console.log(`P6: 3 bikes back wall right (guidance 7)...`);
  const p6 = await callKontext(p5, P6_BIKES_BACK_RIGHT, [REFS.bike_rack], 7.0);
  await save(p6, `${prefix}_p6_final.png`);

  console.log(`Variant ${label} done.`);
  return p6;
}

async function main() {
  console.log("\n=== GARAGE SCHOLARS v8 — RULES-COMPLIANT PROMPTS ===\n");

  // Shared white base
  console.log("P1: Clean + bright white (guidance 12)...");
  const whiteUrl = await callKontext(WIDE_URL, P1_CLEAN_WHITE, [], 12.0);
  await save(whiteUrl, "shared_p1_white.png");
  console.log("White base done.");

  await runVariant(P2_WARM_GREIGE,   "A — Warm Greige", "varA", whiteUrl);
  await runVariant(P2_NEUTRAL_GREY,  "B — Neutral Grey", "varB", whiteUrl);

  console.log(`\n=== Complete. Check: ${OUT_DIR} ===\n`);

  const { execSync } = require("child_process");
  execSync(`start "" "${OUT_DIR}\\varA_p6_final.png"`);
  execSync(`start "" "${OUT_DIR}\\varB_p6_final.png"`);

  process.exit(0);
}

main().catch(e => { console.error("Fatal:", e.message); process.exit(1); });
