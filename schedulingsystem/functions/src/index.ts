import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onDocumentWritten, onDocumentCreated } from "firebase-functions/v2/firestore";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { getStorage } from "firebase-admin/storage";
import Anthropic from "@anthropic-ai/sdk";
import sharp from "sharp";
import * as crypto from "crypto";

initializeApp();

// ── Garage Scholars Mobile App functions ──
export {
  gsOnJobUpdated,
  gsOnTransferCreated,
  gsOnRescheduleUpdated,
  gsLockScores,
  gsExpireTransfers,
  gsResetViewerCounts,
  gsMonthlyGoalReset,
  gsComputeAnalytics,
  gsSubmitComplaint,
  gsSendPush,
} from "./gs-functions";

// ── Garage Scholars Payment functions ──
export {
  gsReleaseCompletionPayouts,
  gsCreateStripeAccount,
  gsStripeWebhook,
  gsCreateCustomerPayment,
  gsCreateRetentionSubscription,
  gsResalePayout,
  gsMarkPayoutPaid,
  gsGeneratePaymentReport,
  gsExportPaymentData,
} from "./gs-payments";

const db = getFirestore();
const storage = getStorage();
const adminAuth = getAuth();

// Admin emails that have elevated privileges
const ADMIN_EMAILS = [
  'tylerzsodia@gmail.com',
  'zach.harmon25@gmail.com'
];

// ── Package tier descriptions for SOP prompt ──
const PACKAGE_DATA: { [key: string]: string } = {
  undergraduate: "The Undergrad ($1,197) — Surface Reset & De-Clutter. 2 Scholars, 4-5 hours. Up to 1 truck bed haul-away included. Broad sorting (Keep/Donate/Trash). 1 zone / 1 shelf included. Sweep & blow clean. Standard Clean guarantee.",
  graduate: "The Graduate ($2,197) — Full Organization Logic & Install. 2 Scholars, 6-8 hours. Up to 1 truck bed haul-away included. Micro-sorting (Sports/Tools/Holiday). $300 credit towards storage & shelving (Bold Series catalog). 8 standard bins included. Deep degrease & wipe down / floor powerwash. 30-Day Clutter-Free Guarantee.",
  doctorate: "The Doctorate ($3,797) — White-Glove Detail. 3 Scholars, 1 full day. Up to 2 truck bed haul-away included. $500 credit towards storage & shelving (Bold Series catalog). 16 premium bins included. Deep degrease & wipe down / floor powerwash. Seasonal swap (1 return visit included). Heavy-duty surcharge waived."
};

const SOP_SYSTEM_PROMPT = `You are a Garage Scholars production specialist creating job-specific Standard Operating Procedures for student crews.

SOPs must be:
- Actionable and sequenced (numbered steps)
- Specific to the package tier and selected products
- Grounded in observable garage conditions from photos

CRITICAL image analysis rules:
- Describe spatial zones (left wall, back corner, center floor) not item inventories
- Use condition language: "moderate clutter", "clear wall space", "items stacked to approximately 4 feet"
- Never count or name specific items you see
- If unclear, write "assess on arrival" — never guess

OUTPUT FORMAT — always exactly these 6 sections, no more:

## 1. PRE-JOB LOADOUT
[What to load in the vehicle based on package + shelving + add-ons]

## 2. SITE ASSESSMENT (First 10 Minutes)
[Zone-based observations from images + what to confirm on arrival]

## 3. PHASE SEQUENCE
[Numbered work phases in order — this section gets auto-converted to checklist items, so each phase must be one clear action sentence]

## 4. INSTALLATION SPECIFICATIONS
[Shelving unit placement, mounting specs, add-on installation notes]

## 5. GARAGE SCHOLARS QUALITY STANDARD
[Non-negotiable finish criteria for this package tier]

## 6. CLIENT HANDOFF CHECKLIST
[Walkthrough items, documentation, photos required at completion]`;

const buildSopUserMessage = (job: FirebaseFirestore.DocumentData, hasImages: boolean, adminNotes?: string) => {
  const tier = job.packageTier || job.package || "graduate";
  const packageDesc = PACKAGE_DATA[tier] || PACKAGE_DATA.graduate;

  const parts = [
    `Package: ${tier.toUpperCase()} — ${packageDesc}`,
    `Shelving: ${job.shelvingSelections || "None specified"}`,
    `Add-Ons: ${job.addOns || "None selected"}`,
    `Address: ${job.address || "Unknown"}`,
    `Description: ${job.description || ""}`,
    `Access: ${job.accessConstraints || "None"}`,
    `Sell vs Keep: ${job.sellVsKeepPreference || "decide on arrival"}`
  ];

  if (!hasImages) {
    parts.push("\nNo intake photos provided — Section 2 should open with 'No intake photos provided — complete full site assessment on arrival'.");
  }

  if (adminNotes) {
    parts.push(`\nAdmin notes: ${adminNotes}`);
  }

  parts.push("\nGenerate the job SOP.");
  return parts.join("\n");
};

