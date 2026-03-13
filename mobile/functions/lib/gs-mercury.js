"use strict";
/**
 * Garage Scholars — Mercury Bank Payout Service
 *
 * Wraps the Mercury Payments API for ACH transfers to scholars and resale customers.
 * Two-step flow: create recipient → send money.
 * Includes balance monitoring, low-balance alerts, and payout queuing.
 *
 * Setup:
 *   1. Open a Mercury business checking account at mercury.com
 *   2. Generate an API key in Mercury dashboard → Settings → API
 *   3. Set secret: firebase functions:secrets:set MERCURY_API_KEY
 *   4. Set your Mercury account ID in gs_platformConfig/payments → mercuryAccountId
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMercuryBalance = getMercuryBalance;
exports.checkBalanceAndAlert = checkBalanceAndAlert;
exports.sendMercuryPayout = sendMercuryPayout;
const firestore_1 = require("firebase-admin/firestore");
const db = (0, firestore_1.getFirestore)();
const MERCURY_BASE_URL = "https://api.mercury.com/api/v1";
// ── Balance thresholds ──
const BALANCE_YELLOW = 1500; // "Top up soon"
const BALANCE_RED = 1000; // "Top up now"
/**
 * Find or create a Mercury recipient by name + account number.
 */
async function findOrCreateRecipient(apiKey, recipient) {
    // List existing recipients and check for a match
    const listResp = await fetch(`${MERCURY_BASE_URL}/recipients`, {
        headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (listResp.ok) {
        const listData = await listResp.json();
        const recipients = listData.recipients || listData || [];
        const existing = (Array.isArray(recipients) ? recipients : []).find((r) => r.name === recipient.name &&
            r.electronicRoutingInfo?.accountNumber?.endsWith(recipient.accountNumber.slice(-4)));
        if (existing)
            return existing.id;
    }
    // Create new recipient
    const createResp = await fetch(`${MERCURY_BASE_URL}/recipients`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            name: recipient.name,
            emails: recipient.email ? [recipient.email] : [],
            paymentMethod: "domesticWire",
            electronicRoutingInfo: {
                accountNumber: recipient.accountNumber,
                routingNumber: recipient.routingNumber,
                electronicAccountType: recipient.accountType === "checking" ? "personalChecking" : "personalSavings",
                address: recipient.address || {
                    address1: "Denver, CO",
                    city: "Denver",
                    region: "CO",
                    postalCode: "80202",
                    country: "US",
                },
            },
        }),
    });
    if (!createResp.ok) {
        const errText = await createResp.text();
        throw new Error(`Mercury create recipient error ${createResp.status}: ${errText}`);
    }
    const created = await createResp.json();
    return created.id;
}
/**
 * Get Mercury checking account balance.
 */
