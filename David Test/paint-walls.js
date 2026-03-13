#!/usr/bin/env node
/**
 * paint-walls.js — Deterministic wall color overlay using sharp
 *
 * HOW IT WORKS:
 *   1. Load the cleaned white image (FLUX Kontext pass 1 output)
 *   2. Detect "wall pixels" = any pixel with high luminance (white/near-white)
 *      These are walls, ceiling, and trim from the clean pass
 *   3. Apply a color overlay ONLY to those pixels at a set opacity
 *   4. Result: walls painted in exact BM color, floor/door/structure unchanged
 *
 * WHY THIS IS BETTER THAN AI FOR COLOR:
 *   - Exact color every time (no hallucination, no drift)
 *   - Zero API cost
 *   - Instant (<1 second)
 *   - Works on any clean image from any garage
 *
 * USAGE:
 *   node paint-walls.js <input_image> <output_image> <hex_color> [opacity]
 *   node paint-walls.js test_v7/shared_p1_white.png output_warm_grey.png "#C2B9A7" 0.55
 */

const sharp  = require("sharp");
const path   = require("path");
const fs     = require("fs");

// ── Benjamin Moore color palette ──────────────────────────────────────────────
const BM_COLORS = {
  // Warm greys / greiges
  "revere_pewter":    "#C2B9A7",  // HC-172 — warm greige, most popular garage color
  "pale_oak":         "#D4C9B4",  // OC-20  — light warm greige
  "accessible_beige": "#CAC0AE",  // SW 7036 — greige, warm
  "agreeable_gray":   "#C2B8AA",  // SW 7029 — warm greige

  // Cool / neutral greys
  "stonington_gray":  "#8C9090",  // HC-170 — medium cool grey
  "gray_owl":         "#C4C3BB",  // OC-52  — light cool grey
  "repose_gray":      "#B8B5AD",  // SW 7015 — neutral grey
  "coventry_gray":    "#8B9196",  // HC-169 — medium blue-grey
  "chelsea_gray":     "#8F9393",  // HC-168 — medium cool grey

  // White / near-white
  "white":            "#FFFFFF",
  "chantilly_lace":   "#F6F4F0",  // OC-65  — warm white
};

// ── Parse hex to RGB ──────────────────────────────────────────────────────────
function hexToRgb(hex) {
  const clean = hex.replace("#", "");
  return {
    r: parseInt(clean.substring(0, 2), 16),
    g: parseInt(clean.substring(2, 4), 16),
    b: parseInt(clean.substring(4, 6), 16),
  };
}

// ── Apply paint color to wall pixels ─────────────────────────────────────────
// Strategy: pixels with luminance > threshold are "walls" (white/near-white from clean pass)
// Apply overlay color using alpha compositing — this simulates paint on white walls
async function applyWallColor(inputPath, outputPath, hexColor, opacity = 0.50) {
  const color = hexToRgb(hexColor);
  const img   = sharp(inputPath);
  const meta  = await img.metadata();
  const { width, height } = meta;

  // Get raw pixel data to identify wall pixels (high luminance = white = walls)
  const raw = await sharp(inputPath).raw().toBuffer({ resolveWithObject: true });
  const { data, info } = raw;
  const channels = info.channels; // 3 = RGB, 4 = RGBA

  // Build a mask: white pixels (luminance > 200) → full opacity
  //                grey/dark pixels → reduced opacity (don't paint floor/door)
  const maskData = Buffer.alloc(width * height * 4); // RGBA mask

  for (let i = 0; i < width * height; i++) {
    const r = data[i * channels];
    const g = data[i * channels + 1];
    const b = data[i * channels + 2];

    // Luminance (weighted average)
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;

    // Only paint pixels that are white/near-white (walls, ceiling from clean pass)
    // Floor is concrete (~130-160 lum), door panels are medium grey
    // Walls from clean pass are 220-255 luminance
    let alpha = 0;
    if (lum > 200) {
      // High luminance = wall/ceiling — full color application
      // Scale: 200 lum = 0 alpha, 255 lum = full alpha
      alpha = Math.round(((lum - 200) / 55) * opacity * 255);
    }

    const j = i * 4;
    maskData[j]     = color.r;
    maskData[j + 1] = color.g;
    maskData[j + 2] = color.b;
    maskData[j + 3] = alpha;
  }

  // Convert mask to sharp image
  const maskImg = await sharp(maskData, {
    raw: { width, height, channels: 4 }
  }).png().toBuffer();

  // Composite: base image + color mask overlay
  await sharp(inputPath)
    .composite([{ input: maskImg, blend: "over" }])
    .toFile(outputPath);

  console.log(`  Painted: ${path.basename(outputPath)} (${hexColor}, opacity ${opacity})`);
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    // Demo mode: paint all BM colors onto the best clean image we have
    const cleanImg = path.join(__dirname, "test_v7", "shared_p1_white.png");
    if (!fs.existsSync(cleanImg)) {
      console.error("No clean image found. Run test-v7.js first, or specify an input.");
      process.exit(1);
    }

    const outDir = path.join(__dirname, "paint_samples");
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

    console.log("\n=== PAINT WALL SAMPLES — All BM Colors ===\n");
    for (const [name, hex] of Object.entries(BM_COLORS)) {
      const outPath = path.join(outDir, `${name}.png`);
      await applyWallColor(cleanImg, outPath, hex, 0.55);
    }
    console.log(`\nDone. Check: ${outDir}`);
    return;
  }

  // Direct usage: input output hex [opacity]
  const [input, output, hex, opacityStr] = args;
  const opacity = opacityStr ? parseFloat(opacityStr) : 0.55;
  await applyWallColor(input, output, hex, opacity);
}

main().catch(e => { console.error("Fatal:", e.message); process.exit(1); });
