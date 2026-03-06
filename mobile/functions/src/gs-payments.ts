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

import { onSchedule } from "firebase-functions/v2/scheduler";
import { onCall, onRequest, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import {
  GS_COLLECTIONS,
  PAYMENT_RELEASE_HOURS,
  MINIMUM_SCORE_FOR_PAYMENT,
  CHECKIN_SPLIT_PERCENT,
  COMPLETION_SPLIT_PERCENT,
  CONVENIENCE_FEE_PERCENT,
  SCORE_LOCK_HOURS,
} from "./gs-constants";

const db = getFirestore();

// Lazy-load Stripe (only when needed, avoids cold start cost when not processing payments)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _stripe: any = null;
function getStripe(): any {
  if (!_stripe) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Stripe = require("stripe");
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY not configured");
    _stripe = new Stripe(key);
  }
  return _stripe;
}

// ── Helper: send admin notification via Firestore mail collection ──
async function notifyAdmins(subject: string, body: string) {
  await db.collection("mail").add({
    to: ["garagescholars@gmail.com"],
    message: { subject, html: body },
    createdAt: FieldValue.serverTimestamp(),
  });
}

// ── Helper: get admin push tokens (reuse from gs-functions pattern) ──
async function getAdminTokens(): Promise<string[]> {
  const snap = await db.collection(GS_COLLECTIONS.PROFILES).where("role", "==", "admin").get();
  return snap.docs.map((d) => d.data().pushToken as string).filter(Boolean);
}

async function sendExpoPush(pushTokens: string[], title: string, body: string, data?: Record<string, string>) {
  const messages = pushTokens
    .filter((t) => t && t.startsWith("ExponentPushToken"))
    .map((to) => ({ to, title, body, sound: "default" as const, data }));
  if (messages.length === 0) return;
  try {
    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(messages),
    });
  } catch (err) {
    console.error("Expo push failed:", err);
  }
}

// ═══════════════════════════════════════════════════════════════
// 1. HELPER: Create first-half payout on scholar check-in
//    Called from gsOnJobUpdated (UPCOMING → IN_PROGRESS)
// ═══════════════════════════════════════════════════════════════
export async function createCheckinPayout(jobId: string, jobData: FirebaseFirestore.DocumentData) {
  const scholarId = jobData.claimedBy;
  if (!scholarId) {
    console.warn(`createCheckinPayout: no claimedBy for job ${jobId}`);
    return;
  }

  // Idempotency: check if payout already exists for this job + split type
  const existingSnap = await db
    .collection(GS_COLLECTIONS.PAYOUTS)
    .where("jobId", "==", jobId)
    .where("splitType", "==", "checkin_50")
    .limit(1)
    .get();

  if (!existingSnap.empty) {
    console.log(`Checkin payout already exists for job ${jobId}, skipping.`);
    return;
  }

  const totalPayout = (jobData.payout || 0) + (jobData.rushBonus || 0);
  const firstHalf = Math.round((totalPayout * CHECKIN_SPLIT_PERCENT) / 100 * 100) / 100;

  // Check if scholar has Stripe Connect set up
  const stripeAccSnap = await db
    .collection(GS_COLLECTIONS.STRIPE_ACCOUNTS)
    .where("userId", "==", scholarId)
    .where("accountType", "==", "scholar")
    .where("payoutsEnabled", "==", true)
    .limit(1)
    .get();

  const hasStripe = !stripeAccSnap.empty;
  const stripeAccountId = hasStripe ? stripeAccSnap.docs[0].data().stripeAccountId : null;

  // Create payout doc
  const payoutRef = db.collection(GS_COLLECTIONS.PAYOUTS).doc();
  const payoutData: Record<string, any> = {
    jobId,
    scholarId,
    recipientName: jobData.claimedByName || "Scholar",
    amount: firstHalf,
    splitType: "checkin_50",
    status: hasStripe ? "processing" : "pending",
    paymentMethod: hasStripe ? "stripe_ach" : "manual_zelle",
    complaintWindowPassed: false,
    taxYear: new Date().getFullYear(),
    createdAt: FieldValue.serverTimestamp(),
  };

  // If Stripe is set up, initiate transfer
  if (hasStripe && stripeAccountId) {
    try {
      const stripe = getStripe();
      const transfer = await stripe.transfers.create({
        amount: Math.round(firstHalf * 100), // Stripe uses cents
        currency: "usd",
        destination: stripeAccountId,
        description: `Check-in payout: ${jobData.title || jobId}`,
        metadata: { jobId, scholarId, splitType: "checkin_50" },
      });
      payoutData.stripeTransferId = transfer.id;
      payoutData.status = "processing";
      console.log(`Stripe transfer created: ${transfer.id} for $${firstHalf}`);
    } catch (err) {
      console.error(`Stripe transfer failed for job ${jobId}:`, err);
      payoutData.status = "pending";
      payoutData.paymentMethod = "manual_zelle";
      payoutData.notes = `Stripe transfer failed: ${(err as Error).message}`;
    }
  }

  await payoutRef.set(payoutData);

  // Update job with first payout reference
  await db.collection(GS_COLLECTIONS.JOBS).doc(jobId).update({
    firstPayoutId: payoutRef.id,
    paymentStatus: "first_paid",
  });

  // Notify admins if manual payment needed
  if (!hasStripe) {
    const scholarName = jobData.claimedByName || "Unknown Scholar";
    await notifyAdmins(
      `💰 Manual Payment Required: $${firstHalf}`,
      `<p><strong>${scholarName}</strong> checked in for "<strong>${jobData.title || jobId}</strong>".</p>
       <p>First 50% payout: <strong>$${firstHalf}</strong></p>
       <p>Scholar does not have Stripe set up — please pay manually via Zelle/Venmo.</p>
       <p>Job ID: ${jobId}</p>`
    );

    const adminTokens = await getAdminTokens();
    if (adminTokens.length > 0) {
      await sendExpoPush(
        adminTokens,
        "Manual Payment Needed",
        `Pay ${scholarName} $${firstHalf} for check-in (${jobData.title})`,
        { screen: "admin-payments", jobId }
      );
    }
  }

  console.log(`Checkin payout created: ${payoutRef.id}, amount=$${firstHalf}, method=${payoutData.paymentMethod}`);
}

