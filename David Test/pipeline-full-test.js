#!/usr/bin/env node
/**
 * Full 4-Step Pipeline Test — From Raw HEIC to Final 3 Shades of Gray
 *
 * Step 1: Kontext Pro (guidance 7.0) — Base cleanup, white walls, remove all clutter
 * Step 2: Nano Banana 2 Edit — Paint 3 BM grays in parallel
 * Step 3: Kontext Pro (guidance 3.5) — Remove black grate from back right wall
 * Step 4: Nano Banana 2 Edit — Remove white trim/baseboard (conditional)
 */

const fs = require("fs");
const path = require("path");

const FAL_API_KEY = process.env.FAL_API_KEY;
if (!FAL_API_KEY) { console.error("Set FAL_API_KEY"); process.exit(1); }

const GRAYS = [
  { code: "HC-169", name: "Coventry Gray" },
  { code: "HC-170", name: "Stonington Gray" },
  { code: "HC-168", name: "Chelsea Gray" },
];

// ── API Callers ──

async function callKontext(imageUrl, prompt, guidance = 7.0) {
  const res = await fetch("https://fal.run/fal-ai/flux-pro/kontext", {
    method: "POST",
    headers: { Authorization: `Key ${FAL_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ image_url: imageUrl, prompt, num_images: 1, guidance_scale: guidance, output_format: "png" }),
  });
  if (!res.ok) throw new Error(`Kontext ${res.status}: ${await res.text()}`);
  const r = await res.json();
  return r.images[0].url;
}

async function callNanoBanana(imageUrl, prompt) {
  const res = await fetch("https://fal.run/fal-ai/nano-banana-2/edit", {
    method: "POST",
    headers: { Authorization: `Key ${FAL_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ image_urls: [imageUrl], prompt, num_images: 1, resolution: "1K", output_format: "png" }),
  });
  if (!res.ok) throw new Error(`NanoBanana ${res.status}: ${await res.text()}`);
  const r = await res.json();
  return r.images[0].url;
}

async function download(url, filePath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Download failed");
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(filePath, buf);
  console.log(`      💾 ${path.basename(filePath)} (${(buf.length / 1024 / 1024).toFixed(1)}MB)`);
  return filePath;
}

function toDataUri(filePath) {
  const ext = path.extname(filePath).slice(1);
  const mime = ext === "jpg" ? "image/jpeg" : "image/png";
  return `data:${mime};base64,${fs.readFileSync(filePath).toString("base64")}`;
}

