#!/usr/bin/env node
/**
 * Test script — Trigger shade-based mockup generation directly (bypasses HTTP auth).
 *
 * Usage:
 *   node test-consultation-mockups.js                    # List consultations
 *   node test-consultation-mockups.js <consultationId>   # Generate for specific consultation
 *   node test-consultation-mockups.js --all              # Generate for all with photos
 */

const admin = require("firebase-admin");

// Initialize with ADC
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: "garage-scholars-v2",
    storageBucket: "garage-scholars-v2.firebasestorage.app",
  });
}

const db = admin.firestore();
const storage = admin.storage();
const COLLECTION = "gs_consultations";

const SHADE_KEYS = ["shade1", "shade2", "shade3"];

const DEFAULT_SHADES = {
  shade1: { bmCode: "HC-169", bmName: "Coventry Gray", hex: "#A7A9A5" },
  shade2: { bmCode: "HC-170", bmName: "Stonington Gray", hex: "#9A9E9A" },
  shade3: { bmCode: "HC-168", bmName: "Chelsea Gray", hex: "#8A8C8A" },
};

async function listConsultations() {
  const snap = await db.collection(COLLECTION).orderBy("createdAt", "desc").limit(20).get();
  if (snap.empty) {
    console.log("No consultations found.");
    return [];
  }

  console.log(`\n📋 Found ${snap.size} consultation(s):\n`);
  const docs = [];
  snap.forEach((doc) => {
    const d = doc.data();
    const hasPhoto = !!d.spacePhotoUrls?.wide;
    const status = d.status || "unknown";
    const mockupStatus = SHADE_KEYS.map((s) => {
      const m = d.mockups?.[s];
      return `${s}: ${m?.status || "—"} (${m?.bmName || "?"})`;
    }).join(" | ");

    console.log(`  ${doc.id}`);
    console.log(`    Client: ${d.clientName || "?"} | Service: ${d.serviceType} | Status: ${status}`);
    console.log(`    Photo: ${hasPhoto ? "✅" : "❌"} | Mockups: ${mockupStatus}`);
    console.log();
    docs.push({ id: doc.id, ...d });
  });
  return docs;
}

// ─── fal.ai FLUX.2 Pro Edit ───

