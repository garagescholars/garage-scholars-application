const fs = require('fs');
const path = require('path');

const FAL_KEY = process.env.FAL_KEY || '21ad1ca3-1b7b-49ad-8048-150c58196ef5:79e754b084f207e7d84a4c77ed0bb4e0';
const WIDE_URL = 'https://storage.googleapis.com/garage-scholars-v2.firebasestorage.app/gs_consultation_photos/david_test/wide_angle.jpg';
const OUT_DIR = path.join(__dirname, 'renditions_v3_kontext');

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

async function generate(item) {
  console.log('Starting:', item.name);
  const start = Date.now();
  try {
    const resp = await fetch('https://fal.run/fal-ai/flux-pro/kontext', {
      method: 'POST',
      headers: { 'Authorization': 'Key ' + FAL_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image_url: WIDE_URL,
        prompt: item.prompt,
        guidance_scale: 20,
        num_inference_steps: 40,
      }),
    });
    if (!resp.ok) {
      const errText = await resp.text();
      console.error('FAILED ' + item.name + ': ' + resp.status + ' ' + errText.substring(0, 300));
      return;
    }
    const result = await resp.json();
    const imgUrl = result.images && result.images[0] && result.images[0].url;
    if (!imgUrl) {
      console.error('NO IMAGE for ' + item.name + ': ' + JSON.stringify(result).substring(0, 200));
      return;
    }
    const imgResp = await fetch(imgUrl);
    const buffer = Buffer.from(await imgResp.arrayBuffer());
    fs.writeFileSync(path.join(OUT_DIR, item.name + '.jpg'), buffer);
    console.log('DONE:', item.name, '(' + Math.round(buffer.length / 1024) + 'KB, ' + Math.round((Date.now() - start) / 1000) + 's)');
  } catch (e) {
    console.error('ERROR ' + item.name + ':', e.message);
  }
}

const allPrompts = [
  // PAINT COLOR OPTIONS — Kontext edit instructions with exact BM hex codes
  {
    name: '01_paint_stonington_gray',
    prompt: 'Make these changes to this garage photo: 1) Paint ALL walls and the ceiling a smooth, uniform light silvery gray color #CACBC5 (Benjamin Moore Stonington Gray). The drywall should look perfectly finished and painted — no visible tape, mud, or joints. 2) Remove ALL clutter, boxes, and items from the floor and back wall area. 3) Add white overhead ceiling-mounted storage racks with large blue plastic bins near the ceiling. 4) Add wall-mounted vertical bike racks on the right wall holding the bikes vertically by their front wheels, completely off the floor. 5) Add black wire shelving along the back wall with neat rows of labeled clear storage bins. 6) The concrete floor should be completely empty and clean. Keep the garage door, ceiling structure, window, and door exactly as they are.',
  },
  {
    name: '02_paint_coventry_gray',
    prompt: 'Make these changes to this garage photo: 1) Paint ALL walls and the ceiling a smooth, uniform medium gray color #B8BAB6 (Benjamin Moore Coventry Gray). This gray is noticeably darker than white — a true medium gray. The drywall should look perfectly finished and painted — no visible tape, mud, or joints. 2) Remove ALL clutter, boxes, and items from the floor and back wall area. 3) Add white overhead ceiling-mounted storage racks with large blue plastic bins near the ceiling. 4) Add wall-mounted vertical bike racks on the right wall holding the bikes vertically by their front wheels, completely off the floor. 5) Add black wire shelving along the back wall with neat rows of labeled clear storage bins. 6) The concrete floor should be completely empty and clean. Keep the garage door, ceiling structure, window, and door exactly as they are.',
  },
  {
    name: '03_paint_gray_owl',
    prompt: 'Make these changes to this garage photo: 1) Paint ALL walls and the ceiling a smooth, uniform soft light gray color #D3D4CC (Benjamin Moore Gray Owl). This is a light gray with a subtle cool green undertone. The drywall should look perfectly finished and painted — no visible tape, mud, or joints. 2) Remove ALL clutter, boxes, and items from the floor and back wall area. 3) Add white overhead ceiling-mounted storage racks with large blue plastic bins near the ceiling. 4) Add wall-mounted vertical bike racks on the right wall holding the bikes vertically by their front wheels, completely off the floor. 5) Add black wire shelving along the back wall with neat rows of labeled clear storage bins. 6) The concrete floor should be completely empty and clean. Keep the garage door, ceiling structure, window, and door exactly as they are.',
  },
  // STORAGE CONFIGURATIONS — all use Coventry Gray #B8BAB6 as base
  {
    name: '04_storage_vertical_bikes_overhead',
    prompt: 'Make these changes to this garage photo: 1) Paint all walls and ceiling a smooth uniform medium gray #B8BAB6, perfectly finished. 2) Remove ALL clutter from the garage. 3) Add four large white SafeRacks-style overhead ceiling storage platforms mounted flat against the ceiling holding large plastic storage bins. 4) On the right wall, add 5 Steadyrack-style vertical swivel bike racks — each holding a bike vertically by its front wheel, swung flat against the wall to save space. 5) Along the back wall, add two tall black wire shelving units completely filled with neat rows of labeled clear Greenmade storage bins. 6) The concrete floor must be 100% empty — nothing on it at all. Keep the garage door, ceiling joists, window, and door exactly as they are.',
  },
  {
    name: '05_storage_ceiling_hoist_bikes',
    prompt: 'Make these changes to this garage photo: 1) Paint all walls and ceiling a smooth uniform medium gray #B8BAB6, perfectly finished. 2) Remove ALL clutter from the garage. 3) Add ceiling-mounted bike hoists with pulley/rope systems — 4 bikes lifted horizontally flat against the ceiling, suspended from ceiling hooks, completely off the floor. 4) Add four white overhead metal ceiling storage rack platforms holding large bins. 5) Cover the entire back wall with gray slatwall organization panels fitted with hooks, baskets, small shelves, and labeled bins for tools and supplies. 6) The concrete floor must be 100% empty — nothing on it at all. Keep the garage door, ceiling joists, window, and door exactly as they are.',
  },
  {
    name: '06_storage_horizontal_hooks_pegboard',
    prompt: 'Make these changes to this garage photo: 1) Paint all walls and ceiling a smooth uniform medium gray #B8BAB6, perfectly finished. 2) Remove ALL clutter from the garage. 3) On the right wall, add heavy-duty horizontal wall-mounted bike hooks hanging 5 bikes horizontally by their frames at staggered heights, alternating direction to save space. 4) Add four white overhead metal ceiling storage rack platforms holding bins near the ceiling. 5) Along the back wall, add black wire shelving units with rows of labeled clear storage bins. 6) On the left wall, add a large white pegboard tool organization panel with neatly arranged tools, hooks, and holders. 7) The concrete floor must be 100% empty. Keep the garage door, ceiling joists, window, and door exactly as they are.',
  },
];

// Run in batches of 2 (fal.ai concurrency limit)
(async () => {
  for (let i = 0; i < allPrompts.length; i += 2) {
    const batch = allPrompts.slice(i, i + 2);
    console.log('\n--- Batch ' + (Math.floor(i/2) + 1) + ' of ' + Math.ceil(allPrompts.length/2) + ' ---');
    await Promise.all(batch.map(generate));
  }
  console.log('\nAll 6 generations complete!');
})();
