#!/usr/bin/env node
/**
 * Generate David's 3 Gray Shade Mockups — Graduate Package
 *
 * 3 Benjamin Moore grays, minimalist luxury, FLUX.2 Pro Edit
 * Monkey Bars bike rack, black Greenmade bins, overhead racks, two cars
 */

const fs = require("fs");
const path = require("path");

const FAL_API_KEY = process.env.FAL_API_KEY;
if (!FAL_API_KEY) {
  console.error("Set FAL_API_KEY env var");
  process.exit(1);
}

// ── 3 Best BM Grays for this garage ──
const GRAYS = [
  { code: "HC-169", name: "Coventry Gray",   hex: "#A7A9A5", desc: "light, airy" },
  { code: "HC-170", name: "Stonington Gray", hex: "#9A9E9A", desc: "classic mid-tone" },
  { code: "HC-168", name: "Chelsea Gray",    hex: "#8A8C8A", desc: "deeper, sophisticated" },
];

function buildDavidPrompt(gray) {
  return [
    `Repaint all walls and ceiling from white to Benjamin Moore ${gray.name} (${gray.code}).`,
    "Smooth, even, professional satin finish. Crisp paint lines at trim and ceiling.",
    "",
    "Add to the back right wall: a Monkey Bars wall-mounted 4-bike storage rack —",
    "a 53-inch gray powder-coated industrial steel horizontal bar mounted high on the wall",
    "with four adjustable sliding J-hooks, two mountain bikes and two road bikes",
    "hung vertically by their front wheels in a neat organized row.",
    "",
    "Along the left wall: one 5-tier commercial black metal shelving unit (72 inches tall)",
    "neatly loaded with 8 black 27-gallon storage bins with green lids, labeled and organized.",
    "",
    "Near the ceiling: two white powder-coated overhead ceiling storage racks with wire mesh decking",
    "mounted flush against the ceiling joists.",
    "",
    "Two cars parked inside — a modern dark SUV on the left and a white sedan on the right.",
    "Clean concrete floor, nothing else on it except the cars.",
    "Remove the stepping stool completely.",
    "",
    "Minimalist luxury garage. Magazine-quality photorealistic interior design photography.",
    "Bright even LED lighting. Preserve exact garage geometry, perspective, and proportions.",
  ].join(" ");
}

async function callFlux2Edit(imageUrl, prompt) {
  console.log("      Calling FLUX.2 Pro Edit...");
  const response = await fetch("https://fal.run/fal-ai/flux-2-pro/edit", {
    method: "POST",
    headers: {
      Authorization: `Key ${FAL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      image_urls: [imageUrl],
      prompt,
      image_size: "auto",
      output_format: "png",
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`FLUX.2 ${response.status}: ${errText}`);
  }

  const result = await response.json();
  const url = result.images?.[0]?.url;
  if (!url) throw new Error("FLUX.2 returned no image");
  console.log("      ✅ Image generated");
  return url;
}

async function downloadToFile(url, filePath) {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Download failed");
  const buffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(filePath, buffer);
  console.log(`      💾 Saved: ${path.basename(filePath)} (${(buffer.length / 1024 / 1024).toFixed(1)}MB)`);
}

async function main() {
  // Use tier1_kontext as base — it's the cleanest starting point
  // (Kontext paint pass already cleaned walls, removed clutter, preserved geometry perfectly)
  const photoUrl = "https://storage.googleapis.com/garage-scholars-v2.firebasestorage.app/gs_consultation_mockups/Fz5gaa5RxXoU7mvQ3sdw/tier1_kontext2pass_1773117612330.png";

  console.log(`\n🏠 David's Garage — Graduate Package Mockups`);
  console.log(`   Base: tier1_kontext (clean Kontext paint pass — best geometry)`);
  console.log(`   Engine: FLUX.2 Pro Edit (gray paint + items on top)`);
  console.log(`   Generating 3 Benjamin Moore gray shades...\n`);

  const outDir = path.join(__dirname, "renditions_v5_david_grays");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

  // Run all 3 in parallel
  const promises = GRAYS.map(async (gray, i) => {
    const label = `${gray.name} (${gray.code})`;
    console.log(`   🎨 [${i + 1}/3] ${label} — ${gray.desc}`);
    const prompt = buildDavidPrompt(gray);
    console.log(`      Prompt length: ${prompt.length} chars`);

    try {
      const generatedUrl = await callFlux2Edit(photoUrl, prompt);
      const filename = `${String(i + 1).padStart(2, "0")}_${gray.name.replace(/\s+/g, "_")}_${gray.code}.png`;
      await downloadToFile(generatedUrl, path.join(outDir, filename));
      return { gray: label, success: true, filename };
    } catch (err) {
      console.error(`      ❌ ${label}: ${err.message}`);
      return { gray: label, success: false, error: err.message };
    }
  });

  const results = await Promise.all(promises);

  console.log("\n📊 Results:");
  results.forEach((r) => {
    console.log(`   ${r.success ? "✅" : "❌"} ${r.gray} — ${r.success ? r.filename : r.error}`);
  });

  console.log(`\n📁 Images saved to: ${outDir}\n`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
