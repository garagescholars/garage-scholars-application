"use strict";
/**
 * Garage Scholars — Resale, Donation & Gym Install Inventory Functions
 *
 * Handles AI item analysis via Gemini Vision, Firestore triggers for
 * social media queue, and donation receipt email notifications.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.gsOnItemSold = exports.gsOnResaleStatusChange = exports.gsOnDonationReceiptUploaded = exports.gsOnGymPhotosUploaded = exports.gsOnItemConfirmed = exports.gsAnalyzeItem = void 0;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-functions/v2/firestore");
const firestore_2 = require("firebase-admin/firestore");
const generative_ai_1 = require("@google/generative-ai");
const gs_constants_1 = require("./gs-constants");
const gs_notifications_1 = require("./gs-notifications");
const ADMIN_EMAILS = ["garagescholars@gmail.com", "admin@garagescholars.com"];
/** Escape HTML to prevent XSS in email templates */
function escapeHtml(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}
const db = (0, firestore_2.getFirestore)();
// ─── Email template wrapper (same branding as review campaigns) ───
function emailWrapper(body) {
    return `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b;">
  <div style="background: #0f1b2d; padding: 24px; text-align: center; border-radius: 12px 12px 0 0;">
    <h1 style="color: #14b8a6; margin: 0; font-size: 24px;">Garage Scholars</h1>
  </div>
  <div style="padding: 32px 24px; background: #f8fafc; border: 1px solid #e2e8f0;">
    ${body}
  </div>
  <div style="background: #0f1b2d; padding: 16px; text-align: center; border-radius: 0 0 12px 12px;">
    <p style="color: #64748b; font-size: 12px; margin: 0;">Garage Scholars — Denver's College-Powered Garage Transformations</p>
  </div>
</div>`;
}
// ═══════════════════════════════════════════════════════════════
// Callable: Analyze item photos with Gemini Vision
// ═══════════════════════════════════════════════════════════════
exports.gsAnalyzeItem = (0, https_1.onCall)({
    cors: true,
    timeoutSeconds: 60,
    memory: "512MiB",
    secrets: ["GEMINI_API_KEY"],
}, async (request) => {
    const { photoUrls, itemType } = request.data;
    if (!photoUrls || photoUrls.length === 0) {
        throw new https_1.HttpsError("invalid-argument", "At least one photo URL is required");
    }
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey)
        throw new https_1.HttpsError("internal", "GEMINI_API_KEY not configured");
    try {
        // Download images and convert to base64 for Gemini Vision
        const imageParts = await Promise.all(photoUrls.map(async (url) => {
            const resp = await fetch(url);
            if (!resp.ok)
                throw new Error(`Failed to download image: ${url}`);
            const buffer = Buffer.from(await resp.arrayBuffer());
            return {
                inlineData: {
                    data: buffer.toString("base64"),
                    mimeType: "image/jpeg",
                },
            };
        }));
        const prompt = itemType === "resale"
            ? `You are analyzing photos of a household item that will be listed for resale on Facebook Marketplace, Craigslist, and eBay.

Look at all the photos carefully and provide:
1. name: A clear, searchable product name (brand + type, e.g. "DeWalt 20V Cordless Drill" or "IKEA Kallax Shelf Unit")
2. description: A 2-3 sentence marketplace listing description that highlights condition, features, and appeal. Write it like a real listing, not AI.
3. condition: One of: like_new, good, fair, poor
4. estimatedPrice: Estimated resale price in USD (integer). Be realistic based on condition and typical marketplace prices.
5. category: One of: furniture, electronics, sports, tools, appliances, clothing, outdoor, toys, fitness, other

Respond ONLY with a JSON object, no markdown:
{"name":"...","description":"...","condition":"...","estimatedPrice":0,"category":"..."}`
            : `You are analyzing photos of household items being donated to charity.

Look at the photos and provide:
1. name: A clear description of the items (e.g. "Box of children's clothing and toys" or "Kitchen appliances set")
2. description: A brief 1-2 sentence description of what's being donated and approximate condition.
3. condition: One of: like_new, good, fair, poor
4. category: One of: furniture, electronics, sports, tools, appliances, clothing, outdoor, toys, fitness, other

Respond ONLY with a JSON object, no markdown:
{"name":"...","description":"...","condition":"...","category":"..."}`;
        const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        const result = await model.generateContent([prompt, ...imageParts]);
        const text = result.response.text()?.trim() || "";
        // Parse JSON from response
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            console.error("Gemini did not return valid JSON:", text);
            return {
                name: "",
                description: "",
                condition: "good",
                estimatedPrice: 0,
                category: "other",
            };
        }
        const parsed = JSON.parse(jsonMatch[0]);
        return {
            name: parsed.name || "",
            description: parsed.description || "",
            condition: parsed.condition || "good",
            estimatedPrice: parsed.estimatedPrice || 0,
            category: parsed.category || "other",
        };
    }
    catch (err) {
        console.error("Item analysis failed:", err);
        throw new https_1.HttpsError("internal", `Item analysis failed: ${err.message}`);
    }
});
// ═══════════════════════════════════════════════════════════════
// Trigger: When a resale/donation item is confirmed → queue social post
// ═══════════════════════════════════════════════════════════════
exports.gsOnItemConfirmed = (0, firestore_1.onDocumentUpdated)(`${gs_constants_1.GS_COLLECTIONS.RESALE_DONATION_ITEMS}/{itemId}`, async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after)
        return;
    // Only trigger when status changes TO worker_confirmed
    if (before.status === "worker_confirmed" || after.status !== "worker_confirmed")
        return;
    const itemType = after.type;
    const jobId = after.jobId;
    // Load job details for social queue entry
    const jobSnap = await db.collection(gs_constants_1.GS_COLLECTIONS.JOBS).doc(jobId).get();
    if (!jobSnap.exists) {
        console.error(`Job ${jobId} not found for social queue`);
        return;
    }
    const job = jobSnap.data();
    const photos = after.photos;
    const confirmed = after.workerConfirmed;
    // Create social content queue entry
    await db.collection(gs_constants_1.GS_COLLECTIONS.SOCIAL_CONTENT_QUEUE).add({
        jobId,
        scholarId: job.claimedBy || "",
        jobTitle: job.title || "",
        address: job.address || "",
        packageTier: job.packageTier || "",
        beforePhotoUrl: "",
        afterPhotoUrl: "",
        contentType: itemType,
        itemName: confirmed?.name || "",
        itemPhotos: Object.values(photos),
        status: "pending",
        retryCount: 0,
        createdAt: firestore_2.FieldValue.serverTimestamp(),
    });
    console.log(`Social queue entry created for ${itemType} item in job ${jobId}`);
});
// ═══════════════════════════════════════════════════════════════
// Trigger: When gym install photos are uploaded → queue social post
// ═══════════════════════════════════════════════════════════════
exports.gsOnGymPhotosUploaded = (0, firestore_1.onDocumentCreated)(`${gs_constants_1.GS_COLLECTIONS.GYM_INSTALL_PHOTOS}/{docId}`, async (event) => {
    const data = event.data?.data();
    if (!data)
        return;
    const jobId = data.jobId;
    const photos = data.photos;
    const equipment = data.equipmentInstalled;
    // Load job details
    const jobSnap = await db.collection(gs_constants_1.GS_COLLECTIONS.JOBS).doc(jobId).get();
    if (!jobSnap.exists) {
        console.error(`Job ${jobId} not found for gym social queue`);
        return;
    }
    const job = jobSnap.data();
    // Create social content queue entry
    await db.collection(gs_constants_1.GS_COLLECTIONS.SOCIAL_CONTENT_QUEUE).add({
        jobId,
        scholarId: job.claimedBy || "",
        jobTitle: job.title || "",
        address: job.address || "",
        packageTier: job.packageTier || "",
        beforePhotoUrl: "",
        afterPhotoUrl: "",
        contentType: "gym_install",
        itemName: equipment.join(", "),
        itemPhotos: photos,
        status: "pending",
        retryCount: 0,
        createdAt: firestore_2.FieldValue.serverTimestamp(),
    });
    console.log(`Social queue entry created for gym install in job ${jobId}`);
});
// ═══════════════════════════════════════════════════════════════
// Trigger: When donation receipt is uploaded → send email
// ═══════════════════════════════════════════════════════════════
exports.gsOnDonationReceiptUploaded = (0, firestore_1.onDocumentCreated)(`${gs_constants_1.GS_COLLECTIONS.DONATION_RECEIPTS}/{receiptId}`, async (event) => {
    const data = event.data?.data();
    if (!data)
        return;
    const jobId = data.jobId;
    const donationCenter = data.donationCenter;
    const receiptPhotoUrl = data.receiptPhotoUrl;
    const itemIds = data.itemIds;
    // Load job for customer email
    const jobSnap = await db.collection(gs_constants_1.GS_COLLECTIONS.JOBS).doc(jobId).get();
    if (!jobSnap.exists) {
        console.error(`Job ${jobId} not found for donation receipt email`);
        return;
    }
    const job = jobSnap.data();
    const customerEmail = job.clientEmail;
    const customerName = job.clientName || job.customerName || "Valued Customer";
    // Load donated items
    const itemNames = [];
    for (const itemId of itemIds) {
        const itemSnap = await db.collection(gs_constants_1.GS_COLLECTIONS.RESALE_DONATION_ITEMS).doc(itemId).get();
        if (itemSnap.exists) {
            const itemData = itemSnap.data();
            const name = itemData.workerConfirmed?.name || itemData.aiSuggestion?.name || "Item";
            itemNames.push(name);
        }
    }
    const itemListHtml = itemNames.length > 0
        ? itemNames.map((n) => `<li style="margin-bottom: 4px;">${n}</li>`).join("")
        : "<li>Donated items</li>";
    const emailBody = emailWrapper(`
      <p>Hi ${customerName},</p>
      <p>Thank you for your generous donation during your Garage Scholars garage transformation! Here is your donation receipt for your records.</p>

      <div style="background: #f1f5f9; border-radius: 8px; padding: 16px; margin: 20px 0;">
        <h3 style="margin: 0 0 8px 0; color: #0f1b2d;">Donation Receipt</h3>
        <p style="margin: 4px 0;"><strong>Donation Center:</strong> ${donationCenter}</p>
        <p style="margin: 4px 0;"><strong>Date:</strong> ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>
        <p style="margin: 4px 0;"><strong>Job Reference:</strong> ${job.title || jobId}</p>
      </div>

      <h3 style="color: #0f1b2d;">Items Donated:</h3>
      <ul style="color: #334155;">
        ${itemListHtml}
      </ul>

      ${receiptPhotoUrl ? `<p><a href="${receiptPhotoUrl}" style="color: #14b8a6; font-weight: 700;">View Donation Receipt Photo</a></p>` : ""}

      <div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 12px 16px; margin: 20px 0; border-radius: 0 8px 8px 0;">
        <p style="margin: 0; color: #1e40af; font-weight: 600;">Tax Benefit Information</p>
        <p style="margin: 8px 0 0 0; color: #334155; font-size: 14px;">
          These donated items may be tax-deductible. Please keep this receipt for your records and consult your tax advisor regarding the fair market value of your donated items.
        </p>
      </div>

      <p style="color: #64748b; font-size: 14px;">Thank you for choosing to give back while transforming your space!</p>
    `);
    // Send to admin and customer
    const recipients = ["admin@garagescholars.com"];
    if (customerEmail)
        recipients.push(customerEmail);
    try {
        await (0, gs_notifications_1.sendEmail)(recipients, `Donation Receipt — ${donationCenter} | ${job.title || "Garage Transformation"}`, emailBody);
        console.log(`Donation receipt email sent to: ${recipients.join(", ")}`);
    }
    catch (err) {
        console.error("Failed to send donation receipt email:", err);
    }
});
// ═══════════════════════════════════════════════════════════════
// Resale Concierge — Email Notifications on Status Changes
// ═══════════════════════════════════════════════════════════════
exports.gsOnResaleStatusChange = (0, firestore_1.onDocumentUpdated)("inventory/{itemId}", async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after)
        return;
    const oldStatus = before.status;
    const newStatus = after.status;
    if (oldStatus === newStatus)
        return;
    // Rate limit: skip if an email was sent for this item in the last 5 minutes
    const lastEmailAt = after.lastEmailSentAt?.toDate?.() || null;
    if (lastEmailAt && Date.now() - lastEmailAt.getTime() < 5 * 60 * 1000) {
        console.log(`Skipping email for ${event.params.itemId} — rate limited (last sent ${lastEmailAt})`);
        return;
    }
    const title = escapeHtml(after.title || "Untitled Item");
    const client = escapeHtml(after.clientName || "Unknown Client");
    const price = escapeHtml(String(after.price || "0"));
    const itemId = event.params.itemId;
    // Mark email timestamp to prevent spam
    await db.collection("inventory").doc(itemId).update({
        lastEmailSentAt: firestore_2.FieldValue.serverTimestamp(),
    });
    // ── New listing needs review → notify admins ──
    if (newStatus === "Needs Review") {
        // Only allow images from our Firebase Storage bucket
        const rawImageUrl = after.imageUrls?.[0] || "";
        const imageHtml = rawImageUrl.includes("firebasestorage.googleapis.com")
            ? `<img src="${escapeHtml(rawImageUrl)}" alt="${title}" style="width: 200px; border-radius: 8px; margin: 12px 0;" />`
            : "";
        await (0, gs_notifications_1.sendEmail)(ADMIN_EMAILS, `New Listing Needs Review: ${title}`, emailWrapper(`
          <h2 style="color: #0f1b2d; margin: 0 0 8px 0;">New Listing Submitted</h2>
          <p style="color: #475569;">A new item is waiting for your review before it can be posted to marketplaces.</p>

          ${imageHtml}

          <div style="background: #f1f5f9; border-radius: 8px; padding: 16px; margin: 16px 0;">
            <p style="margin: 4px 0;"><strong>Item:</strong> ${title}</p>
            <p style="margin: 4px 0;"><strong>Price:</strong> $${price}</p>
            <p style="margin: 4px 0;"><strong>Client:</strong> ${client}</p>
            <p style="margin: 4px 0;"><strong>Platform:</strong> ${after.platform || "Not set"}</p>
            <p style="margin: 4px 0;"><strong>Condition:</strong> ${after.condition || "Not set"}</p>
          </div>

          <p style="color: #475569; font-size: 14px;">
            Log in to the <a href="https://garage-scholars-resale.vercel.app" style="color: #14b8a6; font-weight: 700;">Resale Concierge</a> to review and approve this listing.
          </p>
        `));
        console.log(`Review notification sent for: ${title}`);
    }
    // ── Item approved → notify admins of automation start ──
    if (newStatus === "Pending" && oldStatus === "Needs Review") {
        await (0, gs_notifications_1.sendEmail)(ADMIN_EMAILS, `Listing Approved: ${title} — Automation Starting`, emailWrapper(`
          <h2 style="color: #0f1b2d; margin: 0 0 8px 0;">Listing Approved</h2>
          <p style="color: #475569;"><strong>${title}</strong> has been approved and is now queued for marketplace automation.</p>

          <div style="background: #ecfdf5; border-left: 4px solid #10b981; padding: 12px 16px; margin: 16px 0; border-radius: 0 8px 8px 0;">
            <p style="margin: 0; color: #065f46;">The backend worker will automatically post this item to: <strong>${after.platform || "configured platforms"}</strong></p>
          </div>

          <div style="background: #f1f5f9; border-radius: 8px; padding: 16px; margin: 16px 0;">
            <p style="margin: 4px 0;"><strong>Client:</strong> ${client}</p>
            <p style="margin: 4px 0;"><strong>Price:</strong> $${price}</p>
          </div>
        `));
        console.log(`Approval notification sent for: ${title}`);
    }
    // ── Item denied → log (no client email on this collection) ──
    if (newStatus === "Denied") {
        await (0, gs_notifications_1.sendEmail)(ADMIN_EMAILS, `Listing Denied: ${title}`, emailWrapper(`
          <h2 style="color: #0f1b2d; margin: 0 0 8px 0;">Listing Denied</h2>
          <p style="color: #475569;"><strong>${title}</strong> (Client: ${client}) was denied review.</p>
          <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 12px 16px; margin: 16px 0; border-radius: 0 8px 8px 0;">
            <p style="margin: 0; color: #991b1b;"><strong>Reason:</strong> ${escapeHtml(after.reviewNotes || "No reason provided")}</p>
          </div>
        `));
        console.log(`Denial notification sent for: ${title}`);
    }
    // ── Automation error → notify admins ──
    if ((newStatus === "Error" || newStatus === "Compliance Error") && oldStatus !== "Error" && oldStatus !== "Compliance Error") {
        const errorMsg = escapeHtml(String(after.lastError?.message || after.lastError || "Unknown error"));
        await (0, gs_notifications_1.sendEmail)(ADMIN_EMAILS, `Automation Error: ${title}`, emailWrapper(`
          <h2 style="color: #0f1b2d; margin: 0 0 8px 0;">Automation Error</h2>
          <p style="color: #475569;">The automation worker encountered an error while posting <strong>${title}</strong>.</p>

          <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 12px 16px; margin: 16px 0; border-radius: 0 8px 8px 0;">
            <p style="margin: 0; color: #991b1b;"><strong>Error:</strong> ${errorMsg}</p>
          </div>

          <div style="background: #f1f5f9; border-radius: 8px; padding: 16px; margin: 16px 0;">
            <p style="margin: 4px 0;"><strong>Client:</strong> ${client}</p>
            <p style="margin: 4px 0;"><strong>Platform:</strong> ${after.platform || "Not set"}</p>
            <p style="margin: 4px 0;"><strong>Item ID:</strong> ${itemId}</p>
          </div>

          <p style="color: #475569; font-size: 14px;">
            <a href="https://garage-scholars-resale.vercel.app" style="color: #14b8a6; font-weight: 700;">Open Resale Concierge</a> to retry or edit this listing.
          </p>
        `));
        console.log(`Error notification sent for: ${title}`);
    }
    // ── Item goes Active → confirmation to admins ──
    if (newStatus === "Active" && oldStatus !== "Active") {
        await (0, gs_notifications_1.sendEmail)(ADMIN_EMAILS, `Now Live: ${title} — $${price}`, emailWrapper(`
          <h2 style="color: #0f1b2d; margin: 0 0 8px 0;">Item is Live!</h2>
          <p style="color: #475569;"><strong>${title}</strong> is now active on the marketplace.</p>

          <div style="background: #ecfdf5; border-left: 4px solid #10b981; padding: 12px 16px; margin: 16px 0; border-radius: 0 8px 8px 0;">
            <p style="margin: 0; color: #065f46;">Successfully posted to <strong>${after.platform || "marketplace"}</strong> at <strong>$${price}</strong></p>
          </div>

          <div style="background: #f1f5f9; border-radius: 8px; padding: 16px; margin: 16px 0;">
            <p style="margin: 4px 0;"><strong>Client:</strong> ${client}</p>
          </div>
        `));
        console.log(`Active notification sent for: ${title}`);
    }
});
// ═══════════════════════════════════════════════════════════════
// Resale Concierge — Email on Item Sold (archived to sold_inventory)
// ═══════════════════════════════════════════════════════════════
exports.gsOnItemSold = (0, firestore_1.onDocumentCreated)("sold_inventory/{itemId}", async (event) => {
    const data = event.data?.data();
    if (!data)
        return;
    const title = escapeHtml(data.title || "Untitled Item");
    const client = escapeHtml(data.clientName || "Unknown Client");
    const price = escapeHtml(String(data.price || "0"));
    const salePrice = parseFloat(data.price) || 0;
    const commission = salePrice * 0.50;
    const clientShare = salePrice - commission;
    await (0, gs_notifications_1.sendEmail)(ADMIN_EMAILS, `SOLD: ${title} for $${price}`, emailWrapper(`
        <h2 style="color: #0f1b2d; margin: 0 0 8px 0;">Item Sold!</h2>
        <p style="color: #475569;"><strong>${title}</strong> has been marked as sold.</p>

        <div style="background: #ecfdf5; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <h3 style="margin: 0 0 12px 0; color: #065f46;">Revenue Breakdown</h3>
          <table style="width: 100%; font-size: 14px; color: #334155;">
            <tr><td style="padding: 4px 0;">Sale Price</td><td style="text-align: right; font-weight: 700;">$${salePrice.toFixed(2)}</td></tr>
            <tr><td style="padding: 4px 0;">Our Commission (50%)</td><td style="text-align: right; font-weight: 700; color: #059669;">$${commission.toFixed(2)}</td></tr>
            <tr style="border-top: 1px solid #d1d5db;"><td style="padding: 8px 0 4px;">Client Share (${client})</td><td style="text-align: right; font-weight: 700;">$${clientShare.toFixed(2)}</td></tr>
          </table>
        </div>

        <div style="background: #f1f5f9; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <p style="margin: 4px 0;"><strong>Client:</strong> ${client}</p>
          <p style="margin: 4px 0;"><strong>Platform:</strong> ${data.platform || "Not set"}</p>
          <p style="margin: 4px 0;"><strong>Date Sold:</strong> ${data.dateSold || new Date().toLocaleDateString()}</p>
        </div>

        <p style="color: #475569; font-size: 14px;">
          Remember to <a href="https://garage-scholars-resale.vercel.app" style="color: #14b8a6; font-weight: 700;">record the payout</a> to ${client} when payment is sent.
        </p>
      `));
    console.log(`Sold notification sent for: ${title} — $${price}`);
});
