const { ebayRequest } = require('./ebayClient');
const { getSetup, EBAY_MARKETPLACE_ID } = require('./ebaySetup');
const { logger } = require('../lib/logger');

const EBAY_PUBLISH_ENABLED = (process.env.EBAY_PUBLISH_ENABLED || 'false') === 'true';
const DEFAULT_CATEGORY_ID = process.env.EBAY_DEFAULT_CATEGORY_ID || '11700';

// --- Price parsing (handles $, commas, whitespace correctly) ---

const parsePrice = (value) => {
    if (value === null || value === undefined) return null;
    const str = String(value).trim();
    // Remove currency symbols and whitespace, then remove commas (thousands separators)
    // "$1,234.56" → "1234.56", "1234" → "1234", "$12.99" → "12.99"
    // Reject negative values upfront
    if (str.startsWith('-')) return null;
    const cleaned = str.replace(/[^0-9.,]/g, '').replace(/,/g, '');
    const num = Number(cleaned);
    if (!Number.isFinite(num) || num <= 0) return null;
    // Round to 2 decimal places (eBay requires valid currency)
    return Math.round(num * 100) / 100;
};

// --- Condition mapping (expanded) ---

const CONDITION_MAP = {
    'NEW': { id: 1000, label: 'NEW' },
    'LIKE NEW': { id: 1500, label: 'LIKE_NEW' },
    'LIKE_NEW': { id: 1500, label: 'LIKE_NEW' },
    'EXCELLENT': { id: 2000, label: 'VERY_GOOD' },
    'VERY GOOD': { id: 2000, label: 'VERY_GOOD' },
    'VERY_GOOD': { id: 2000, label: 'VERY_GOOD' },
    'GOOD': { id: 2500, label: 'GOOD' },
    'USED': { id: 3000, label: 'USED' },
    'ACCEPTABLE': { id: 4000, label: 'USED_ACCEPTABLE' },
    'REFURBISHED': { id: 3500, label: 'SELLER_REFURBISHED' },
    'SELLER_REFURBISHED': { id: 3500, label: 'SELLER_REFURBISHED' },
    'FOR PARTS': { id: 7000, label: 'FOR_PARTS_OR_NOT_WORKING' },
    'FOR_PARTS': { id: 7000, label: 'FOR_PARTS_OR_NOT_WORKING' },
    'NOT WORKING': { id: 7000, label: 'FOR_PARTS_OR_NOT_WORKING' }
};

const normalizeCondition = (condition) => {
    const key = String(condition || '').trim().toUpperCase();
    return CONDITION_MAP[key] || CONDITION_MAP['USED'];
};

const sanitizeSku = (sku) => String(sku).replace(/[^a-zA-Z0-9_-]/g, '_');

// --- Image validation ---

/**
 * Validate and filter image URLs before sending to eBay API.
 * eBay requires HTTPS URLs pointing to accessible images.
 */
const validateImageUrls = (imageUrls) => {
    if (!imageUrls || !Array.isArray(imageUrls) || imageUrls.length === 0) {
        return { valid: [], warnings: ['No images provided — eBay listings without images perform poorly'] };
    }

    const valid = [];
    const warnings = [];

    for (let i = 0; i < imageUrls.length; i++) {
        const url = imageUrls[i];
        if (!url || typeof url !== 'string') {
            warnings.push(`Image ${i + 1}: invalid URL (empty or not a string)`);
            continue;
        }

        // Must be HTTPS (eBay requirement)
        if (!url.startsWith('https://')) {
            warnings.push(`Image ${i + 1}: not HTTPS — skipped (${url.slice(0, 60)})`);
            continue;
        }

        // Skip obvious placeholders
        const placeholders = ['via.placeholder.com', 'placeholder.com', 'placehold.it', 'dummyimage.com'];
        if (placeholders.some(p => url.includes(p))) {
            warnings.push(`Image ${i + 1}: placeholder URL — skipped`);
            continue;
        }

        valid.push(url);
    }

    return { valid, warnings };
};

// --- Error formatting ---

const formatEbayError = (error) => {
    const payload = error.response?.data || null;
    const status = error.response?.status || null;

    if (!payload) {
        return {
            message: error.message || String(error),
            code: error.code || null,
            status,
            rawError: null,
            isAuthError: error.code === 'EBAY_AUTH_FAILED'
        };
    }

    const errors = payload.errors || [];
    const message = errors.map(e => e.message).filter(Boolean).join('; ') || 'eBay API error';
    const code = errors[0]?.errorId || errors[0]?.errorCode || null;
    const rawError = JSON.stringify(payload).slice(0, 3000);

    return { message, code, status, rawError, isAuthError: status === 401 };
};

// --- Offer error handling (robust extraction of existing offerId) ---

/**
 * Try to extract an existing offerId from an eBay offer creation error.
 * eBay returns error 25002 when an offer already exists for the SKU.
 */
const extractExistingOfferId = (error) => {
    try {
        const errors = error.response?.data?.errors;
        if (!Array.isArray(errors)) return null;

        for (const err of errors) {
            // Check error ID for "offer already exists" variants
            const errorId = err.errorId || err.errorCode;
            if (errorId !== 25002 && errorId !== '25002') continue;

            // Try multiple paths to extract the offerId
            const params = err.parameters || [];
            for (const param of params) {
                if (param.name === 'offerId' && param.value) return param.value;
            }

            // Fallback: check the error message for an offerId pattern
            const msgMatch = (err.message || '').match(/offer\s+(\d+)/i);
            if (msgMatch) return msgMatch[1];
        }
    } catch (_) {
        // Parsing failed — return null
    }
    return null;
};