// ═══════════════════════════════════════════════════════════════
// 2. HELPER: Hold completion payout on complaint
//    Called from gsSubmitComplaint
// ═══════════════════════════════════════════════════════════════
export async function holdCompletionPayout(jobId: string) {
  const payoutsSnap = await db
    .collection(GS_COLLECTIONS.PAYOUTS)
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
  await db.collection(GS_COLLECTIONS.JOBS).doc(jobId).update({
    paymentStatus: "held",
  });
}

// ═══════════════════════════════════════════════════════════════
// 3. SCHEDULED: Release completion payouts after 72hr window
//    Runs every hour. Only queries jobs awaiting second payout
//    (paymentStatus == "first_paid") to avoid scanning all history.
// ═══════════════════════════════════════════════════════════════
export const gsReleaseCompletionPayouts = onSchedule(
  { schedule: "every 1 hours", timeoutSeconds: 300 },
  async () => {
    console.log("gsReleaseCompletionPayouts: checking for payouts to release...");

    const now = Timestamp.now();

    // Only query jobs that are awaiting second payout — bounded set
    const pendingJobs = await db
      .collection(GS_COLLECTIONS.JOBS)
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
        if (!scholarId) continue;

        // Get quality score for this job
        const scoreSnap = await db.collection(GS_COLLECTIONS.JOB_QUALITY_SCORES).doc(jobId).get();
        if (!scoreSnap.exists) continue;
        const scoreData = scoreSnap.data()!;

        // Must be locked (48hr complaint window passed)
        if (!scoreData.scoreLocked) continue;

        // Skip if complaint filed
        if (scoreData.customerComplaint) {
          console.log(`Job ${jobId}: has complaint, skipping auto-release.`);
          continue;
        }

        // Score must meet minimum
        const finalScore = scoreData.finalScore || 0;
        if (finalScore < MINIMUM_SCORE_FOR_PAYMENT) {
          console.log(`Job ${jobId}: score ${finalScore} below minimum ${MINIMUM_SCORE_FOR_PAYMENT}, holding.`);
          await jobDoc.ref.update({ paymentStatus: "held" });
          continue;
        }

        // 72hrs must have passed since checkout
        // complaintWindowEnd = checkout + 48hrs, so releaseTime = complaintWindowEnd + 24hrs
        const complaintWindowEnd = scoreData.complaintWindowEnd?.toDate();
        if (!complaintWindowEnd) continue;

        const hoursAfterWindow = PAYMENT_RELEASE_HOURS - SCORE_LOCK_HOURS;
        const releaseTime = new Date(complaintWindowEnd.getTime() + hoursAfterWindow * 60 * 60 * 1000);
        if (now.toDate() < releaseTime) continue;

        // Idempotency: skip if completion payout already exists
        const existingPayout = await db
          .collection(GS_COLLECTIONS.PAYOUTS)
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
        const secondHalf = Math.round((totalPayout * COMPLETION_SPLIT_PERCENT) / 100 * 100) / 100;

        // Check for Stripe
        const stripeAccSnap = await db
          .collection(GS_COLLECTIONS.STRIPE_ACCOUNTS)
          .where("userId", "==", scholarId)
          .where("accountType", "==", "scholar")
          .where("payoutsEnabled", "==", true)
          .limit(1)
          .get();

        const hasStripe = !stripeAccSnap.empty;
        const stripeAccountId = hasStripe ? stripeAccSnap.docs[0].data().stripeAccountId : null;

        // Create completion payout
        const payoutRef = db.collection(GS_COLLECTIONS.PAYOUTS).doc();
        const payoutData: Record<string, any> = {
          jobId,
          scholarId,
          recipientName: jobData.claimedByName || "Scholar",
          amount: secondHalf,
          splitType: "completion_50",
          status: hasStripe ? "processing" : "pending",
          paymentMethod: hasStripe ? "stripe_ach" : "manual_zelle",
          releaseEligibleAt: Timestamp.fromDate(releaseTime),
          qualityScoreAtRelease: finalScore,
          complaintWindowPassed: true,
          taxYear: new Date().getFullYear(),
          createdAt: FieldValue.serverTimestamp(),
        };

        // Initiate Stripe transfer if available
        if (hasStripe && stripeAccountId) {
          try {
            const stripe = getStripe();
            const transfer = await stripe.transfers.create({
              amount: Math.round(secondHalf * 100),
              currency: "usd",
              destination: stripeAccountId,
              description: `Completion payout: ${jobData.title || jobId}`,
              metadata: { jobId, scholarId, splitType: "completion_50" },
            });
            payoutData.stripeTransferId = transfer.id;
            console.log(`Stripe completion transfer: ${transfer.id} for $${secondHalf}`);
          } catch (err) {
            console.error(`Stripe transfer failed for completion ${jobId}:`, err);
            payoutData.status = "pending";
            payoutData.paymentMethod = "manual_zelle";
            payoutData.notes = `Stripe transfer failed: ${(err as Error).message}`;
          }
        }

        await payoutRef.set(payoutData);

        // Update job
        await jobDoc.ref.update({
          secondPayoutId: payoutRef.id,
          paymentStatus: "fully_paid",
        });

        // Notify scholar
        const scholarProfile = await db.collection(GS_COLLECTIONS.PROFILES).doc(scholarId).get();
        const pushToken = scholarProfile.data()?.pushToken;
        if (pushToken) {
          await sendExpoPush(
            [pushToken],
            "Payment Released!",
            `Your completion payout of $${secondHalf} for "${jobData.title}" has been ${hasStripe ? "sent to your bank" : "approved — contact admin for payment"}.`,
            { screen: "payments" }
          );
        }

        // Notify admins if manual
        if (!hasStripe) {
          await notifyAdmins(
            `💰 Manual Payment Required: $${secondHalf} (Completion)`,
            `<p>Completion payout released for "<strong>${jobData.title || jobId}</strong>".</p>
             <p>Scholar: <strong>${jobData.claimedByName || scholarId}</strong></p>
             <p>Amount: <strong>$${secondHalf}</strong></p>
             <p>Quality Score: ${finalScore.toFixed(2)}</p>
             <p>Please pay manually via Zelle/Venmo.</p>`
          );
        }

        console.log(`Completion payout created: ${payoutRef.id}, job=${jobId}, amount=$${secondHalf}`);
      } catch (err) {
        console.error(`Error processing completion payout for job ${jobDoc.id}:`, err);
      }
    }
  }
);

