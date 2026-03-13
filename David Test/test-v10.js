#!/usr/bin/env node
/**
 * test-v10.js — Sharp-painted base + precise product placement
 *
 * Architecture:
 *   1. Reuse test_v7/shared_p1_white.png (already generated, ~1.3MB)
 *      OR run a fresh P1 clean pass if it's missing
 *   2. Apply deterministic BM paint via sharp (exact color, zero API cost)
 *   3. Convert painted PNG → base64 data URL → feed to FLUX as starting image
 *   4. Product passes: left overhead rack → right overhead rack →
 *                      3 bikes left wall → 3 bikes right wall
 *
 * PROMPT RULES (learned from v7-v9):
 *   - SPATIAL LOCK first, always
 *   - One item per pass, described as a visual result
 *   - Forbidden zones explicit on every pass
 *   - Bikes get guidance 7, overhead racks get 5
 *   - Color: guidance 8 (stronger than 6 to fight natural light)
 */

const sharp  = require("sharp");
const fs     = require("fs");
const path   = require("path");

const FAL_API_KEY = process.env.FAL_API_KEY;
if (!FAL_API_KEY) { console.error("Set FAL_API_KEY"); process.exit(1); }

const WIDE_URL  = "https://storage.googleapis.com/garage-scholars-v2.firebasestorage.app/gs_consultation_photos/david_test/wide_angle.jpg";
const WHITE_PNG = path.join(__dirname, "test_v7", "shared_p1_white.png");
const OUT_DIR   = path.join(__dirname, "test_v10");
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const REFS = {
  overhead_rack: "https://i.ebayimg.com/images/g/3DkAAeSwOt5pfvBE/s-l500.jpg",
  bike_rack:     "https://i.ebayimg.com/images/g/RykAAeSwK1pok4r0/s-l500.jpg",
};

// ── API call with retry ────────────────────────────────────────────────────────
async function callKontext(imageUrl, prompt, refs = [], guidance = 7.0, retries = 6) {
  const body = {
    image_url: imageUrl,
    prompt,
    num_images: 1,
    guidance_scale: guidance,
    output_format: "png",
  };
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
          console.log(`   Retry ${attempt}/${retries} (${res.status})...`);
          await new Promise(r => setTimeout(r, 8000 * attempt));
          continue;
        }
        throw new Error(`Kontext ${res.status}: ${text}`);
      }
      return (await res.json()).images[0].url;
    } catch (e) {
      if (attempt === retries) throw e;
      console.log(`   Network error, retry ${attempt}/${retries}...`);
      await new Promise(r => setTimeout(r, 8000 * attempt));
    }
  }
}

// ── Save URL to disk ──────────────────────────────────────────────────────────
async function save(url, name) {
  const res = await fetch(url);
  const buf = Buffer.from(await res.arrayBuffer());
  const outPath = path.join(OUT_DIR, name);
  fs.writeFileSync(outPath, buf);
  console.log(`   Saved: ${name} (${(buf.length / 1024).toFixed(0)}KB)`);
  return outPath;
}

// ── Sharp wall paint (deterministic) ─────────────────────────────────────────
// Detects wall pixels (luminance > 200 = white/near-white from clean pass)
// Applies BM color overlay only to those pixels
async function applyWallColor(inputPath, outputPath, hexColor, opacity = 0.60) {
  const clean = hexColor.replace("#", "");
  const color = {
    r: parseInt(clean.substring(0, 2), 16),
    g: parseInt(clean.substring(2, 4), 16),
    b: parseInt(clean.substring(4, 6), 16),
  };

  const raw = await sharp(inputPath).raw().toBuffer({ resolveWithObject: true });
  const { data, info } = raw;
  const { width, height, channels } = info;

  const maskData = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const r = data[i * channels];
    const g = data[i * channels + 1];
    const b = data[i * channels + 2];
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;

    let alpha = 0;
    if (lum > 200) {
      alpha = Math.round(((lum - 200) / 55) * opacity * 255);
    }

    const j = i * 4;
    maskData[j]     = color.r;
    maskData[j + 1] = color.g;
    maskData[j + 2] = color.b;
    maskData[j + 3] = alpha;
  }

  const maskImg = await sharp(maskData, { raw: { width, height, channels: 4 } }).png().toBuffer();
  await sharp(inputPath)
    .composite([{ input: maskImg, blend: "over" }])
    .toFile(outputPath);

  console.log(`   Painted: ${path.basename(outputPath)} (${hexColor})`);
  return outputPath;
}

