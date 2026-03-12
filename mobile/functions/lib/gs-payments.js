"use strict";
/**
 * Garage Scholars — Payment System Cloud Functions
 *
 * Handles:
 * - 50/50 split payouts to scholars (check-in → first half, 72hr quality window → second half)
 * - Stripe Connect for scholar bank accounts
 * - Customer payment collection (ACH preferred, card fallback + convenience fee)
 * - Recurring retention subscriptions
 * - Resale payouts to customers
 * - Biweekly CPA reporting with auto-email
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.gsSendResalePaymentLink = exports.gsCheckMissedBalanceInvoices = exports.gsCreateBalanceInvoice = exports.gsCreateInvoice = exports.gsExportPaymentData = exports.gsCpaReconciliationReport = exports.gsFundMercuryFromChase = exports.gsWeeklyReplenishmentReport = exports.gsGeneratePaymentReport = exports.gsMarkPayoutPaid = exports.gsAdminComplaint = exports.gsSaveScholarBankInfo = exports.gsSaveResaleBankInfo = exports.gsSaveResalePaymentInfo = exports.gsResalePayout = exports.gsCreateRetentionSubscription = exports.gsCreateCustomerPayment = exports.gsStripeWebhook = exports.gsCreateStripeAccount = exports.gsReleaseCompletionPayouts = void 0;
exports.createCheckinPayout = createCheckinPayout;
exports.holdCompletionPayout = holdCompletionPayout;
const scheduler_1 = require("firebase-functions/v2/scheduler");
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-admin/firestore");
const gs_constants_1 = require("./gs-constants");
const gs_mercury_1 = require("./gs-mercury");
const db = (0, firestore_1.getFirestore)();
// Lazy-load Stripe (only when needed, avoids cold start cost when not processing payments)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _stripe = null;
function getStripe() {
    if (!_stripe) {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const Stripe = require("stripe");
        const key = process.env.STRIPE_SECRET_KEY?.trim();
        if (!key)
            throw new Error("STRIPE_SECRET_KEY not configured");
        _stripe = new Stripe(key);
    }
    return _stripe;
}
// ── Helper: get Mercury config from Firestore platform config ──
async function getMercuryConfig() {
    const apiKey = process.env.MERCURY_API_KEY;
    if (!apiKey)
        return null;
    const configSnap = await db.collection(gs_constants_1.GS_COLLECTIONS.PLATFORM_CONFIG).doc("payments").get();
    const accountId = configSnap.data()?.mercuryAccountId;
    if (!accountId)
        return null;
    return { apiKey, accountId };
}
// ── Helper: send admin notification via Firestore mail collection ──
async function notifyAdmins(subject, body) {
    await db.collection("mail").add({
        to: ["garagescholars@gmail.com"],
        message: { subject, html: body },
        createdAt: firestore_1.FieldValue.serverTimestamp(),
    });
}
async function getAdminTokens(category) {
    const snap = await db.collection(gs_constants_1.GS_COLLECTIONS.PROFILES).where("role", "==", "admin").get();
    return snap.docs
        .filter((d) => {
        const token = d.data().pushToken;
        if (!token)
            return false;
        if (category) {
            const prefs = d.data().notificationPrefs;
            if (prefs && prefs[category] === false)
                return false;
        }
        return true;
    })
        .map((d) => d.data().pushToken);
}
// ── Helper: get admin emails, optionally filtered by notification preference ──
async function getAdminEmails(category) {
    const snap = await db.collection(gs_constants_1.GS_COLLECTIONS.PROFILES).where("role", "==", "admin").get();
    return snap.docs
        .filter((d) => {
        const email = d.data().email;
        if (!email)
            return false;
        if (category) {
            const prefs = d.data().notificationPrefs;
            if (prefs && prefs[category] === false)
                return false;
        }
        return true;
    })
        .map((d) => d.data().email);
}
async function sendExpoPush(pushTokens, title, body, data) {
    const messages = pushTokens
        .filter((t) => t && t.startsWith("ExponentPushToken"))
        .map((to) => ({ to, title, body, sound: "default", data }));
    if (messages.length === 0)
        return;
    try {
        await fetch("https://exp.host/--/api/v2/push/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(messages),
        });
    }
    catch (err) {
        console.error("Expo push failed:", err);
    }
}
// ═══════════════════════════════════════════════════════════════
// 1. HELPER: Create first-half payout on scholar check-in
//    Called from gsOnJobUpdated (UPCOMING → IN_PROGRESS)
// ═══════════════════════════════════════════════════════════════
async function createCheckinPayout(jobId, jobData) {
    const scholarId = jobData.claimedBy;
    if (!scholarId) {
        console.warn(`createCheckinPayout: no claimedBy for job ${jobId}`);
        return;
    }
    // Idempotency: check if payout already exists for this job + split type
    const existingSnap = await db
        .collection(gs_constants_1.GS_COLLECTIONS.PAYOUTS)
        .where("jobId", "==", jobId)
        .where("splitType", "==", "checkin_50")
        .limit(1)
        .get();
    if (!existingSnap.empty) {
        console.log(`Checkin payout already exists for job ${jobId}, skipping.`);
        return;
    }
    const totalPayout = (jobData.payout || 0) + (jobData.rushBonus || 0);
    const firstHalf = Math.round((totalPayout * gs_constants_1.CHECKIN_SPLIT_PERCENT) / 100 * 100) / 100;
    // Check if scholar has bank info on file for Mercury ACH
    const bankAccSnap = await db
        .collection(gs_constants_1.GS_COLLECTIONS.STRIPE_ACCOUNTS)
        .where("userId", "==", scholarId)
        .where("accountType", "==", "scholar")
        .where("payoutsEnabled", "==", true)
        .limit(1)
        .get();
    const hasBankInfo = !bankAccSnap.empty && !!bankAccSnap.docs[0].data().bankRouting;
    const bankData = hasBankInfo ? bankAccSnap.docs[0].data() : null;
    // Check for Zelle/Venmo fallback
    const hasFallback = !hasBankInfo && bankAccSnap.docs?.[0]?.data()?.fallbackMethod;
    const fallbackData = hasFallback ? bankAccSnap.docs[0].data() : null;
    // Create payout doc
    const payoutRef = db.collection(gs_constants_1.GS_COLLECTIONS.PAYOUTS).doc();
    const payoutData = {
        jobId,
        scholarId,
        recipientName: jobData.claimedByName || "Scholar",
        amount: firstHalf,
        splitType: "checkin_50",
        status: "pending",
        paymentMethod: "none",
        complaintWindowPassed: false,
        taxYear: new Date().getFullYear(),
        createdAt: firestore_1.FieldValue.serverTimestamp(),
    };
    // Priority 1: Mercury ACH direct deposit
    if (hasBankInfo && bankData) {
        const mercury = await getMercuryConfig();
        if (mercury) {
            const result = await (0, gs_mercury_1.sendMercuryPayout)(mercury.apiKey, mercury.accountId, {
                name: bankData.accountHolderName || jobData.claimedByName || "Scholar",
                routingNumber: bankData.bankRouting,
                accountNumber: bankData.bankAccount,
                accountType: bankData.bankAccountType || "checking",
            }, firstHalf, `Check-in payout: ${jobData.title || jobId}`);
            payoutData.status = result.status;
            payoutData.paymentMethod = result.method;
            if (result.transferId)
                payoutData.mercuryTransferId = result.transferId;
            if (result.error)
                payoutData.notes = `Mercury: ${result.error}`;
        }
    }
    // Priority 2: Zelle/Venmo on file
    if (payoutData.paymentMethod === "none" && fallbackData) {
        payoutData.paymentMethod = fallbackData.fallbackMethod;
        payoutData.fallbackHandle = fallbackData.fallbackHandle;
        payoutData.status = "awaiting_send";
        payoutData.notes = `Send via ${fallbackData.fallbackMethod}: ${fallbackData.fallbackHandle}`;
    }
    // Priority 3: No payment info — manual
    if (payoutData.paymentMethod === "none") {
        payoutData.paymentMethod = "manual";
        payoutData.status = "pending";
    }
    await payoutRef.set(payoutData);
    // Update job with first payout reference
    await db.collection(gs_constants_1.GS_COLLECTIONS.JOBS).doc(jobId).update({
        firstPayoutId: payoutRef.id,
        paymentStatus: "first_paid",
    });
    // Notify admins if not fully automated
    if (payoutData.status !== "processing") {
        const scholarName = jobData.claimedByName || "Unknown Scholar";
        const actionMsg = payoutData.paymentMethod === "manual"
            ? "No bank info on file — send them a bank link or pay via Zelle/Venmo."
            : `Send via ${payoutData.paymentMethod}: ${payoutData.fallbackHandle || ""}. Then mark as paid.`;
        await notifyAdmins(`Payout Action: $${firstHalf} to ${scholarName}`, `<p><strong>${scholarName}</strong> checked in for "<strong>${jobData.title || jobId}</strong>".</p>
       <p>First 50% payout: <strong>$${firstHalf}</strong></p>
       <p><strong>Action:</strong> ${actionMsg}</p>`);
        const adminTokens = await getAdminTokens();
        if (adminTokens.length > 0) {
            await sendExpoPush(adminTokens, "Payout Action Needed", `$${firstHalf} to ${scholarName} for check-in (${jobData.title})`, { screen: "admin-payments", jobId });
        }
    }
    console.log(`Checkin payout created: ${payoutRef.id}, amount=$${firstHalf}, method=${payoutData.paymentMethod}`);
}
// ═══════════════════════════════════════════════════════════════
// 2. HELPER: Hold completion payout on complaint
//    Called from gsSubmitComplaint
// ═══════════════════════════════════════════════════════════════
async function holdCompletionPayout(jobId) {
    const payoutsSnap = await db
        .collection(gs_constants_1.GS_COLLECTIONS.PAYOUTS)
        .where("jobId", "==", jobId)
        .where("splitType", "==", "completion_50")
        .get();
    for (const payoutDoc of payoutsSnap.docs) {
        if (payoutDoc.data().status === "pending" || payoutDoc.data().status === "processing") {
            await payoutDoc.ref.update({
                status: "held",
                holdReason: "Customer complaint filed",
            });
            console.log(`Held completion payout ${payoutDoc.id} for job ${jobId}`);
        }
    }
    // Update job payment status
    await db.collection(gs_constants_1.GS_COLLECTIONS.JOBS).doc(jobId).update({
        paymentStatus: "held",
    });
}
// ═══════════════════════════════════════════════════════════════
// 3. SCHEDULED: Release completion payouts after 72hr window
//    Runs every hour. Only queries jobs awaiting second payout
//    (paymentStatus == "first_paid") to avoid scanning all history.
// ═══════════════════════════════════════════════════════════════
exports.gsReleaseCompletionPayouts = (0, scheduler_1.onSchedule)({ schedule: "every 1 hours", timeoutSeconds: 300 }, async () => {
    console.log("gsReleaseCompletionPayouts: checking for payouts to release...");
    const now = firestore_1.Timestamp.now();
    // Only query jobs that are awaiting second payout — bounded set
    const pendingJobs = await db
        .collection(gs_constants_1.GS_COLLECTIONS.JOBS)
        .where("paymentStatus", "==", "first_paid")
        .get();
    if (pendingJobs.empty) {
        console.log("No jobs awaiting completion payout.");
        return;
    }
    console.log(`Found ${pendingJobs.size} jobs awaiting completion payout.`);
    for (const jobDoc of pendingJobs.docs) {
        try {
            const jobId = jobDoc.id;
            const jobData = jobDoc.data();
            const scholarId = jobData.claimedBy;
            if (!scholarId)
                continue;
            // Get quality score for this job
            const scoreSnap = await db.collection(gs_constants_1.GS_COLLECTIONS.JOB_QUALITY_SCORES).doc(jobId).get();
            if (!scoreSnap.exists)
                continue;
            const scoreData = scoreSnap.data();
            // Must be locked (48hr complaint window passed)
            if (!scoreData.scoreLocked)
                continue;
            // Skip if complaint filed
            if (scoreData.customerComplaint) {
                console.log(`Job ${jobId}: has complaint, skipping auto-release.`);
                continue;
            }
            // Score must meet minimum
            const finalScore = scoreData.finalScore || 0;
            if (finalScore < gs_constants_1.MINIMUM_SCORE_FOR_PAYMENT) {
                console.log(`Job ${jobId}: score ${finalScore} below minimum ${gs_constants_1.MINIMUM_SCORE_FOR_PAYMENT}, holding.`);
                await jobDoc.ref.update({ paymentStatus: "held" });
                continue;
            }
            // 72hrs must have passed since checkout
            // complaintWindowEnd = checkout + 48hrs, so releaseTime = complaintWindowEnd + 24hrs
            const complaintWindowEnd = scoreData.complaintWindowEnd?.toDate();
            if (!complaintWindowEnd)
                continue;
            const hoursAfterWindow = gs_constants_1.PAYMENT_RELEASE_HOURS - gs_constants_1.SCORE_LOCK_HOURS;
            const releaseTime = new Date(complaintWindowEnd.getTime() + hoursAfterWindow * 60 * 60 * 1000);
            if (now.toDate() < releaseTime)
                continue;
            // Idempotency: skip if completion payout already exists
            const existingPayout = await db
                .collection(gs_constants_1.GS_COLLECTIONS.PAYOUTS)
                .where("jobId", "==", jobId)
                .where("splitType", "==", "completion_50")
                .limit(1)
                .get();
            if (!existingPayout.empty) {
                // Fix stale paymentStatus
                await jobDoc.ref.update({ paymentStatus: "fully_paid", secondPayoutId: existingPayout.docs[0].id });
                continue;
            }
            const totalPayout = (jobData.payout || 0) + (jobData.rushBonus || 0);
            const secondHalf = Math.round((totalPayout * gs_constants_1.COMPLETION_SPLIT_PERCENT) / 100 * 100) / 100;
            // Check for bank info (Mercury ACH)
            const bankAccSnap = await db
                .collection(gs_constants_1.GS_COLLECTIONS.STRIPE_ACCOUNTS)
                .where("userId", "==", scholarId)
                .where("accountType", "==", "scholar")
                .where("payoutsEnabled", "==", true)
                .limit(1)
                .get();
            const hasBankInfo = !bankAccSnap.empty && !!bankAccSnap.docs[0].data().bankRouting;
            const bankInfo = hasBankInfo ? bankAccSnap.docs[0].data() : null;
            const hasFallback = !hasBankInfo && bankAccSnap.docs?.[0]?.data()?.fallbackMethod;
            const fallbackInfo = hasFallback ? bankAccSnap.docs[0].data() : null;
            // Create completion payout
            const payoutRef = db.collection(gs_constants_1.GS_COLLECTIONS.PAYOUTS).doc();
            const payoutData = {
                jobId,
                scholarId,
                recipientName: jobData.claimedByName || "Scholar",
                amount: secondHalf,
                splitType: "completion_50",
                status: "pending",
                paymentMethod: "none",
                releaseEligibleAt: firestore_1.Timestamp.fromDate(releaseTime),
                qualityScoreAtRelease: finalScore,
                complaintWindowPassed: true,
                taxYear: new Date().getFullYear(),
                createdAt: firestore_1.FieldValue.serverTimestamp(),
            };
            // Priority 1: Mercury ACH direct deposit
            if (hasBankInfo && bankInfo) {
                const mercury = await getMercuryConfig();
                if (mercury) {
                    const result = await (0, gs_mercury_1.sendMercuryPayout)(mercury.apiKey, mercury.accountId, {
                        name: bankInfo.accountHolderName || jobData.claimedByName || "Scholar",
                        routingNumber: bankInfo.bankRouting,
                        accountNumber: bankInfo.bankAccount,
                        accountType: bankInfo.bankAccountType || "checking",
                    }, secondHalf, `Completion payout: ${jobData.title || jobId}`);
                    payoutData.status = result.status;
                    payoutData.paymentMethod = result.method;
                    if (result.transferId)
                        payoutData.mercuryTransferId = result.transferId;
                    if (result.error)
                        payoutData.notes = `Mercury: ${result.error}`;
                }
            }
            // Priority 2: Zelle/Venmo fallback
            if (payoutData.paymentMethod === "none" && fallbackInfo) {
                payoutData.paymentMethod = fallbackInfo.fallbackMethod;
                payoutData.fallbackHandle = fallbackInfo.fallbackHandle;
                payoutData.status = "awaiting_send";
                payoutData.notes = `Send via ${fallbackInfo.fallbackMethod}: ${fallbackInfo.fallbackHandle}`;
            }
            // Priority 3: No payment info
            if (payoutData.paymentMethod === "none") {
                payoutData.paymentMethod = "manual";
                payoutData.status = "pending";
            }
            await payoutRef.set(payoutData);
            // Update job
            await jobDoc.ref.update({
                secondPayoutId: payoutRef.id,
                paymentStatus: "fully_paid",
            });
            // Notify scholar
            const scholarProfile = await db.collection(gs_constants_1.GS_COLLECTIONS.PROFILES).doc(scholarId).get();
            const pushToken = scholarProfile.data()?.pushToken;
            if (pushToken) {
                const depositMsg = payoutData.paymentMethod === "mercury_ach"
                    ? "sent via direct deposit — arrives in 1-2 business days"
                    : "approved — you'll receive payment shortly";
                await sendExpoPush([pushToken], "Payment Released!", `Your completion payout of $${secondHalf} for "${jobData.title}" has been ${depositMsg}.`, { screen: "payments" });
            }
            // Notify admins if not fully automated
            if (payoutData.status !== "processing") {
                const actionMsg = payoutData.paymentMethod === "manual"
                    ? "No bank info on file — send them a bank link or pay via Zelle/Venmo."
                    : `Send via ${payoutData.paymentMethod}: ${payoutData.fallbackHandle || ""}. Then mark as paid.`;
                await notifyAdmins(`Payout Action: $${secondHalf} to ${jobData.claimedByName || scholarId} (Completion)`, `<p>Completion payout released for "<strong>${jobData.title || jobId}</strong>".</p>
             <p>Scholar: <strong>${jobData.claimedByName || scholarId}</strong></p>
             <p>Amount: <strong>$${secondHalf}</strong></p>
             <p>Quality Score: ${finalScore.toFixed(2)}</p>
             <p><strong>Action:</strong> ${actionMsg}</p>`);
            }
            console.log(`Completion payout created: ${payoutRef.id}, job=${jobId}, amount=$${secondHalf}`);
        }
        catch (err) {
            console.error(`Error processing completion payout for job ${jobDoc.id}:`, err);
        }
    }
});
// ═══════════════════════════════════════════════════════════════
// 4. CALLABLE: Create Stripe Connect account for scholar/customer
// ═══════════════════════════════════════════════════════════════
exports.gsCreateStripeAccount = (0, https_1.onCall)({ cors: true, timeoutSeconds: 30, secrets: ["STRIPE_SECRET_KEY"] }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "Authentication required.");
    }
    const userId = request.auth.uid;
    const { accountType, returnUrl, refreshUrl } = request.data;
    if (!accountType) {
        throw new https_1.HttpsError("invalid-argument", "accountType is required (scholar or resale_customer).");
    }
    // Check for existing account
    const existingSnap = await db
        .collection(gs_constants_1.GS_COLLECTIONS.STRIPE_ACCOUNTS)
        .where("userId", "==", userId)
        .where("accountType", "==", accountType)
        .limit(1)
        .get();
    let stripeAccountId;
    if (!existingSnap.empty) {
        const existing = existingSnap.docs[0].data();
        if (existing.onboardingComplete && existing.payoutsEnabled) {
            return { alreadyComplete: true, stripeAccountId: existing.stripeAccountId };
        }
        stripeAccountId = existing.stripeAccountId;
    }
    else {
        // Create new Stripe Express account
        const stripe = getStripe();
        // Get user profile for prefill
        const profileSnap = await db.collection(gs_constants_1.GS_COLLECTIONS.PROFILES).doc(userId).get();
        const profile = profileSnap.data();
        const account = await stripe.accounts.create({
            type: "express",
            country: "US",
            capabilities: {
                transfers: { requested: true },
            },
            business_type: "individual",
            metadata: { userId, accountType, platform: "garage_scholars" },
            ...(profile?.email ? { email: profile.email } : {}),
        });
        stripeAccountId = account.id;
        // Save to Firestore
        await db.collection(gs_constants_1.GS_COLLECTIONS.STRIPE_ACCOUNTS).doc().set({
            userId,
            stripeAccountId: account.id,
            accountType,
            onboardingComplete: false,
            payoutsEnabled: false,
            taxIdProvided: false,
            createdAt: firestore_1.FieldValue.serverTimestamp(),
        });
        // Update scholar profile if scholar (use merge to avoid failing on missing doc)
        if (accountType === "scholar") {
            await db.collection(gs_constants_1.GS_COLLECTIONS.SCHOLAR_PROFILES).doc(userId).set({
                stripeAccountId: account.id,
                stripeOnboardingComplete: false,
                bankLinked: false,
            }, { merge: true });
        }
    }
    // Create onboarding link
    const stripe = getStripe();
    const accountLink = await stripe.accountLinks.create({
        account: stripeAccountId,
        type: "account_onboarding",
        return_url: returnUrl || "garagescholars://payment-setup?status=complete",
        refresh_url: refreshUrl || "garagescholars://payment-setup?status=refresh",
    });
    return { url: accountLink.url, stripeAccountId };
});
// ═══════════════════════════════════════════════════════════════
// 5. HTTP: Stripe webhook endpoint
// ═══════════════════════════════════════════════════════════════
exports.gsStripeWebhook = (0, https_1.onRequest)({ cors: false, timeoutSeconds: 60, secrets: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"] }, async (req, res) => {
    if (req.method !== "POST") {
        res.status(405).send("Method Not Allowed");
        return;
    }
    const stripe = getStripe();
    const sig = req.headers["stripe-signature"];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!sig || !webhookSecret) {
        res.status(400).send("Missing signature or webhook secret");
        return;
    }
    let event;
    try {
        event = stripe.webhooks.constructEvent(req.rawBody, sig, webhookSecret);
    }
    catch (err) {
        console.error("Webhook signature verification failed:", err);
        res.status(400).send(`Webhook Error: ${err.message}`);
        return;
    }
    console.log(`Stripe webhook: ${event.type}`);
    switch (event.type) {
        case "transfer.created": {
            const transfer = event.data.object;
            const transferId = transfer.id;
            // Find payout by stripeTransferId and mark as processing
            const payoutSnap = await db
                .collection(gs_constants_1.GS_COLLECTIONS.PAYOUTS)
                .where("stripeTransferId", "==", transferId)
                .limit(1)
                .get();
            if (!payoutSnap.empty) {
                await payoutSnap.docs[0].ref.update({
                    status: "processing",
                });
                console.log(`Payout ${payoutSnap.docs[0].id} marked as processing`);
            }
            break;
        }
        case "transfer.updated": {
            const transfer = event.data.object;
            const payoutSnap = await db
                .collection(gs_constants_1.GS_COLLECTIONS.PAYOUTS)
                .where("stripeTransferId", "==", transfer.id)
                .limit(1)
                .get();
            if (!payoutSnap.empty) {
                if (transfer.reversed || transfer.amount_reversed > 0) {
                    await payoutSnap.docs[0].ref.update({
                        status: "failed",
                        notes: `Transfer reversed or failed`,
                    });
                    const payoutData = payoutSnap.docs[0].data();
                    await notifyAdmins("⚠️ Stripe Transfer Failed", `<p>Transfer to <strong>${payoutData.recipientName}</strong> failed/reversed.</p>
               <p>Amount: $${payoutData.amount}</p>
               <p>Please pay manually.</p>`);
                }
                else {
                    await payoutSnap.docs[0].ref.update({
                        status: "paid",
                        paidAt: firestore_1.FieldValue.serverTimestamp(),
                    });
                    console.log(`Payout ${payoutSnap.docs[0].id} marked as paid`);
                }
            }
            break;
        }
        case "account.updated": {
            const account = event.data.object;
            const stripeAccountId = account.id;
            const accSnap = await db
                .collection(gs_constants_1.GS_COLLECTIONS.STRIPE_ACCOUNTS)
                .where("stripeAccountId", "==", stripeAccountId)
                .limit(1)
                .get();
            if (!accSnap.empty) {
                const onboardingComplete = account.details_submitted === true;
                const payoutsEnabled = account.payouts_enabled === true;
                const bankAccounts = account.external_accounts?.data || [];
                const bankLast4 = bankAccounts.length > 0 ? bankAccounts[0].last4 : null;
                await accSnap.docs[0].ref.update({
                    onboardingComplete,
                    payoutsEnabled,
                    ...(bankLast4 ? { bankLast4 } : {}),
                    taxIdProvided: account.individual?.id_number_provided || false,
                    updatedAt: firestore_1.FieldValue.serverTimestamp(),
                });
                // Update scholar profile
                const accData = accSnap.docs[0].data();
                if (accData.accountType === "scholar") {
                    await db.collection(gs_constants_1.GS_COLLECTIONS.SCHOLAR_PROFILES).doc(accData.userId).update({
                        stripeOnboardingComplete: onboardingComplete,
                        bankLinked: payoutsEnabled,
                    });
                }
                console.log(`Stripe account ${stripeAccountId} updated: onboarding=${onboardingComplete}, payouts=${payoutsEnabled}`);
            }
            break;
        }
        case "payment_intent.succeeded": {
            const pi = event.data.object;
            // Update customer payment record
            const cpSnap = await db
                .collection(gs_constants_1.GS_COLLECTIONS.CUSTOMER_PAYMENTS)
                .where("stripePaymentIntentId", "==", pi.id)
                .limit(1)
                .get();
            if (!cpSnap.empty) {
                await cpSnap.docs[0].ref.update({
                    status: "succeeded",
                    paidAt: firestore_1.FieldValue.serverTimestamp(),
                });
            }
            break;
        }
        case "invoice.paid": {
            const invoice = event.data.object;
            const invoiceSplitType = invoice.metadata?.splitType;
            const invoiceJobId = invoice.metadata?.jobId;
            // ── Handle split payment invoices (deposit or balance) ──
            if (invoiceJobId && (invoiceSplitType === "deposit_50" || invoiceSplitType === "balance_50" || invoiceSplitType === "full")) {
                // Update the gs_customerPayments record
                const cpSnap = await db
                    .collection(gs_constants_1.GS_COLLECTIONS.CUSTOMER_PAYMENTS)
                    .where("stripeInvoiceId", "==", invoice.id)
                    .limit(1)
                    .get();
                if (!cpSnap.empty) {
                    await cpSnap.docs[0].ref.update({
                        status: "succeeded",
                        paidAt: firestore_1.FieldValue.serverTimestamp(),
                    });
                }
                // Update the job's payment status
                const jobRef = db.collection(gs_constants_1.GS_COLLECTIONS.JOBS).doc(invoiceJobId);
                const jobSnap = await jobRef.get();
                if (jobSnap.exists) {
                    const job = jobSnap.data();
                    if (invoiceSplitType === "deposit_50") {
                        await jobRef.update({
                            clientPaymentStatus: "deposit_paid",
                            depositPaidAt: firestore_1.FieldValue.serverTimestamp(),
                            updatedAt: firestore_1.FieldValue.serverTimestamp(),
                        });
                        console.log(`[webhook] Deposit paid for job ${invoiceJobId}`);
                        // Notify admin
                        await notifyAdmins(`Deposit Received: ${job.clientName} — $${(invoice.amount_paid / 100).toFixed(2)}`, `<p><strong>${job.clientName}</strong> paid the 50% deposit ($${(invoice.amount_paid / 100).toFixed(2)}).</p>
                 <p>The balance invoice will be auto-sent when the job is marked as completed.</p>`);
                    }
                    else if (invoiceSplitType === "balance_50") {
                        await jobRef.update({
                            clientPaymentStatus: "fully_paid",
                            balancePaidAt: firestore_1.FieldValue.serverTimestamp(),
                            updatedAt: firestore_1.FieldValue.serverTimestamp(),
                        });
                        console.log(`[webhook] Balance paid for job ${invoiceJobId} — FULLY PAID`);
                        await notifyAdmins(`FULLY PAID: ${job.clientName} — $${(job.clientPrice || 0).toFixed(2)}`, `<p><strong>${job.clientName}</strong> paid the balance. Job is now fully paid.</p>
                 <p><strong>Total collected:</strong> $${(job.clientPrice || 0).toFixed(2)}</p>`);
                    }
                    else if (invoiceSplitType === "full") {
                        await jobRef.update({
                            clientPaymentStatus: "fully_paid",
                            depositPaidAt: firestore_1.FieldValue.serverTimestamp(),
                            balancePaidAt: firestore_1.FieldValue.serverTimestamp(),
                            updatedAt: firestore_1.FieldValue.serverTimestamp(),
                        });
                        console.log(`[webhook] Full payment received for job ${invoiceJobId}`);
                    }
                }
            }
            // ── Handle recurring subscription invoices ──
            if (invoice.subscription) {
                const cpSnap = await db
                    .collection(gs_constants_1.GS_COLLECTIONS.CUSTOMER_PAYMENTS)
                    .where("stripeSubscriptionId", "==", invoice.subscription)
                    .limit(1)
                    .get();
                if (!cpSnap.empty) {
                    await db.collection(gs_constants_1.GS_COLLECTIONS.CUSTOMER_PAYMENTS).add({
                        customerId: cpSnap.docs[0].data().customerId,
                        customerName: cpSnap.docs[0].data().customerName,
                        amount: invoice.amount_paid / 100,
                        type: "retention_monthly",
                        stripePaymentIntentId: invoice.payment_intent,
                        stripeSubscriptionId: invoice.subscription,
                        paymentMethod: "ach",
                        convenienceFee: 0,
                        totalCharged: invoice.amount_paid / 100,
                        status: "succeeded",
                        description: `Monthly retention - ${new Date(invoice.period_start * 1000).toLocaleDateString()}`,
                        createdAt: firestore_1.FieldValue.serverTimestamp(),
                        paidAt: firestore_1.FieldValue.serverTimestamp(),
                    });
                }
            }
            break;
        }
        case "charge.refunded": {
            const charge = event.data.object;
            const piId = charge.payment_intent;
            if (piId) {
                const cpSnap = await db
                    .collection(gs_constants_1.GS_COLLECTIONS.CUSTOMER_PAYMENTS)
                    .where("stripePaymentIntentId", "==", piId)
                    .limit(1)
                    .get();
                if (!cpSnap.empty) {
                    const refundedFull = charge.refunded === true;
                    await cpSnap.docs[0].ref.update({
                        status: refundedFull ? "refunded" : "partially_refunded",
                        refundedAmount: charge.amount_refunded / 100,
                        refundedAt: firestore_1.FieldValue.serverTimestamp(),
                    });
                    const cpData = cpSnap.docs[0].data();
                    await notifyAdmins("💰 Payment Refunded", `<p>${refundedFull ? "Full" : "Partial"} refund processed for <strong>${cpData.customerName}</strong>.</p>
               <p>Refunded: $${(charge.amount_refunded / 100).toFixed(2)}</p>`);
                }
            }
            break;
        }
        case "charge.dispute.created": {
            const dispute = event.data.object;
            const piId = dispute.payment_intent;
            if (piId) {
                const cpSnap = await db
                    .collection(gs_constants_1.GS_COLLECTIONS.CUSTOMER_PAYMENTS)
                    .where("stripePaymentIntentId", "==", piId)
                    .limit(1)
                    .get();
                if (!cpSnap.empty) {
                    await cpSnap.docs[0].ref.update({
                        status: "disputed",
                        disputeReason: dispute.reason || "unknown",
                        disputedAt: firestore_1.FieldValue.serverTimestamp(),
                    });
                }
            }
            await notifyAdmins("🚨 CHARGEBACK ALERT", `<p>A customer has filed a dispute/chargeback.</p>
           <p>Amount: $${(dispute.amount / 100).toFixed(2)}</p>
           <p>Reason: ${dispute.reason || "Not specified"}</p>
           <p><strong>Action required:</strong> Respond in Stripe Dashboard within the deadline.</p>`);
            break;
        }
        case "payment_intent.payment_failed": {
            const pi = event.data.object;
            const cpSnap = await db
                .collection(gs_constants_1.GS_COLLECTIONS.CUSTOMER_PAYMENTS)
                .where("stripePaymentIntentId", "==", pi.id)
                .limit(1)
                .get();
            if (!cpSnap.empty) {
                const failMessage = pi.last_payment_error?.message || "Payment failed";
                await cpSnap.docs[0].ref.update({
                    status: "failed",
                    notes: failMessage,
                });
                const cpData = cpSnap.docs[0].data();
                await notifyAdmins("⚠️ Customer Payment Failed", `<p>Payment from <strong>${cpData.customerName}</strong> failed.</p>
             <p>Amount: $${cpData.amount}</p>
             <p>Reason: ${failMessage}</p>`);
            }
            break;
        }
    }
    res.status(200).json({ received: true });
});
// ═══════════════════════════════════════════════════════════════
// 6. CALLABLE: Create customer payment (ACH preferred, card fallback)
// ═══════════════════════════════════════════════════════════════
exports.gsCreateCustomerPayment = (0, https_1.onCall)({ cors: true, timeoutSeconds: 30, secrets: ["STRIPE_SECRET_KEY"] }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "Authentication required.");
    }
    // Verify admin
    const profileSnap = await db.collection(gs_constants_1.GS_COLLECTIONS.PROFILES).doc(request.auth.uid).get();
    if (!profileSnap.exists || profileSnap.data()?.role !== "admin") {
        throw new https_1.HttpsError("permission-denied", "Admin role required.");
    }
    const { customerId, customerName, customerEmail, amount, type, description, jobId, paymentMethodType, } = request.data;
    if (!customerId || !customerName || !amount || !type) {
        throw new https_1.HttpsError("invalid-argument", "customerId, customerName, amount, and type are required.");
    }
    const stripe = getStripe();
    const preferredMethod = paymentMethodType || "ach";
    // Calculate convenience fee for card payments
    const convenienceFee = preferredMethod === "card"
        ? Math.round(amount * (gs_constants_1.CONVENIENCE_FEE_PERCENT / 100) * 100) / 100
        : 0;
    const totalCharged = Math.round((amount + convenienceFee) * 100) / 100;
    // Create or find Stripe Customer
    let stripeCustomer;
    const existingCustomers = await stripe.customers.list({ email: customerEmail, limit: 1 });
    if (existingCustomers.data.length > 0) {
        stripeCustomer = existingCustomers.data[0];
    }
    else {
        stripeCustomer = await stripe.customers.create({
            email: customerEmail,
            name: customerName,
            metadata: { customerId, platform: "garage_scholars" },
        });
    }
    // Create PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(totalCharged * 100), // cents
        currency: "usd",
        customer: stripeCustomer.id,
        payment_method_types: preferredMethod === "ach"
            ? ["us_bank_account"]
            : ["card"],
        description: description || `${type} payment - ${customerName}`,
        metadata: { customerId, jobId: jobId || "", type, platform: "garage_scholars" },
        ...(preferredMethod === "ach" ? {
            payment_method_options: {
                us_bank_account: {
                    financial_connections: { permissions: ["payment_method"] },
                },
            },
        } : {}),
    });
    // Record in Firestore
    await db.collection(gs_constants_1.GS_COLLECTIONS.CUSTOMER_PAYMENTS).add({
        customerId,
        customerName,
        jobId: jobId || null,
        amount,
        type,
        stripePaymentIntentId: paymentIntent.id,
        paymentMethod: preferredMethod,
        convenienceFee,
        totalCharged,
        status: "pending",
        description: description || `${type} payment`,
        createdAt: firestore_1.FieldValue.serverTimestamp(),
    });
    return {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        convenienceFee,
        totalCharged,
    };
});
// ═══════════════════════════════════════════════════════════════
// 7. CALLABLE: Create recurring retention subscription
// ═══════════════════════════════════════════════════════════════
exports.gsCreateRetentionSubscription = (0, https_1.onCall)({ cors: true, timeoutSeconds: 30, secrets: ["STRIPE_SECRET_KEY"] }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "Authentication required.");
    }
    const profileSnap = await db.collection(gs_constants_1.GS_COLLECTIONS.PROFILES).doc(request.auth.uid).get();
    if (!profileSnap.exists || profileSnap.data()?.role !== "admin") {
        throw new https_1.HttpsError("permission-denied", "Admin role required.");
    }
    const { customerId, customerName, customerEmail, packageKey, monthlyAmount, description } = request.data;
    if (!customerId || !customerName || !customerEmail) {
        throw new https_1.HttpsError("invalid-argument", "customerId, customerName, and customerEmail are required.");
    }
    if (!packageKey && !monthlyAmount) {
        throw new https_1.HttpsError("invalid-argument", "Either packageKey or monthlyAmount is required.");
    }
    // Resolve package details
    let resolvedPriceId = null;
    let resolvedAmount;
    let resolvedDescription;
    if (packageKey) {
        const pkg = gs_constants_1.GS_PACKAGES[packageKey];
        if (!pkg || pkg.type !== "recurring") {
            throw new https_1.HttpsError("invalid-argument", `${packageKey} is not a valid membership package.`);
        }
        resolvedPriceId = gs_constants_1.STRIPE_PRICE_IDS[packageKey] || null;
        resolvedAmount = pkg.price;
        resolvedDescription = description || `${pkg.name} — $${pkg.price}/mo`;
    }
    else {
        resolvedAmount = monthlyAmount;
        resolvedDescription = description || `Monthly retention - $${monthlyAmount}/mo`;
    }
    const stripe = getStripe();
    // Find or create Stripe Customer
    let stripeCustomer;
    const existingCustomers = await stripe.customers.list({ email: customerEmail, limit: 1 });
    if (existingCustomers.data.length > 0) {
        stripeCustomer = existingCustomers.data[0];
    }
    else {
        stripeCustomer = await stripe.customers.create({
            email: customerEmail,
            name: customerName,
            metadata: { customerId, platform: "garage_scholars" },
        });
    }
    // Use pre-created Stripe price or create a custom one
    let priceId;
    if (resolvedPriceId) {
        priceId = resolvedPriceId;
    }
    else {
        const price = await stripe.prices.create({
            unit_amount: Math.round(resolvedAmount * 100),
            currency: "usd",
            recurring: { interval: "month" },
            product_data: {
                name: resolvedDescription,
                metadata: { customerId, platform: "garage_scholars" },
            },
        });
        priceId = price.id;
    }
    // Create subscription
    const subscription = await stripe.subscriptions.create({
        customer: stripeCustomer.id,
        items: [{ price: priceId }],
        payment_behavior: "default_incomplete",
        payment_settings: {
            payment_method_types: ["us_bank_account", "card"],
            save_default_payment_method: "on_subscription",
        },
        expand: ["latest_invoice.payment_intent"],
        metadata: { customerId, packageKey: packageKey || "custom", type: "retention_monthly", platform: "garage_scholars" },
    });
    // Record in Firestore
    await db.collection(gs_constants_1.GS_COLLECTIONS.CUSTOMER_PAYMENTS).add({
        customerId,
        customerName,
        customerEmail,
        amount: resolvedAmount,
        type: "retention_monthly",
        packageKey: packageKey || null,
        stripeSubscriptionId: subscription.id,
        paymentMethod: "ach",
        convenienceFee: 0,
        totalCharged: resolvedAmount,
        status: "pending",
        description: resolvedDescription,
        createdAt: firestore_1.FieldValue.serverTimestamp(),
    });
    const invoice = subscription.latest_invoice;
    const paymentIntent = invoice?.payment_intent;
    return {
        subscriptionId: subscription.id,
        clientSecret: paymentIntent?.client_secret || null,
        status: subscription.status,
        packageKey: packageKey || null,
        amount: resolvedAmount,
    };
});
// ═══════════════════════════════════════════════════════════════
// 8. CALLABLE: Resale payout to customer
// ═══════════════════════════════════════════════════════════════
exports.gsResalePayout = (0, https_1.onCall)({ cors: true, timeoutSeconds: 30, secrets: ["STRIPE_SECRET_KEY", "MERCURY_API_KEY"] }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "Authentication required.");
    }
    const profileSnap = await db.collection(gs_constants_1.GS_COLLECTIONS.PROFILES).doc(request.auth.uid).get();
    if (!profileSnap.exists || profileSnap.data()?.role !== "admin") {
        throw new https_1.HttpsError("permission-denied", "Admin role required.");
    }
    const { customerId, customerName, customerEmail, amount, description, jobId } = request.data;
    if (!customerId || !amount) {
        throw new https_1.HttpsError("invalid-argument", "customerId and amount are required.");
    }
    const payoutRef = db.collection(gs_constants_1.GS_COLLECTIONS.PAYOUTS).doc();
    const payoutData = {
        jobId: jobId || null,
        customerId,
        customerEmail: customerEmail || null,
        recipientName: customerName || "Customer",
        amount,
        splitType: "resale",
        status: "pending",
        paymentMethod: "none",
        complaintWindowPassed: true,
        taxYear: new Date().getFullYear(),
        notes: description || "Resale payout",
        createdAt: firestore_1.FieldValue.serverTimestamp(),
    };
    // ── Auto-resolve payment method from stored customer info ──
    // 1) Try Stripe transfer — check if customer has a linked Stripe account
    let stripeAccount = null;
    if (customerEmail) {
        const stripeSnap = await db
            .collection(gs_constants_1.GS_COLLECTIONS.STRIPE_ACCOUNTS)
            .where("email", "==", customerEmail)
            .where("accountType", "==", "resale_customer")
            .limit(1)
            .get();
        if (!stripeSnap.empty) {
            stripeAccount = stripeSnap.docs[0].data();
        }
    }
    if (stripeAccount?.onboardingComplete && stripeAccount?.payoutsEnabled && stripeAccount?.stripeAccountId) {
        // Stripe Connect transfer — fully automated
        try {
            const stripe = getStripe();
            const transfer = await stripe.transfers.create({
                amount: Math.round(amount * 100),
                currency: "usd",
                destination: stripeAccount.stripeAccountId,
                description: description || `Resale payout to ${customerName}`,
                metadata: {
                    payoutId: payoutRef.id,
                    customerId,
                    platform: "garage_scholars",
                },
            });
            payoutData.status = "processing";
            payoutData.paymentMethod = "stripe_transfer";
            payoutData.stripeTransferId = transfer.id;
        }
        catch (err) {
            console.error("Stripe transfer failed for resale payout, falling back:", err);
            // Fall through to next method
        }
    }
    // 2) Try Zelle/Venmo — check stored fallback handle
    if (payoutData.paymentMethod === "none" && stripeAccount?.fallbackMethod && stripeAccount?.fallbackHandle) {
        const method = stripeAccount.fallbackMethod;
        payoutData.paymentMethod = method;
        payoutData.fallbackHandle = stripeAccount.fallbackHandle;
        payoutData.status = "awaiting_send";
        payoutData.notes += ` | Send via ${method}: ${stripeAccount.fallbackHandle}`;
    }
    // 3) Try Mercury ACH as last automated option
    if (payoutData.paymentMethod === "none") {
        const mercury = await getMercuryConfig();
        if (mercury) {
            // Check if we have bank details stored on the stripe account doc
            const bankRouting = stripeAccount?.bankRouting;
            const bankAccount = stripeAccount?.bankAccount;
            if (bankRouting && bankAccount) {
                const result = await (0, gs_mercury_1.sendMercuryPayout)(mercury.apiKey, mercury.accountId, { name: customerName, routingNumber: bankRouting, accountNumber: bankAccount, accountType: stripeAccount?.bankAccountType || "checking" }, amount, description || `Resale payout to ${customerName}`);
                payoutData.status = result.status;
                payoutData.paymentMethod = result.method;
                if (result.transferId)
                    payoutData.mercuryTransferId = result.transferId;
                if (result.error)
                    payoutData.notes += ` | ${result.error}`;
            }
        }
    }
    // 4) No payment method found — manual intervention needed
    if (payoutData.paymentMethod === "none") {
        payoutData.paymentMethod = "manual";
        payoutData.status = "pending";
    }
    await payoutRef.set(payoutData);
    // Email the resale customer
    if (customerEmail) {
        let paymentMethodLabel;
        switch (payoutData.paymentMethod) {
            case "stripe_transfer":
                paymentMethodLabel = "Direct bank transfer via Stripe (arrives in 1-2 business days)";
                break;
            case "zelle":
                paymentMethodLabel = `Zelle to ${stripeAccount?.fallbackHandle || "your account on file"}`;
                break;
            case "venmo":
                paymentMethodLabel = `Venmo to ${stripeAccount?.fallbackHandle || "your account on file"}`;
                break;
            case "mercury_ach":
                paymentMethodLabel = "ACH bank transfer (arrives in 1-2 business days)";
                break;
            default:
                paymentMethodLabel = "We'll be in touch shortly with payment details";
        }
        await db.collection("mail").add({
            to: [customerEmail],
            message: {
                subject: `Your Garage Scholars Resale Payout — $${amount.toFixed(2)}`,
                html: `
            <div style="font-family: sans-serif; max-width: 520px; margin: auto;">
              <h2 style="color: #1a2e1a;">Your item sold!</h2>
              <p>Hi ${customerName},</p>
              <p>Great news — your consignment item has sold and your payout is on the way.</p>
              <table style="width:100%; border-collapse:collapse; margin: 20px 0;">
                <tr><td style="padding:8px; color:#555;">Payout Amount</td><td style="padding:8px; font-weight:bold;">$${amount.toFixed(2)}</td></tr>
                <tr style="background:#f9f9f9;"><td style="padding:8px; color:#555;">Payment Method</td><td style="padding:8px;">${paymentMethodLabel}</td></tr>
                ${description ? `<tr><td style="padding:8px; color:#555;">Notes</td><td style="padding:8px;">${description}</td></tr>` : ""}
              </table>
              <p>Questions? Reply to this email or contact us at <a href="mailto:admin@garagescholars.com">admin@garagescholars.com</a>.</p>
              <p style="color:#888; font-size:0.85rem;">Garage Scholars &middot; Denver Metro Area</p>
            </div>
          `,
            },
            createdAt: firestore_1.FieldValue.serverTimestamp(),
        });
    }
    // Notify admins based on status
    if (payoutData.status === "awaiting_send") {
        // Zelle/Venmo — admin just needs to send it via the app
        await notifyAdmins(`Resale Payout: $${amount.toFixed(2)} to ${customerName} via ${payoutData.paymentMethod}`, `<p>Resale payout to <strong>${customerName}</strong>: <strong>$${amount.toFixed(2)}</strong></p>
         <p><strong>Send via ${payoutData.paymentMethod}:</strong> ${payoutData.fallbackHandle}</p>
         <p>Once sent, mark as paid in the app.</p>`);
    }
    else if (payoutData.status === "pending" && payoutData.paymentMethod === "manual") {
        // No payment info on file at all
        await notifyAdmins(`Resale Payout Needs Attention: $${amount.toFixed(2)} to ${customerName}`, `<p>Resale payout to <strong>${customerName}</strong>: <strong>$${amount.toFixed(2)}</strong></p>
         <p>${description || "No description"}</p>
         <p><strong>No payment method on file.</strong> Send them a bank link or get their Zelle/Venmo info.</p>
         ${customerEmail ? `<p>Customer email: ${customerEmail}</p>` : ""}`);
    }
    return { payoutId: payoutRef.id, status: payoutData.status, paymentMethod: payoutData.paymentMethod };
});
// ═══════════════════════════════════════════════════════════════
// 8b. CALLABLE: Save resale customer's Zelle/Venmo handle
//     Called by admin when customer replies with their info.
// ═══════════════════════════════════════════════════════════════
exports.gsSaveResalePaymentInfo = (0, https_1.onCall)({ cors: true, timeoutSeconds: 10 }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "Authentication required.");
    }
    const profileSnap = await db.collection(gs_constants_1.GS_COLLECTIONS.PROFILES).doc(request.auth.uid).get();
    if (!profileSnap.exists || profileSnap.data()?.role !== "admin") {
        throw new https_1.HttpsError("permission-denied", "Admin role required.");
    }
    const { customerEmail, fallbackMethod, fallbackHandle } = request.data;
    if (!customerEmail || !fallbackMethod || !fallbackHandle) {
        throw new https_1.HttpsError("invalid-argument", "customerEmail, fallbackMethod, and fallbackHandle are required.");
    }
    // Find existing stripe account doc by email
    const existingSnap = await db
        .collection(gs_constants_1.GS_COLLECTIONS.STRIPE_ACCOUNTS)
        .where("email", "==", customerEmail)
        .where("accountType", "==", "resale_customer")
        .limit(1)
        .get();
    if (!existingSnap.empty) {
        // Update existing doc
        await existingSnap.docs[0].ref.update({
            fallbackMethod,
            fallbackHandle,
            fallbackUpdatedAt: firestore_1.FieldValue.serverTimestamp(),
        });
    }
    else {
        // Create a new doc (customer never got a Stripe link, just gave Zelle/Venmo)
        await db.collection(gs_constants_1.GS_COLLECTIONS.STRIPE_ACCOUNTS).add({
            accountType: "resale_customer",
            email: customerEmail,
            customerName: customerEmail, // admin can update later
            fallbackMethod,
            fallbackHandle,
            onboardingComplete: false,
            payoutsEnabled: false,
            createdAt: firestore_1.FieldValue.serverTimestamp(),
            fallbackUpdatedAt: firestore_1.FieldValue.serverTimestamp(),
        });
    }
    return { success: true };
});
// ═══════════════════════════════════════════════════════════════
// 8b2. CALLABLE: Admin saves resale customer's bank info for ACH
// ═══════════════════════════════════════════════════════════════
exports.gsSaveResaleBankInfo = (0, https_1.onCall)({ cors: true, timeoutSeconds: 10 }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "Authentication required.");
    }
    const profileSnap = await db.collection(gs_constants_1.GS_COLLECTIONS.PROFILES).doc(request.auth.uid).get();
    if (!profileSnap.exists || profileSnap.data()?.role !== "admin") {
        throw new https_1.HttpsError("permission-denied", "Admin role required.");
    }
    const { customerEmail, customerName, routingNumber, accountNumber, accountType } = request.data;
    if (!customerEmail || !customerName || !routingNumber || !accountNumber) {
        throw new https_1.HttpsError("invalid-argument", "customerEmail, customerName, routingNumber, and accountNumber are required.");
    }
    if (!/^\d{9}$/.test(routingNumber)) {
        throw new https_1.HttpsError("invalid-argument", "Routing number must be exactly 9 digits.");
    }
    const accountLast4 = accountNumber.slice(-4);
    // Find existing doc by email
    const existingSnap = await db
        .collection(gs_constants_1.GS_COLLECTIONS.STRIPE_ACCOUNTS)
        .where("email", "==", customerEmail)
        .where("accountType", "==", "resale_customer")
        .limit(1)
        .get();
    const bankData = {
        accountType: "resale_customer",
        email: customerEmail,
        customerName,
        bankRouting: routingNumber,
        bankAccount: accountNumber,
        bankAccountType: accountType || "checking",
        accountHolderName: customerName,
        bankLast4: accountLast4,
        payoutsEnabled: true,
        onboardingComplete: true,
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
    };
    if (!existingSnap.empty) {
        await existingSnap.docs[0].ref.update(bankData);
    }
    else {
        await db.collection(gs_constants_1.GS_COLLECTIONS.STRIPE_ACCOUNTS).add({
            ...bankData,
            createdAt: firestore_1.FieldValue.serverTimestamp(),
        });
    }
    return { success: true, bankLast4: accountLast4 };
});
// ═══════════════════════════════════════════════════════════════
// 8c. CALLABLE: Scholar saves their bank info for direct deposit
//     Stores routing + last4 of account. Full account number only
//     used at payout time via Mercury ACH.
// ═══════════════════════════════════════════════════════════════
exports.gsSaveScholarBankInfo = (0, https_1.onCall)({ cors: true, timeoutSeconds: 10 }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "Authentication required.");
    }
    const userId = request.auth.uid;
    const { routingNumber, accountNumber, accountType, accountHolderName } = request.data;
    if (!routingNumber || !accountNumber || !accountType || !accountHolderName) {
        throw new https_1.HttpsError("invalid-argument", "routingNumber, accountNumber, accountType, and accountHolderName are required.");
    }
    // Basic validation
    if (!/^\d{9}$/.test(routingNumber)) {
        throw new https_1.HttpsError("invalid-argument", "Routing number must be exactly 9 digits.");
    }
    if (!/^\d{4,17}$/.test(accountNumber)) {
        throw new https_1.HttpsError("invalid-argument", "Account number must be 4-17 digits.");
    }
    const accountLast4 = accountNumber.slice(-4);
    // Check for existing bank info doc
    const existingSnap = await db
        .collection(gs_constants_1.GS_COLLECTIONS.STRIPE_ACCOUNTS)
        .where("userId", "==", userId)
        .where("accountType", "==", "scholar")
        .limit(1)
        .get();
    const bankData = {
        userId,
        accountType: "scholar",
        bankRouting: routingNumber,
        bankAccount: accountNumber,
        bankAccountType: accountType,
        accountHolderName,
        bankLast4: accountLast4,
        payoutsEnabled: true,
        onboardingComplete: true,
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
    };
    if (!existingSnap.empty) {
        await existingSnap.docs[0].ref.update(bankData);
    }
    else {
        await db.collection(gs_constants_1.GS_COLLECTIONS.STRIPE_ACCOUNTS).add({
            ...bankData,
            createdAt: firestore_1.FieldValue.serverTimestamp(),
        });
    }
    // Update scholar profile
    await db.collection(gs_constants_1.GS_COLLECTIONS.SCHOLAR_PROFILES).doc(userId).set({
        bankLinked: true,
        bankLast4: accountLast4,
        bankAccountType: accountType,
    }, { merge: true });
    return { success: true, bankLast4: accountLast4 };
});
// ═══════════════════════════════════════════════════════════════
// 8d. CALLABLE: Admin files complaint on a job
//     Holds the 2nd 50% payout, reduces quality score, flags job.
// ═══════════════════════════════════════════════════════════════
exports.gsAdminComplaint = (0, https_1.onCall)({ cors: true, timeoutSeconds: 30 }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "Authentication required.");
    }
    const profileSnap = await db.collection(gs_constants_1.GS_COLLECTIONS.PROFILES).doc(request.auth.uid).get();
    if (!profileSnap.exists || profileSnap.data()?.role !== "admin") {
        throw new https_1.HttpsError("permission-denied", "Admin role required.");
    }
    const { jobId, description, scoreReduction } = request.data;
    if (!jobId || !description) {
        throw new https_1.HttpsError("invalid-argument", "jobId and description are required.");
    }
    const jobRef = db.collection(gs_constants_1.GS_COLLECTIONS.JOBS).doc(jobId);
    const jobSnap = await jobRef.get();
    if (!jobSnap.exists) {
        throw new https_1.HttpsError("not-found", "Job not found.");
    }
    const jobData = jobSnap.data();
    const reduction = Math.min(100, Math.max(0, scoreReduction ?? 50)) / 100;
    // Update quality score
    const scoreRef = db.collection(gs_constants_1.GS_COLLECTIONS.JOB_QUALITY_SCORES).doc(jobId);
    const scoreSnap = await scoreRef.get();
    if (scoreSnap.exists) {
        const scoreData = scoreSnap.data();
        await scoreRef.update({
            adminComplaint: true,
            adminComplaintDetails: description,
            adminComplaintBy: request.auth.uid,
            adminComplaintAt: firestore_1.FieldValue.serverTimestamp(),
            completionScore: Math.max(0, (scoreData.completionScore || 0) * (1 - reduction)),
        });
    }
    // Hold any pending completion payout
    try {
        await holdCompletionPayout(jobId);
    }
    catch (err) {
        console.error(`holdCompletionPayout failed for admin complaint on job ${jobId}:`, err);
    }
    // Update job status
    await jobRef.update({
        status: "DISPUTED",
        adminComplaint: true,
        adminComplaintDescription: description,
        adminComplaintAt: firestore_1.FieldValue.serverTimestamp(),
        adminComplaintBy: request.auth.uid,
    });
    // Notify the scholar
    const scholarId = jobData.claimedBy;
    if (scholarId) {
        const scholarProfile = await db.collection(gs_constants_1.GS_COLLECTIONS.PROFILES).doc(scholarId).get();
        const pushToken = scholarProfile.data()?.pushToken;
        if (pushToken) {
            await sendExpoPush([pushToken], "Job Issue Reported", `An issue was reported for "${jobData.title}". Your completion payout is on hold pending review.`, { screen: "my-jobs", jobId });
        }
    }
    return { success: true };
});
// ═══════════════════════════════════════════════════════════════
// 9. CALLABLE: Admin marks manual payout as paid
// ═══════════════════════════════════════════════════════════════
exports.gsMarkPayoutPaid = (0, https_1.onCall)({ cors: true, timeoutSeconds: 10 }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "Authentication required.");
    }
    const profileSnap = await db.collection(gs_constants_1.GS_COLLECTIONS.PROFILES).doc(request.auth.uid).get();
    if (!profileSnap.exists || profileSnap.data()?.role !== "admin") {
        throw new https_1.HttpsError("permission-denied", "Admin role required.");
    }
    const { payoutId, paymentMethod, notes } = request.data;
    if (!payoutId) {
        throw new https_1.HttpsError("invalid-argument", "payoutId is required.");
    }
    const payoutRef = db.collection(gs_constants_1.GS_COLLECTIONS.PAYOUTS).doc(payoutId);
    const payoutSnap = await payoutRef.get();
    if (!payoutSnap.exists) {
        throw new https_1.HttpsError("not-found", "Payout not found.");
    }
    await payoutRef.update({
        status: "paid",
        paidAt: firestore_1.FieldValue.serverTimestamp(),
        ...(paymentMethod ? { paymentMethod } : {}),
        ...(notes ? { notes } : {}),
    });
    return { ok: true };
});
// ═══════════════════════════════════════════════════════════════
// 10. SCHEDULED: Biweekly CPA report (1st and 16th at 8am)
// ═══════════════════════════════════════════════════════════════
exports.gsGeneratePaymentReport = (0, scheduler_1.onSchedule)("0 8 1,16 * *", async () => {
    console.log("Generating biweekly CPA payment report...");
    const now = new Date();
    const day = now.getDate();
    const month = now.getMonth();
    const year = now.getFullYear();
    // Determine period
    let startDate;
    let endDate;
    if (day <= 15) {
        // Report for previous period: 16th to end of previous month
        const prevMonth = month === 0 ? 11 : month - 1;
        const prevYear = month === 0 ? year - 1 : year;
        startDate = new Date(prevYear, prevMonth, 16);
        endDate = new Date(year, month, 0, 23, 59, 59); // last day of prev month
    }
    else {
        // Report for 1st to 15th of current month
        startDate = new Date(year, month, 1);
        endDate = new Date(year, month, 15, 23, 59, 59);
    }
    const startTs = firestore_1.Timestamp.fromDate(startDate);
    const endTs = firestore_1.Timestamp.fromDate(endDate);
    // Get all paid payouts in this period
    const payoutsSnap = await db
        .collection(gs_constants_1.GS_COLLECTIONS.PAYOUTS)
        .where("status", "==", "paid")
        .where("paidAt", ">=", startTs)
        .where("paidAt", "<=", endTs)
        .get();
    // Get pending payouts (not yet paid — show CPA what's outstanding)
    const pendingSnap = await db
        .collection(gs_constants_1.GS_COLLECTIONS.PAYOUTS)
        .where("status", "in", ["pending", "processing"])
        .where("createdAt", ">=", startTs)
        .where("createdAt", "<=", endTs)
        .get();
    const scholarMap = {};
    const resaleMap = {};
    const methodTotals = {};
    let scholarTotal = 0;
    let resaleTotal = 0;
    for (const doc of payoutsSnap.docs) {
        const data = doc.data();
        const isResale = data.splitType === "resale";
        const id = data.scholarId || data.customerId || "unknown";
        const map = isResale ? resaleMap : scholarMap;
        if (!map[id]) {
            map[id] = { name: data.recipientName || id, total: 0, jobCount: 0, method: data.paymentMethod || "unknown" };
        }
        map[id].total += data.amount || 0;
        map[id].jobCount += 1;
        const method = data.paymentMethod || "unknown";
        methodTotals[method] = (methodTotals[method] || 0) + (data.amount || 0);
        if (isResale)
            resaleTotal += data.amount || 0;
        else
            scholarTotal += data.amount || 0;
    }
    const totalAmount = scholarTotal + resaleTotal;
    const scholarBreakdowns = Object.entries(scholarMap).map(([scholarId, data]) => ({
        scholarId,
        scholarName: data.name,
        jobCount: data.jobCount,
        totalPaid: Math.round(data.total * 100) / 100,
        paymentMethod: data.method,
    }));
    const resaleBreakdowns = Object.entries(resaleMap).map(([customerId, data]) => ({
        customerId,
        customerName: data.name,
        payoutCount: data.jobCount,
        totalPaid: Math.round(data.total * 100) / 100,
        paymentMethod: data.method,
    }));
    // Create period doc
    const periodId = `${year}-${String(month + 1).padStart(2, "0")}-${day <= 15 ? "A" : "B"}`;
    await db.collection(gs_constants_1.GS_COLLECTIONS.PAYMENT_PERIODS).doc(periodId).set({
        periodType: "biweekly",
        startDate: startDate.toISOString().split("T")[0],
        endDate: endDate.toISOString().split("T")[0],
        totalPayouts: payoutsSnap.size,
        totalAmount: Math.round(totalAmount * 100) / 100,
        scholarTotal: Math.round(scholarTotal * 100) / 100,
        resaleTotal: Math.round(resaleTotal * 100) / 100,
        scholarBreakdowns,
        resaleBreakdowns,
        methodTotals,
        status: "closed",
        createdAt: firestore_1.FieldValue.serverTimestamp(),
    });
    // Get CPA config
    const configSnap = await db.collection(gs_constants_1.GS_COLLECTIONS.PLATFORM_CONFIG).doc("payments").get();
    const config = configSnap.data();
    const cpaEmail = config?.cpaEmail;
    const autoEmail = config?.cpaAutoEmailEnabled !== false;
    if (cpaEmail && autoEmail) {
        const fmt = (n) => `$${n.toFixed(2)}`;
        const periodLabel = `${startDate.toLocaleDateString("en-US")} – ${endDate.toLocaleDateString("en-US")}`;
        // Scholar rows
        const scholarRows = scholarBreakdowns
            .sort((a, b) => b.totalPaid - a.totalPaid)
            .map((s) => `<tr><td>${s.scholarName}</td><td>${s.jobCount}</td><td>${s.paymentMethod}</td><td><strong>${fmt(s.totalPaid)}</strong></td></tr>`)
            .join("");
        // Resale rows
        const resaleRows = resaleBreakdowns
            .sort((a, b) => b.totalPaid - a.totalPaid)
            .map((r) => `<tr><td>${r.customerName}</td><td>${r.payoutCount}</td><td>${r.paymentMethod}</td><td><strong>${fmt(r.totalPaid)}</strong></td></tr>`)
            .join("");
        // Pending rows
        const pendingRows = pendingSnap.docs
            .map((d) => d.data())
            .map((p) => `<tr><td>${p.recipientName || "—"}</td><td>${p.splitType || "—"}</td><td>${fmt(p.amount || 0)}</td><td style="color:#e65c00;">${p.status}</td></tr>`)
            .join("");
        // Method breakdown
        const methodRows = Object.entries(methodTotals)
            .map(([m, t]) => `<tr><td>${m}</td><td>${fmt(t)}</td></tr>`)
            .join("");
        // CSV — scholar payouts
        const scholarCsv = [
            "TYPE,Recipient,Count,Method,Total Paid,Period Start,Period End",
            ...scholarBreakdowns.map((s) => `"scholar","${s.scholarName}",${s.jobCount},"${s.paymentMethod}",${s.totalPaid},"${startDate.toISOString().split("T")[0]}","${endDate.toISOString().split("T")[0]}"`),
            ...resaleBreakdowns.map((r) => `"resale","${r.customerName}",${r.payoutCount},"${r.paymentMethod}",${r.totalPaid},"${startDate.toISOString().split("T")[0]}","${endDate.toISOString().split("T")[0]}"`),
            `"TOTAL","",${payoutsSnap.size},"",${totalAmount.toFixed(2)},"",""`
        ].join("\n");
        const tableStyle = `border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse; width:100%; margin-bottom:24px;"`;
        const thStyle = `style="background:#1a2e1a; color:#fff; text-align:left;"`;
        const reportHtml = `
      <div style="font-family: sans-serif; max-width: 700px; margin: auto; color: #1a2e1a;">
        <h2 style="border-bottom: 2px solid #1a2e1a; padding-bottom: 8px;">Garage Scholars — Biweekly Payment Report</h2>
        <p><strong>Period:</strong> ${periodLabel}</p>

        <table ${tableStyle}>
          <tr><td style="padding:8px;"><strong>Total Paid Out</strong></td><td><strong>${fmt(totalAmount)}</strong></td></tr>
          <tr style="background:#f5f5f5;"><td style="padding:8px;">Scholar Payouts</td><td>${fmt(scholarTotal)}</td></tr>
          <tr><td style="padding:8px;">Resale Customer Payouts</td><td>${fmt(resaleTotal)}</td></tr>
          <tr style="background:#f5f5f5;"><td style="padding:8px;">Pending (not yet paid)</td><td style="color:#e65c00;">${fmt(pendingSnap.docs.reduce((s, d) => s + (d.data().amount || 0), 0))}</td></tr>
        </table>

        <h3>Scholar Payouts (1099 Workers)</h3>
        ${scholarBreakdowns.length > 0 ? `
        <table ${tableStyle}>
          <thead><tr ${thStyle}><th style="padding:8px;">Scholar</th><th style="padding:8px;">Payouts</th><th style="padding:8px;">Method</th><th style="padding:8px;">Total</th></tr></thead>
          <tbody>${scholarRows}</tbody>
          <tfoot><tr><td colspan="3"><strong>TOTAL</strong></td><td><strong>${fmt(scholarTotal)}</strong></td></tr></tfoot>
        </table>` : "<p><em>No scholar payouts this period.</em></p>"}

        <h3>Resale Customer Payouts</h3>
        ${resaleBreakdowns.length > 0 ? `
        <table ${tableStyle}>
          <thead><tr ${thStyle}><th style="padding:8px;">Customer</th><th style="padding:8px;">Payouts</th><th style="padding:8px;">Method</th><th style="padding:8px;">Total</th></tr></thead>
          <tbody>${resaleRows}</tbody>
          <tfoot><tr><td colspan="3"><strong>TOTAL</strong></td><td><strong>${fmt(resaleTotal)}</strong></td></tr></tfoot>
        </table>` : "<p><em>No resale payouts this period.</em></p>"}

        ${pendingSnap.size > 0 ? `
        <h3 style="color:#e65c00;">⏳ Pending Payouts (Outstanding)</h3>
        <table ${tableStyle}>
          <thead><tr ${thStyle}><th style="padding:8px;">Recipient</th><th style="padding:8px;">Type</th><th style="padding:8px;">Amount</th><th style="padding:8px;">Status</th></tr></thead>
          <tbody>${pendingRows}</tbody>
        </table>` : ""}

        <h3>Payment Method Breakdown</h3>
        <table ${tableStyle}>
          <thead><tr ${thStyle}><th style="padding:8px;">Method</th><th style="padding:8px;">Total</th></tr></thead>
          <tbody>${methodRows}</tbody>
        </table>

        <h3>Raw CSV Data</h3>
        <pre style="background:#f5f5f5; padding:12px; font-size:0.8rem; overflow:auto;">${scholarCsv}</pre>

        <p style="color:#888; font-size:0.85rem; border-top:1px solid #ddd; padding-top:12px;">
          All workers are 1099 independent contractors. This report covers paid payouts only.
          Generated automatically by Garage Scholars on ${new Date().toLocaleDateString("en-US")}.
        </p>
      </div>
    `;
        await db.collection("mail").add({
            to: [cpaEmail],
            cc: ["garagescholars@gmail.com"],
            message: {
                subject: `📊 GS Payment Report: ${periodLabel} — ${fmt(totalAmount)} paid out`,
                html: reportHtml,
            },
            createdAt: firestore_1.FieldValue.serverTimestamp(),
        });
        await db.collection(gs_constants_1.GS_COLLECTIONS.PAYMENT_PERIODS).doc(periodId).update({
            cpaReportSentAt: firestore_1.FieldValue.serverTimestamp(),
            status: "reported",
        });
        console.log(`CPA report emailed to ${cpaEmail}`);
    }
    console.log(`Payment period ${periodId}: ${payoutsSnap.size} payouts, $${totalAmount.toFixed(2)}`);
});
// ═══════════════════════════════════════════════════════════════
// 10b. SCHEDULED: Weekly Mercury replenishment report (every Monday 8am)
//      Sums all Mercury ACH payouts for the past week.
//      Emails admin: "Transfer $X from Chase → Mercury"
// ═══════════════════════════════════════════════════════════════
exports.gsWeeklyReplenishmentReport = (0, scheduler_1.onSchedule)("0 8 * * 1", async () => {
    console.log("Generating weekly Mercury replenishment report...");
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const startTs = firestore_1.Timestamp.fromDate(weekAgo);
    const endTs = firestore_1.Timestamp.fromDate(now);
    // Get all payouts sent via Mercury this week
    const mercuryPayouts = await db
        .collection(gs_constants_1.GS_COLLECTIONS.PAYOUTS)
        .where("paymentMethod", "==", "mercury_ach")
        .where("createdAt", ">=", startTs)
        .where("createdAt", "<=", endTs)
        .get();
    // Get all payouts sent via Zelle/Venmo (manually, but still from our accounts)
    const manualPayouts = await db
        .collection(gs_constants_1.GS_COLLECTIONS.PAYOUTS)
        .where("status", "==", "paid")
        .where("paidAt", ">=", startTs)
        .where("paidAt", "<=", endTs)
        .get();
    let mercuryTotal = 0;
    let zelleVenmoTotal = 0;
    const mercuryLines = [];
    const manualLines = [];
    for (const doc of mercuryPayouts.docs) {
        const d = doc.data();
        mercuryTotal += d.amount || 0;
        mercuryLines.push({
            name: d.recipientName || "Unknown",
            amount: d.amount || 0,
            type: d.splitType || "unknown",
            date: d.createdAt?.toDate?.()?.toLocaleDateString("en-US") || "",
        });
    }
    for (const doc of manualPayouts.docs) {
        const d = doc.data();
        const method = d.paymentMethod || "";
        if (method === "zelle" || method === "venmo" || method.startsWith("manual_")) {
            zelleVenmoTotal += d.amount || 0;
            manualLines.push({
                name: d.recipientName || "Unknown",
                amount: d.amount || 0,
                method,
                date: d.paidAt?.toDate?.()?.toLocaleDateString("en-US") || "",
            });
        }
    }
    const totalOutflow = mercuryTotal + zelleVenmoTotal;
    const fmt = (n) => `$${n.toFixed(2)}`;
    const weekLabel = `${weekAgo.toLocaleDateString("en-US")} – ${now.toLocaleDateString("en-US")}`;
    // Mercury line items table
    const mercuryRows = mercuryLines
        .sort((a, b) => b.amount - a.amount)
        .map((l) => `<tr><td>${l.name}</td><td>${l.type}</td><td>${l.date}</td><td><strong>${fmt(l.amount)}</strong></td></tr>`)
        .join("");
    const manualRows = manualLines
        .sort((a, b) => b.amount - a.amount)
        .map((l) => `<tr><td>${l.name}</td><td>${l.method}</td><td>${l.date}</td><td><strong>${fmt(l.amount)}</strong></td></tr>`)
        .join("");
    const thStyle = `style="background:#1a2e1a; color:#fff; text-align:left; padding:8px;"`;
    const tdStyle = `style="padding:8px; border-bottom:1px solid #eee;"`;
    const reportHtml = `
    <div style="font-family: sans-serif; max-width: 640px; margin: auto;">
      <h2 style="color: #1a2e1a;">Weekly Replenishment Report</h2>
      <p style="color:#555;">${weekLabel}</p>

      <div style="background:#f0fdf4; border:2px solid #10b981; border-radius:12px; padding:20px; margin:20px 0; text-align:center;">
        <p style="margin:0; color:#555; font-size:14px;">Transfer from Chase to Mercury</p>
        <p style="margin:8px 0 0; font-size:32px; font-weight:800; color:#1a2e1a;">${fmt(mercuryTotal)}</p>
        <p style="margin:4px 0 0; color:#888; font-size:12px;">To replenish Mercury for ACH payouts this week</p>
      </div>

      <h3 style="color:#1a2e1a;">Summary</h3>
      <table style="width:100%; border-collapse:collapse; margin-bottom:24px;">
        <tr><td ${tdStyle}>Mercury ACH Payouts</td><td ${tdStyle}><strong>${fmt(mercuryTotal)}</strong> (${mercuryPayouts.size} payouts)</td></tr>
        <tr><td ${tdStyle}>Zelle/Venmo Payouts</td><td ${tdStyle}><strong>${fmt(zelleVenmoTotal)}</strong> (${manualLines.length} payouts)</td></tr>
        <tr style="background:#f8f9fa;"><td ${tdStyle}><strong>Total Outflow</strong></td><td ${tdStyle}><strong>${fmt(totalOutflow)}</strong></td></tr>
      </table>

      ${mercuryLines.length > 0 ? `
        <h3 style="color:#1a2e1a;">Mercury ACH Detail</h3>
        <table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse; width:100%; margin-bottom:24px;">
          <tr><th ${thStyle}>Recipient</th><th ${thStyle}>Type</th><th ${thStyle}>Date</th><th ${thStyle}>Amount</th></tr>
          ${mercuryRows}
        </table>
      ` : ""}

      ${manualLines.length > 0 ? `
        <h3 style="color:#1a2e1a;">Zelle/Venmo Detail</h3>
        <table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse; width:100%; margin-bottom:24px;">
          <tr><th ${thStyle}>Recipient</th><th ${thStyle}>Method</th><th ${thStyle}>Date</th><th ${thStyle}>Amount</th></tr>
          ${manualRows}
        </table>
      ` : ""}

      <p style="color:#888; font-size:0.85rem;">Garage Scholars Payment System &middot; Auto-generated weekly report</p>
    </div>
  `;
    // Email admins who have weeklyReport enabled
    const adminEmails = await getAdminEmails("weeklyReport");
    const emailTo = adminEmails.length > 0 ? adminEmails : ["garagescholars@gmail.com"];
    await db.collection("mail").add({
        to: emailTo,
        message: {
            subject: `Weekly Replenishment: Transfer ${fmt(mercuryTotal)} to Mercury (${weekLabel})`,
            html: reportHtml,
        },
        createdAt: firestore_1.FieldValue.serverTimestamp(),
    });
    // Push notify admins
    const adminTokens = await getAdminTokens("weeklyReport");
    if (adminTokens.length > 0) {
        await sendExpoPush(adminTokens, "Mercury Replenishment Needed", `Transfer ${fmt(mercuryTotal)} from Chase to Mercury to cover last week's payouts.`, { screen: "admin-payouts" });
    }
    // Save replenishment request in Firestore for admin approval flow
    await db.collection(gs_constants_1.GS_COLLECTIONS.PLATFORM_CONFIG).doc("mercuryReplenishment").set({
        amount: mercuryTotal,
        weekLabel,
        status: "pending_approval",
        mercuryPayoutCount: mercuryPayouts.size,
        manualPayoutCount: manualLines.length,
        totalOutflow,
        createdAt: firestore_1.FieldValue.serverTimestamp(),
        approvedBy: null,
        approvedAt: null,
        transferId: null,
    });
    // CPA does NOT get the replenishment report — only the biweekly payout summary
    console.log(`Weekly replenishment report: Mercury=${fmt(mercuryTotal)}, Manual=${fmt(zelleVenmoTotal)}, Total=${fmt(totalOutflow)}`);
});
// ═══════════════════════════════════════════════════════════════
// 10c. CALLABLE: Admin approves Mercury funding (pull from Chase)
// ═══════════════════════════════════════════════════════════════
exports.gsFundMercuryFromChase = (0, https_1.onCall)({ cors: true, timeoutSeconds: 60 }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "Authentication required.");
    }
    const profileSnap = await db.collection(gs_constants_1.GS_COLLECTIONS.PROFILES).doc(request.auth.uid).get();
    if (!profileSnap.exists || profileSnap.data()?.role !== "admin") {
        throw new https_1.HttpsError("permission-denied", "Admin role required.");
    }
    const { amount } = request.data;
    if (!amount || amount <= 0) {
        throw new https_1.HttpsError("invalid-argument", "Amount must be greater than 0.");
    }
    // Get Mercury config
    const mercuryConfig = await getMercuryConfig();
    if (!mercuryConfig) {
        throw new https_1.HttpsError("failed-precondition", "Mercury is not configured. Set MERCURY_API_KEY and mercuryAccountId.");
    }
    // Get linked Chase account ID from platform config
    const configSnap = await db.collection(gs_constants_1.GS_COLLECTIONS.PLATFORM_CONFIG).doc("payments").get();
    const linkedChaseAccountId = configSnap.data()?.mercuryLinkedChaseAccountId;
    if (!linkedChaseAccountId) {
        throw new https_1.HttpsError("failed-precondition", "Chase account not linked in Mercury. Add mercuryLinkedChaseAccountId to gs_platformConfig/payments.");
    }
    // Call Mercury API to pull funds from Chase
    try {
        const response = await fetch(`https://api.mercury.com/api/v1/account/${mercuryConfig.accountId}/transactions`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${mercuryConfig.apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                amount,
                paymentMethod: "ach",
                externalAccountId: linkedChaseAccountId,
                direction: "debit", // Pull FROM Chase INTO Mercury
                note: `Weekly replenishment from Chase - ${new Date().toLocaleDateString("en-US")}`,
            }),
        });
        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Mercury API error ${response.status}: ${errText}`);
        }
        const data = await response.json();
        // Record the transfer
        await db.collection("gs_mercuryTransfers").add({
            transferId: data.id || null,
            amount,
            direction: "chase_to_mercury",
            status: "processing",
            approvedBy: request.auth.uid,
            approvedByName: profileSnap.data()?.fullName || "Admin",
            approvedAt: firestore_1.FieldValue.serverTimestamp(),
            createdAt: firestore_1.FieldValue.serverTimestamp(),
        });
        // Update the pending replenishment doc
        await db.collection(gs_constants_1.GS_COLLECTIONS.PLATFORM_CONFIG).doc("mercuryReplenishment").update({
            status: "approved",
            approvedBy: request.auth.uid,
            approvedAt: firestore_1.FieldValue.serverTimestamp(),
            transferId: data.id || null,
        });
        // Push notify all admins
        const adminTokens = await getAdminTokens("mercuryAlerts");
        if (adminTokens.length > 0) {
            const adminName = profileSnap.data()?.fullName || "Admin";
            await sendExpoPush(adminTokens, "Mercury Funded", `${adminName} approved $${amount.toFixed(2)} transfer from Chase to Mercury.`, { screen: "admin-payouts" });
        }
        return { ok: true, transferId: data.id || null, status: "processing" };
    }
    catch (err) {
        console.error("Mercury funding failed:", err);
        throw new https_1.HttpsError("internal", err.message || "Failed to initiate Mercury funding.");
    }
});
// ═══════════════════════════════════════════════════════════════
// 10d. SCHEDULED: Biweekly CPA reconciliation report (1st and 16th)
// ═══════════════════════════════════════════════════════════════
exports.gsCpaReconciliationReport = (0, scheduler_1.onSchedule)("0 9 1,16 * *", async () => {
    console.log("Generating CPA reconciliation report...");
    const configSnap = await db.collection(gs_constants_1.GS_COLLECTIONS.PLATFORM_CONFIG).doc("payments").get();
    const cpaEmail = configSnap.data()?.cpaEmail;
    if (!cpaEmail) {
        console.log("No CPA email configured — skipping reconciliation report.");
        return;
    }
    // Determine the reporting period (last 2 weeks)
    const now = new Date();
    const periodEnd = now;
    const periodStart = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000);
    const startTs = firestore_1.Timestamp.fromDate(periodStart);
    const endTs = firestore_1.Timestamp.fromDate(periodEnd);
    const fmt = (n) => `$${n.toFixed(2)}`;
    const periodLabel = `${periodStart.toLocaleDateString("en-US")} – ${now.toLocaleDateString("en-US")}`;
    // 1. Get all payouts (money OUT via Mercury ACH)
    const payoutsSnap = await db
        .collection(gs_constants_1.GS_COLLECTIONS.PAYOUTS)
        .where("createdAt", ">=", startTs)
        .where("createdAt", "<=", endTs)
        .get();
    let totalPayouts = 0;
    const payoutRows = [];
    for (const d of payoutsSnap.docs) {
        const p = d.data();
        totalPayouts += p.amount || 0;
        payoutRows.push(`<tr><td style="padding:6px 8px;border-bottom:1px solid #eee;">${p.recipientName || "Unknown"}</td>` +
            `<td style="padding:6px 8px;border-bottom:1px solid #eee;">${p.splitType || p.payoutType || "—"}</td>` +
            `<td style="padding:6px 8px;border-bottom:1px solid #eee;">${p.paymentMethod || "—"}</td>` +
            `<td style="padding:6px 8px;border-bottom:1px solid #eee;">${p.createdAt?.toDate?.()?.toLocaleDateString("en-US") || "—"}</td>` +
            `<td style="padding:6px 8px;border-bottom:1px solid #eee;font-weight:700;">${fmt(p.amount || 0)}</td></tr>`);
    }
    // 2. Get all Stripe payments (money IN from customers)
    const paymentsSnap = await db
        .collection(gs_constants_1.GS_COLLECTIONS.CUSTOMER_PAYMENTS)
        .where("createdAt", ">=", startTs)
        .where("createdAt", "<=", endTs)
        .get();
    let totalStripeIn = 0;
    const stripeRows = [];
    for (const d of paymentsSnap.docs) {
        const p = d.data();
        totalStripeIn += p.amount || 0;
        stripeRows.push(`<tr><td style="padding:6px 8px;border-bottom:1px solid #eee;">${p.customerName || p.customerEmail || "Unknown"}</td>` +
            `<td style="padding:6px 8px;border-bottom:1px solid #eee;">${p.description || p.packageType || "—"}</td>` +
            `<td style="padding:6px 8px;border-bottom:1px solid #eee;">${p.paymentMethod || "stripe"}</td>` +
            `<td style="padding:6px 8px;border-bottom:1px solid #eee;">${p.createdAt?.toDate?.()?.toLocaleDateString("en-US") || "—"}</td>` +
            `<td style="padding:6px 8px;border-bottom:1px solid #eee;font-weight:700;">${fmt(p.amount || 0)}</td></tr>`);
    }
    // 3. Get Mercury transfer records (Chase → Mercury funding)
    const transfersSnap = await db
        .collection("gs_mercuryTransfers")
        .where("createdAt", ">=", startTs)
        .where("createdAt", "<=", endTs)
        .get();
    let totalTransfers = 0;
    const transferRows = [];
    for (const d of transfersSnap.docs) {
        const t = d.data();
        totalTransfers += t.amount || 0;
        transferRows.push(`<tr><td style="padding:6px 8px;border-bottom:1px solid #eee;">Chase → Mercury</td>` +
            `<td style="padding:6px 8px;border-bottom:1px solid #eee;">${t.approvedByName || "Admin"}</td>` +
            `<td style="padding:6px 8px;border-bottom:1px solid #eee;">${t.createdAt?.toDate?.()?.toLocaleDateString("en-US") || "—"}</td>` +
            `<td style="padding:6px 8px;border-bottom:1px solid #eee;font-weight:700;">${fmt(t.amount || 0)}</td></tr>`);
    }
    const thStyle = `style="background:#1a2e1a;color:#fff;text-align:left;padding:8px;"`;
    const reportHtml = `
    <div style="font-family:sans-serif;max-width:700px;margin:auto;">
      <h2 style="color:#1a2e1a;">Garage Scholars — CPA Reconciliation Report</h2>
      <p style="color:#555;">Period: <strong>${periodLabel}</strong></p>

      <div style="background:#f0f9ff;border:2px solid #3b82f6;border-radius:12px;padding:20px;margin:20px 0;">
        <p style="margin:0;color:#555;font-size:14px;">
          Please reconcile the transactions below against the <strong>Chase business checking account</strong> statement for this period.
          All outgoing payments are routed through Mercury ACH. All incoming payments are processed via Stripe and deposited to Chase.
        </p>
      </div>

      <h3 style="color:#1a2e1a;">Summary</h3>
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
        <tr><td style="padding:8px;border-bottom:1px solid #eee;">Stripe Deposits (Money In)</td>
            <td style="padding:8px;border-bottom:1px solid #eee;font-weight:700;color:#10b981;">+${fmt(totalStripeIn)}</td></tr>
        <tr><td style="padding:8px;border-bottom:1px solid #eee;">Mercury ACH Payouts (Money Out)</td>
            <td style="padding:8px;border-bottom:1px solid #eee;font-weight:700;color:#ef4444;">-${fmt(totalPayouts)}</td></tr>
        <tr><td style="padding:8px;border-bottom:1px solid #eee;">Chase → Mercury Transfers</td>
            <td style="padding:8px;border-bottom:1px solid #eee;font-weight:700;">${fmt(totalTransfers)}</td></tr>
        <tr style="background:#f8f9fa;">
            <td style="padding:8px;font-weight:700;">Net (In - Out)</td>
            <td style="padding:8px;font-weight:700;">${fmt(totalStripeIn - totalPayouts)}</td></tr>
      </table>

      ${stripeRows.length > 0 ? `
        <h3 style="color:#1a2e1a;">Stripe Payments (Money In → Chase)</h3>
        <p style="color:#888;font-size:12px;">These should appear as Stripe deposits on the Chase statement.</p>
        <table border="1" cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;margin-bottom:24px;font-size:13px;">
          <tr><th ${thStyle}>Customer</th><th ${thStyle}>Description</th><th ${thStyle}>Method</th><th ${thStyle}>Date</th><th ${thStyle}>Amount</th></tr>
          ${stripeRows.join("")}
        </table>
      ` : "<p><em>No Stripe payments this period.</em></p>"}

      ${payoutRows.length > 0 ? `
        <h3 style="color:#1a2e1a;">Payouts (Money Out via Mercury ACH)</h3>
        <p style="color:#888;font-size:12px;">These are funded from Mercury. Chase statement will show the bulk Chase → Mercury transfers below.</p>
        <table border="1" cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;margin-bottom:24px;font-size:13px;">
          <tr><th ${thStyle}>Recipient</th><th ${thStyle}>Type</th><th ${thStyle}>Method</th><th ${thStyle}>Date</th><th ${thStyle}>Amount</th></tr>
          ${payoutRows.join("")}
        </table>
      ` : "<p><em>No payouts this period.</em></p>"}

      ${transferRows.length > 0 ? `
        <h3 style="color:#1a2e1a;">Chase → Mercury Transfers</h3>
        <p style="color:#888;font-size:12px;">These should appear as ACH debits on the Chase statement to Mercury.</p>
        <table border="1" cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;margin-bottom:24px;font-size:13px;">
          <tr><th ${thStyle}>Transfer</th><th ${thStyle}>Approved By</th><th ${thStyle}>Date</th><th ${thStyle}>Amount</th></tr>
          ${transferRows.join("")}
        </table>
      ` : "<p><em>No Chase → Mercury transfers this period.</em></p>"}

      <div style="background:#fffbeb;border:1px solid #f59e0b40;border-radius:8px;padding:14px;margin:20px 0;">
        <p style="margin:0;color:#92400e;font-size:13px;">
          <strong>Reconciliation Notes:</strong> The individual Mercury ACH payouts will NOT appear on the Chase statement.
          Only the bulk Chase → Mercury transfers will show. Match the transfer totals against the payout detail above.
          Stripe deposits may appear 1-2 business days after the transaction date.
        </p>
      </div>

      <p style="color:#888;font-size:0.85rem;">Garage Scholars Payment System &middot; Auto-generated biweekly CPA report</p>
    </div>
  `;
    await db.collection("mail").add({
        to: [cpaEmail],
        message: {
            subject: `GS Reconciliation Report: ${periodLabel} — ${fmt(totalStripeIn)} in, ${fmt(totalPayouts)} out`,
            html: reportHtml,
        },
        createdAt: firestore_1.FieldValue.serverTimestamp(),
    });
    console.log(`CPA report sent: Stripe in=${fmt(totalStripeIn)}, Payouts out=${fmt(totalPayouts)}, Transfers=${fmt(totalTransfers)}`);
});
// ═══════════════════════════════════════════════════════════════
// 11. CALLABLE: On-demand payment data export
// ═══════════════════════════════════════════════════════════════
exports.gsExportPaymentData = (0, https_1.onCall)({ cors: true, timeoutSeconds: 60 }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "Authentication required.");
    }
    const profileSnap = await db.collection(gs_constants_1.GS_COLLECTIONS.PROFILES).doc(request.auth.uid).get();
    if (!profileSnap.exists || profileSnap.data()?.role !== "admin") {
        throw new https_1.HttpsError("permission-denied", "Admin role required.");
    }
    const { startDate, endDate, format } = request.data;
    if (!startDate || !endDate) {
        throw new https_1.HttpsError("invalid-argument", "startDate and endDate are required (YYYY-MM-DD).");
    }
    const start = firestore_1.Timestamp.fromDate(new Date(startDate));
    const end = firestore_1.Timestamp.fromDate(new Date(endDate + "T23:59:59"));
    // Get payouts
    const payoutsSnap = await db
        .collection(gs_constants_1.GS_COLLECTIONS.PAYOUTS)
        .where("createdAt", ">=", start)
        .where("createdAt", "<=", end)
        .get();
    const payouts = payoutsSnap.docs.map((d) => {
        const data = d.data();
        return {
            id: d.id,
            jobId: data.jobId || "",
            recipientName: data.recipientName || "",
            scholarId: data.scholarId || "",
            customerId: data.customerId || "",
            amount: data.amount || 0,
            splitType: data.splitType || "",
            status: data.status || "",
            paymentMethod: data.paymentMethod || "",
            taxYear: data.taxYear || "",
            createdAt: data.createdAt?.toDate?.()?.toISOString() || "",
            paidAt: data.paidAt?.toDate?.()?.toISOString() || "",
        };
    });
    if (format === "csv" || !format) {
        const headers = "ID,Job ID,Recipient,Scholar ID,Customer ID,Amount,Split Type,Status,Payment Method,Tax Year,Created,Paid";
        const rows = payouts.map((p) => `"${p.id}","${p.jobId}","${p.recipientName}","${p.scholarId}","${p.customerId}",${p.amount},"${p.splitType}","${p.status}","${p.paymentMethod}",${p.taxYear},"${p.createdAt}","${p.paidAt}"`);
        return { csv: [headers, ...rows].join("\n"), count: payouts.length };
    }
    return { data: payouts, count: payouts.length };
});
// ═══════════════════════════════════════════════════════════════
// 12. CALLABLE: Create & send Stripe invoice to customer via email
// ═══════════════════════════════════════════════════════════════
// ── Shared helper: find or create Stripe customer ──
async function findOrCreateStripeCustomer(stripe, customerEmail, customerName) {
    const existing = await stripe.customers.list({ email: customerEmail, limit: 1 });
    if (existing.data.length > 0) {
        const c = existing.data[0];
        if (c.name !== customerName) {
            return stripe.customers.update(c.id, { name: customerName });
        }
        return c;
    }
    return stripe.customers.create({
        email: customerEmail,
        name: customerName,
        metadata: { platform: "garage_scholars" },
    });
}
// ── Shared helper: create, finalize, and send a Stripe invoice ──
async function createAndSendStripeInvoice(stripe, opts) {
    const invoice = await stripe.invoices.create({
        customer: opts.customerId,
        collection_method: "send_invoice",
        days_until_due: opts.daysUntilDue ?? 3,
        description: opts.invoiceDescription,
        metadata: {
            jobId: opts.jobId,
            splitType: opts.splitType,
            packageTier: opts.packageTier,
            platform: "garage_scholars",
        },
    });
    await stripe.invoiceItems.create({
        customer: opts.customerId,
        invoice: invoice.id,
        amount: opts.amountCents,
        currency: "usd",
        description: opts.lineDescription,
    });
    const finalized = await stripe.invoices.finalizeInvoice(invoice.id);
    await stripe.invoices.sendInvoice(invoice.id);
    return { invoice, finalized };
}
exports.gsCreateInvoice = (0, https_1.onCall)({ cors: true, timeoutSeconds: 30, secrets: ["STRIPE_SECRET_KEY"] }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "Authentication required.");
    }
    const profileSnap = await db.collection(gs_constants_1.GS_COLLECTIONS.PROFILES).doc(request.auth.uid).get();
    if (!profileSnap.exists || profileSnap.data()?.role !== "admin") {
        throw new https_1.HttpsError("permission-denied", "Admin role required.");
    }
    const { customerName, customerEmail, packageKey, amount, description, jobId, packageTier, splitType = "deposit_50", } = request.data;
    if (!customerName || !customerEmail || !amount) {
        throw new https_1.HttpsError("invalid-argument", "customerName, customerEmail, and amount are required.");
    }
    if (!jobId) {
        throw new https_1.HttpsError("invalid-argument", "jobId is required for invoice tracking.");
    }
    // Idempotency guard: prevent sending duplicate deposit invoices
    if (splitType === "deposit_50") {
        const jobSnap = await db.collection(gs_constants_1.GS_COLLECTIONS.JOBS).doc(jobId).get();
        if (jobSnap.exists && jobSnap.data()?.depositInvoiceId) {
            throw new https_1.HttpsError("already-exists", "A deposit invoice has already been sent for this job.");
        }
    }
    const stripe = getStripe();
    const stripeCustomer = await findOrCreateStripeCustomer(stripe, customerEmail, customerName);
    const isDeposit = splitType === "deposit_50";
    const invoiceAmount = isDeposit
        ? Math.round(amount * (gs_constants_1.CLIENT_DEPOSIT_PERCENT / 100) * 100) / 100
        : amount;
    const invoiceAmountCents = Math.round(invoiceAmount * 100);
    const label = isDeposit ? "Deposit (50%)" : "Full Payment";
    const desc = description || `${packageTier || "Service"} Package`;
    const { invoice, finalized } = await createAndSendStripeInvoice(stripe, {
        customerId: stripeCustomer.id,
        amountCents: invoiceAmountCents,
        lineDescription: `${desc} — ${label}`,
        invoiceDescription: `Garage Scholars — ${desc} — ${label}`,
        jobId,
        splitType: isDeposit ? "deposit_50" : "full",
        packageTier: packageTier || "",
    });
    // Record in gs_customerPayments
    await db.collection(gs_constants_1.GS_COLLECTIONS.CUSTOMER_PAYMENTS).add({
        customerId: stripeCustomer.id,
        customerName,
        customerEmail,
        jobId,
        amount: invoiceAmount,
        fullJobAmount: amount,
        type: "invoice",
        splitType: isDeposit ? "deposit_50" : "full",
        stripeInvoiceId: invoice.id,
        stripePaymentIntentId: finalized.payment_intent || null,
        paymentMethod: "invoice",
        convenienceFee: 0,
        totalCharged: invoiceAmount,
        status: "pending",
        description: `${desc} — ${label}`,
        invoiceUrl: finalized.hosted_invoice_url || null,
        invoicePdf: finalized.invoice_pdf || null,
        createdAt: firestore_1.FieldValue.serverTimestamp(),
    });
    // Update job with invoice tracking fields
    const jobUpdate = {
        stripeCustomerId: stripeCustomer.id,
        clientPaymentType: isDeposit ? "split_50_50" : "full",
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
    };
    if (isDeposit) {
        jobUpdate.depositInvoiceId = invoice.id;
        jobUpdate.clientPaymentStatus = "pending_deposit";
    }
    else {
        jobUpdate.clientPaymentStatus = "pending_full";
    }
    await db.collection(gs_constants_1.GS_COLLECTIONS.JOBS).doc(jobId).update(jobUpdate);
    // Admin confirmation email
    await db.collection("mail").add({
        to: ["garagescholars@gmail.com"],
        message: {
            subject: `${label} Invoice Sent: ${customerName} — $${invoiceAmount.toFixed(2)}`,
            html: `<h2>${label} Invoice Sent</h2>
          <p><strong>Client:</strong> ${customerName}</p>
          <p><strong>Email:</strong> ${customerEmail}</p>
          <p><strong>Amount:</strong> $${invoiceAmount.toFixed(2)} (of $${amount.toFixed(2)} total)</p>
          <p><strong>Package:</strong> ${packageTier || "N/A"}</p>
          <p><strong>Stripe Invoice:</strong> ${invoice.id}</p>
          ${isDeposit ? "<p>The balance invoice ($" + (amount - invoiceAmount).toFixed(2) + ") will be auto-sent when the job is completed.</p>" : ""}`,
        },
        createdAt: firestore_1.FieldValue.serverTimestamp(),
    });
    console.log(`[gsCreateInvoice] ${label} invoice ${invoice.id} sent to ${customerEmail} for $${invoiceAmount} (job: ${jobId})`);
    return {
        invoiceId: invoice.id,
        invoiceUrl: finalized.hosted_invoice_url,
        invoicePdf: finalized.invoice_pdf,
        status: finalized.status,
        splitType: isDeposit ? "deposit_50" : "full",
        invoiceAmount,
    };
});
// ═══════════════════════════════════════════════════════════════
// 13. Balance Invoice — auto-sent when job reaches COMPLETED
// ═══════════════════════════════════════════════════════════════
exports.gsCreateBalanceInvoice = (0, https_1.onCall)({ cors: true, timeoutSeconds: 30, secrets: ["STRIPE_SECRET_KEY"] }, async (request) => {
    // Can be called by admin manually OR by internal trigger (server-to-server)
    const { jobId } = request.data;
    if (!jobId) {
        throw new https_1.HttpsError("invalid-argument", "jobId is required.");
    }
    const jobSnap = await db.collection(gs_constants_1.GS_COLLECTIONS.JOBS).doc(jobId).get();
    if (!jobSnap.exists) {
        throw new https_1.HttpsError("not-found", "Job not found.");
    }
    const job = jobSnap.data();
    // Guard: only send balance for split_50_50 jobs where deposit was paid
    if (job.clientPaymentType !== "split_50_50") {
        throw new https_1.HttpsError("failed-precondition", "Job is not a split payment job.");
    }
    if (job.clientPaymentStatus !== "deposit_paid") {
        throw new https_1.HttpsError("failed-precondition", `Cannot send balance invoice — current status is "${job.clientPaymentStatus}". Deposit must be paid first.`);
    }
    // Idempotency: don't send balance twice
    if (job.balanceInvoiceId) {
        console.log(`[gsCreateBalanceInvoice] Balance already sent for job ${jobId}: ${job.balanceInvoiceId}`);
        return { invoiceId: job.balanceInvoiceId, alreadySent: true };
    }
    const stripe = getStripe();
    // Use the Stripe customer already stored on the job
    const customerId = job.stripeCustomerId;
    if (!customerId) {
        throw new https_1.HttpsError("failed-precondition", "No Stripe customer ID on job. Was the deposit invoice sent?");
    }
    const fullAmount = job.clientPrice;
    const balanceAmount = Math.round(fullAmount * (gs_constants_1.CLIENT_BALANCE_PERCENT / 100) * 100) / 100;
    const balanceCents = Math.round(balanceAmount * 100);
    const desc = job.title || `${job.serviceType || "Service"} Package`;
    const { invoice, finalized } = await createAndSendStripeInvoice(stripe, {
        customerId,
        amountCents: balanceCents,
        lineDescription: `${desc} — Balance (50%)`,
        invoiceDescription: `Garage Scholars — ${desc} — Balance Due`,
        jobId,
        splitType: "balance_50",
        packageTier: job.package || "",
    });
    // Record payment
    await db.collection(gs_constants_1.GS_COLLECTIONS.CUSTOMER_PAYMENTS).add({
        customerId,
        customerName: job.clientName,
        customerEmail: job.clientEmail,
        jobId,
        amount: balanceAmount,
        fullJobAmount: fullAmount,
        type: "invoice",
        splitType: "balance_50",
        stripeInvoiceId: invoice.id,
        stripePaymentIntentId: finalized.payment_intent || null,
        paymentMethod: "invoice",
        convenienceFee: 0,
        totalCharged: balanceAmount,
        status: "pending",
        description: `${desc} — Balance (50%)`,
        invoiceUrl: finalized.hosted_invoice_url || null,
        invoicePdf: finalized.invoice_pdf || null,
        createdAt: firestore_1.FieldValue.serverTimestamp(),
    });
    // Update job
    await db.collection(gs_constants_1.GS_COLLECTIONS.JOBS).doc(jobId).update({
        balanceInvoiceId: invoice.id,
        clientPaymentStatus: "pending_balance",
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
    });
    // Notify admins
    await db.collection("mail").add({
        to: ["garagescholars@gmail.com"],
        message: {
            subject: `Balance Invoice Sent: ${job.clientName} — $${balanceAmount.toFixed(2)}`,
            html: `<h2>Balance Invoice Auto-Sent</h2>
          <p><strong>Client:</strong> ${job.clientName}</p>
          <p><strong>Email:</strong> ${job.clientEmail}</p>
          <p><strong>Balance Due:</strong> $${balanceAmount.toFixed(2)}</p>
          <p><strong>Job:</strong> ${desc}</p>
          <p><strong>Stripe Invoice:</strong> ${invoice.id}</p>
          <p>This balance invoice was automatically sent because the job was marked as completed.</p>`,
        },
        createdAt: firestore_1.FieldValue.serverTimestamp(),
    });
    console.log(`[gsCreateBalanceInvoice] Balance invoice ${invoice.id} sent to ${job.clientEmail} for $${balanceAmount} (job: ${jobId})`);
    return {
        invoiceId: invoice.id,
        invoiceUrl: finalized.hosted_invoice_url,
        invoicePdf: finalized.invoice_pdf,
        status: finalized.status,
        balanceAmount,
    };
});
// ═══════════════════════════════════════════════════════════════
// 14. Safety Net — scheduled check for missed balance invoices
//     Runs every 6 hours. Catches any job that reached COMPLETED
//     with deposit_paid status but no balance invoice sent.
// ═══════════════════════════════════════════════════════════════
exports.gsCheckMissedBalanceInvoices = (0, scheduler_1.onSchedule)({ schedule: "every 6 hours", timeoutSeconds: 120, secrets: ["STRIPE_SECRET_KEY"] }, async () => {
    console.log("[gsCheckMissedBalanceInvoices] Running safety-net check...");
    // Find split_50_50 jobs where deposit is paid but no balance invoice sent
    const missedSnap = await db.collection(gs_constants_1.GS_COLLECTIONS.JOBS)
        .where("clientPaymentType", "==", "split_50_50")
        .where("clientPaymentStatus", "==", "deposit_paid")
        .get();
    let sent = 0;
    for (const doc of missedSnap.docs) {
        const job = doc.data();
        // Only send balance if job is actually completed (or past REVIEW_PENDING)
        const completedStatuses = ["COMPLETED", "REVIEW_PENDING"];
        if (!completedStatuses.includes(job.status))
            continue;
        // Skip if balance already sent (double-check)
        if (job.balanceInvoiceId)
            continue;
        try {
            const stripe = getStripe();
            const customerId = job.stripeCustomerId;
            if (!customerId) {
                console.warn(`[gsCheckMissedBalanceInvoices] Job ${doc.id} has no stripeCustomerId, skipping`);
                continue;
            }
            const fullAmount = job.clientPrice;
            const balanceAmount = Math.round(fullAmount * (gs_constants_1.CLIENT_BALANCE_PERCENT / 100) * 100) / 100;
            const balanceCents = Math.round(balanceAmount * 100);
            const desc = job.title || `${job.serviceType || "Service"} Package`;
            const { invoice, finalized } = await createAndSendStripeInvoice(stripe, {
                customerId,
                amountCents: balanceCents,
                lineDescription: `${desc} — Balance (50%)`,
                invoiceDescription: `Garage Scholars — ${desc} — Balance Due`,
                jobId: doc.id,
                splitType: "balance_50",
                packageTier: job.package || "",
            });
            await db.collection(gs_constants_1.GS_COLLECTIONS.CUSTOMER_PAYMENTS).add({
                customerId,
                customerName: job.clientName,
                customerEmail: job.clientEmail,
                jobId: doc.id,
                amount: balanceAmount,
                fullJobAmount: fullAmount,
                type: "invoice",
                splitType: "balance_50",
                stripeInvoiceId: invoice.id,
                stripePaymentIntentId: finalized.payment_intent || null,
                paymentMethod: "invoice",
                convenienceFee: 0,
                totalCharged: balanceAmount,
                status: "pending",
                description: `${desc} — Balance (50%)`,
                invoiceUrl: finalized.hosted_invoice_url || null,
                invoicePdf: finalized.invoice_pdf || null,
                createdAt: firestore_1.FieldValue.serverTimestamp(),
            });
            await doc.ref.update({
                balanceInvoiceId: invoice.id,
                clientPaymentStatus: "pending_balance",
                updatedAt: firestore_1.FieldValue.serverTimestamp(),
            });
            // ALERT admin that safety net caught a missed invoice
            await db.collection("mail").add({
                to: ["garagescholars@gmail.com"],
                message: {
                    subject: `[SAFETY NET] Missed Balance Invoice Sent: ${job.clientName}`,
                    html: `<h2>Safety Net: Balance Invoice Recovered</h2>
              <p>A balance invoice was missed during normal job completion flow and has been automatically sent by the safety-net scheduler.</p>
              <p><strong>Client:</strong> ${job.clientName} (${job.clientEmail})</p>
              <p><strong>Balance:</strong> $${balanceAmount.toFixed(2)}</p>
              <p><strong>Job:</strong> ${desc}</p>
              <p><strong>Invoice:</strong> ${invoice.id}</p>`,
                },
                createdAt: firestore_1.FieldValue.serverTimestamp(),
            });
            sent++;
            console.log(`[gsCheckMissedBalanceInvoices] RECOVERED: Sent balance invoice for job ${doc.id}`);
        }
        catch (err) {
            console.error(`[gsCheckMissedBalanceInvoices] Failed to send balance for job ${doc.id}:`, err);
            // Notify admin of failure so they can manually intervene
            await db.collection("mail").add({
                to: ["garagescholars@gmail.com"],
                message: {
                    subject: `[ALERT] Failed to Send Balance Invoice: ${job.clientName}`,
                    html: `<h2>Balance Invoice Send Failed</h2>
              <p>The safety-net scheduler failed to send a balance invoice. Please send it manually.</p>
              <p><strong>Client:</strong> ${job.clientName} (${job.clientEmail})</p>
              <p><strong>Job ID:</strong> ${doc.id}</p>
              <p><strong>Error:</strong> ${err.message}</p>`,
                },
                createdAt: firestore_1.FieldValue.serverTimestamp(),
            });
        }
    }
    console.log(`[gsCheckMissedBalanceInvoices] Done. Recovered ${sent} missed balance invoices.`);
});
// ═══════════════════════════════════════════════════════════════
// 15. CALLABLE: Email resale customer requesting bank info
// ═══════════════════════════════════════════════════════════════
exports.gsSendResalePaymentLink = (0, https_1.onCall)({ cors: true, timeoutSeconds: 30 }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "Authentication required.");
    }
    // Verify admin
    const profileSnap = await db.collection(gs_constants_1.GS_COLLECTIONS.PROFILES).doc(request.auth.uid).get();
    if (!profileSnap.exists || profileSnap.data()?.role !== "admin") {
        throw new https_1.HttpsError("permission-denied", "Admin role required.");
    }
    const { customerName, customerEmail, customMessage } = request.data;
    if (!customerName || !customerEmail) {
        throw new https_1.HttpsError("invalid-argument", "customerName and customerEmail are required.");
    }
    // Check for existing account record
    const existingSnap = await db
        .collection(gs_constants_1.GS_COLLECTIONS.STRIPE_ACCOUNTS)
        .where("email", "==", customerEmail)
        .where("accountType", "==", "resale_customer")
        .limit(1)
        .get();
    let accountDocId;
    let alreadyHasBankInfo = false;
    if (!existingSnap.empty) {
        accountDocId = existingSnap.docs[0].id;
        const existing = existingSnap.docs[0].data();
        alreadyHasBankInfo = !!existing.bankRouting || !!existing.fallbackMethod;
        await existingSnap.docs[0].ref.update({
            customerName,
            lastLinkSentAt: firestore_1.FieldValue.serverTimestamp(),
            lastLinkSentBy: request.auth.uid,
        });
    }
    else {
        const docRef = await db.collection(gs_constants_1.GS_COLLECTIONS.STRIPE_ACCOUNTS).add({
            accountType: "resale_customer",
            email: customerEmail,
            customerName,
            onboardingComplete: false,
            payoutsEnabled: false,
            lastLinkSentAt: firestore_1.FieldValue.serverTimestamp(),
            lastLinkSentBy: request.auth.uid,
            createdAt: firestore_1.FieldValue.serverTimestamp(),
        });
        accountDocId = docRef.id;
    }
    // Email the customer
    const customMsgHtml = customMessage
        ? `<p style="color:#555; margin-top:16px;">${customMessage}</p>`
        : "";
    await db.collection("mail").add({
        to: [customerEmail],
        message: {
            subject: "Garage Scholars — Set Up Your Payout Info",
            html: `
          <div style="font-family: sans-serif; max-width: 560px; margin: auto;">
            <h2 style="color: #1a2e1a;">Get Paid for Your Items</h2>
            <p>Hi ${customerName},</p>
            <p>We need your payment info so we can pay you when your consignment items sell.</p>
            ${customMsgHtml}

            <div style="background:#f8f9fa; border-radius:12px; padding:20px; margin:24px 0;">
              <p style="font-weight:700; color:#1a2e1a; margin-top:0;">Direct Deposit (ACH)</p>
              <p style="color:#555; margin-bottom:0;">Reply to this email with:</p>
              <ul style="color:#555;">
                <li>Name on bank account</li>
                <li>Routing number (9 digits)</li>
                <li>Account number</li>
                <li>Checking or Savings</li>
              </ul>
            </div>

            <p style="color:#888; font-size:0.9rem;">Once we have your info, all future payouts will be sent automatically when your items sell. You only need to do this once.</p>
            <p style="color:#888; font-size:0.85rem;">Questions? Reply to this email or contact us at <a href="mailto:admin@garagescholars.com">admin@garagescholars.com</a>.</p>
            <p style="color:#aaa; font-size:0.8rem;">Garage Scholars &middot; Denver Metro Area</p>
          </div>
        `,
        },
        createdAt: firestore_1.FieldValue.serverTimestamp(),
    });
    // Notify admins
    await notifyAdmins(`Payment info request sent to ${customerName}`, `<p>Payout info request emailed to <strong>${customerName}</strong> (${customerEmail}).</p>
       <p>When they reply with bank details, enter it in the Payouts page.</p>
       ${alreadyHasBankInfo ? "<p><em>Note: This customer already has payment info on file.</em></p>" : ""}`);
    return {
        success: true,
        alreadyHasBankInfo,
        accountDocId,
    };
});