// ═══════════════════════════════════════════════════════════════
// 4. CALLABLE: Create Stripe Connect account for scholar/customer
// ═══════════════════════════════════════════════════════════════
export const gsCreateStripeAccount = onCall(
  { cors: true, timeoutSeconds: 30, secrets: ["STRIPE_SECRET_KEY"] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication required.");
    }

    const userId = request.auth.uid;
    const { accountType, returnUrl, refreshUrl } = request.data as {
      accountType?: "scholar" | "resale_customer";
      returnUrl?: string;
      refreshUrl?: string;
    };

    if (!accountType) {
      throw new HttpsError("invalid-argument", "accountType is required (scholar or resale_customer).");
    }

    // Check for existing account
    const existingSnap = await db
      .collection(GS_COLLECTIONS.STRIPE_ACCOUNTS)
      .where("userId", "==", userId)
      .where("accountType", "==", accountType)
      .limit(1)
      .get();

    let stripeAccountId: string;

    if (!existingSnap.empty) {
      const existing = existingSnap.docs[0].data();
      if (existing.onboardingComplete && existing.payoutsEnabled) {
        return { alreadyComplete: true, stripeAccountId: existing.stripeAccountId };
      }
      stripeAccountId = existing.stripeAccountId;
    } else {
      // Create new Stripe Express account
      const stripe = getStripe();

      // Get user profile for prefill
      const profileSnap = await db.collection(GS_COLLECTIONS.PROFILES).doc(userId).get();
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
      await db.collection(GS_COLLECTIONS.STRIPE_ACCOUNTS).doc().set({
        userId,
        stripeAccountId: account.id,
        accountType,
        onboardingComplete: false,
        payoutsEnabled: false,
        taxIdProvided: false,
        createdAt: FieldValue.serverTimestamp(),
      });

      // Update scholar profile if scholar (use merge to avoid failing on missing doc)
      if (accountType === "scholar") {
        await db.collection(GS_COLLECTIONS.SCHOLAR_PROFILES).doc(userId).set({
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
  }
);

// ═══════════════════════════════════════════════════════════════
// 5. HTTP: Stripe webhook endpoint
// ═══════════════════════════════════════════════════════════════
export const gsStripeWebhook = onRequest(
  { cors: false, timeoutSeconds: 60, secrets: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"] },
  async (req, res) => {
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

    let event: any;
    try {
      event = stripe.webhooks.constructEvent(req.rawBody, sig, webhookSecret);
    } catch (err) {
      console.error("Webhook signature verification failed:", err);
      res.status(400).send(`Webhook Error: ${(err as Error).message}`);
      return;
    }

    console.log(`Stripe webhook: ${event.type}`);

    switch (event.type) {
      case "transfer.created": {
        const transfer = event.data.object as any;
        const transferId = transfer.id;
        // Find payout by stripeTransferId and mark as processing
        const payoutSnap = await db
          .collection(GS_COLLECTIONS.PAYOUTS)
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
        const transfer = event.data.object as any;
        const payoutSnap = await db
          .collection(GS_COLLECTIONS.PAYOUTS)
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
            await notifyAdmins(
              "⚠️ Stripe Transfer Failed",
              `<p>Transfer to <strong>${payoutData.recipientName}</strong> failed/reversed.</p>
               <p>Amount: $${payoutData.amount}</p>
               <p>Please pay manually.</p>`
            );
          } else {
            await payoutSnap.docs[0].ref.update({
              status: "paid",
              paidAt: FieldValue.serverTimestamp(),
            });
            console.log(`Payout ${payoutSnap.docs[0].id} marked as paid`);
          }
        }
        break;
      }

      case "account.updated": {
        const account = event.data.object as any;
        const stripeAccountId = account.id;
        const accSnap = await db
          .collection(GS_COLLECTIONS.STRIPE_ACCOUNTS)
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
            updatedAt: FieldValue.serverTimestamp(),
          });

          // Update scholar profile
          const accData = accSnap.docs[0].data();
          if (accData.accountType === "scholar") {
            await db.collection(GS_COLLECTIONS.SCHOLAR_PROFILES).doc(accData.userId).update({
              stripeOnboardingComplete: onboardingComplete,
              bankLinked: payoutsEnabled,
            });
          }

          console.log(`Stripe account ${stripeAccountId} updated: onboarding=${onboardingComplete}, payouts=${payoutsEnabled}`);
        }
        break;
      }

      case "payment_intent.succeeded": {
        const pi = event.data.object as any;
        // Update customer payment record
        const cpSnap = await db
          .collection(GS_COLLECTIONS.CUSTOMER_PAYMENTS)
          .where("stripePaymentIntentId", "==", pi.id)
          .limit(1)
          .get();
        if (!cpSnap.empty) {
          await cpSnap.docs[0].ref.update({
            status: "succeeded",
            paidAt: FieldValue.serverTimestamp(),
          });
        }
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as any;
        // Record recurring payment
        if (invoice.subscription) {
          const cpSnap = await db
            .collection(GS_COLLECTIONS.CUSTOMER_PAYMENTS)
            .where("stripeSubscriptionId", "==", invoice.subscription)
            .limit(1)
            .get();
          if (!cpSnap.empty) {
            // Add new payment record for this invoice
            await db.collection(GS_COLLECTIONS.CUSTOMER_PAYMENTS).add({
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
              createdAt: FieldValue.serverTimestamp(),
              paidAt: FieldValue.serverTimestamp(),
            });
          }
        }
        break;
      }

      case "charge.refunded": {
        const charge = event.data.object as any;
        const piId = charge.payment_intent;
        if (piId) {
          const cpSnap = await db
            .collection(GS_COLLECTIONS.CUSTOMER_PAYMENTS)
            .where("stripePaymentIntentId", "==", piId)
            .limit(1)
            .get();
          if (!cpSnap.empty) {
            const refundedFull = charge.refunded === true;
            await cpSnap.docs[0].ref.update({
              status: refundedFull ? "refunded" : "partially_refunded",
              refundedAmount: charge.amount_refunded / 100,
              refundedAt: FieldValue.serverTimestamp(),
            });
            const cpData = cpSnap.docs[0].data();
            await notifyAdmins(
              "💰 Payment Refunded",
              `<p>${refundedFull ? "Full" : "Partial"} refund processed for <strong>${cpData.customerName}</strong>.</p>
               <p>Refunded: $${(charge.amount_refunded / 100).toFixed(2)}</p>`
            );
          }
        }
        break;
      }

      case "charge.dispute.created": {
        const dispute = event.data.object as any;
        const piId = dispute.payment_intent;
        if (piId) {
          const cpSnap = await db
            .collection(GS_COLLECTIONS.CUSTOMER_PAYMENTS)
            .where("stripePaymentIntentId", "==", piId)
            .limit(1)
            .get();
          if (!cpSnap.empty) {
            await cpSnap.docs[0].ref.update({
              status: "disputed",
              disputeReason: dispute.reason || "unknown",
              disputedAt: FieldValue.serverTimestamp(),
            });
          }
        }
        await notifyAdmins(
          "🚨 CHARGEBACK ALERT",
          `<p>A customer has filed a dispute/chargeback.</p>
           <p>Amount: $${(dispute.amount / 100).toFixed(2)}</p>
           <p>Reason: ${dispute.reason || "Not specified"}</p>
           <p><strong>Action required:</strong> Respond in Stripe Dashboard within the deadline.</p>`
        );
        break;
      }

      case "payment_intent.payment_failed": {
        const pi = event.data.object as any;
        const cpSnap = await db
          .collection(GS_COLLECTIONS.CUSTOMER_PAYMENTS)
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
          await notifyAdmins(
            "⚠️ Customer Payment Failed",
            `<p>Payment from <strong>${cpData.customerName}</strong> failed.</p>
             <p>Amount: $${cpData.amount}</p>
             <p>Reason: ${failMessage}</p>`
          );
        }
        break;
      }
    }

    res.status(200).json({ received: true });
  }
);

