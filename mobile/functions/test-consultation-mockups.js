#!/usr/bin/env node
/**
 * Test script — Trigger dual-mode mockup generation directly (bypasses HTTP auth).
 *
 * Usage:
 *   node test-consultation-mockups.js                    # List consultations
 *   node test-consultation-mockups.js <consultationId>   # Generate for specific consultation
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

// Import the compiled generation logic
const consultationModule = require("./lib/gs-consultation");

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
    const mockupStatus = ["tier1", "tier2", "tier3"].map((t) => {
      const m = d.mockups?.[t];
      return `${t}: ${m?.status || "—"}/${m?.kontextStatus || "—"}/${m?.flux2Status || "—"}`;
    }).join(" | ");

    console.log(`  ${doc.id}`);
    console.log(`    Client: ${d.clientName || "?"} | Service: ${d.serviceType} | Status: ${status}`);
    console.log(`    Photo: ${hasPhoto ? "✅" : "❌"} | Mockups: ${mockupStatus}`);
    console.log();
    docs.push({ id: doc.id, ...d });
  });
  return docs;
}

// ─── Replicate the core generation logic locally ───

async function callKontext(imageUrl, prompt, falApiKey) {
  console.log(`      [Kontext] Calling fal.ai...`);
  const response = await fetch("https://fal.run/fal-ai/flux-pro/kontext", {
    method: "POST",
    headers: {
      Authorization: `Key ${falApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      image_url: imageUrl,
      prompt,
      num_images: 1,
      guidance_scale: 7.0,
      output_format: "png",
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Kontext ${response.status}: ${errText}`);
  }

  const result = await response.json();
  const url = result.images?.[0]?.url;
  if (!url) throw new Error("Kontext returned no image");
  console.log(`      [Kontext] ✅ Got image`);
  return url;
}

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

// ─── Prompt builders (inline from compiled module) ───

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

function buildPaintPrompt(doc) {
  const addons = normalizeGarageAddons(doc.garageAddons);
  const color = addons.flooringColor;
  const wallColor = color?.name && color?.code ? `Benjamin Moore ${color.name} (${color.code})` : "crisp bright white";
  return `Transform this garage with a complete luxury paint job. Paint ALL walls and ceiling ${wallColor} with a smooth, even, professional finish. Cover all drywall tape, mud, seams, and imperfections completely — no raw drywall showing anywhere. The walls should look freshly painted by a professional crew with clean, crisp lines. Bright, even lighting. Remove all clutter and debris from the floor. Photorealistic result.`;
}

function buildStoragePrompt(tier, doc) {
  const addons = normalizeGarageAddons(doc.garageAddons);
  const items = [];

  const bikeRack = addons.bikeRack || "none";
  if (bikeRack !== "none" && MONKEY_BARS_DESC[bikeRack]) items.push(MONKEY_BARS_DESC[bikeRack]);

  switch (tier) {
    case "tier1":
      items.push(addons.overheadStorage === "4-racks"
        ? "four heavy-duty white powder-coated overhead ceiling storage racks with wire mesh decking"
        : "two heavy-duty white overhead ceiling storage racks mounted flush against the ceiling joists");
      if (addons.shelving !== "none") {
        const count = addons.shelving === "3-units" ? "three" : addons.shelving === "2-units" ? "two" : "one";
        items.push(`${count} commercial-grade black wire shelving unit${count !== "one" ? "s" : ""} with matching clear labeled bins`);
      }
      break;
    case "tier2":
      items.push(addons.overheadStorage === "4-racks" ? "four heavy-duty overhead ceiling storage racks" : "two heavy-duty overhead ceiling storage racks");
      const sc = addons.shelving === "3-units" ? "three" : addons.shelving === "2-units" ? "two" : addons.shelving === "1-unit" ? "one" : "two";
      items.push(`${sc} commercial-grade black wire shelving unit${sc !== "one" ? "s" : ""} neatly loaded with matching labeled clear plastic storage bins`);
      if (addons.wallOrg === "pegboard") items.push("a large pegboard tool organization wall with premium hooks and tool silhouettes");
      else if (addons.wallOrg === "slatwall") items.push("a commercial gray slatwall organization panel with premium hooks, baskets, and shelves");
      break;
    case "tier3":
      if (addons.cabinets === "basic-wire") items.push("wall-mounted commercial wire storage cabinets with doors");
      else items.push("a full run of NewAge Bold Series glossy black steel garage cabinets with stainless steel countertops lining the walls");
      items.push(addons.overheadStorage === "4-racks" ? "four heavy-duty overhead ceiling storage racks" : addons.overheadStorage === "2-racks" ? "two heavy-duty overhead ceiling storage racks" : "four heavy-duty overhead ceiling storage racks");
      if (addons.wallOrg === "slatwall") items.push("a full-wall commercial gray slatwall organization system with premium accessories");
      else items.push("a large premium pegboard tool wall with custom tool silhouettes and heavy-duty hooks");
      break;
  }

  const floor = buildFloorInstruction(addons);
  const floorStr = floor ? ` The floor has been upgraded to ${floor}.` : "";
  return `Add the following premium storage systems to this garage: ${items.join("; ")}. Everything is brand new, professionally installed, perfectly level and aligned.${floorStr} Photorealistic, match original lighting and perspective.`;
}

function buildFullLuxuryPrompt(tier, doc) {
  const addons = normalizeGarageAddons(doc.garageAddons);
  const size = doc.garageSize || "2-car";
  const ceiling = doc.ceilingHeight;
  let context = `${size} garage`;
  if (ceiling === "open-joists") context += " with exposed open joist ceilings";
  else if (ceiling === "10ft+") context += " with tall 10-foot ceilings";
  else if (ceiling) context += ` with ${ceiling} ceilings`;

  const wallColor = addons.flooringColor?.name && addons.flooringColor?.code
    ? `Benjamin Moore ${addons.flooringColor.name} (${addons.flooringColor.code})`
    : "crisp bright white";

  const style = doc.stylePreference === "workshop"
    ? "high-end workshop aesthetic with premium tool organization"
    : doc.stylePreference === "minimalist"
    ? "ultra-clean minimalist design with hidden storage and seamless surfaces"
    : "sleek modern luxury garage with magazine-quality design";

  const items = [];
  const bikeRack = addons.bikeRack || "none";
  if (bikeRack !== "none" && MONKEY_BARS_DESC[bikeRack]) items.push(MONKEY_BARS_DESC[bikeRack]);

  switch (tier) {
    case "tier1":
      items.push(addons.overheadStorage === "4-racks" ? "four heavy-duty white powder-coated overhead ceiling storage racks" : "two heavy-duty white overhead ceiling storage racks");
      if (addons.shelving !== "none") {
        const count = addons.shelving === "3-units" ? "three" : addons.shelving === "2-units" ? "two" : "one";
        items.push(`${count} commercial-grade black wire shelving unit${count !== "one" ? "s" : ""} with labeled bins`);
      }
      break;
    case "tier2":
      items.push(addons.overheadStorage === "4-racks" ? "four overhead ceiling storage racks" : "two overhead ceiling storage racks");
      const sc2 = addons.shelving === "3-units" ? "three" : addons.shelving === "2-units" ? "two" : addons.shelving === "1-unit" ? "one" : "two";
      items.push(`${sc2} black wire shelving unit${sc2 !== "one" ? "s" : ""} with matching labeled clear bins`);
      if (addons.wallOrg === "pegboard") items.push("a pegboard tool organization wall");
      else if (addons.wallOrg === "slatwall") items.push("a slatwall organization panel with hooks and baskets");
      break;
    case "tier3":
      if (addons.cabinets === "basic-wire") items.push("wall-mounted wire storage cabinets");
      else items.push("NewAge Bold Series glossy black steel cabinets with stainless countertops lining the walls");
      items.push(addons.overheadStorage === "4-racks" ? "four overhead ceiling storage racks" : addons.overheadStorage === "2-racks" ? "two overhead ceiling storage racks" : "four overhead ceiling storage racks");
      if (addons.wallOrg === "slatwall") items.push("a full-wall slatwall organization system");
      else items.push("a premium pegboard tool wall");
      break;
  }

  const floor = buildFloorInstruction(addons);
  const floorStr = floor ? `Replace the entire floor with ${floor}.` : "";
  const dream = doc.dreamDescription ? ` Client vision: "${doc.dreamDescription}".` : "";

  return `${LUXURY_PREAMBLE} Complete transformation of this ${context}. Paint ALL walls and ceiling ${wallColor} — smooth, even, professional finish, no raw drywall, tape, or mud visible. ${floorStr} Install: ${items.join("; ")}. All items brand new, professionally installed, perfectly aligned. ${style}. Remove all clutter, debris, and mess — this is a showroom-ready luxury garage.${dream} Photorealistic, preserve the exact garage geometry, perspective, and proportions.`;
}

// ─── Main generation runner ───

async function generateForConsultation(consultationId) {
  // Get FAL_API_KEY from Firebase functions config or env
  let falApiKey = process.env.FAL_API_KEY;
  if (!falApiKey) {
    // Try to read from Firebase functions config
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

  // Mark as generating
  await docRef.update({ status: "generating", generationMode: "both" });

  const tiers = ["tier1", "tier2", "tier3"];
  const timestamp = Date.now();

  // Run all 6 in parallel
  const promises = [];

  for (const tier of tiers) {
    // ── Kontext 2-Pass ──
    promises.push((async () => {
      const label = `${tier}/kontext`;
      try {
        console.log(`   🎨 ${label} — Pass 1: Painting walls...`);
        const paintPrompt = buildPaintPrompt(data);
        console.log(`      Prompt: ${paintPrompt.substring(0, 120)}...`);
        const paintedUrl = await callKontext(widePhotoUrl, paintPrompt, falApiKey);

        console.log(`   📦 ${label} — Pass 2: Adding storage...`);
        const storagePrompt = buildStoragePrompt(tier, data);
        console.log(`      Prompt: ${storagePrompt.substring(0, 120)}...`);
        const finalUrl = await callKontext(paintedUrl, storagePrompt, falApiKey);

        // Upload to Firebase Storage
        const path = `gs_consultation_mockups/${consultationId}/${tier}_kontext2pass_${timestamp}.png`;
        const publicUrl = await downloadAndUpload(finalUrl, path);

        await docRef.update({
          [`mockups.${tier}.kontextStatus`]: "ready",
          [`mockups.${tier}.kontextUrl`]: publicUrl,
        });

        console.log(`   ✅ ${label} — DONE: ${publicUrl}`);
        return { tier, mode: "kontext", url: publicUrl };
      } catch (err) {
        console.error(`   ❌ ${label} — FAILED: ${err.message}`);
        await docRef.update({ [`mockups.${tier}.kontextStatus`]: "failed" });
        return { tier, mode: "kontext", error: err.message };
      }
    })());

    // ── FLUX.2 Pro Edit ──
    promises.push((async () => {
      const label = `${tier}/flux2`;
      try {
        console.log(`   🔥 ${label} — Single-pass luxury edit...`);
        const prompt = buildFullLuxuryPrompt(tier, data);
        console.log(`      Prompt: ${prompt.substring(0, 120)}...`);
        const generatedUrl = await callFlux2Edit(widePhotoUrl, prompt, falApiKey);

        const path = `gs_consultation_mockups/${consultationId}/${tier}_flux2edit_${timestamp}.png`;
        const publicUrl = await downloadAndUpload(generatedUrl, path);

        await docRef.update({
          [`mockups.${tier}.flux2Status`]: "ready",
          [`mockups.${tier}.flux2Url`]: publicUrl,
        });

        console.log(`   ✅ ${label} — DONE: ${publicUrl}`);
        return { tier, mode: "flux2", url: publicUrl };
      } catch (err) {
        console.error(`   ❌ ${label} — FAILED: ${err.message}`);
        await docRef.update({ [`mockups.${tier}.flux2Status`]: "failed" });
        return { tier, mode: "flux2", error: err.message };
      }
    })());
  }

  console.log(`\n   ⏳ Running ${promises.length} generations in parallel...\n`);
  const results = await Promise.all(promises);

  const ok = results.filter((r) => r.url).length;
  const fail = results.filter((r) => r.error).length;
  console.log(`\n📊 Done: ${ok} succeeded, ${fail} failed\n`);

  // Print summary
  for (const tier of tiers) {
    const k = results.find((r) => r.tier === tier && r.mode === "kontext");
    const f = results.find((r) => r.tier === tier && r.mode === "flux2");
    console.log(`  ${tier}:`);
    console.log(`    Kontext: ${k?.url || `❌ ${k?.error}`}`);
    console.log(`    FLUX.2:  ${f?.url || `❌ ${f?.error}`}`);
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
