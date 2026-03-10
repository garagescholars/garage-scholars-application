#!/usr/bin/env node
/**
 * David v6 — Multi-model comparison on tier1_kontext base
 *
 * Test 3 models × 1 gray (Stonington) to find the best preservation model:
 *   A) Kontext Pro — multi-pass (paint → rack → bins)
 *   B) Kontext Max — single pass (more powerful adherence)
 *   C) Nano Banana 2 Edit — Gemini-based reasoning editor
 *
 * Then generate 3 grays with the winner.
 */

const fs = require("fs");
const path = require("path");

const FAL_API_KEY = process.env.FAL_API_KEY;
if (!FAL_API_KEY) { console.error("Set FAL_API_KEY"); process.exit(1); }

const BASE_IMAGE = "https://storage.googleapis.com/garage-scholars-v2.firebasestorage.app/gs_consultation_mockups/Fz5gaa5RxXoU7mvQ3sdw/tier1_kontext2pass_1773117612330.png";

const TEST_GRAY = { code: "HC-170", name: "Stonington Gray", hex: "#9A9E9A" };

// ── Prompts ──

const PAINT_PROMPT = `Repaint all walls and ceiling from white to Benjamin Moore ${TEST_GRAY.name} (${TEST_GRAY.code}). Smooth, even, professional satin finish. Keep everything else exactly the same. Do not add or remove anything. Only change the wall and ceiling color.`;

const RACK_PROMPT = "Add a wall-mounted bike storage rack on the back right wall — a gray powder-coated steel horizontal bar with four sliding J-hooks, with two mountain bikes and two road bikes hung vertically by their front wheels. Remove the stepping stool from the floor. Keep everything else exactly the same.";

const BINS_PROMPT = "Add along the left wall: one 5-tier commercial black metal shelving unit neatly loaded with 8 black storage bins with green lids. Add near the ceiling: two white overhead ceiling storage racks mounted flush to the joists. Keep everything else exactly the same.";

const SINGLE_PROMPT = [
  `Repaint all walls and ceiling to Benjamin Moore ${TEST_GRAY.name} (${TEST_GRAY.code}), smooth satin finish.`,
  "Add on the back right wall: a gray steel wall-mounted bike rack bar with four J-hooks holding two mountain bikes and two road bikes hung vertically.",
  "Add along the left wall: one 5-tier black metal shelving unit with 8 black storage bins with green lids.",
  "Add near the ceiling: two white overhead storage racks mounted to the joists.",
  "Remove the stepping stool from the floor. Clean concrete floor, nothing else on it.",
  "Keep the exact same garage structure, window, door, ceiling, lighting, and perspective.",
].join(" ");

// ── API callers ──

async function callKontext(imageUrl, prompt, label) {
  console.log(`      [Kontext Pro] ${label}...`);
  const res = await fetch("https://fal.run/fal-ai/flux-pro/kontext", {
    method: "POST",
    headers: { Authorization: `Key ${FAL_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ image_url: imageUrl, prompt, num_images: 1, guidance_scale: 5.0, output_format: "png" }),
  });
  if (!res.ok) throw new Error(`Kontext ${res.status}: ${await res.text()}`);
  const r = await res.json();
  return r.images?.[0]?.url || (() => { throw new Error("No image"); })();
}

async function callKontextMax(imageUrl, prompt) {
  console.log("      [Kontext Max] Calling...");
  const res = await fetch("https://fal.run/fal-ai/flux-pro/kontext/max", {
    method: "POST",
    headers: { Authorization: `Key ${FAL_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ image_url: imageUrl, prompt, num_images: 1, guidance_scale: 5.0, output_format: "png" }),
  });
  if (!res.ok) throw new Error(`Kontext Max ${res.status}: ${await res.text()}`);
  const r = await res.json();
  return r.images?.[0]?.url || (() => { throw new Error("No image"); })();
}

async function callNanoBanana(imageUrl, prompt) {
  console.log("      [Nano Banana 2] Calling...");
  const res = await fetch("https://fal.run/fal-ai/nano-banana-2/edit", {
    method: "POST",
    headers: { Authorization: `Key ${FAL_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ image_urls: [imageUrl], prompt, num_images: 1, resolution: "1K", output_format: "png" }),
  });
  if (!res.ok) throw new Error(`Nano Banana ${res.status}: ${await res.text()}`);
  const r = await res.json();
  return r.images?.[0]?.url || (() => { throw new Error("No image"); })();
}

async function download(url, filePath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Download failed");
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(filePath, buf);
  console.log(`      💾 ${path.basename(filePath)} (${(buf.length / 1024 / 1024).toFixed(1)}MB)`);
}

async function main() {
  const outDir = path.join(__dirname, "renditions_v6_model_test");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

  console.log("\n🧪 Model Comparison — Stonington Gray on tier1_kontext base");
  console.log("   No cars. Minimalist. Preserve geometry.\n");

  // ── A) Kontext Pro 3-pass ──
  const kontextPro = (async () => {
    try {
      console.log("   🅰️  Kontext Pro (3-pass: paint → rack → bins)");
      const step1 = await callKontext(BASE_IMAGE, PAINT_PROMPT, "Pass 1: Paint");
      const step2 = await callKontext(step1, RACK_PROMPT, "Pass 2: Bike rack");
      const step3 = await callKontext(step2, BINS_PROMPT, "Pass 3: Bins + overhead");
      await download(step3, path.join(outDir, "A_kontext_pro_3pass.png"));
      console.log("   ✅ Kontext Pro done\n");
      return true;
    } catch (e) {
      console.error(`   ❌ Kontext Pro: ${e.message}\n`);
      return false;
    }
  })();

  // ── B) Kontext Max single pass ──
  const kontextMax = (async () => {
    try {
      console.log("   🅱️  Kontext Max (single pass)");
      const url = await callKontextMax(BASE_IMAGE, SINGLE_PROMPT);
      await download(url, path.join(outDir, "B_kontext_max.png"));
      console.log("   ✅ Kontext Max done\n");
      return true;
    } catch (e) {
      console.error(`   ❌ Kontext Max: ${e.message}\n`);
      return false;
    }
  })();

  // ── C) Nano Banana 2 Edit ──
  const nanoBanana = (async () => {
    try {
      console.log("   🅲  Nano Banana 2 Edit (Gemini reasoning)");
      const url = await callNanoBanana(BASE_IMAGE, SINGLE_PROMPT);
      await download(url, path.join(outDir, "C_nano_banana_2.png"));
      console.log("   ✅ Nano Banana 2 done\n");
      return true;
    } catch (e) {
      console.error(`   ❌ Nano Banana 2: ${e.message}\n`);
      return false;
    }
  })();

  await Promise.all([kontextPro, kontextMax, nanoBanana]);

  console.log("📁 Results in:", outDir);
  console.log("   Compare A vs B vs C to pick the winner.\n");
  process.exit(0);
}

main().catch(e => { console.error("Fatal:", e); process.exit(1); });