// ═══════════════════════════════════════════════════════════════
// 6. CALLABLE: Create customer payment (ACH preferred, card fallback)
// ═══════════════════════════════════════════════════════════════
export const gsCreateCustomerPayment = onCall(
  { cors: true, timeoutSeconds: 30, secrets: ["STRIPE_SECRET_KEY"] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication required.");
    }

    // Verify admin
    const profileSnap = await db.collection(GS_COLLECTIONS.PROFILES).doc(request.auth.uid).get();
    if (!profileSnap.exists || profileSnap.data()?.role !== "admin") {
      throw new HttpsError("permission-denied", "Admin role required.");
    }

    const {
      customerId,
      customerName,
      customerEmail,
      amount,
      type,
      description,
      jobId,
      paymentMethodType,
    } = request.data as {
      customerId: string;
      customerName: string;
      customerEmail: string;
      amount: number;
      type: "package" | "one_off" | "retention_monthly";
      description?: string;
      jobId?: string;
      paymentMethodType?: "ach" | "card";
    };

    if (!customerId || !customerName || !amount || !type) {
      throw new HttpsError("invalid-argument", "customerId, customerName, amount, and type are required.");
    }

    const stripe = getStripe();
    const preferredMethod = paymentMethodType || "ach";

    // Calculate convenience fee for card payments
    const convenienceFee = preferredMethod === "card"
      ? Math.round(amount * (CONVENIENCE_FEE_PERCENT / 100) * 100) / 100
      : 0;
    const totalCharged = Math.round((amount + convenienceFee) * 100) / 100;

    // Create or find Stripe Customer
    let stripeCustomer: any;
    const existingCustomers = await stripe.customers.list({ email: customerEmail, limit: 1 });
    if (existingCustomers.data.length > 0) {
      stripeCustomer = existingCustomers.data[0];
    } else {
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
    await db.collection(GS_COLLECTIONS.CUSTOMER_PAYMENTS).add({
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
      createdAt: FieldValue.serverTimestamp(),
    });

    return {
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      convenienceFee,
      totalCharged,
    };
  }
);

