#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const FAL_API_KEY = process.env.FAL_API_KEY;
if (!FAL_API_KEY) { console.error("Set FAL_API_KEY"); process.exit(1); }

const SOURCES = [
  { file: "Coventry_Gray_HC-169.png", name: "Coventry Gray", code: "HC-169" },
  { file: "Stonington_Gray_HC-170.png", name: "Stonington Gray", code: "HC-170" },
  { file: "Chelsea_Gray_HC-168.png", name: "Chelsea Gray", code: "HC-168" },
];

const INPUT_DIR = path.join(__dirname, "renditions_v8_kontext_paint");

async function call(imageUrl, prompt) {
  const res = await fetch("https://fal.run/fal-ai/flux-pro/kontext", {
    method: "POST",
    headers: { Authorization: `Key ${FAL_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      image_url: imageUrl,
      prompt,
      num_images: 1,
      guidance_scale: 3.5,
      output_format: "png",
    }),
  });
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
  const r = await res.json();
  return r.images[0].url;
}

async function uploadToTmp(filePath) {
  // Upload local file to fal.ai storage so Kontext can use it
  const fileData = fs.readFileSync(filePath);
  const res = await fetch("https://fal.run/fal-ai/flux-pro/kontext", {
    method: "POST",
    headers: { Authorization: `Key ${FAL_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      image_url: `data:image/png;base64,${fileData.toString("base64")}`,
      prompt: "Keep this image exactly the same. Change nothing.",
      num_images: 1,
      guidance_scale: 1.0,
      output_format: "png",
    }),
  });
  // Actually, let's just use data URI directly as the image_url
  return `data:image/png;base64,${fileData.toString("base64")}`;
}

async function main() {
  const outDir = path.join(__dirname, "renditions_v9_final");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

  console.log("\n🎨 Removing black grate — Kontext Pro pass on v8 images\n");

  const prompt = "Remove the black grate/vent at the top right of the back wall. Replace it with the same wall color so the wall looks clean and smooth. Change absolutely nothing else in the image.";

  const jobs = SOURCES.map(async (s) => {
    console.log(`   🔧 ${s.name} ${s.code}...`);
    const localPath = path.join(INPUT_DIR, s.file);
    const imageUrl = `data:image/png;base64,${fs.readFileSync(localPath).toString("base64")}`;
    const url = await call(imageUrl, prompt);
    const outFile = path.join(outDir, s.file);
    const res = await fetch(url);
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(outFile, buf);
    console.log(`   ✅ ${s.name} — ${path.basename(outFile)} (${(buf.length/1024/1024).toFixed(1)}MB)`);
  });

  await Promise.all(jobs);
  console.log(`\n📁 ${outDir}\n`);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