async function callFlux2Edit(imageUrl, prompt, falApiKey) {
  console.log(`      [FLUX.2] Calling fal.ai...`);
  const response = await fetch("https://fal.run/fal-ai/flux-2-pro/edit", {
    method: "POST",
    headers: {
      Authorization: `Key ${falApiKey}`,
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
  console.log(`      [FLUX.2] ✅ Got image`);
  return url;
}

async function downloadAndUpload(generatedUrl, storagePath) {
  const imageResponse = await fetch(generatedUrl);
  if (!imageResponse.ok) throw new Error("Failed to download generated image");
  const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());

  const bucket = storage.bucket();
  const file = bucket.file(storagePath);
  await file.save(imageBuffer, { metadata: { contentType: "image/png" } });
  await file.makePublic();
  return `https://storage.googleapis.com/${bucket.name}/${storagePath}`;
}

// ─── Prompt builders ───

const LUXURY_PREAMBLE = "Professional interior design photography of a luxury garage transformation. Magazine-quality, photorealistic, bright even LED lighting, clean lines, premium materials throughout.";

const MONKEY_BARS_DESC = {
  "wall-2": "a Monkey Bars wall-mounted 2-bike storage rack — a sleek gray powder-coated steel horizontal bar with two adjustable sliding J-hooks, bikes hung vertically by their front wheels, mounted high on the wall to save floor space",
  "wall-4": "a Monkey Bars wall-mounted 4-bike storage rack — a 53-inch gray powder-coated industrial steel bar with four adjustable sliding J-hooks with rubber coating, four bikes hung vertically by their front wheels in a neat row, mounted high on the wall",
};

function normalizeGarageAddons(raw) {
  if (!raw) return { shelving: "none", overheadStorage: "none", cabinets: "none", wallOrg: "none", flooringType: "none", flooringColor: null, bikeRack: "none" };
  if (typeof raw.overheadStorage === "boolean" || typeof raw.polyasparticFlooring === "boolean") {
    return {
      shelving: raw.extraShelving ? "1-unit" : "none",
      overheadStorage: raw.overheadStorage ? "2-racks" : "none",
      cabinets: "none", wallOrg: "none",
      flooringType: raw.polyasparticFlooring ? "polyaspartic" : "none",
      flooringColor: raw.flooringColor && typeof raw.flooringColor === "string" ? { code: "", name: raw.flooringColor } : raw.flooringColor || null,
      bikeRack: raw.bikeRack || "none",
    };
  }
  if (typeof raw.flooring === "boolean") {
    return { ...raw, flooringType: raw.flooring ? "polyaspartic" : "none", bikeRack: raw.bikeRack || "none" };
  }
  return { ...raw, bikeRack: raw.bikeRack || "none" };
}

function buildFloorInstruction(addons) {
  const flooringType = addons.flooringType || "none";
  if (flooringType === "none") return "";
  const color = addons.flooringColor;
  const colorStr = color?.name && color?.code ? `Benjamin Moore ${color.name} (${color.code}) ` : color?.name ? `${color.name} ` : "";
  const map = {
    "polyaspartic": `pristine ${colorStr}polyaspartic flake floor coating with a glossy showroom finish`,
    "click-in-plate": `premium ${colorStr}click-in diamond plate garage flooring tiles with a factory-fresh metallic sheen`,
  };
  return map[flooringType] || `${colorStr}premium flooring`;
}

function buildGarageShadePrompt(doc, wallColor) {
  const addons = normalizeGarageAddons(doc.garageAddons);
  const size = doc.garageSize || "2-car";
  const ceiling = doc.ceilingHeight;
  let context = `${size} garage`;
  if (ceiling === "open-joists") context += " with exposed open joist ceilings";
  else if (ceiling === "10ft+") context += " with tall 10-foot ceilings";
  else if (ceiling) context += ` with ${ceiling} ceilings`;

  const wallColorStr = `Benjamin Moore ${wallColor.bmName} (${wallColor.bmCode})`;

  const style = doc.stylePreference === "workshop"
    ? "high-end workshop aesthetic with premium tool organization"
    : doc.stylePreference === "minimalist"
    ? "ultra-clean minimalist design with hidden storage and seamless surfaces"
    : "sleek modern luxury garage with magazine-quality design";

  const items = [];
  const bikeRack = addons.bikeRack || "none";
  if (bikeRack !== "none" && MONKEY_BARS_DESC[bikeRack]) items.push(MONKEY_BARS_DESC[bikeRack]);

  if (addons.overheadStorage !== "none") {
    const count = addons.overheadStorage === "4-racks" ? "four" : "two";
    items.push(`${count} heavy-duty white powder-coated overhead ceiling storage racks with wire mesh decking`);
  }

  if (addons.shelving !== "none") {
    const count = addons.shelving === "3-units" ? "three" : addons.shelving === "2-units" ? "two" : "one";
    items.push(`${count} commercial-grade black wire shelving unit${count !== "one" ? "s" : ""} neatly loaded with matching labeled clear plastic storage bins`);
  }

  if (addons.cabinets === "premium-newage") items.push("a full run of NewAge Bold Series glossy black steel garage cabinets with stainless steel countertops lining the walls");
  else if (addons.cabinets === "basic-wire") items.push("wall-mounted commercial wire storage cabinets with doors");

  if (addons.wallOrg === "pegboard") items.push("a large pegboard tool organization wall with premium hooks and tool silhouettes");
  else if (addons.wallOrg === "slatwall") items.push("a commercial gray slatwall organization panel with premium hooks, baskets, and shelves");

  const floor = buildFloorInstruction(addons);
  const floorStr = floor ? `Replace the entire floor with ${floor}.` : "";
  const installStr = items.length > 0 ? `Install: ${items.join("; ")}.` : "";
  const dream = doc.dreamDescription ? ` Client vision: "${doc.dreamDescription}".` : "";

  return `${LUXURY_PREAMBLE} Complete transformation of this ${context}. Paint ALL walls and ceiling ${wallColorStr} — smooth, even, professional finish, no raw drywall, tape, or mud visible. ${floorStr} ${installStr} All items brand new, professionally installed, perfectly aligned. ${style}. Remove all clutter, debris, and mess — this is a showroom-ready luxury garage.${dream} Photorealistic, preserve the exact garage geometry, perspective, and proportions.`;
}

// ─── Main generation runner ───

async function generateForConsultation(consultationId) {
  let falApiKey = process.env.FAL_API_KEY;
  if (!falApiKey) {
    try {
      const { execSync } = require("child_process");
      const result = execSync("firebase functions:secrets:access FAL_API_KEY --project garage-scholars-v2 2>/dev/null", { encoding: "utf-8" }).trim();
      if (result) falApiKey = result;
    } catch {}
  }
  if (!falApiKey) {
    console.error("❌ FAL_API_KEY not found. Set it as an env var: FAL_API_KEY=xxx node test-consultation-mockups.js ...");
    process.exit(1);
  }

  const docRef = db.collection(COLLECTION).doc(consultationId);
  const snap = await docRef.get();
  if (!snap.exists) { console.error("❌ Not found."); return; }

  const data = snap.data();
  const widePhotoUrl = data.spacePhotoUrls?.wide;
  if (!widePhotoUrl) { console.error("❌ No wide photo."); return; }

  console.log(`\n🚀 Generating for: ${data.clientName}`);
  console.log(`   Photo: ${widePhotoUrl.substring(0, 80)}...`);
  console.log(`   Addons: ${JSON.stringify(data.garageAddons || {})}\n`);

  await docRef.update({ status: "generating" });

  const timestamp = Date.now();
  const promises = [];

  for (const shade of SHADE_KEYS) {
    promises.push((async () => {
      const shadeData = data.mockups?.[shade];
      const wallColor = {
        bmCode: shadeData?.bmCode || DEFAULT_SHADES[shade].bmCode,
        bmName: shadeData?.bmName || DEFAULT_SHADES[shade].bmName,
        hex: shadeData?.hex || DEFAULT_SHADES[shade].hex,
      };

      const label = `${shade} (${wallColor.bmName})`;
      try {
        console.log(`   🎨 ${label} — FLUX.2 Pro Edit...`);
        await docRef.update({ [`mockups.${shade}.status`]: "generating" });

        const prompt = buildGarageShadePrompt(data, wallColor);
        console.log(`      Prompt: ${prompt.substring(0, 120)}...`);
        const generatedUrl = await callFlux2Edit(widePhotoUrl, prompt, falApiKey);

        const path = `gs_consultation_mockups/${consultationId}/${shade}_${timestamp}.png`;
        const publicUrl = await downloadAndUpload(generatedUrl, path);

        await docRef.update({
          [`mockups.${shade}.status`]: "ready",
          [`mockups.${shade}.imageUrl`]: publicUrl,
        });

        console.log(`   ✅ ${label} — DONE: ${publicUrl}`);
        return { shade, wallColor: wallColor.bmName, url: publicUrl };
      } catch (err) {
        console.error(`   ❌ ${label} — FAILED: ${err.message}`);
        await docRef.update({ [`mockups.${shade}.status`]: "failed" });
        return { shade, wallColor: wallColor.bmName, error: err.message };
      }
    })());
  }

  console.log(`\n   ⏳ Running ${promises.length} shade generations in parallel...\n`);
  const results = await Promise.all(promises);

  const ok = results.filter((r) => r.url).length;
  const fail = results.filter((r) => r.error).length;
  console.log(`\n📊 Done: ${ok} succeeded, ${fail} failed\n`);

  for (const r of results) {
    console.log(`  ${r.shade} (${r.wallColor}): ${r.url || `❌ ${r.error}`}`);
  }

  if (ok === 3) {
    await docRef.update({ status: "ready" });
    console.log("\n✅ All shades ready — consultation marked as ready.");
  }
}

async function main() {
  const arg = process.argv[2];

  if (!arg) {
    await listConsultations();
    console.log("Usage:");
    console.log("  FAL_API_KEY=xxx node test-consultation-mockups.js <consultationId>");
    console.log("  FAL_API_KEY=xxx node test-consultation-mockups.js --all\n");
  } else if (arg === "--all") {
    const docs = await listConsultations();
    const withPhotos = docs.filter((d) => d.spacePhotoUrls?.wide);
    for (const d of withPhotos) {
      await generateForConsultation(d.id);
    }
  } else {
    await generateForConsultation(arg);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