async function main() {
  const outDir = path.join(__dirname, "pipeline_full_test");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

  const sourceJpg = path.join(__dirname, "IMG_1624.jpg");
  if (!fs.existsSync(sourceJpg)) { console.error("IMG_1624.jpg not found — run sips conversion first"); process.exit(1); }

  const sourceUri = toDataUri(sourceJpg);
  console.log(`\n🏗️  FULL PIPELINE TEST — IMG_1624.HEIC → 3 Shades of Gray\n`);

  // ════════════════════════════════════════
  // STEP 1: Base Cleanup — Kontext Pro (guidance 7.0)
  // ════════════════════════════════════════
  console.log("━━━ STEP 1: Base Cleanup — Kontext Pro (guidance 7.0) ━━━");
  console.log("   Painting walls white, covering drywall, removing all clutter...\n");

  const step1Prompt = "Transform this garage with a complete luxury paint job. Paint ALL walls and ceiling crisp bright white with a smooth, even, professional finish. Cover all drywall tape, mud, seams, and imperfections completely — no raw drywall showing anywhere. The walls should look freshly painted by a professional crew with clean, crisp lines. Remove ALL items from the garage: all bikes, boxes, bins, shelving, wall-mounted items, grates, stepping stools, and clutter. Completely empty garage — nothing on the walls, nothing on the floor. Only the garage structure remains: walls, ceiling, door, window, light fixture. Bright, even lighting. Photorealistic result.";

  const step1Url = await callKontext(sourceUri, step1Prompt, 7.0);
  const step1File = await download(step1Url, path.join(outDir, "step1_base_cleanup.png"));
  console.log("   ✅ Step 1 complete\n");

  // ════════════════════════════════════════
  // STEP 2: Paint 3 BM Grays — Nano Banana 2 (parallel)
  // ════════════════════════════════════════
  console.log("━━━ STEP 2: Paint 3 BM Grays — Nano Banana 2 Edit ━━━\n");

  const step1Uri = toDataUri(step1File);
  const step2Files = await Promise.all(GRAYS.map(async (g) => {
    const prompt = `Repaint all walls and ceiling from white to Benjamin Moore ${g.name} (${g.code}). Smooth, even, professional satin finish. Crisp paint lines at trim and ceiling edges. Empty garage, nothing on the floor, nothing on the walls. Keep the exact same garage structure, window, door, ceiling, and lighting. Only change the paint color.`;
    console.log(`   🎨 ${g.name} (${g.code})...`);
    const url = await callNanoBanana(step1Uri, prompt);
    const file = await download(url, path.join(outDir, `step2_${g.name.replace(/\s+/g, "_")}_${g.code}.png`));
    console.log(`   ✅ ${g.name} done\n`);
    return { ...g, file };
  }));

  // ════════════════════════════════════════
  // STEP 3: Surgical Cleanup — Kontext Pro (guidance 3.5)
  // Remove black grate from back right wall
  // ════════════════════════════════════════
  console.log("━━━ STEP 3: Surgical Cleanup — Kontext Pro (guidance 3.5) ━━━");
  console.log("   Removing black grate from back right wall...\n");

  const step3Prompt = "Remove the black grate/vent at the top right of the back wall. Replace it with the same wall color so the wall looks clean and smooth. Change absolutely nothing else in the image.";

  const step3Files = await Promise.all(step2Files.map(async (s) => {
    const uri = toDataUri(s.file);
    console.log(`   🔧 ${s.name} (${s.code})...`);
    const url = await callKontext(uri, step3Prompt, 3.5);
    const file = await download(url, path.join(outDir, `step3_${s.name.replace(/\s+/g, "_")}_${s.code}.png`));
    console.log(`   ✅ ${s.name} done\n`);
    return { ...s, file };
  }));

  // ════════════════════════════════════════
  // STEP 4: Detail Refinement — Nano Banana 2
  // Remove white trim/baseboard
  // ════════════════════════════════════════
  console.log("━━━ STEP 4: Detail Refinement — Nano Banana 2 Edit ━━━");
  console.log("   Removing white trim/baseboard...\n");

  const step4Prompt = "Paint over the white trim/baseboard at the bottom of all walls so it matches the gray wall color above it. The white horizontal band running along the base of the walls should become the same gray as the rest of the wall. Do not change anything else in the image — keep the floor, ceiling, door, window, and all geometry exactly the same.";

  const step4Files = await Promise.all(step3Files.map(async (s) => {
    const uri = toDataUri(s.file);
    console.log(`   🔧 ${s.name} (${s.code})...`);
    const url = await callNanoBanana(uri, step4Prompt);
    const file = await download(url, path.join(outDir, `final_${s.name.replace(/\s+/g, "_")}_${s.code}.png`));
    console.log(`   ✅ ${s.name} done\n`);
    return { ...s, file };
  }));

  console.log("═══════════════════════════════════════");
  console.log("🏁 PIPELINE COMPLETE");
  console.log("═══════════════════════════════════════");
  console.log(`\n📁 All outputs in: ${outDir}`);
  console.log("   step1_base_cleanup.png         — White wall base");
  step2Files.forEach(f => console.log(`   ${path.basename(f.file)}  — Paint only`));
  step3Files.forEach(f => console.log(`   ${path.basename(f.file)}  — Grate removed`));
  step4Files.forEach(f => console.log(`   ${path.basename(f.file)}  — Final (trim removed)`));
  console.log("");
  process.exit(0);
}

main().catch(e => { console.error("Fatal:", e); process.exit(1); });
