/**
 * One-time script to seed gs_platformConfig/payments in Firestore.
 * Run: GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account.json node set-platform-config.js
 * Or:  firebase functions:shell → then run manually, or just use Firebase console.
 *
 * Fields to update in Firebase Console → Firestore → gs_platformConfig → payments:
 *   cpaEmail: "your-cpa@example.com"
 *   cpaAutoEmailEnabled: true
 *   mercuryAccountId: ""   ← fill in after opening Mercury account
 */

const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

const projectId = "garage-scholars-v2";

initializeApp({ projectId });
const db = getFirestore();

async function run() {
  await db.collection("gs_platformConfig").doc("payments").set({
    cpaEmail: "cpa@placeholder.com",       // ← replace with real CPA email
    cpaAutoEmailEnabled: true,
    mercuryAccountId: "",                  // ← fill in after Mercury signup
  }, { merge: true });

  console.log("✓ gs_platformConfig/payments set.");
  process.exit(0);
}

run().catch((e) => { console.error(e); process.exit(1); });