// ═══════════════════════════════════════════════════════════════
// 7. CALLABLE: Create recurring retention subscription
// ═══════════════════════════════════════════════════════════════
export const gsCreateRetentionSubscription = onCall(
  { cors: true, timeoutSeconds: 30, secrets: ["STRIPE_SECRET_KEY"] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication required.");
    }

    const profileSnap = await db.collection(GS_COLLECTIONS.PROFILES).doc(request.auth.uid).get();
    if (!profileSnap.exists || profileSnap.data()?.role !== "admin") {
      throw new HttpsError("permission-denied", "Admin role required.");
    }

    const { customerId, customerName, customerEmail, monthlyAmount, description } = request.data as {
      customerId: string;
      customerName: string;
      customerEmail: string;
      monthlyAmount: number;
      description?: string;
    };

    if (!customerId || !customerName || !customerEmail || !monthlyAmount) {
      throw new HttpsError("invalid-argument", "customerId, customerName, customerEmail, and monthlyAmount are required.");
    }

    const stripe = getStripe();

    // Find or create Stripe Customer
    let stripeCustomer: any;
    const existingCustomers = await stripe.customers.list({ email: customerEmail, limit: 1 });
    if (existingCustomers.data.length > 0) {
      stripeCustomer = existingCustomers.data[0];
    } else {
      stripeCustomer = await stripe.customers.create({
        email: customerEmail,
        name: customerName,
        metadata: { customerId, platform: "garage_scholars" },
      });
    }

    // Create price for this subscription
    const price = await stripe.prices.create({
      unit_amount: Math.round(monthlyAmount * 100),
      currency: "usd",
      recurring: { interval: "month" },
      product_data: {
        name: `Monthly Retention - ${customerName}`,
        metadata: { customerId, platform: "garage_scholars" },
      },
    });

    // Create subscription (payment method collected via checkout session or setup intent)
    const subscription = await stripe.subscriptions.create({
      customer: stripeCustomer.id,
      items: [{ price: price.id }],
      payment_behavior: "default_incomplete",
      payment_settings: {
        payment_method_types: ["us_bank_account", "card"],
        save_default_payment_method: "on_subscription",
      },
      expand: ["latest_invoice.payment_intent"],
      metadata: { customerId, type: "retention_monthly", platform: "garage_scholars" },
    });

    // Record in Firestore
    await db.collection(GS_COLLECTIONS.CUSTOMER_PAYMENTS).add({
      customerId,
      customerName,
      amount: monthlyAmount,
      type: "retention_monthly",
      stripeSubscriptionId: subscription.id,
      paymentMethod: "ach",
      convenienceFee: 0,
      totalCharged: monthlyAmount,
      status: "pending",
      description: description || `Monthly retention - $${monthlyAmount}/mo`,
      createdAt: FieldValue.serverTimestamp(),
    });

    const invoice = subscription.latest_invoice as any;
    const paymentIntent = invoice?.payment_intent as any;

    return {
      subscriptionId: subscription.id,
      clientSecret: paymentIntent?.client_secret || null,
      status: subscription.status,
    };
  }
);