// --- API operations ---

const upsertInventoryItem = async (db, sku, payload) => {
    return ebayRequest(db, {
        method: 'PUT',
        path: `/sell/inventory/v1/inventory_item/${encodeURIComponent(sku)}`,
        data: payload
    });
};

const createOffer = async (db, payload) => {
    const response = await ebayRequest(db, {
        method: 'POST',
        path: '/sell/inventory/v1/offer',
        data: payload
    });
    return response.data.offerId;
};

const publishOffer = async (db, offerId) => {
    const response = await ebayRequest(db, {
        method: 'POST',
        path: `/sell/inventory/v1/offer/${offerId}/publish`,
        data: {}
    });
    return response.data.listingId;
};

// --- Main listing function ---

const runEbayListing = async ({ inventoryId, item, publicTitle, publicDescription, db, admin }) => {
    const setup = await getSetup(db);
    const marketplaceId = setup?.marketplaceId || EBAY_MARKETPLACE_ID;
    const merchantLocationKey = setup?.merchantLocationKey || null;
    const paymentPolicyId = setup?.paymentPolicyId || null;
    const fulfillmentPolicyId = setup?.fulfillmentPolicyId || null;
    const returnPolicyId = setup?.returnPolicyId || null;

    if (!merchantLocationKey || !paymentPolicyId || !fulfillmentPolicyId || !returnPolicyId) {
        return {
            ok: false,
            message: 'Missing eBay setup (merchantLocationKey or policies). Run bootstrapEbay.js.',
            code: 'SETUP_MISSING'
        };
    }

    const sku = sanitizeSku(item.ebay?.sku || `gs_${inventoryId}`);
    const price = parsePrice(item.price);
    if (!price) {
        return { ok: false, message: `Invalid price for eBay listing: "${item.price}"`, code: 'INVALID_PRICE' };
    }
    if (price > 99999) {
        return { ok: false, message: `Price $${price} exceeds eBay reasonable limit`, code: 'INVALID_PRICE' };
    }

    const categoryId = item.ebayCategoryId || DEFAULT_CATEGORY_ID;
    if (!item.ebayCategoryId) {
        logger.warn('Using fallback eBay category', { categoryId, inventoryId });
    }

    const condition = normalizeCondition(item.condition);
    const description = publicDescription || publicTitle;

    // Validate images before sending to eBay
    const imageResult = validateImageUrls(item.imageUrls);
    if (imageResult.warnings.length > 0) {
        logger.warn('eBay image validation warnings', { warnings: imageResult.warnings, inventoryId });
    }
    if (imageResult.valid.length === 0) {
        throw new Error('No valid images for eBay listing — at least 1 required');
    }

    try {
        // Step 1: Upsert inventory item
        await upsertInventoryItem(db, sku, {
            availability: { shipToLocationAvailability: { quantity: 1 } },
            product: {
                title: publicTitle.slice(0, 80), // eBay max title length
                description: description.slice(0, 4000), // Reasonable description limit
                imageUrls: imageResult.valid
            }
        });

        // Step 2: Create or reuse offer
        let offerId = item.ebay?.offerId || null;
        if (!offerId) {
            try {
                offerId = await createOffer(db, {
                    sku,
                    marketplaceId,
                    format: 'FIXED_PRICE',
                    availableQuantity: 1,
                    categoryId,
                    listingDescription: description.slice(0, 4000),
                    merchantLocationKey,
                    conditionId: condition.id,
                    listingPolicies: {
                        fulfillmentPolicyId,
                        paymentPolicyId,
                        returnPolicyId
                    },
                    pricingSummary: { price: { value: String(price), currency: 'USD' } }
                });
            } catch (error) {
                // Check if an offer already exists for this SKU
                const existingOfferId = extractExistingOfferId(error);
                if (existingOfferId) {
                    logger.info('Using existing eBay offer', { offerId: existingOfferId, sku });
                    offerId = existingOfferId;
                } else {
                    throw error;
                }
            }
        }

        // Step 3: Publish (if enabled)
        let listingId = item.ebay?.listingId || null;
        let status = 'ready_to_publish';
        if (EBAY_PUBLISH_ENABLED) {
            if (item.ebay?.status === 'LIVE' && listingId) {
                status = 'published';
            } else {
                listingId = await publishOffer(db, offerId);
                status = 'published';
            }
        }

        return {
            ok: true,
            sku,
            offerId,
            listingId,
            status,
            inventoryItemId: sku,
            marketplaceId,
            merchantLocationKey,
            paymentPolicyId,
            fulfillmentPolicyId,
            returnPolicyId
        };
    } catch (error) {
        const formatted = formatEbayError(error);

        // Provide actionable guidance for auth failures
        if (formatted.isAuthError) {
            return {
                ok: false,
                message: `eBay auth failed — run cliAuth.js to re-authorize. (${formatted.message})`,
                code: 'EBAY_AUTH_FAILED',
                rawError: formatted.rawError
            };
        }

        return {
            ok: false,
            message: formatted.message,
            code: formatted.code,
            rawError: formatted.rawError
        };
    }
};

module.exports = { runEbayListing, parsePrice, validateImageUrls };
