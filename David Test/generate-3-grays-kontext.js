#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const FAL_API_KEY = process.env.FAL_API_KEY;
if (!FAL_API_KEY) { console.error("Set FAL_API_KEY"); process.exit(1); }

const BASE = "https://storage.googleapis.com/garage-scholars-v2.firebasestorage.app/gs_consultation_mockups/Fz5gaa5RxXoU7mvQ3sdw/tier1_kontext2pass_1773117612330.png";

const GRAYS = [
  { code: "HC-169", name: "Coventry Gray" },
  { code: "HC-170", name: "Stonington Gray" },
  { code: "HC-168", name: "Chelsea Gray" },
];

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

async function main() {
  const outDir = path.join(__dirname, "renditions_v8_kontext_paint");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

  console.log("\n🎨 3 Shades of Gray — Kontext Pro (geometry-preserving)\n");

  const jobs = GRAYS.map(async (g) => {
    const prompt = `Change the wall and ceiling color to Benjamin Moore ${g.name} (${g.code}). Smooth satin finish. Change nothing else.`;
    console.log(`   🎨 ${g.name} ${g.code}...`);
    const url = await call(BASE, prompt);
    const file = path.join(outDir, `${g.name.replace(/\s+/g, "_")}_${g.code}.png`);
    const res = await fetch(url);
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(file, buf);
    console.log(`   ✅ ${g.name} — ${path.basename(file)} (${(buf.length/1024/1024).toFixed(1)}MB)`);
  });

  await Promise.all(jobs);
  console.log(`\n📁 ${outDir}\n`);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