// ═══════════════════════════════════════════════════════════════
// 8. CALLABLE: Resale payout to customer
// ═══════════════════════════════════════════════════════════════
export const gsResalePayout = onCall(
  { cors: true, timeoutSeconds: 30, secrets: ["STRIPE_SECRET_KEY"] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication required.");
    }

    const profileSnap = await db.collection(GS_COLLECTIONS.PROFILES).doc(request.auth.uid).get();
    if (!profileSnap.exists || profileSnap.data()?.role !== "admin") {
      throw new HttpsError("permission-denied", "Admin role required.");
    }

    const { customerId, customerName, amount, description, jobId } = request.data as {
      customerId: string;
      customerName: string;
      amount: number;
      description?: string;
      jobId?: string;
    };

    if (!customerId || !amount) {
      throw new HttpsError("invalid-argument", "customerId and amount are required.");
    }

    // Check customer has Stripe Connect
    const stripeAccSnap = await db
      .collection(GS_COLLECTIONS.STRIPE_ACCOUNTS)
      .where("userId", "==", customerId)
      .where("accountType", "==", "resale_customer")
      .where("payoutsEnabled", "==", true)
      .limit(1)
      .get();

    const payoutRef = db.collection(GS_COLLECTIONS.PAYOUTS).doc();
    const payoutData: Record<string, any> = {
      jobId: jobId || null,
      customerId,
      recipientName: customerName || "Customer",
      amount,
      splitType: "resale",
      status: "pending",
      paymentMethod: "manual_zelle",
      complaintWindowPassed: true,
      taxYear: new Date().getFullYear(),
      notes: description || "Resale payout",
      createdAt: FieldValue.serverTimestamp(),
    };

    if (!stripeAccSnap.empty) {
      const stripeAccountId = stripeAccSnap.docs[0].data().stripeAccountId;
      try {
        const stripe = getStripe();
        const transfer = await stripe.transfers.create({
          amount: Math.round(amount * 100),
          currency: "usd",
          destination: stripeAccountId,
          description: description || `Resale payout to ${customerName}`,
          metadata: { customerId, splitType: "resale", platform: "garage_scholars" },
        });
        payoutData.stripeTransferId = transfer.id;
        payoutData.status = "processing";
        payoutData.paymentMethod = "stripe_ach";
      } catch (err) {
        console.error(`Stripe resale transfer failed:`, err);
        payoutData.notes += ` | Stripe failed: ${(err as Error).message}`;
      }
    }

    await payoutRef.set(payoutData);

    if (payoutData.status === "pending") {
      await notifyAdmins(
        `💰 Resale Payout Required: $${amount}`,
        `<p>Resale payout to <strong>${customerName}</strong>: <strong>$${amount}</strong></p>
         <p>${description || "No description"}</p>
         <p>Customer does not have Stripe set up — please pay manually.</p>`
      );
    }

    return { payoutId: payoutRef.id, status: payoutData.status };
  }
);

// ═══════════════════════════════════════════════════════════════
// 9. CALLABLE: Admin marks manual payout as paid
// ═══════════════════════════════════════════════════════════════
export const gsMarkPayoutPaid = onCall(
  { cors: true, timeoutSeconds: 10 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication required.");
    }

    const profileSnap = await db.collection(GS_COLLECTIONS.PROFILES).doc(request.auth.uid).get();
    if (!profileSnap.exists || profileSnap.data()?.role !== "admin") {
      throw new HttpsError("permission-denied", "Admin role required.");
    }

    const { payoutId, paymentMethod, notes } = request.data as {
      payoutId: string;
      paymentMethod?: string;
      notes?: string;
    };

    if (!payoutId) {
      throw new HttpsError("invalid-argument", "payoutId is required.");
    }

    const payoutRef = db.collection(GS_COLLECTIONS.PAYOUTS).doc(payoutId);
    const payoutSnap = await payoutRef.get();
    if (!payoutSnap.exists) {
      throw new HttpsError("not-found", "Payout not found.");
    }

    await payoutRef.update({
      status: "paid",
      paidAt: FieldValue.serverTimestamp(),
      ...(paymentMethod ? { paymentMethod } : {}),
      ...(notes ? { notes } : {}),
    });

    return { ok: true };
  }
);