export const generateSopForJob = onCall({ timeoutSeconds: 300, memory: "1GiB", secrets: ["ANTHROPIC_API_KEY"] }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }

  const { jobId, adminNotes } = request.data as { jobId?: string; adminNotes?: string };
  if (!jobId) {
    throw new HttpsError("invalid-argument", "Missing jobId.");
  }

  await requireAdmin(request.auth.uid, request.auth.token.email);

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) {
    throw new HttpsError("failed-precondition", "ANTHROPIC_API_KEY is not configured. Run: firebase functions:secrets:set ANTHROPIC_API_KEY");
  }

  const jobRef = db.collection("gs_jobs").doc(jobId);
  const jobSnap = await jobRef.get();
  if (!jobSnap.exists) {
    throw new HttpsError("not-found", "Job not found.");
  }

  const jobData = { id: jobSnap.id, ...jobSnap.data() } as { id: string; intakeMediaPaths?: string[] } & FirebaseFirestore.DocumentData;
  const intakePaths: string[] = Array.isArray(jobData.intakeMediaPaths) ? jobData.intakeMediaPaths : [];

  // Download images as base64 for Claude vision
  const bucket = storage.bucket();
  const imageBlocks: Array<{ type: "image"; source: { type: "base64"; media_type: string; data: string } }> = [];

  for (const rawPath of intakePaths.slice(0, 3)) {
    try {
      // Strip full URL prefix if intakeMediaPaths stores public URLs
      let storagePath = rawPath;
      const bucketName = bucket.name; // e.g. "garage-scholars-v2.firebasestorage.app"
      const prefix = `https://storage.googleapis.com/${bucketName}/`;
      if (storagePath.startsWith(prefix)) {
        storagePath = storagePath.slice(prefix.length);
      }
      // Also handle firebasestorage.googleapis.com format
      const altPrefix = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/`;
      if (storagePath.startsWith(altPrefix)) {
        storagePath = decodeURIComponent(storagePath.slice(altPrefix.length).split("?")[0]);
      }

      console.log(`Downloading image: ${storagePath}`);
      const [rawBuffer] = await bucket.file(storagePath).download();

      // Resize to max 1600px longest side + JPEG quality 80 to stay under Claude's 5MB limit
      const resized = await sharp(rawBuffer)
        .resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toBuffer();

      console.log(`Resized image: ${rawBuffer.length} → ${resized.length} bytes`);
      imageBlocks.push({
        type: "image",
        source: { type: "base64", media_type: "image/jpeg", data: resized.toString("base64") }
      });
      console.log(`Successfully downloaded image: ${storagePath}`);
    } catch (err) {
      console.warn(`Failed to download intake image: ${rawPath}`, err);
    }
  }

  console.log(`Calling Claude API with ${imageBlocks.length} images for job ${jobId}`);

  const anthropic = new Anthropic({ apiKey: anthropicKey });
  const userText = buildSopUserMessage(jobData, imageBlocks.length > 0, adminNotes);

  const userContent: Array<any> = [
    ...imageBlocks,
    { type: "text", text: userText }
  ];

  let generatedSOP = "";

  try {
    console.log(`SOP generation starting...`);
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 16384,
      system: SOP_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userContent }]
    });

    const textBlock = response.content.find((b: any) => b.type === "text");
    generatedSOP = textBlock ? (textBlock as any).text : "";
    console.log(`Got ${generatedSOP.length} chars, has sections: ${generatedSOP.includes("## 1.")}`);
  } catch (error) {
    console.error(`SOP generation failed:`, (error as Error).message);
    throw new HttpsError("internal", `Failed to generate SOP: ${(error as Error).message}`);
  }

  if (!generatedSOP) {
    console.error(`SOP generation returned empty response for job ${jobId}`);
    throw new HttpsError("internal", "SOP generation returned empty response");
  }

  // Save generated SOP directly on the job document
  console.log(`Saving SOP (${generatedSOP.length} chars) to job ${jobId}`);
  await jobRef.set({
    generatedSOP,
    status: "SOP_NEEDS_REVIEW",
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });

  console.log(`SOP successfully saved for job ${jobId}`);
  return { ok: true, generatedSOP };
});

const requireAdmin = async (uid: string, email?: string) => {
  // Check if user email is in the admin list
  if (email && ADMIN_EMAILS.includes(email.toLowerCase())) {
    return;
  }

  // Fallback to checking Firestore role
  const userSnap = await db.collection("gs_profiles").doc(uid).get();
  const role = userSnap.exists ? userSnap.data()?.role : null;
  if (role !== "admin") {
    throw new HttpsError("permission-denied", "Admin role required.");
  }
};

// Sanitize a name for use in Storage folder paths (filesystem-safe)
const sanitizeForPath = (name: string): string =>
  name.trim().replace(/[^a-zA-Z0-9 -]/g, '').replace(/\s+/g, ' ').trim() || 'Unknown';

// Build the human-readable storage folder name: "ClientName - clientId"
const buildClientFolder = (name: string, clientId: string): string =>
  `${sanitizeForPath(name)} - ${clientId}`;

// Find existing client by email or create a new one in the clients collection
// Returns { clientId, clientFolder } where clientFolder is the Storage folder name
const findOrCreateClient = async (
  name: string, email: string, phone?: string, source: 'scheduling' | 'resale' | 'both' = 'scheduling'
): Promise<{ clientId: string; clientFolder: string }> => {
  const existing = await db.collection('clients')
    .where('email', '==', email.toLowerCase().trim())
    .limit(1).get();

  if (!existing.empty) {
    const doc = existing.docs[0];
    const data = doc.data();
    // Use stored folder name if available, otherwise build it
    const clientFolder = data.storageFolderName || buildClientFolder(data.name || name, doc.id);
    // Backfill storageFolderName if missing
    if (!data.storageFolderName) {
      await doc.ref.update({ storageFolderName: clientFolder });
    }
    return { clientId: doc.id, clientFolder };
  }

  const clientRef = await db.collection('clients').add({
    name: name.trim(),
    email: email.toLowerCase().trim(),
    phone: phone?.trim() || null,
    source,
    createdAt: FieldValue.serverTimestamp(),
    storageFolderName: '', // placeholder — set after we have the ID
    stats: {
      totalServiceJobs: 0,
      totalPropertiesServiced: 0,
      totalItemsListed: 0,
      totalItemsSold: 0,
      totalRevenue: 0
    }
  });

  const clientFolder = buildClientFolder(name, clientRef.id);
  await clientRef.update({ storageFolderName: clientFolder });

  return { clientId: clientRef.id, clientFolder };
};

export const approveSignup = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }
  const { requestId } = request.data as { requestId?: string };
  if (!requestId) {
    throw new HttpsError("invalid-argument", "Missing requestId.");
  }

  await requireAdmin(request.auth.uid, request.auth.token.email);

  const requestRef = db.collection("signupRequests").doc(requestId);
  const reqSnap = await requestRef.get();
  if (!reqSnap.exists) {
    throw new HttpsError("not-found", "Signup request not found.");
  }

  console.log("Looking for user with requestId:", requestId);
  const userQuery = await db.collection("users").where("requestId", "==", requestId).limit(1).get();
  console.log("User query result - empty?", userQuery.empty, "size:", userQuery.size);

  if (userQuery.empty) {
    // Try to find user by email as fallback
    const reqData = reqSnap.data();
    const email = reqData?.email;
    const name = reqData?.name || "Scholar";
    console.log("User not found by requestId, trying email:", email);

    if (email) {
      const emailQuery = await db.collection("users").where("email", "==", email).limit(1).get();
      console.log("Email query result - empty?", emailQuery.empty, "size:", emailQuery.size);

      if (!emailQuery.empty) {
        const userDoc = emailQuery.docs[0];
        console.log("Found user by email, updating with requestId");
        // Update the user doc with the requestId and approve
        await userDoc.ref.set({
          requestId,
          role: "scholar",
          status: "active",
          approvedAt: FieldValue.serverTimestamp(),
          approvedByUid: request.auth.uid
        }, { merge: true });

        await requestRef.set({
          status: "approved",
          decidedAt: FieldValue.serverTimestamp(),
          decidedByUid: request.auth.uid
        }, { merge: true });

        return { ok: true };
      }

      // User doesn't exist in Firestore at all - find them in Firebase Auth and create the doc
      console.log("User not found in Firestore, checking Firebase Auth for email:", email);
      try {
        const authUser = await adminAuth.getUserByEmail(email);
        console.log("Found user in Firebase Auth:", authUser.uid);

        // Create the user document
        await db.collection("users").doc(authUser.uid).set({
          email,
          name,
          role: "scholar",
          status: "active",
          requestId,
          createdAt: FieldValue.serverTimestamp(),
          approvedAt: FieldValue.serverTimestamp(),
          approvedByUid: request.auth.uid
        });

        await requestRef.set({
          status: "approved",
          decidedAt: FieldValue.serverTimestamp(),
          decidedByUid: request.auth.uid
        }, { merge: true });

        console.log("Created user document and approved");
        return { ok: true };
      } catch (authError) {
        console.error("Firebase Auth lookup failed:", authError);
      }
    }

    // Last resort: debug all users to see what's in the collection
    console.log("Failed to find user by requestId, email, or Firebase Auth");

    // Get all users to debug
    const allUsers = await db.collection("users").limit(10).get();
    console.log("Total users in collection:", allUsers.size);
    allUsers.docs.forEach(doc => {
      console.log("User doc:", doc.id, doc.data());
    });

    throw new HttpsError("not-found", `User for request not found. Checked requestId: ${requestId}, email: ${email || 'none'}`);
  }
  const userDoc = userQuery.docs[0];
  console.log("Found user document:", userDoc.id, userDoc.data());

  await requestRef.set({
    status: "approved",
    decidedAt: FieldValue.serverTimestamp(),
    decidedByUid: request.auth.uid
  }, { merge: true });

  await userDoc.ref.set({
    role: "scholar",
    status: "active",
    approvedAt: FieldValue.serverTimestamp(),
    approvedByUid: request.auth.uid
  }, { merge: true });

  return { ok: true };
});

export const createAccount = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }

  await requireAdmin(request.auth.uid, request.auth.token.email);

  const { fullName, email, password, role } = request.data as {
    fullName?: string;
    email?: string;
    password?: string;
    role?: "scholar" | "admin";
  };

  if (!fullName?.trim() || !email?.trim() || !password) {
    throw new HttpsError("invalid-argument", "Full name, email, and password are required.");
  }
  if (password.length < 6) {
    throw new HttpsError("invalid-argument", "Password must be at least 6 characters.");
  }
  if (role !== "scholar" && role !== "admin") {
    throw new HttpsError("invalid-argument", "Role must be 'scholar' or 'admin'.");
  }

  const normalizedEmail = email.trim().toLowerCase();

  // Create user in Firebase Auth via Admin SDK (doesn't affect caller's session)
  let uid: string;
  try {
    const userRecord = await adminAuth.createUser({
      email: normalizedEmail,
      password,
      displayName: fullName.trim(),
    });
    uid = userRecord.uid;
  } catch (err: any) {
    if (err.code === "auth/email-already-exists") {
      throw new HttpsError("already-exists", "A user with this email already exists.");
    }
    throw new HttpsError("internal", err.message || "Failed to create auth user.");
  }

  // Create gs_profiles document
  await db.collection("gs_profiles").doc(uid).set({
    email: normalizedEmail,
    fullName: fullName.trim(),
    phone: "",
    role,
    isActive: true,
    createdAt: FieldValue.serverTimestamp(),
    createdBy: request.auth.uid,
  });

  // If scholar, also create gs_scholarProfiles
  if (role === "scholar") {
    await db.collection("gs_scholarProfiles").doc(uid).set({
      scholarId: uid,
      scholarName: fullName.trim(),
      monthlyJobGoal: 10,
      monthlyMoneyGoal: 3000,
      totalJobsCompleted: 0,
      totalEarnings: 0,
      payScore: 5.0,
      cancellationRate: 0,
      acceptanceRate: 100,
      tier: "new",
      showOnLeaderboard: true,
      createdAt: FieldValue.serverTimestamp(),
    });
  }

  return { ok: true, uid, email: normalizedEmail, role };
});

export const declineSignup = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }
  const { requestId } = request.data as { requestId?: string };
  if (!requestId) {
    throw new HttpsError("invalid-argument", "Missing requestId.");
  }

  await requireAdmin(request.auth.uid, request.auth.token.email);

  const requestRef = db.collection("signupRequests").doc(requestId);
  const reqSnap = await requestRef.get();
  if (!reqSnap.exists) {
    throw new HttpsError("not-found", "Signup request not found.");
  }

  const userQuery = await db.collection("users").where("requestId", "==", requestId).limit(1).get();
  const userDoc = userQuery.empty ? null : userQuery.docs[0];

  await requestRef.set({
    status: "declined",
    decidedAt: FieldValue.serverTimestamp(),
    decidedByUid: request.auth.uid
  }, { merge: true });

  if (userDoc) {
    await userDoc.ref.set({
      status: "disabled"
    }, { merge: true });
    await adminAuth.deleteUser(userDoc.id).catch(() => null);
  }

  return { ok: true };
});

/**
 * Send email notification when job status changes to REVIEW_PENDING
 * Requires Firebase Email Extension to be installed
 */
export const sendJobReviewEmail = onDocumentWritten("serviceJobs/{jobId}", async (event) => {
  const beforeData = event.data?.before?.data();
  const afterData = event.data?.after?.data();

  // Only trigger when status changes to REVIEW_PENDING
  if (!afterData || afterData.status !== "REVIEW_PENDING") {
    return;
  }

  // Don't send duplicate emails if already REVIEW_PENDING
  if (beforeData?.status === "REVIEW_PENDING") {
    return;
  }

  const jobId = event.params.jobId;
  console.log(`Job ${jobId} is now pending review. Sending email notification...`);

  try {
    const bucket = storage.bucket();

    // Get download URLs for media
    const getDownloadUrl = async (path: string): Promise<string> => {
      if (!path || path === '') return '';
      if (path.startsWith('http')) return path; // Already a URL
      try {
        const [url] = await bucket.file(path).getSignedUrl({
          action: "read",
          expires: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days
        });
        return url;
      } catch (error) {
        console.error(`Failed to get URL for ${path}:`, error);
        return '';
      }
    };

    const checkInPhotoUrl = afterData.checkInMedia?.photoFrontOfHouse
      ? await getDownloadUrl(afterData.checkInMedia.photoFrontOfHouse)
      : '';

    const checkOutPhotoUrl = afterData.checkOutMedia?.photoFrontOfHouse
      ? await getDownloadUrl(afterData.checkOutMedia.photoFrontOfHouse)
      : '';

    const checkOutVideoUrl = afterData.checkOutMedia?.videoGarage
      ? await getDownloadUrl(afterData.checkOutMedia.videoGarage)
      : '';

    // Calculate work duration
    let workDuration = 'N/A';
    if (afterData.checkInTime && afterData.checkOutTime) {
      const minutes = Math.round(
        (new Date(afterData.checkOutTime).getTime() - new Date(afterData.checkInTime).getTime()) / (1000 * 60)
      );
      workDuration = `${minutes} minutes`;
    }

    // Generate secure approval token (simple hash of jobId + timestamp)
    const approvalToken = Buffer.from(`${jobId}-${Date.now()}`).toString('base64');

    // Create email HTML
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Job Review Required</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      background: linear-gradient(135deg, #2a5f5f 0%, #1f4a4a 100%);
      color: white;
      padding: 30px;
      border-radius: 12px;
      text-align: center;
      margin-bottom: 30px;
    }
    .header h1 {
      margin: 0;
      font-size: 28px;
    }
    .info-box {
      background: #f8f9fa;
      border-left: 4px solid #2a5f5f;
      padding: 20px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .info-row {
      margin: 10px 0;
      font-size: 14px;
    }
    .info-label {
      font-weight: 600;
      color: #555;
    }
    .info-value {
      color: #333;
    }
    .media-section {
      margin: 30px 0;
    }
    .media-section h3 {
      color: #2a5f5f;
      margin-bottom: 15px;
    }
    .media-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 15px;
      margin-bottom: 20px;
    }
    .media-item img {
      width: 100%;
      border-radius: 8px;
      border: 2px solid #e0e0e0;
    }
    .media-item p {
      text-align: center;
      font-size: 13px;
      color: #666;
      margin: 8px 0 0 0;
    }
    .video-link {
      display: block;
      background: #f0f0f0;
      padding: 15px;
      border-radius: 8px;
      text-align: center;
      text-decoration: none;
      color: #2a5f5f;
      font-weight: 600;
      margin: 15px 0;
    }
    .video-link:hover {
      background: #e0e0e0;
    }
    .button-container {
      text-align: center;
      margin: 40px 0;
    }
    .approve-button {
      display: inline-block;
      background: #10b981;
      color: white;
      padding: 16px 40px;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 700;
      font-size: 16px;
      box-shadow: 0 4px 6px rgba(16, 185, 129, 0.3);
    }
    .approve-button:hover {
      background: #059669;
    }
    .dashboard-link {
      display: inline-block;
      background: #3b82f6;
      color: white;
      padding: 12px 24px;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      margin-top: 15px;
    }
    .payment-info {
      background: #dbeafe;
      border: 1px solid #3b82f6;
      padding: 15px;
      border-radius: 8px;
      margin: 20px 0;
      font-size: 13px;
      color: #1e40af;
    }
    .footer {
      text-align: center;
      color: #999;
      font-size: 12px;
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e0e0e0;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>🏠 Job Review Required</h1>
    <p style="margin: 10px 0 0 0; opacity: 0.9;">A scholar has completed a service job</p>
  </div>

  <div class="info-box">
    <div class="info-row">
      <span class="info-label">Client:</span>
      <span class="info-value">${afterData.clientName || 'Unknown'}</span>
    </div>
    <div class="info-row">
      <span class="info-label">Address:</span>
      <span class="info-value">${afterData.address || 'N/A'}</span>
    </div>
    <div class="info-row">
      <span class="info-label">Scholar:</span>
      <span class="info-value">${afterData.assigneeName || 'Unknown'}</span>
    </div>
    <div class="info-row">
      <span class="info-label">Total Payout:</span>
      <span class="info-value" style="font-weight: 700; color: #10b981;">$${afterData.pay || 0}</span>
    </div>
    <div class="info-row">
      <span class="info-label">Work Duration:</span>
      <span class="info-value">${workDuration}</span>
    </div>
    <div class="info-row">
      <span class="info-label">Job ID:</span>
      <span class="info-value" style="font-family: monospace; font-size: 12px;">${jobId}</span>
    </div>
  </div>

  <div class="payment-info">
    <strong>💰 Payment Policy:</strong> Approval triggers 50% immediate payment ($${(afterData.pay || 0) / 2}).
    The remaining 50% is automatically released 24 hours after job completion if no client complaints are filed.
  </div>

  <div class="media-section">
    <h3>📸 Quality Assurance Photos</h3>
    <div class="media-grid">
      <div class="media-item">
        ${checkInPhotoUrl ? `<img src="${checkInPhotoUrl}" alt="Check-In Photo" />` : '<p>No check-in photo</p>'}
        <p>Check-In</p>
      </div>
      <div class="media-item">
        ${checkOutPhotoUrl ? `<img src="${checkOutPhotoUrl}" alt="Check-Out Photo" />` : '<p>No check-out photo</p>'}
        <p>Check-Out</p>
      </div>
    </div>

    ${checkOutVideoUrl ? `
      <a href="${checkOutVideoUrl}" class="video-link" target="_blank">
        🎥 View Check-Out Video (Garage Walkthrough)
      </a>
    ` : '<p style="color: #dc2626; font-weight: 600;">⚠️ No check-out video available</p>'}
  </div>

  <div class="button-container">
    <a href="${process.env.SCHEDULING_APP_URL || 'https://your-scheduling-app.vercel.app'}/admin?approve=${approvalToken}" class="approve-button">
      ✅ Approve & Pay $${(afterData.pay || 0) / 2} (50% now)
    </a>
    <br/>
    <a href="${process.env.SCHEDULING_APP_URL || 'https://your-scheduling-app.vercel.app'}/admin" class="dashboard-link">
      Open Admin Dashboard
    </a>
  </div>

  <div class="footer">
    <p>This is an automated notification from Garage Scholars Scheduling System</p>
    <p>Job completed at ${new Date(afterData.checkOutTime).toLocaleString()}</p>
  </div>
</body>
</html>
    `;

    // Write to 'mail' collection (monitored by Firebase Email Extension)
    await db.collection('mail').add({
      to: ['garagescholars@gmail.com', 'admin@garagescholars.com'], // Centralized review inbox
      message: {
        subject: `🔔 Review Required: ${afterData.clientName} - $${afterData.pay}`,
        html: emailHtml,
      },
      jobId: jobId,
      approvalToken: approvalToken,
      createdAt: FieldValue.serverTimestamp()
    });

    console.log(`Email notification queued for job ${jobId}`);
  } catch (error) {
    console.error(`Failed to send email for job ${jobId}:`, error);
  }
});