// ── Convert local PNG to base64 data URL ──────────────────────────────────────
function toDataUrl(filePath) {
  const buf = fs.readFileSync(filePath);
  return `data:image/png;base64,${buf.toString("base64")}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// PROMPTS
// ─────────────────────────────────────────────────────────────────────────────

const LOCK = "Preserve all original perspective, proportions, and lighting exactly. Keep every item already in the garage exactly as-is. ";
const END  = " Nothing else changes.";

// P1 — only runs if no local white PNG exists
const P1_CLEAN_WHITE =
  "Remove every single item from this garage — all bikes, racks, hooks, couches, boxes, bins, shelving, tools, bags, and all clutter. " +
  "Paint every wall surface and the ceiling crisp bright white, smooth and even, like a freshly painted showroom. " +
  "No raw drywall, no seams, no texture — clean white everywhere. " +
  "Keep the bare structure only: white walls, white ceiling, concrete floor, garage door, window, interior door on the left wall. " +
  "Photorealistic result.";

// P3 — Overhead rack LEFT side of ceiling
const P3_OVERHEAD_LEFT =
  LOCK +
  "On the LEFT HALF of the ceiling — near the left wall, above the left side of the garage — " +
  "a steel overhead storage rack is suspended from the ceiling joists by four vertical drop rods. " +
  "The rack is 6 feet wide and 2 feet deep, loaded with 4 gray plastic storage bins sitting on top. " +
  "It hangs level from the ceiling only — does NOT touch the left wall, garage door panels, door tracks, or opener motor." +
  END;

// P4 — Overhead rack RIGHT side of ceiling
const P4_OVERHEAD_RIGHT =
  LOCK +
  "On the RIGHT HALF of the ceiling — near the right wall, above the right side of the garage — " +
  "a steel overhead storage rack is suspended from the ceiling joists by four vertical drop rods. " +
  "The rack is 6 feet wide and 2 feet deep, loaded with 4 gray plastic storage bins sitting on top. " +
  "It hangs level from the ceiling only — does NOT touch the right wall, garage door panels, door tracks, or opener motor." +
  END;

// P5 — 3 bikes on LEFT WALL
const P5_BIKES_LEFT =
  LOCK +
  "On the LEFT SIDE WALL, three bicycles hang vertically side by side in a row. " +
  "Each bike has its front wheel hooked to a wall-mounted hook at shoulder height, the bike hanging straight down against the left wall. " +
  "All three bikes are mounted on the LEFT WALL only, evenly spaced, wheels parallel to the wall. " +
  "They do NOT touch the floor, ceiling, back wall, garage door, door tracks, or the overhead rack." +
  END;

// P6 — 3 bikes on RIGHT WALL
const P6_BIKES_RIGHT =
  LOCK +
  "On the RIGHT SIDE WALL, three bicycles hang vertically side by side in a row. " +
  "Each bike has its front wheel hooked to a wall-mounted hook at shoulder height, the bike hanging straight down against the right wall. " +
  "All three bikes are mounted on the RIGHT WALL only, evenly spaced, wheels parallel to the wall. " +
  "They do NOT touch the floor, ceiling, back wall, garage door, door tracks, or the overhead rack." +
  END;

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  console.log("\n=== GARAGE SCHOLARS v10 — SHARP PAINT + PRECISE PLACEMENT ===\n");

  // ── Step 1: Get the white base ─────────────────────────────────────────────
  let whiteLocalPath;

  if (fs.existsSync(WHITE_PNG)) {
    console.log("P1: Reusing existing white base from test_v7 (skipping API call)");
    whiteLocalPath = WHITE_PNG;
  } else {
    console.log("P1: No local white base found — running FLUX clean pass (guidance 12)...");
    const whiteUrl = await callKontext(WIDE_URL, P1_CLEAN_WHITE, [], 12.0);
    whiteLocalPath = await save(whiteUrl, "p1_white.png");
  }

  // ── Step 2: Apply deterministic BM paint color via sharp ──────────────────
  // Revere Pewter = warm greige (most popular garage color)
  // Stonington Gray = cool medium grey
  // Using Revere Pewter as primary, Stonington Gray as alt
  console.log("\nPainting walls with sharp (deterministic, zero API cost)...");
  const paintedPath = path.join(OUT_DIR, "p2_painted_warm_grey.png");
  await applyWallColor(whiteLocalPath, paintedPath, "#C2B9A7", 0.70); // revere pewter, stronger opacity

  // Also generate cool grey variant (no API cost)
  const coolGreyPath = path.join(OUT_DIR, "p2_painted_cool_grey.png");
  await applyWallColor(whiteLocalPath, coolGreyPath, "#8C9090", 0.50); // stonington gray

  // ── Step 3: Convert painted image to data URL for FLUX ────────────────────
  console.log("\nConverting painted image to data URL for FLUX...");
  const paintedDataUrl = toDataUrl(paintedPath);
  const dataSizeMB = (paintedDataUrl.length / 1024 / 1024).toFixed(1);
  console.log(`   Data URL size: ${dataSizeMB}MB`);

  // ── Product passes (from warm grey painted base) ───────────────────────────
  console.log("\nP3: Overhead storage rack — LEFT ceiling (guidance 5)...");
  const p3url = await callKontext(paintedDataUrl, P3_OVERHEAD_LEFT, [REFS.overhead_rack], 5.0);
  const p3path = await save(p3url, "p3_overhead_left.png");

  console.log("\nP4: Overhead storage rack — RIGHT ceiling (guidance 5)...");
  const p4url = await callKontext(p3url, P4_OVERHEAD_RIGHT, [REFS.overhead_rack], 5.0);
  const p4path = await save(p4url, "p4_overhead_right.png");

  console.log("\nP5: 3 bikes — LEFT WALL (guidance 7)...");
  const p5url = await callKontext(p4url, P5_BIKES_LEFT, [REFS.bike_rack], 7.0);
  const p5path = await save(p5url, "p5_bikes_left.png");

  console.log("\nP6: 3 bikes — RIGHT WALL (guidance 7)...");
  const p6url = await callKontext(p5url, P6_BIKES_RIGHT, [REFS.bike_rack], 7.0);
  const p6path = await save(p6url, "p6_final.png");

  console.log(`\n=== Complete. Check: ${OUT_DIR} ===\n`);

  // Auto-open key results
  const { execSync } = require("child_process");
  try { execSync(`start "" "${paintedPath}"`); } catch (_) {}
  try { execSync(`start "" "${p4path}"`); } catch (_) {}  // after both racks
  try { execSync(`start "" "${p6path}"`); } catch (_) {}  // final
}

main().catch(e => { console.error("Fatal:", e.message); process.exit(1); });