// ═══════════════════════════════════════════════════════════════
// 10. SCHEDULED: Biweekly CPA report (1st and 16th at 8am)
// ═══════════════════════════════════════════════════════════════
export const gsGeneratePaymentReport = onSchedule("0 8 1,16 * *", async () => {
  console.log("Generating biweekly CPA payment report...");

  const now = new Date();
  const day = now.getDate();
  const month = now.getMonth();
  const year = now.getFullYear();

  // Determine period
  let startDate: Date;
  let endDate: Date;
  if (day <= 15) {
    // Report for previous period: 16th to end of previous month
    const prevMonth = month === 0 ? 11 : month - 1;
    const prevYear = month === 0 ? year - 1 : year;
    startDate = new Date(prevYear, prevMonth, 16);
    endDate = new Date(year, month, 0, 23, 59, 59); // last day of prev month
  } else {
    // Report for 1st to 15th of current month
    startDate = new Date(year, month, 1);
    endDate = new Date(year, month, 15, 23, 59, 59);
  }

  const startTs = Timestamp.fromDate(startDate);
  const endTs = Timestamp.fromDate(endDate);

  // Get all paid payouts in this period
  const payoutsSnap = await db
    .collection(GS_COLLECTIONS.PAYOUTS)
    .where("status", "==", "paid")
    .where("paidAt", ">=", startTs)
    .where("paidAt", "<=", endTs)
    .get();

  // Aggregate by scholar
  const scholarMap: Record<string, { name: string; total: number; jobCount: number; payoutIds: string[] }> = {};
  let totalAmount = 0;

  for (const doc of payoutsSnap.docs) {
    const data = doc.data();
    const sid = data.scholarId || data.customerId || "unknown";
    if (!scholarMap[sid]) {
      scholarMap[sid] = { name: data.recipientName || sid, total: 0, jobCount: 0, payoutIds: [] };
    }
    scholarMap[sid].total += data.amount || 0;
    scholarMap[sid].jobCount += 1;
    scholarMap[sid].payoutIds.push(doc.id);
    totalAmount += data.amount || 0;
  }

  const scholarBreakdowns = Object.entries(scholarMap).map(([scholarId, data]) => ({
    scholarId,
    scholarName: data.name,
    jobCount: data.jobCount,
    totalPaid: Math.round(data.total * 100) / 100,
    payoutIds: data.payoutIds,
  }));

  // Create period doc
  const periodId = `${year}-${String(month + 1).padStart(2, "0")}-${day <= 15 ? "A" : "B"}`;
  await db.collection(GS_COLLECTIONS.PAYMENT_PERIODS).doc(periodId).set({
    periodType: "biweekly",
    startDate: startDate.toISOString().split("T")[0],
    endDate: endDate.toISOString().split("T")[0],
    totalPayouts: payoutsSnap.size,
    totalAmount: Math.round(totalAmount * 100) / 100,
    scholarBreakdowns,
    status: "closed",
    createdAt: FieldValue.serverTimestamp(),
  });

  // Get CPA config
  const configSnap = await db.collection(GS_COLLECTIONS.PLATFORM_CONFIG).doc("payments").get();
  const config = configSnap.data();
  const cpaEmail = config?.cpaEmail;
  const autoEmail = config?.cpaAutoEmailEnabled !== false;

  if (cpaEmail && autoEmail) {
    // Build CSV data
    const csvLines = [
      "Scholar Name,Scholar ID,Payout Count,Total Paid,Period Start,Period End",
      ...scholarBreakdowns.map((s) =>
        `"${s.scholarName}","${s.scholarId}",${s.jobCount},${s.totalPaid},"${startDate.toISOString().split("T")[0]}","${endDate.toISOString().split("T")[0]}"`
      ),
      `"TOTAL","",${payoutsSnap.size},${Math.round(totalAmount * 100) / 100},"",""`
    ];
    const csvContent = csvLines.join("\n");

    // Build report HTML
    const tableRows = scholarBreakdowns
      .sort((a, b) => b.totalPaid - a.totalPaid)
      .map((s) =>
        `<tr><td>${s.scholarName}</td><td>${s.jobCount}</td><td>$${s.totalPaid.toFixed(2)}</td></tr>`
      )
      .join("");

    const reportHtml = `
      <h2>Garage Scholars — Biweekly Payment Report</h2>
      <p><strong>Period:</strong> ${startDate.toLocaleDateString()} – ${endDate.toLocaleDateString()}</p>
      <p><strong>Total Payouts:</strong> ${payoutsSnap.size}</p>
      <p><strong>Total Amount:</strong> $${totalAmount.toFixed(2)}</p>
      <table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;">
        <thead><tr><th>Scholar</th><th>Payouts</th><th>Total</th></tr></thead>
        <tbody>${tableRows}</tbody>
        <tfoot><tr><th>TOTAL</th><th>${payoutsSnap.size}</th><th>$${totalAmount.toFixed(2)}</th></tr></tfoot>
      </table>
      <br><p>CSV data attached below:</p>
      <pre>${csvContent}</pre>
      <p><em>All workers are 1099 independent contractors.</em></p>
    `;

    await db.collection("mail").add({
      to: [cpaEmail],
      cc: ["garagescholars@gmail.com"],
      message: {
        subject: `📊 GS Payment Report: ${startDate.toLocaleDateString()} – ${endDate.toLocaleDateString()}`,
        html: reportHtml,
      },
      createdAt: FieldValue.serverTimestamp(),
    });

    await db.collection(GS_COLLECTIONS.PAYMENT_PERIODS).doc(periodId).update({
      cpaReportSentAt: FieldValue.serverTimestamp(),
      status: "reported",
    });

    console.log(`CPA report emailed to ${cpaEmail}`);
  }

  console.log(`Payment period ${periodId}: ${payoutsSnap.size} payouts, $${totalAmount.toFixed(2)}`);
});

// ═══════════════════════════════════════════════════════════════
// 11. CALLABLE: On-demand payment data export
// ═══════════════════════════════════════════════════════════════
export const gsExportPaymentData = onCall(
  { cors: true, timeoutSeconds: 60 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication required.");
    }

    const profileSnap = await db.collection(GS_COLLECTIONS.PROFILES).doc(request.auth.uid).get();
    if (!profileSnap.exists || profileSnap.data()?.role !== "admin") {
      throw new HttpsError("permission-denied", "Admin role required.");
    }

    const { startDate, endDate, format } = request.data as {
      startDate: string;
      endDate: string;
      format?: "csv" | "json";
    };

    if (!startDate || !endDate) {
      throw new HttpsError("invalid-argument", "startDate and endDate are required (YYYY-MM-DD).");
    }

    const start = Timestamp.fromDate(new Date(startDate));
    const end = Timestamp.fromDate(new Date(endDate + "T23:59:59"));

    // Get payouts
    const payoutsSnap = await db
      .collection(GS_COLLECTIONS.PAYOUTS)
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
      const rows = payouts.map((p) =>
        `"${p.id}","${p.jobId}","${p.recipientName}","${p.scholarId}","${p.customerId}",${p.amount},"${p.splitType}","${p.status}","${p.paymentMethod}",${p.taxYear},"${p.createdAt}","${p.paidAt}"`
      );
      return { csv: [headers, ...rows].join("\n"), count: payouts.length };
    }

    return { data: payouts, count: payouts.length };
  }
);

