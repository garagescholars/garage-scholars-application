#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const FAL_API_KEY = process.env.FAL_API_KEY;
if (!FAL_API_KEY) { console.error("Set FAL_API_KEY"); process.exit(1); }

const SOURCES = [
  { file: "Coventry_Gray_HC-169.png", name: "Coventry Gray", code: "HC-169" },
  { file: "Stonington_Gray_HC-170.png", name: "Stonington Gray", code: "HC-170" },
];

const INPUT_DIR = path.join(__dirname, "renditions_v9_final");

async function call(imageUrl, prompt) {
  const res = await fetch("https://fal.run/fal-ai/nano-banana-2/edit", {
    method: "POST",
    headers: { Authorization: `Key ${FAL_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      image_urls: [imageUrl],
      prompt,
      num_images: 1,
      resolution: "1K",
      output_format: "png",
    }),
  });
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
  const r = await res.json();
  return r.images[0].url;
}

async function main() {
  const outDir = path.join(__dirname, "renditions_v10_no_trim");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

  console.log("\n🎨 Removing white trim — Nano Banana 2 (better reasoning)\n");

  const prompt = "Paint over the white trim/baseboard at the bottom of all walls so it matches the gray wall color above it. The white horizontal band running along the base of the walls should become the same gray as the rest of the wall. Do not change anything else in the image — keep the floor, ceiling, door, window, and all geometry exactly the same.";

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
