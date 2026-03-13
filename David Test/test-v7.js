#!/usr/bin/env node
/**
 * test-v7.js — Fixed paint + bikes
 *
 * Strategy:
 *   P1: Clean + bright white (guidance 12) — proven clean base
 *   P2: Grey color wash over white walls (guidance 6) — just changes wall hue
 *   P3: Overhead rack above garage door (guidance 5) — worked well before
 *   P4: Bikes on right wall (guidance 7) — pushed harder
 *
 * Variant A: Warm greige (grey-beige, slightly warm undertone)
 * Variant B: Pure neutral light grey (no warm/cool bias, classic grey)
 */

const fs   = require("fs");
const path = require("path");

const FAL_API_KEY = process.env.FAL_API_KEY;
if (!FAL_API_KEY) { console.error("Set FAL_API_KEY"); process.exit(1); }

const WIDE_URL = "https://storage.googleapis.com/garage-scholars-v2.firebasestorage.app/gs_consultation_photos/david_test/wide_angle.jpg";
const OUT_DIR  = path.join(__dirname, "test_v7");
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

const S = "Preserve all original perspective, proportions, and lighting exactly. Keep every item already in the garage exactly as-is — only add or change the one thing described. Photorealistic result. ";

// ── P1: Clean + bright white base ─────────────────────────────────────────────
const CLEAN_WHITE =
  "Transform this garage completely. " +
  "Remove EVERY SINGLE item: all bikes, racks, hooks, couches, sofas, boxes, bins, shelving, tools, bags, clutter — everything. " +
  "Paint ALL walls and ceiling crisp bright white with a smooth, even, professional finish — no raw drywall, seams, or texture visible. " +
  "Only bare structure remains: white walls, white ceiling, concrete floor, garage door, window, interior door on left wall. " +
  "Bright even LED lighting. Photorealistic result.";

// ── P2A: Warm greige wash ─────────────────────────────────────────────────────
const PAINT_WARM_GREIGE =
  S +
  "Repaint ALL walls and ceiling from white to a warm light greige — a soft grey with warm beige-tan undertones, " +
  "like Benjamin Moore Pale Oak or Accessible Beige. The color reads as clearly grey-beige, noticeably warmer and darker than white. " +
  "Apply the color uniformly to every wall surface and the ceiling. " +
  "The floor, garage door, trim, and all structure remain completely unchanged. Nothing else changes.";

// ── P2B: Pure neutral grey wash ───────────────────────────────────────────────
const PAINT_NEUTRAL_GREY =
  S +
  "Repaint ALL walls and ceiling from white to a pure neutral light grey — a clean true grey with no warm or cool bias, " +
  "like Benjamin Moore Gray Owl or Repose Gray. The color reads as clearly grey, noticeably darker than white, pure and neutral. " +
  "Apply the color uniformly to every wall surface and the ceiling. " +
  "The floor, garage door, trim, and all structure remain completely unchanged. Nothing else changes.";

// ── P3: Overhead above door ───────────────────────────────────────────────────
const OVERHEAD_ABOVE_DOOR =
  S +
  "Add one overhead ceiling storage rack mounted in the dead space directly above the garage door — " +
  "the narrow zone between the top of the garage door panel and the ceiling. " +
  "The rack is approximately 8 feet wide, 18 inches deep, suspended from the ceiling framing by four short steel drop rods. " +
  "It does NOT touch the garage door, door tracks, or opener motor. " +
  "Stack 4 gray storage bins on top of the rack. Nothing else changes.";

// ── P4: Bikes right wall ──────────────────────────────────────────────────────
const BIKES_RIGHT_WALL =
  S +
  "Mount two bicycles on the RIGHT SIDE WALL using wall hooks — " +
  "one road bike and one mountain bike, each hanging vertically with the front wheel hooked at shoulder height on the wall, " +
  "the rest of the bike hanging down against the wall. " +
  "The two bikes are side by side on the right wall, taking up about 4 feet of wall space total. " +
  "They hang flat against the right wall, wheels perpendicular to the floor. " +
  "Right wall only — not touching the floor, ceiling, or garage door. Nothing else changes.";

async function runVariant(greyPrompt, label, prefix, whiteUrl) {
  console.log(`\n--- VARIANT ${label} ---`);

  console.log(`P2: Paint ${label} (guidance 6)...`);
  const p2 = await callKontext(whiteUrl, greyPrompt, [], 6.0);
  await save(p2, `${prefix}_p2_paint.png`);

  console.log(`P3: Overhead above door (guidance 5)...`);
  const p3 = await callKontext(p2, OVERHEAD_ABOVE_DOOR, [REFS.overhead_rack], 5.0);
  await save(p3, `${prefix}_p3_overhead.png`);

  console.log(`P4: Bikes right wall (guidance 7)...`);
  const p4 = await callKontext(p3, BIKES_RIGHT_WALL, [REFS.bike_rack], 7.0);
  await save(p4, `${prefix}_p4_final.png`);

  console.log(`Variant ${label} done.`);
}

async function main() {
  console.log("\n=== GARAGE SCHOLARS v7 — FIXED PAINT + BIKES ===\n");

  // Shared white base — run once, branch into two grey variants
  console.log("P1: Clean + bright white base (guidance 12)...");
  const whiteUrl = await callKontext(WIDE_URL, CLEAN_WHITE, [], 12.0);
  await save(whiteUrl, "shared_p1_white.png");
  console.log("White base done.");

  await runVariant(PAINT_WARM_GREIGE,   "A (Warm Greige)",      "varA", whiteUrl);
  await runVariant(PAINT_NEUTRAL_GREY,  "B (Neutral Grey)",     "varB", whiteUrl);

  console.log(`\n=== Complete. Check: ${OUT_DIR} ===\n`);

  // Auto-open finals
  const { execSync } = require("child_process");
  execSync(`start "" "${OUT_DIR}\\varA_p4_final.png"`);
  execSync(`start "" "${OUT_DIR}\\varB_p4_final.png"`);

  process.exit(0);
}

main().catch(e => { console.error("Fatal:", e.message); process.exit(1); });
