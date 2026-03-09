/**
 * Garage Scholars — Consultation Mockup Generation
 *
 * Uses fal.ai FLUX.1 [pro] Fill (inpainting) to generate AI mockups
 * of garage organization and home gym installations during live sales consults.
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { GS_COLLECTIONS } from "./gs-constants";

const db = getFirestore();
const storage = getStorage();

type ServiceType = "garage_org" | "gym_install";
type Tier = "tier1" | "tier2" | "tier3";

// ── Package metadata ──

const GS_PACKAGES = {
  garage_org: {
    tier1: { name: "The Undergraduate", price: 1197 },
    tier2: { name: "The Graduate", price: 2197 },
    tier3: { name: "The Doctorate", price: 3697 },
  },
  gym_install: {
    tier1: { name: "Warm Up", price: 997 },
    tier2: { name: "Super Set", price: 1997 },
    tier3: { name: "1 Rep Max", price: 4797 },
  },
} as const;

// ── Prompt builders ──

function buildGarageOrgPrompt(
  tier: Tier,
  addons: { polyasparticFlooring: boolean; flooringColor: string | null; overheadStorage: boolean; extraShelving: boolean }
): string {
  switch (tier) {
    case "tier1":
      return "Add two white overhead metal ceiling storage racks mounted near the ceiling joists. Keep all existing walls, floor surface, garage door, and structure completely unchanged. Photorealistic, match original lighting and shadows.";
    case "tier2":
      return "Add labeled plastic storage bins organized on black wire shelving units along the walls, plus two overhead ceiling storage racks. Keep existing floor and all structure unchanged. Photorealistic, match original lighting.";
    case "tier3": {
      const floorInstruction = addons.polyasparticFlooring && addons.flooringColor
        ? `Replace floor with ${addons.flooringColor} polyaspartic flake floor coating.`
        : "Keep existing floor.";
      return `Add NewAge Bold Series black steel cabinets lining the walls, overhead ceiling storage racks, and a pegboard tool wall. ${floorInstruction} Bright, professionally organized, magazine-quality home garage. Photorealistic.`;
    }
  }
}

function buildGymInstallPrompt(
  tier: Tier,
  addons: { rubberFlooring: boolean; flooringColor: string | null; mirrorWall: boolean; cableSystem: boolean; pullUpRig: boolean }
): string {
  switch (tier) {
    case "tier1":
      return "Add interlocking black rubber floor tiles covering the garage floor, a wall-mounted dumbbell rack with adjustable dumbbells (5-50 lbs), and a fold-flat wall-mounted pull-up bar. Keep all walls and ceiling unchanged. Photorealistic, bright clean lighting.";
    case "tier2": {
      const floorText = addons.rubberFlooring ? "black rubber flooring tiles" : "existing floor";
      return `Add ${floorText} covering the floor, a full power cage/squat rack with barbell and plates, adjustable FID bench, cable machine in corner, wall-mounted dumbbell rack. Professional home gym look. Photorealistic.`;
    }
    case "tier3": {
      const floorText = addons.rubberFlooring ? "rubber flooring" : "existing floor";
      const extras: string[] = [];
      if (addons.pullUpRig) extras.push("freestanding pull-up/muscle-up rig");
      if (addons.mirrorWall) extras.push("full-length mirrors on back wall");
      if (addons.cableSystem) extras.push("functional trainer / cable crossover");
      const extrasText = extras.length > 0 ? `, ${extras.join(", ")}` : "";
      return `Add ${floorText}, full squat rack system, cable crossover machine, commercial dumbbell rack (5-100 lbs)${extrasText}. Elite home gym, bright clean lighting, magazine-quality. Photorealistic.`;
    }
  }
}

function buildPrompt(serviceType: ServiceType, tier: Tier, doc: any): string {
  if (serviceType === "garage_org") {
    return buildGarageOrgPrompt(tier, doc.garageAddons || {});
  }
  return buildGymInstallPrompt(tier, doc.gymAddons || {});
}

// ═══════════════════════════════════════════════════════════════
// Callable: Generate a single consultation mockup via fal.ai
// ═══════════════════════════════════════════════════════════════

export const gsGenerateConsultMockup = onCall(
  {
    cors: true,
    timeoutSeconds: 120,
    memory: "512MiB",
    secrets: ["FAL_API_KEY"],
  },
  async (request) => {
    const { consultationId, tier } = request.data as {
      consultationId: string;
      tier: Tier;
    };

    if (!consultationId || !tier) {
      throw new HttpsError("invalid-argument", "consultationId and tier are required");
    }
    if (!["tier1", "tier2", "tier3"].includes(tier)) {
      throw new HttpsError("invalid-argument", "tier must be tier1, tier2, or tier3");
    }

    const falApiKey = process.env.FAL_API_KEY;
    if (!falApiKey) throw new HttpsError("internal", "FAL_API_KEY not configured");

    const consultRef = db.collection(GS_COLLECTIONS.CONSULTATIONS).doc(consultationId);
    const snap = await consultRef.get();
    if (!snap.exists) {
      throw new HttpsError("not-found", "Consultation not found");
    }

    const doc = snap.data()!;
    const serviceType = doc.serviceType as ServiceType;
    const widePhotoUrl = doc.spacePhotoUrls?.wide;

    if (!widePhotoUrl) {
      throw new HttpsError("failed-precondition", "Wide-angle photo is required");
    }

    // Mark as generating
    await consultRef.update({
      [`mockups.${tier}.status`]: "generating",
      updatedAt: FieldValue.serverTimestamp(),
    });

    try {
      // Check for custom prompts in platformConfig
      let prompt: string;
      const promptDoc = await db
        .collection(GS_COLLECTIONS.PLATFORM_CONFIG)
        .doc("consultationPrompts")
        .get();
      const customPrompts = promptDoc.exists ? promptDoc.data() : null;

      if (customPrompts?.[serviceType]?.[tier]) {
        prompt = customPrompts[serviceType][tier];
      } else {
        prompt = buildPrompt(serviceType, tier, doc);
      }

      // Call fal.ai FLUX.1 [pro] Fill
      const falResponse = await fetch("https://fal.run/fal-ai/flux-pro/v1/fill", {
        method: "POST",
        headers: {
          Authorization: `Key ${falApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          image_url: widePhotoUrl,
          prompt,
          num_images: 1,
        }),
      });

      if (!falResponse.ok) {
        const errText = await falResponse.text();
        throw new Error(`fal.ai returned ${falResponse.status}: ${errText}`);
      }

      const falResult = await falResponse.json();
      const generatedUrl = falResult.images?.[0]?.url;

      if (!generatedUrl) {
        throw new Error("fal.ai did not return an image URL");
      }

      // Download the generated image and upload to Firebase Storage
      const imageResponse = await fetch(generatedUrl);
      if (!imageResponse.ok) throw new Error("Failed to download generated image");
      const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());

      const timestamp = Date.now();
      const storagePath = `gs_consultation_mockups/${consultationId}/${tier}_${timestamp}.png`;
      const bucket = storage.bucket();
      const file = bucket.file(storagePath);

      await file.save(imageBuffer, {
        metadata: { contentType: "image/png" },
      });

      // Make publicly readable and get download URL
      await file.makePublic();
      const imageUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;

      // Update Firestore with the result
      await consultRef.update({
        [`mockups.${tier}.status`]: "ready",
        [`mockups.${tier}.imageUrl`]: imageUrl,
        updatedAt: FieldValue.serverTimestamp(),
      });

      // Check if all tiers are done — if so, mark consultation as ready
      const updatedSnap = await consultRef.get();
      const updatedDoc = updatedSnap.data()!;
      const allReady = ["tier1", "tier2", "tier3"].every(
        (t) => updatedDoc.mockups?.[t]?.status === "ready"
      );
      if (allReady) {
        await consultRef.update({ status: "ready" });
      }

      return { tier, imageUrl };
    } catch (err: any) {
      console.error(`Mockup generation failed for ${consultationId}/${tier}:`, err);

      await consultRef.update({
        [`mockups.${tier}.status`]: "failed",
        updatedAt: FieldValue.serverTimestamp(),
      });

      throw new HttpsError("internal", `Mockup generation failed: ${err.message}`);
    }
  }
);

// Export package metadata for use in mobile screens
export { GS_PACKAGES };
