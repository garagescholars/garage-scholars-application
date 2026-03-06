"use strict";
/**
 * Garage Scholars — Resale Concierge Messaging & Email Drip Functions
 *
 * Handles:
 * 1. Email notifications when new buyer conversations are created
 * 2. Email notifications when buyers reply in conversations
 * 3. Daily drip emails: stale listings, price drop reminders, payout reminders
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.gsResaleDripNotifications = exports.gsOnConversationReply = exports.gsOnConversationCreated = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const firestore_2 = require("firebase-admin/firestore");
const gs_notifications_1 = require("./gs-notifications");
const db = (0, firestore_2.getFirestore)();
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
/** Branded email wrapper (matches gs-inventory.ts styling) */
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
/** Platform color for email badges */
function platformColor(platform) {
    switch (platform?.toLowerCase()) {
        case "ebay": return "#e53e3e";
        case "craigslist": return "#805ad5";
        case "facebook": return "#3182ce";
        default: return "#718096";
    }
}
// ═══════════════════════════════════════════════════════════════
// 1. New Conversation Created → Email Admins
// ═══════════════════════════════════════════════════════════════
exports.gsOnConversationCreated = (0, firestore_1.onDocumentCreated)("conversations/{conversationId}", async (event) => {
    const data = event.data?.data();
    if (!data)
        return;
    const buyerName = escapeHtml(data.buyerName || "Unknown Buyer");
    const platform = escapeHtml(data.platform || "Unknown");
    const itemTitle = escapeHtml(data.itemTitle || "Unknown Item");
    const firstMessage = escapeHtml(data.lastMessage || "");
    const color = platformColor(data.platform);
    await (0, gs_notifications_1.sendEmail)(ADMIN_EMAILS, `New Buyer Inquiry: ${data.buyerName || "Unknown"} — ${data.itemTitle || "Item"}`, emailWrapper(`
        <h2 style="color: #0f1b2d; margin: 0 0 8px 0;">New Buyer Inquiry</h2>
        <p style="color: #475569;">A new conversation has been logged in the Resale Concierge.</p>

        <div style="background: #f1f5f9; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <p style="margin: 4px 0;">
            <strong>Buyer:</strong> ${buyerName}
          </p>
          <p style="margin: 4px 0;">
            <strong>Platform:</strong>
            <span style="background: ${color}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 700;">${platform}</span>
          </p>
          <p style="margin: 4px 0;"><strong>Item:</strong> ${itemTitle}</p>
        </div>

        ${firstMessage ? `
        <div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 12px 16px; margin: 16px 0; border-radius: 0 8px 8px 0;">
          <p style="margin: 0; color: #1e40af; font-weight: 600;">Initial Message</p>
          <p style="margin: 8px 0 0 0; color: #334155; font-size: 14px;">"${firstMessage}"</p>
        </div>
        ` : ""}

        <p style="color: #475569; font-size: 14px;">
          <a href="https://garage-scholars-resale.vercel.app" style="color: #14b8a6; font-weight: 700;">Open Resale Concierge</a> to view and respond.
        </p>
      `));
    console.log(`New conversation email sent: ${data.buyerName} — ${data.itemTitle}`);
});
// ═══════════════════════════════════════════════════════════════
// 2. New Message in Conversation → Email Admins (skip owner replies)
// ═══════════════════════════════════════════════════════════════
exports.gsOnConversationReply = (0, firestore_1.onDocumentCreated)("conversations/{conversationId}/messages/{messageId}", async (event) => {
    const data = event.data?.data();
    if (!data)
        return;
    // Don't email when admin sends a message (sender === "owner")
    if (data.sender === "owner")
        return;
    // Load parent conversation for context
    const conversationId = event.params.conversationId;
    const convoSnap = await db.collection("conversations").doc(conversationId).get();
    if (!convoSnap.exists)
        return;
    const convo = convoSnap.data();
    // Rate limit: check if conversation had an email in the last 5 minutes
    const lastEmailAt = convo.lastReplyEmailAt?.toDate?.() || null;
    if (lastEmailAt && Date.now() - lastEmailAt.getTime() < 5 * 60 * 1000) {
        console.log(`Skipping reply email for conversation ${conversationId} — rate limited`);
        return;
    }
    // Update rate limit timestamp
    await db.collection("conversations").doc(conversationId).update({
        lastReplyEmailAt: firestore_2.FieldValue.serverTimestamp(),
    });
    const buyerName = escapeHtml(convo.buyerName || "Buyer");
    const itemTitle = escapeHtml(convo.itemTitle || "Item");
    const messageText = escapeHtml(data.text || "");
    const platform = escapeHtml(convo.platform || "");
    await (0, gs_notifications_1.sendEmail)(ADMIN_EMAILS, `Reply from ${convo.buyerName || "Buyer"}: ${convo.itemTitle || "Item"}`, emailWrapper(`
        <h2 style="color: #0f1b2d; margin: 0 0 8px 0;">New Buyer Reply</h2>
        <p style="color: #475569;"><strong>${buyerName}</strong> sent a message about <strong>${itemTitle}</strong>${platform ? ` (${platform})` : ""}.</p>

        <div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 12px 16px; margin: 16px 0; border-radius: 0 8px 8px 0;">
          <p style="margin: 0; color: #334155; font-size: 14px;">"${messageText}"</p>
        </div>

        <p style="color: #475569; font-size: 14px;">
          <a href="https://garage-scholars-resale.vercel.app" style="color: #14b8a6; font-weight: 700;">Open Resale Concierge</a> to reply.
        </p>
      `));
    console.log(`Reply email sent for conversation ${conversationId}`);
});
// ═══════════════════════════════════════════════════════════════
// 3. Daily Drip Notifications (9:00 AM Denver)
//    - 3-day stale listings
//    - 7-day price drop reminder
//    - Payout reminders for sold items
// ═══════════════════════════════════════════════════════════════
exports.gsResaleDripNotifications = (0, scheduler_1.onSchedule)({
    schedule: "0 9 * * *",
    timeZone: "America/Denver",
}, async () => {
    const now = Date.now();
    const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    const dripItems = [];
    // ── 3-Day Stale Listing Check ──
    const inventorySnap = await db.collection("inventory")
        .where("status", "==", "Active")
        .get();
    for (const doc of inventorySnap.docs) {
        const item = doc.data();
        const dripsSent = item.dripsSent || [];
        const dateListed = item.dateListed?.toDate?.() || item.dateAdded?.toDate?.() || null;
        if (!dateListed)
            continue;
        const ageMs = now - dateListed.getTime();
        const title = escapeHtml(item.title || "Untitled");
        const price = escapeHtml(String(item.price || "0"));
        // 3-day stale reminder
        if (ageMs >= THREE_DAYS_MS && !dripsSent.includes("stale_3d")) {
            dripItems.push(`
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${title}</td>
            <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">$${price}</td>
            <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">
              <span style="background: #fef3c7; color: #92400e; padding: 2px 8px; border-radius: 4px; font-size: 12px;">3+ Days Active</span>
            </td>
            <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">Consider lowering price or improving photos</td>
          </tr>
        `);
            await doc.ref.update({
                dripsSent: firestore_2.FieldValue.arrayUnion("stale_3d"),
            });
        }
        // 7-day price drop reminder
        if (ageMs >= SEVEN_DAYS_MS && !dripsSent.includes("price_drop_7d")) {
            dripItems.push(`
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${title}</td>
            <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">$${price}</td>
            <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">
              <span style="background: #fee2e2; color: #991b1b; padding: 2px 8px; border-radius: 4px; font-size: 12px;">7+ Days — Price Drop?</span>
            </td>
            <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">Strong candidate for 15-20% price reduction</td>
          </tr>
        `);
            await doc.ref.update({
                dripsSent: firestore_2.FieldValue.arrayUnion("price_drop_7d"),
            });
        }
    }
    // ── Payout Reminders for Sold Items ──
    const soldSnap = await db.collection("sold_inventory").get();
    for (const doc of soldSnap.docs) {
        const item = doc.data();
        const dripsSent = item.dripsSent || [];
        // Skip if already paid out or reminder already sent
        if (item.paidOut || dripsSent.includes("payout_reminder"))
            continue;
        const dateSold = item.dateSold
            ? new Date(item.dateSold)
            : item.soldAt?.toDate?.() || null;
        if (!dateSold)
            continue;
        const ageMs = now - dateSold.getTime();
        // Remind after 3 days of being sold without payout
        if (ageMs >= THREE_DAYS_MS) {
            const title = escapeHtml(item.title || "Untitled");
            const client = escapeHtml(item.clientName || "Unknown");
            const salePrice = parseFloat(item.price) || 0;
            const clientShare = (salePrice * 0.50).toFixed(2);
            dripItems.push(`
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${title}</td>
            <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">$${escapeHtml(String(salePrice))}</td>
            <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">
              <span style="background: #dbeafe; color: #1e40af; padding: 2px 8px; border-radius: 4px; font-size: 12px;">Payout Due</span>
            </td>
            <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${client} is owed $${clientShare}</td>
          </tr>
        `);
            await doc.ref.update({
                dripsSent: firestore_2.FieldValue.arrayUnion("payout_reminder"),
            });
        }
    }
    // ── Send consolidated drip email if there are any items ──
    if (dripItems.length === 0) {
        console.log("Drip check: no items need attention today.");
        return;
    }
    await (0, gs_notifications_1.sendEmail)(ADMIN_EMAILS, `Resale Daily Digest — ${dripItems.length} item${dripItems.length !== 1 ? "s" : ""} need attention`, emailWrapper(`
        <h2 style="color: #0f1b2d; margin: 0 0 8px 0;">Daily Resale Digest</h2>
        <p style="color: #475569;">The following items need your attention:</p>

        <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin: 16px 0;">
          <thead>
            <tr style="background: #f1f5f9;">
              <th style="padding: 8px; text-align: left; border-bottom: 2px solid #e2e8f0;">Item</th>
              <th style="padding: 8px; text-align: left; border-bottom: 2px solid #e2e8f0;">Price</th>
              <th style="padding: 8px; text-align: left; border-bottom: 2px solid #e2e8f0;">Status</th>
              <th style="padding: 8px; text-align: left; border-bottom: 2px solid #e2e8f0;">Action</th>
            </tr>
          </thead>
          <tbody>
            ${dripItems.join("")}
          </tbody>
        </table>

        <p style="color: #475569; font-size: 14px;">
          <a href="https://garage-scholars-resale.vercel.app" style="color: #14b8a6; font-weight: 700;">Open Resale Concierge</a> to take action.
        </p>
      `));
    console.log(`Drip digest sent with ${dripItems.length} items.`);
});