async function getMercuryBalance(apiKey, accountId) {
    const resp = await fetch(`${MERCURY_BASE_URL}/account/${accountId}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(`Mercury balance check failed ${resp.status}: ${errText}`);
    }
    const data = await resp.json();
    const available = data.availableBalance || 0;
    let alertLevel = "ok";
    if (available < BALANCE_RED)
        alertLevel = "red";
    else if (available < BALANCE_YELLOW)
        alertLevel = "yellow";
    return {
        availableBalance: available,
        currentBalance: data.currentBalance || 0,
        accountId,
        alertLevel,
    };
}
// ── Auto-replenish safety limits ──
const AUTO_PULL_COOLDOWN_HOURS = 72; // Wait 3 days between pulls (ACH takes 1-3 days)
const AUTO_PULL_MAX_AMOUNT = 3000; // Never pull more than $3K at once
const AUTO_PULL_TARGET_BALANCE = 3000; // Target balance to replenish to
const AUTO_PULL_MAX_PER_WEEK = 2; // Max 2 auto-pulls per 7-day window
/**
 * Auto-pull funds from Chase to Mercury via Mercury's ACH debit.
 *
 * Safety checks:
 *  1. Chase must be linked (mercuryLinkedChaseAccountId in Firestore)
 *  2. 72hr cooldown between pulls (ACH takes 1-3 days, avoid stacking)
 *  3. Max 2 pulls per 7-day window (prevents runaway pulls)
 *  4. Max $3,000 per pull (caps exposure)
 *  5. Only pulls if no pending pull is already in transit
 *  6. Daily idempotency key (Mercury rejects duplicate same-day requests)
 *  7. Firestore transaction lock prevents race conditions from concurrent payouts
 */
async function autoReplenishFromChase(apiKey, accountId, currentBalance) {
    const configSnap = await db.collection("gs_platformConfig").doc("payments").get();
    const linkedChaseAccountId = configSnap.data()?.mercuryLinkedChaseAccountId;
    if (!linkedChaseAccountId) {
        return { pulled: false, amount: 0, error: "Chase not linked in Firestore" };
    }
    // Use Firestore transaction to prevent race conditions
    // (two payouts finishing at the same time both triggering a pull)
    const replenishRef = db.collection("gs_platformConfig").doc("mercuryAutoReplenish");
    try {
        const result = await db.runTransaction(async (tx) => {
            const replenishSnap = await tx.get(replenishRef);
            const data = replenishSnap.data() || {};
            // ── Check 1: Cooldown — last successful pull must be 72+ hours ago ──
            const lastPullAt = data.lastSuccessfulPullAt?.toDate?.() || new Date(0);
            const hoursSinceLastPull = (Date.now() - lastPullAt.getTime()) / (1000 * 60 * 60);
            if (hoursSinceLastPull < AUTO_PULL_COOLDOWN_HOURS) {
                return { pulled: false, amount: 0, error: `Cooldown: last pull was ${Math.round(hoursSinceLastPull)}hrs ago (${AUTO_PULL_COOLDOWN_HOURS}hr minimum)` };
            }
            // ── Check 2: Max pulls per week ──
            const pullsThisWeek = data.pullsThisWeek || 0;
            const weekResetAt = data.weekResetAt?.toDate?.() || new Date(0);
            const daysSinceReset = (Date.now() - weekResetAt.getTime()) / (1000 * 60 * 60 * 24);
            const actualPullsThisWeek = daysSinceReset >= 7 ? 0 : pullsThisWeek;
            if (actualPullsThisWeek >= AUTO_PULL_MAX_PER_WEEK) {
                return { pulled: false, amount: 0, error: `Weekly limit: ${AUTO_PULL_MAX_PER_WEEK} pulls this week already` };
            }
            // ── Check 3: No pending pull already in transit ──
            if (data.pendingPullId && data.pendingPullStatus === "processing") {
                return { pulled: false, amount: 0, error: `Pull already in transit (${data.pendingPullId})` };
            }
            // ── Calculate pull amount (capped) ──
            const rawAmount = AUTO_PULL_TARGET_BALANCE - currentBalance;
            const pullAmount = Math.min(Math.max(rawAmount, 500), AUTO_PULL_MAX_AMOUNT);
            // ── Lock: mark pull as in-progress BEFORE calling API ──
            const newWeekCount = daysSinceReset >= 7 ? 1 : actualPullsThisWeek + 1;
            tx.set(replenishRef, {
                pendingPullStatus: "in_progress",
                pendingPullStartedAt: firestore_1.FieldValue.serverTimestamp(),
                pendingPullAmount: pullAmount,
                pullsThisWeek: newWeekCount,
                weekResetAt: daysSinceReset >= 7 ? firestore_1.FieldValue.serverTimestamp() : (data.weekResetAt || firestore_1.FieldValue.serverTimestamp()),
            }, { merge: true });
            return { pulled: true, amount: pullAmount, proceed: true };
        });
        // If transaction said don't proceed, return early
        if (!result.proceed) {
            return { pulled: result.pulled, amount: result.amount, error: result.error };
        }
        // ── Execute the Mercury API call (outside transaction) ──
        const pullAmount = result.amount;
        const today = new Date().toISOString().split("T")[0];
        const response = await fetch(`${MERCURY_BASE_URL}/account/${accountId}/transactions`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                amount: pullAmount,
                paymentMethod: "ach",
                externalAccountId: linkedChaseAccountId,
                direction: "debit",
                note: `Auto-replenish from Chase — balance was $${currentBalance.toFixed(2)}`,
                idempotencyKey: `gs-auto-replenish-${accountId}-${today}`,
            }),
        });
        if (!response.ok) {
            const errText = await response.text();
            // Roll back: clear pending status on failure
            await replenishRef.update({
                pendingPullStatus: "failed",
                lastFailedAt: firestore_1.FieldValue.serverTimestamp(),
                lastFailedError: `${response.status}: ${errText}`,
            });
            return { pulled: false, amount: pullAmount, error: `Mercury API error ${response.status}: ${errText}` };
        }
        const apiData = await response.json();
        // ── Record successful pull ──
        await replenishRef.update({
            lastSuccessfulPullAt: firestore_1.FieldValue.serverTimestamp(),
            lastPullAmount: pullAmount,
            lastPullTransferId: apiData.id || null,
            lastPullBalance: currentBalance,
            pendingPullId: apiData.id || null,
            pendingPullStatus: "processing",
        });
        await db.collection("gs_mercuryTransfers").add({
            transferId: apiData.id || null,
            amount: pullAmount,
            direction: "chase_to_mercury",
            type: "auto_replenish",
            status: "processing",
            previousBalance: currentBalance,
            createdAt: firestore_1.FieldValue.serverTimestamp(),
        });
        return { pulled: true, amount: pullAmount };
    }
    catch (err) {
        // Clear pending status on unexpected error
        await replenishRef.update({
            pendingPullStatus: "error",
            lastFailedAt: firestore_1.FieldValue.serverTimestamp(),
            lastFailedError: err.message,
        }).catch(() => { }); // Don't fail on cleanup
        return { pulled: false, amount: 0, error: err.message };
    }
}
/**
 * Check Mercury balance, auto-pull from Chase if low, and alert admins.
 * Called after every payout to keep admins informed.
 * Deduplicates alerts — won't spam if balance stays at the same level.
 */
async function checkBalanceAndAlert(apiKey, accountId, adminTokens, adminEmails, payoutAmount, payoutRecipient) {
    const balance = await getMercuryBalance(apiKey, accountId);
    const fmt = (n) => `$${n.toFixed(2)}`;
    // If balance is below threshold, try to auto-pull from Chase first
    let autoPullResult = null;
    if (balance.availableBalance < BALANCE_YELLOW) {
        try {
            autoPullResult = await autoReplenishFromChase(apiKey, accountId, balance.availableBalance);
            if (autoPullResult.pulled) {
                console.log(`Auto-pulled ${fmt(autoPullResult.amount)} from Chase to Mercury.`);
            }
            else {
                console.log(`Auto-pull skipped: ${autoPullResult.error}`);
            }
        }
        catch (err) {
            console.error("Auto-replenish failed (non-blocking):", err);
            autoPullResult = { pulled: false, amount: 0, error: err.message };
        }
    }
    // Check last alert level to avoid spamming
    const lastAlertSnap = await db.collection("gs_platformConfig").doc("mercuryAlertState").get();
    const lastAlertLevel = lastAlertSnap.data()?.alertLevel || "ok";
    const lastAlertAt = lastAlertSnap.data()?.lastAlertAt?.toDate?.() || new Date(0);
    const hoursSinceLastAlert = (Date.now() - lastAlertAt.getTime()) / (1000 * 60 * 60);
    // Always notify if auto-pull happened; otherwise use dedup logic
    const shouldAlert = (autoPullResult?.pulled) ||
        (balance.alertLevel !== "ok" &&
            (balance.alertLevel !== lastAlertLevel || hoursSinceLastAlert >= 12));
    if (!shouldAlert)
        return balance;
    // Update alert state
    await db.collection("gs_platformConfig").doc("mercuryAlertState").set({
        alertLevel: balance.alertLevel,
        availableBalance: balance.availableBalance,
        lastAlertAt: firestore_1.FieldValue.serverTimestamp(),
        lastPayoutAmount: payoutAmount || null,
        lastPayoutRecipient: payoutRecipient || null,
        lastAutoPull: autoPullResult || null,
    });
    // Build notification content
    const isRed = balance.alertLevel === "red";
    let subject;
    let html;
    if (autoPullResult?.pulled) {
        // Auto-pull succeeded — friendly notification
        subject = `Mercury Auto-Replenished: ${fmt(autoPullResult.amount)} pulled from Chase`;
        html = `
      <div style="font-family: sans-serif; max-width: 520px; margin: auto;">
        <div style="background:#f0fdf4; border:2px solid #10b981; border-radius:12px; padding:20px; text-align:center;">
          <p style="margin:0; font-size:14px; color:#555;">Auto-Replenish Triggered</p>
          <p style="margin:8px 0 0; font-size:36px; font-weight:800; color:#059669;">${fmt(autoPullResult.amount)}</p>
          <p style="margin:4px 0 0; color:#888; font-size:13px;">Pulled from Chase to Mercury (1-3 business days to arrive)</p>
        </div>
        <p style="margin-top:16px;">Mercury balance was <strong>${fmt(balance.availableBalance)}</strong> after paying ${payoutRecipient || "a worker"} ${payoutAmount ? fmt(payoutAmount) : ""}.</p>
        <p>The system auto-initiated a ${fmt(autoPullResult.amount)} ACH transfer from Chase to bring Mercury back up to ~$3,000.</p>
        <p style="color:#555;">No action needed — this is just a heads-up. Funds will arrive in 1-3 business days.</p>
        <p style="color:#888; font-size:0.85rem;">Garage Scholars Mercury Monitor</p>
      </div>
    `;
    }
    else {
        // Auto-pull failed or not configured — alert to manually replenish
        const levelLabel = isRed ? "LOW BALANCE" : "Balance Getting Low";
        const autoPullNote = autoPullResult?.error
            ? `<p style="color:#d97706; font-size:13px;">Auto-replenish attempted but: ${autoPullResult.error}</p>`
            : "";
        subject = `Mercury ${levelLabel}: ${fmt(balance.availableBalance)} remaining`;
        html = `
      <div style="font-family: sans-serif; max-width: 520px; margin: auto;">
        <div style="background:${isRed ? "#fef2f2" : "#fffbeb"}; border:2px solid ${isRed ? "#ef4444" : "#f59e0b"}; border-radius:12px; padding:20px; text-align:center;">
          <p style="margin:0; font-size:14px; color:#555;">${isRed ? "URGENT" : "Heads Up"} -- Mercury Balance</p>
          <p style="margin:8px 0 0; font-size:36px; font-weight:800; color:${isRed ? "#dc2626" : "#d97706"};">${fmt(balance.availableBalance)}</p>
          <p style="margin:4px 0 0; color:#888; font-size:13px;">Available in Mercury Checking</p>
        </div>
        ${payoutAmount ? `<p style="margin-top:16px;">Last payout: <strong>${fmt(payoutAmount)}</strong> to ${payoutRecipient || "worker"}</p>` : ""}
        ${autoPullNote}
        <p>Transfer from Chase to Mercury: we suggest at least <strong>${fmt(3000 - balance.availableBalance)}</strong> to bring it back to $3,000.</p>
        <p style="color:#888; font-size:0.85rem;">Garage Scholars Mercury Monitor</p>
      </div>
    `;
    }
    // Send email
    const emailTo = adminEmails.length > 0 ? adminEmails : ["garagescholars@gmail.com"];
    await db.collection("mail").add({
        to: emailTo,
        message: { subject, html },
        createdAt: firestore_1.FieldValue.serverTimestamp(),
    });
    // Send push notification
    if (adminTokens.length > 0) {
        const pushBody = autoPullResult?.pulled
            ? `Auto-pulled ${fmt(autoPullResult.amount)} from Chase to Mercury. Balance was ${fmt(balance.availableBalance)}.`
            : isRed
                ? `Mercury at ${fmt(balance.availableBalance)} — replenish from Chase ASAP!`
                : `Mercury at ${fmt(balance.availableBalance)} — consider topping up soon.`;
        const pushTitle = autoPullResult?.pulled
            ? "Mercury Auto-Replenished"
            : isRed ? "Mercury LOW BALANCE" : "Mercury Balance Low";
        const messages = adminTokens
            .filter((t) => t && t.startsWith("ExponentPushToken"))
            .map((to) => ({
            to,
            title: pushTitle,
            body: pushBody,
            sound: "default",
            data: { screen: "admin-payouts" },
        }));
        if (messages.length > 0) {
            await fetch("https://exp.host/--/api/v2/push/send", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(messages),
            });
        }
    }
    console.log(`Mercury balance alert (${balance.alertLevel}): ${fmt(balance.availableBalance)}`);
    return balance;
}
/**
 * Send an ACH payment via Mercury.
 * If insufficient funds, returns queued_insufficient_funds status instead of failing.
 * After successful payout, checks balance and alerts admins if low.
 */
async function sendMercuryPayout(apiKey, accountId, recipient, amountDollars, description) {
    if (!apiKey || !accountId) {
        return { transferId: null, recipientId: null, status: "pending", method: "manual_cash", error: "Mercury not configured" };
    }
    try {
        // Pre-check balance before attempting payout
        const balance = await getMercuryBalance(apiKey, accountId);
        if (balance.availableBalance < amountDollars) {
            console.warn(`Mercury insufficient funds: need $${amountDollars}, have $${balance.availableBalance}`);
            return {
                transferId: null,
                recipientId: null,
                status: "queued_insufficient_funds",
                method: "mercury_ach",
                error: `Insufficient funds: need $${amountDollars.toFixed(2)}, available $${balance.availableBalance.toFixed(2)}`,
            };
        }
        // Step 1: Find or create recipient
        const recipientId = await findOrCreateRecipient(apiKey, recipient);
        // Step 2: Send money
        const response = await fetch(`${MERCURY_BASE_URL}/account/${accountId}/transactions`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                recipientId,
                amount: amountDollars,
                paymentMethod: "ach",
                note: description,
                idempotencyKey: `gs-${accountId}-${Date.now()}`,
            }),
        });
        if (!response.ok) {
            const err = await response.text();
            // Detect insufficient funds from API response too
            if (err.toLowerCase().includes("insufficient funds")) {
                return {
                    transferId: null,
                    recipientId,
                    status: "queued_insufficient_funds",
                    method: "mercury_ach",
                    error: `Insufficient funds (API): ${err}`,
                };
            }
            throw new Error(`Mercury API error ${response.status}: ${err}`);
        }
        const data = await response.json();
        return {
            transferId: data.id || null,
            recipientId,
            status: data.status === "pending" ? "approval_needed" : "processing",
            method: "mercury_ach",
        };
    }
    catch (err) {
        const errMsg = err.message;
        // Catch insufficient funds in error messages
        if (errMsg.toLowerCase().includes("insufficient funds")) {
            return {
                transferId: null,
                recipientId: null,
                status: "queued_insufficient_funds",
                method: "mercury_ach",
                error: errMsg,
            };
        }
        console.error("Mercury payout failed, falling back to manual:", err);
        return {
            transferId: null,
            recipientId: null,
            status: "pending",
            method: "manual_cash",
            error: errMsg,
        };
    }
}