// ═══════════════════════════════════════════════════════════════
// 12. CALLABLE: Create & send Stripe invoice to customer via email
// ═══════════════════════════════════════════════════════════════
export const gsCreateInvoice = onCall(
  { cors: true, timeoutSeconds: 30, secrets: ["STRIPE_SECRET_KEY"] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication required.");
    }

    // Verify admin
    const profileSnap = await db.collection(GS_COLLECTIONS.PROFILES).doc(request.auth.uid).get();
    if (!profileSnap.exists || profileSnap.data()?.role !== "admin") {
      throw new HttpsError("permission-denied", "Admin role required.");
    }

    const {
      customerName,
      customerEmail,
      amount,
      description,
      jobId,
      packageTier,
      lineItems,
    } = request.data as {
      customerName: string;
      customerEmail: string;
      amount: number;
      description?: string;
      jobId?: string;
      packageTier?: string;
      lineItems?: Array<{ name: string; amount: number }>;
    };

    if (!customerName || !customerEmail || !amount) {
      throw new HttpsError(
        "invalid-argument",
        "customerName, customerEmail, and amount are required."
      );
    }

    const stripe = getStripe();

    // Find or create Stripe Customer
    let stripeCustomer: any;
    const existingCustomers = await stripe.customers.list({
      email: customerEmail,
      limit: 1,
    });
    if (existingCustomers.data.length > 0) {
      stripeCustomer = existingCustomers.data[0];
      // Update name if needed
      if (stripeCustomer.name !== customerName) {
        stripeCustomer = await stripe.customers.update(stripeCustomer.id, {
          name: customerName,
        });
      }
    } else {
      stripeCustomer = await stripe.customers.create({
        email: customerEmail,
        name: customerName,
        metadata: { platform: "garage_scholars" },
      });
    }

    // Create Stripe Invoice
    const invoice = await stripe.invoices.create({
      customer: stripeCustomer.id,
      collection_method: "send_invoice",
      days_until_due: 3,
      description: description || `Garage Scholars — ${packageTier || "Service"} Package`,
      metadata: {
        jobId: jobId || "",
        packageTier: packageTier || "",
        platform: "garage_scholars",
      },
    });

    // Add line items
    if (lineItems && lineItems.length > 0) {
      for (const item of lineItems) {
        await stripe.invoiceItems.create({
          customer: stripeCustomer.id,
          invoice: invoice.id,
          amount: Math.round(item.amount * 100), // cents
          currency: "usd",
          description: item.name,
        });
      }
    } else {
      // Single line item for the total
      await stripe.invoiceItems.create({
        customer: stripeCustomer.id,
        invoice: invoice.id,
        amount: Math.round(amount * 100),
        currency: "usd",
        description: description || `${packageTier || "Service"} Package`,
      });
    }

    // Finalize and send the invoice — Stripe emails the customer automatically
    const finalizedInvoice = await stripe.invoices.finalizeInvoice(invoice.id);
    await stripe.invoices.sendInvoice(invoice.id);

    // Record in Firestore
    await db.collection(GS_COLLECTIONS.CUSTOMER_PAYMENTS).add({
      customerId: stripeCustomer.id,
      customerName,
      customerEmail,
      jobId: jobId || null,
      amount,
      type: "invoice",
      stripeInvoiceId: invoice.id,
      stripePaymentIntentId: finalizedInvoice.payment_intent || null,
      paymentMethod: "invoice",
      convenienceFee: 0,
      totalCharged: amount,
      status: "pending",
      description: description || `${packageTier || "Service"} Package`,
      invoiceUrl: finalizedInvoice.hosted_invoice_url || null,
      invoicePdf: finalizedInvoice.invoice_pdf || null,
      createdAt: FieldValue.serverTimestamp(),
    });

    // Also send a confirmation email via our own mail system
    await db.collection("mail").add({
      to: ["garagescholars@gmail.com"],
      message: {
        subject: `Invoice Sent: ${customerName} — $${amount.toFixed(2)}`,
        html: `<h2>Invoice Sent</h2>
          <p><strong>Client:</strong> ${customerName}</p>
          <p><strong>Email:</strong> ${customerEmail}</p>
          <p><strong>Amount:</strong> $${amount.toFixed(2)}</p>
          <p><strong>Package:</strong> ${packageTier || "N/A"}</p>
          <p><strong>Stripe Invoice:</strong> ${invoice.id}</p>
          <p>The client will receive a Stripe-hosted payment link via email.</p>`,
      },
      createdAt: FieldValue.serverTimestamp(),
    });

    console.log(`Invoice ${invoice.id} created and sent to ${customerEmail} for $${amount}`);

    return {
      invoiceId: invoice.id,
      invoiceUrl: finalizedInvoice.hosted_invoice_url,
      invoicePdf: finalizedInvoice.invoice_pdf,
      status: finalizedInvoice.status,
    };
  }
);