// Submit quote request from website
export const submitQuoteRequest = onCall(
  { cors: true, timeoutSeconds: 120, memory: "512MiB" },
  async (request) => {
  console.log('submitQuoteRequest handler entered');
  console.log('request.data keys:', Object.keys(request.data || {}));

  const {
    name,
    email,
    phone,
    zipcode,
    serviceType,
    package: packageTier,
    garageSize,
    description,
    photoData // Array of base64 encoded images if present
  } = request.data;

  // Validate required fields (package is optional — HTML form doesn't require it)
  if (!name || !email || !phone || !zipcode || !serviceType) {
    throw new HttpsError("invalid-argument", "Missing required fields: name, email, phone, zipcode, and serviceType are required.");
  }

  console.log(`submitQuoteRequest called: name=${name}, email=${email}, serviceType=${serviceType}, package=${packageTier || 'none'}`);

  try {
    // Step 1: Find or create client in the clients collection
    const { clientId, clientFolder } = await findOrCreateClient(name, email, phone);
    console.log(`Client resolved: ${clientId} (folder: ${clientFolder})`);

    // Step 2: Create quote request document
    const quoteRequestRef = await db.collection('quoteRequests').add({
      name,
      email,
      phone,
      zipcode,
      serviceType,
      package: packageTier || null,
      garageSize: garageSize || null,
      description: description || null,
      status: 'new',
      clientId,
      createdAt: FieldValue.serverTimestamp(),
      source: 'website'
    });

    console.log(`Quote request created: ${quoteRequestRef.id}`);

    // Step 3: Create draft job with LEAD status in gs_jobs (canonical jobs collection)
    const draftJobRef = await db.collection('gs_jobs').add({
      title: name,
      clientName: name,
      clientEmail: email,
      clientPhone: phone,
      clientId,
      clientFolder,
      address: zipcode ? `ZIP: ${zipcode}` : 'Address TBD',
      zipcode: zipcode,
      description: description || 'New lead from website quote form',
      scheduledDate: new Date().toISOString(),
      scheduledTimeStart: '',
      scheduledTimeEnd: '',
      payout: 0,
      clientPrice: 0,
      status: 'LEAD',
      lat: 0,
      lng: 0,
      urgencyLevel: 'standard',
      rushBonus: 0,
      currentViewers: 0,
      viewerFloor: 0,
      totalViews: 0,
      reopenCount: 0,
      checklist: [],
      serviceType,
      package: packageTier || null,
      garageSize: garageSize || null,
      intakeMediaPaths: [],
      intakeImageUrls: [],
      quoteRequestId: quoteRequestRef.id,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });

    console.log(`Draft job created with LEAD status: ${draftJobRef.id}`);

    // Link the job back to the quote request
    await quoteRequestRef.update({ jobId: draftJobRef.id });

    // Step 4: Upload photos to client-centric Storage path with human-readable names
    const intakeMediaPaths: string[] = [];
    const photoEmailUrls: string[] = [];
    const bucket = storage.bucket();
    if (photoData && Array.isArray(photoData) && photoData.length > 0) {
      console.log(`Uploading ${photoData.length} photos to clients/${clientFolder}/quote/photos/...`);

      for (let i = 0; i < photoData.length; i++) {
        try {
          const { base64, filename } = photoData[i];
          const buffer = Buffer.from(base64, 'base64');
          console.log(`Photo ${i}: ${filename}, ${buffer.length} bytes`);
          const storagePath = `clients/${clientFolder}/quote/photos/photo-${i + 1}.jpg`;

          // Generate a download token for email embeds (avoids getSignedUrl permission issues)
          const downloadToken = crypto.randomUUID();
          const file = bucket.file(storagePath);
          await file.save(buffer, {
            metadata: {
              contentType: 'image/jpeg',
              metadata: { firebaseStorageDownloadTokens: downloadToken }
            },
          });

          intakeMediaPaths.push(storagePath);
          // Build a public download URL using the token
          const encodedPath = encodeURIComponent(storagePath);
          photoEmailUrls.push(
            `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodedPath}?alt=media&token=${downloadToken}`
          );
          console.log(`Photo ${i} uploaded: ${storagePath}`);
        } catch (photoError) {
          console.error(`Error uploading photo ${i}:`, photoError);
        }
      }

      // Update job and quote request with storage paths + display URLs
      if (intakeMediaPaths.length > 0) {
        await draftJobRef.update({ intakeMediaPaths, intakeImageUrls: photoEmailUrls });
        await quoteRequestRef.update({ photoStoragePaths: intakeMediaPaths });
        console.log(`${intakeMediaPaths.length} photo paths saved`);
      }
    }

    // Step 5: Send email notification to admin (use signed URLs for photos)
    const serviceTypeLabels: { [key: string]: string } = {
      'get-clean': 'Get Clean',
      'get-organized': 'Get Organized',
      'get-strong': 'Get Strong',
      'resale': 'Resale Concierge',
      'cleaning': 'Cleaning',
      'organization': 'Organization',
      'gym': 'Gym Setup',
      'full': 'Full Transformation'
    };

    const packageLabels: { [key: string]: string } = {
      'undergraduate': 'Undergraduate',
      'graduate': 'Graduate',
      'doctorate': 'Doctorate',
      'warmup': 'Warm Up',
      'superset': 'Super Set',
      '1repmax': '1 Rep Max',
      'deans-list': "The Dean's List",
      'valedictorian': 'The Valedictorian'
    };

    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #6E9D7B; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; }
    .field { margin-bottom: 15px; }
    .field-label { font-weight: bold; color: #27362e; }
    .field-value { margin-top: 5px; }
    .photos { margin-top: 20px; }
    .photos img { max-width: 200px; margin: 10px; border: 1px solid #ddd; }
    .footer { margin-top: 20px; padding: 15px; background-color: #f0f0f0; border-radius: 0 0 8px 8px; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>🏠 New Quote Request</h2>
    </div>

    <div class="content">
      <div class="field">
        <div class="field-label">Contact Information:</div>
        <div class="field-value">
          <strong>Name:</strong> ${name}<br>
          <strong>Email:</strong> ${email}<br>
          <strong>Phone:</strong> ${phone}<br>
          <strong>ZIP Code:</strong> ${zipcode}
        </div>
      </div>

      <div class="field">
        <div class="field-label">Service Details:</div>
        <div class="field-value">
          <strong>Service Type:</strong> ${serviceTypeLabels[serviceType] || serviceType}<br>
          <strong>Package:</strong> ${packageLabels[packageTier] || packageTier || 'Not selected'}
          ${garageSize ? `<br><strong>Garage Size:</strong> ${garageSize}` : ''}
        </div>
      </div>

      ${description ? `
      <div class="field">
        <div class="field-label">Project Description:</div>
        <div class="field-value">${description}</div>
      </div>
      ` : ''}

      ${photoEmailUrls.length > 0 ? `
      <div class="photos">
        <div class="field-label">Photos (${photoEmailUrls.length}):</div>
        ${photoEmailUrls.map(url => `<img src="${url}" alt="Garage photo">`).join('')}
      </div>
      ` : ''}
    </div>

    <div class="footer">
      <p>Quote Request ID: ${quoteRequestRef.id}</p>
      <p>Client ID: ${clientId}</p>
      <p>Submitted at ${new Date().toLocaleString()}</p>
      <p><a href="https://console.firebase.google.com/project/${process.env.GCLOUD_PROJECT}/firestore/data/quoteRequests/${quoteRequestRef.id}">View in Firebase Console</a></p>
    </div>
  </div>
</body>
</html>
    `;

    await db.collection('mail').add({
      to: ['garagescholars@gmail.com', 'admin@garagescholars.com'],
      message: {
        subject: `📋 New Quote Request: ${name} - ${serviceTypeLabels[serviceType] || serviceType} (${packageLabels[packageTier] || 'No package'})`,
        html: emailHtml,
      },
      quoteRequestId: quoteRequestRef.id,
      clientId,
      createdAt: FieldValue.serverTimestamp()
    });

    console.log(`Email notification queued for quote request ${quoteRequestRef.id}`);

    return {
      success: true,
      quoteRequestId: quoteRequestRef.id,
      jobId: draftJobRef.id,
      clientId,
      message: 'Quote request submitted successfully and draft job created'
    };

  } catch (error) {
    console.error('Error submitting quote request:', (error as Error).message, (error as Error).stack);
    throw new HttpsError("internal", `Failed to submit quote request: ${(error as Error).message}`);
  }
});

// ── Scholar Application: email notifications on new submission ──
export const onScholarApplicationCreated = onDocumentCreated(
  "scholarApplications/{appId}",
  async (event) => {
    const appData = event.data?.data();
    if (!appData) return;

    const appId = event.params.appId;
    console.log(`New scholar application received: ${appId} from ${appData.name}`);

    const appliedDate = appData.appliedAt?.toDate
      ? appData.appliedAt.toDate().toLocaleString("en-US", { timeZone: "America/Denver" })
      : new Date().toLocaleString("en-US", { timeZone: "America/Denver" });

    const resumeLink = appData.resumeURL
      ? `<a href="${appData.resumeURL}" style="color:#2563eb;text-decoration:underline;">Download Resume</a>`
      : '<span style="color:#9ca3af;">No resume uploaded</span>';

    // ── Admin notification email ──
    const adminEmailHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;font-family:'Helvetica Neue',Arial,sans-serif;background:#f8fafc;">
  <div style="max-width:600px;margin:0 auto;padding:24px;">
    <div style="background:#1e293b;border-radius:12px 12px 0 0;padding:24px 32px;">
      <h1 style="margin:0;color:#ffffff;font-size:22px;">New Scholar Application</h1>
      <p style="margin:6px 0 0;color:#94a3b8;font-size:14px;">Submitted ${appliedDate} MST</p>
    </div>
    <div style="background:#ffffff;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;padding:32px;">

      <table style="width:100%;border-collapse:collapse;font-size:15px;">
        <tr>
          <td style="padding:10px 12px;font-weight:600;color:#475569;width:40%;border-bottom:1px solid #f1f5f9;">Name</td>
          <td style="padding:10px 12px;color:#1e293b;border-bottom:1px solid #f1f5f9;">${appData.name}</td>
        </tr>
        <tr>
          <td style="padding:10px 12px;font-weight:600;color:#475569;border-bottom:1px solid #f1f5f9;">Phone</td>
          <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;">
            <a href="tel:${appData.phone}" style="color:#2563eb;text-decoration:none;">${appData.phone}</a>
          </td>
        </tr>
        <tr>
          <td style="padding:10px 12px;font-weight:600;color:#475569;border-bottom:1px solid #f1f5f9;">Email</td>
          <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;">
            <a href="mailto:${appData.email}" style="color:#2563eb;text-decoration:none;">${appData.email}</a>
          </td>
        </tr>
        <tr>
          <td style="padding:10px 12px;font-weight:600;color:#475569;border-bottom:1px solid #f1f5f9;">Student</td>
          <td style="padding:10px 12px;color:#1e293b;border-bottom:1px solid #f1f5f9;">${appData.isStudent}</td>
        </tr>
        <tr>
          <td style="padding:10px 12px;font-weight:600;color:#475569;border-bottom:1px solid #f1f5f9;">School</td>
          <td style="padding:10px 12px;color:#1e293b;border-bottom:1px solid #f1f5f9;">${appData.school || 'N/A'}</td>
        </tr>
        <tr>
          <td style="padding:10px 12px;font-weight:600;color:#475569;border-bottom:1px solid #f1f5f9;">Year</td>
          <td style="padding:10px 12px;color:#1e293b;border-bottom:1px solid #f1f5f9;">${appData.year || 'N/A'}</td>
        </tr>
        <tr>
          <td style="padding:10px 12px;font-weight:600;color:#475569;border-bottom:1px solid #f1f5f9;">Availability</td>
          <td style="padding:10px 12px;color:#1e293b;border-bottom:1px solid #f1f5f9;">${appData.availability} hrs/week</td>
        </tr>
        <tr>
          <td style="padding:10px 12px;font-weight:600;color:#475569;border-bottom:1px solid #f1f5f9;">Has Car</td>
          <td style="padding:10px 12px;color:#1e293b;border-bottom:1px solid #f1f5f9;">${appData.hasCar}</td>
        </tr>
        <tr>
          <td style="padding:10px 12px;font-weight:600;color:#475569;border-bottom:1px solid #f1f5f9;">Referral</td>
          <td style="padding:10px 12px;color:#1e293b;border-bottom:1px solid #f1f5f9;">${appData.referralSource || 'Not specified'}</td>
        </tr>
        <tr>
          <td style="padding:10px 12px;font-weight:600;color:#475569;border-bottom:1px solid #f1f5f9;">Resume</td>
          <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;">${resumeLink}</td>
        </tr>
      </table>

      ${appData.whyJoin ? `
      <div style="margin-top:20px;padding:16px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;">
        <p style="margin:0 0 8px;font-weight:600;color:#475569;font-size:14px;">Why They Want to Join:</p>
        <p style="margin:0;color:#1e293b;font-size:14px;line-height:1.5;">${appData.whyJoin}</p>
      </div>` : ''}

      <div style="margin-top:24px;text-align:center;">
        <a href="tel:${appData.phone}" style="display:inline-block;padding:12px 28px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px;margin-right:8px;">Call ${appData.name.split(' ')[0]}</a>
        <a href="mailto:${appData.email}" style="display:inline-block;padding:12px 28px;background:#1e293b;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px;">Email ${appData.name.split(' ')[0]}</a>
      </div>
    </div>

    <p style="text-align:center;color:#94a3b8;font-size:12px;margin-top:16px;">
      Garage Scholars — Scholar Application Pipeline
    </p>
  </div>
</body>
</html>`;

    // ── Auto-response email to applicant ──
    const applicantEmailHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;font-family:'Helvetica Neue',Arial,sans-serif;background:#f8fafc;">
  <div style="max-width:600px;margin:0 auto;padding:24px;">
    <div style="background:#1e293b;border-radius:12px 12px 0 0;padding:24px 32px;">
      <h1 style="margin:0;color:#ffffff;font-size:22px;">Garage Scholars</h1>
    </div>
    <div style="background:#ffffff;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;padding:32px;">
      <h2 style="margin:0 0 16px;color:#1e293b;font-size:20px;">Thanks for applying, ${appData.name.split(' ')[0]}!</h2>
      <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 16px;">
        We've received your application and we're excited to learn more about you. Our team reviews every application personally.
      </p>
      <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 16px;">
        <strong>What happens next:</strong> You'll hear from us within 24 hours for a quick phone interview. Keep an eye on your phone — we'll reach out via call or text.
      </p>
      <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 8px;">
        Questions in the meantime? Text us directly:
      </p>
      <p style="margin:0 0 24px;">
        <a href="tel:7205073969" style="color:#2563eb;font-size:16px;font-weight:600;text-decoration:none;">(720) 507-3969</a>
      </p>
      <p style="color:#475569;font-size:15px;line-height:1.6;margin:0;">
        — The Garage Scholars Team
      </p>
    </div>
    <p style="text-align:center;color:#94a3b8;font-size:12px;margin-top:16px;">
      Garage Scholars | Denver, CO | garagescholars.com
    </p>
  </div>
</body>
</html>`;

    try {
      // Send admin notification to both inboxes
      await db.collection('mail').add({
        to: ['garagescholars@gmail.com', 'admin@garagescholars.com', 'Zach.harmon25@gmail.com', 'tylerzsodia@gmail.com'],
        message: {
          subject: `New Scholar Application: ${appData.name} — ${appData.school || 'N/A'} (${appData.availability} hrs/wk)`,
          html: adminEmailHtml,
        },
        createdAt: FieldValue.serverTimestamp()
      });

      // Send auto-confirmation to applicant
      await db.collection('mail').add({
        to: [appData.email],
        message: {
          subject: 'Application Received — Garage Scholars',
          html: applicantEmailHtml,
        },
        createdAt: FieldValue.serverTimestamp()
      });

      console.log(`Scholar application emails sent for ${appId}: admin + applicant (${appData.email})`);
    } catch (error) {
      console.error(`Failed to send scholar application emails for ${appId}:`, error);
    }
  }
);
