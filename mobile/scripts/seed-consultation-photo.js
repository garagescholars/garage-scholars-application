/**
 * Quick script to upload a garage photo and set it on the draft consultation.
 * Usage: node scripts/seed-consultation-photo.js
 */

// Use firebase-admin from the functions folder
const admin = require("../functions/node_modules/firebase-admin");
const fs = require("fs");
const path = require("path");

admin.initializeApp({
  projectId: "garage-scholars-v2",
  storageBucket: "garage-scholars-v2.firebasestorage.app",
});

const db = admin.firestore();
const bucket = admin.storage().bucket();

const CONSULT_ID = "XUCtlTrdDIwtBOV1JmKX";
const PHOTO_PATH = path.resolve(__dirname, "../../Mockups/David Test/jpg/IMG_1624.jpg");

async function main() {
  console.log("Uploading", PHOTO_PATH);

  const destPath = `gs_consultations/${CONSULT_ID}/wide_photo.jpg`;
  await bucket.upload(PHOTO_PATH, {
    destination: destPath,
    metadata: { contentType: "image/jpeg" },
  });

  // Make it publicly readable
  const file = bucket.file(destPath);
  await file.makePublic();
  const publicUrl = `https://storage.googleapis.com/${bucket.name}/${destPath}`;

  console.log("Uploaded to:", publicUrl);

  // Set the consultation doc (merge so we don't overwrite existing data)
  await db.collection("gs_consultations").doc(CONSULT_ID).set({
    spacePhotoUrls: { wide: publicUrl },
    clientName: "David Test",
    address: "Test Garage",
    serviceType: "garage_org",
    status: "draft",
    updatedAt: new Date(),
  }, { merge: true });

  console.log("Updated consultation", CONSULT_ID, "with wide photo URL");
}

main().catch(console.error);
