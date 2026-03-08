"use strict";
/**
 * Garage Scholars — Mercury Bank Payout Service
 *
 * Wraps the Mercury Payments API for ACH transfers to scholars and resale customers.
 * Falls back to manual_zelle if MERCURY_API_KEY is not configured.
 *
 * Setup:
 *   1. Open a Mercury business checking account at mercury.com
 *   2. Generate an API key in Mercury dashboard → Settings → API
 *   3. Set secret: firebase functions:secrets:set MERCURY_API_KEY
 *   4. Set your Mercury account ID in gs_platformConfig/payments → mercuryAccountId
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendMercuryPayout = sendMercuryPayout;
const MERCURY_BASE_URL = "https://api.mercury.com/api/v1";
/**
 * Send an ACH payment via Mercury.
 * Returns result object — never throws, always falls back gracefully.
 */
async function sendMercuryPayout(apiKey, accountId, recipient, amountDollars, description) {
    if (!apiKey || !accountId) {
        return { transferId: null, status: "pending", method: "manual_zelle", error: "Mercury not configured" };
    }
    try {
        const response = await fetch(`${MERCURY_BASE_URL}/account/${accountId}/transactions`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                recipientName: recipient.name,
                amount: amountDollars,
                paymentMethod: "ach",
                externalAccountDetails: {
                    routingNumber: recipient.routingNumber,
                    accountNumber: recipient.accountNumber,
                    accountType: recipient.accountType,
                },
                note: description,
            }),
        });
        if (!response.ok) {
            const err = await response.text();
            throw new Error(`Mercury API error ${response.status}: ${err}`);
        }
        const data = await response.json();
        return {
            transferId: data.id || null,
            status: "processing",
            method: "mercury_ach",
        };
    }
    catch (err) {
        console.error("Mercury payout failed, falling back to manual:", err);
        return {
            transferId: null,
            status: "pending",
            method: "manual_zelle",
            error: err.message,
        };
    }
}
