#!/usr/bin/env node
/**
 * 3-Pass Pipeline Test — One product type per pass
 *
 * Hypothesis: Placing all objects in one Pass 2 is too much for the model.
 * Breaking into separate passes (one object type each) should improve realism.
 *
 * Pass 1: Clean + paint (guidance 12)
 * Pass 2: Overhead ceiling racks only (guidance 7, with ref)
 * Pass 3: Bike rack only (guidance 5, with ref — lower to preserve Pass 2)
 * Pass 4: Shelving units only (guidance 5, with ref)
 *
 * Usage: FAL_API_KEY=your_key node test-3pass.js
 */

const fs   = require("fs");
const path = require("path");

const FAL_API_KEY = process.env.FAL_API_KEY;
if (!FAL_API_KEY) { console.error("Set FAL_API_KEY"); process.exit(1); }

const WIDE_URL = "https://storage.googleapis.com/garage-scholars-v2.firebasestorage.app/gs_consultation_photos/david_test/wide_angle.jpg";
const OUT_DIR  = path.join(__dirname, "test_3pass");
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const PRODUCT_REFS = {
  overhead_rack:  "https://i.ebayimg.com/images/g/3DkAAeSwOt5pfvBE/s-l500.jpg",
  bike_rack:      "https://i.ebayimg.com/images/g/RykAAeSwK1pok4r0/s-l500.jpg",
  shelving:       "https://i.ebayimg.com/images/g/kSwAAeSwYVFobJMm/s-l500.jpg",
  cabinets:       "https://i.ebayimg.com/images/g/CyMAAOSwNuFk0RCB/s-l500.jpg",
};

async function callKontext(imageUrl, prompt, refs = [], guidance = 7.0) {
  const body = { image_url: imageUrl, prompt, num_images: 1, guidance_scale: guidance, output_format: "png" };
  if (refs.length > 0) body.images = [imageUrl, ...refs];
  const res = await fetch("https://fal.run/fal-ai/flux-pro/kontext", {
    method: "POST",
    headers: { Authorization: `Key ${FAL_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Kontext ${res.status}: ${await res.text()}`);
  return (await res.json()).images[0].url;
}

async function save(url, name) {
  const res = await fetch(url);
  const buf = Buffer.from(await res.arrayBuffer());
  const fp  = path.join(OUT_DIR, name);
  fs.writeFileSync(fp, buf);
  console.log(`      Saved: ${name} (${(buf.length/1024).toFixed(0)}KB)`);
  return fp;
}

const SPATIAL = "Preserve all original perspective, proportions, and lighting exactly. Keep everything already in the garage exactly as-is — only add the new item described. Photorealistic, brand new, professionally installed. ";

const PASS1_PROMPT = "Transform this garage completely. Paint ALL walls and ceiling crisp bright white with a smooth, even, professional finish — no raw drywall, tape, mud, or seams visible anywhere. Remove EVERY SINGLE item from the garage: all bikes, bicycle racks, bike hooks, couch, sofa, boxes, bins, shelving units, wall-mounted storage, overhead racks, grid panels, tools, bags, and all clutter. Completely empty garage — nothing on the walls, nothing hanging, nothing on the floor. Only the bare garage structure remains: painted walls, ceiling, concrete floor, garage door, window, door to house. Bright even LED lighting. Photorealistic result.";

async function main() {
  console.log("\n=== 3-PASS PIPELINE TEST ===\n");

  // ── Pass 1: Clean ───────────────────────────────────────────
  console.log("Pass 1: Cleaning + painting (guidance 12)...");
  const p1url = await callKontext(WIDE_URL, PASS1_PROMPT, [], 12.0);
  const p1file = await save(p1url, "pass1_clean.png");
  console.log("Pass 1 done.\n");

  // ── Tier 2 — 3-pass build ───────────────────────────────────
  console.log("─── TIER 2: 3-pass build ───");

  console.log("Pass 2a: Adding overhead ceiling racks (guidance 7, with ref)...");
  const t2p2prompt = SPATIAL + "Add two large white powder-coated overhead ceiling storage racks (each 4ft x 8ft) mounted flat against the ceiling joists in the center of the ceiling, hanging from adjustable drop brackets. Each rack holds large plastic storage bins on its wire mesh surface. The racks are mounted high — just below the ceiling joists. Nothing else changes.";
  const t2p2url = await callKontext(p1url, t2p2prompt, [PRODUCT_REFS.overhead_rack], 7.0);
  const t2p2file = await save(t2p2url, "tier2_pass2_overhead.png");

  console.log("Pass 2b: Adding bike rack (guidance 5, with ref)...");
  const t2p3prompt = SPATIAL + "Add a Monkey Bars wall-mounted horizontal bike storage bar mounted high on the right wall — a gray powder-coated steel bar with four J-hooks, four bikes hanging vertically by their front wheels, all off the floor. Mount it at eye level near the ceiling, centered on the right wall. Nothing else changes.";
  const t2p3url  = await callKontext(t2p2url, t2p3prompt, [PRODUCT_REFS.bike_rack], 5.0);
  const t2p3file = await save(t2p3url, "tier2_pass3_bikes.png");

  console.log("Pass 2c: Adding shelving (guidance 5, with ref)...");
  const t2p4prompt = SPATIAL + "Add two tall black wire shelving units standing against the back wall, each unit loaded with neat rows of labeled clear plastic storage bins. The shelves are five tiers tall, flush against the back wall. Nothing else changes.";
  const t2p4url  = await callKontext(t2p3url, t2p4prompt, [PRODUCT_REFS.shelving], 5.0);
  await save(t2p4url, "tier2_final_3pass.png");
  console.log("Tier 2 done.\n");

  // ── Tier 3 — 3-pass build ───────────────────────────────────
  console.log("─── TIER 3: 3-pass build ───");

  console.log("Pass 2a: Adding NewAge cabinets (guidance 7, with ref)...");
  const t3p2prompt = SPATIAL + "Add a full continuous run of NewAge Bold Series glossy black steel garage cabinets with stainless steel countertops: base cabinets (36 inches tall) running the entire length of the back wall and wrapping down the right wall, with matching upper wall cabinets mounted above them. The cabinets are flush to the walls, perfectly level, with clean stainless countertops. Nothing else changes.";
  const t3p2url  = await callKontext(p1url, t3p2prompt, [PRODUCT_REFS.cabinets], 7.0);
  await save(t3p2url, "tier3_pass2_cabinets.png");

  console.log("Pass 2b: Adding overhead racks (guidance 5, with ref)...");
  const t3p3prompt = SPATIAL + "Add four large white powder-coated overhead ceiling storage racks mounted flat against the ceiling joists across the full ceiling span, loaded with storage bins. Nothing else changes.";
  const t3p3url  = await callKontext(t3p2url, t3p3prompt, [PRODUCT_REFS.overhead_rack], 5.0);
  await save(t3p3url, "tier3_final_3pass.png");
  console.log("Tier 3 done.\n");

  console.log(`=== Complete. Outputs in: ${OUT_DIR} ===\n`);
  process.exit(0);
}

main().catch(e => { console.error("Fatal:", e.message); process.exit(1); });
