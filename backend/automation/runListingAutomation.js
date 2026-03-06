const path = require('path');
const fs = require('fs');
const https = require('https');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const AdblockerPlugin = require('puppeteer-extra-plugin-adblocker');
const RecaptchaPlugin = require('puppeteer-extra-plugin-recaptcha');
puppeteer.use(StealthPlugin());
puppeteer.use(AdblockerPlugin({ blockTrackers: true }));
puppeteer.use(RecaptchaPlugin({
    provider: { id: '2captcha', token: process.env.CAPTCHA_API_KEY || '' },
    visualFeedback: true
}));
const { runEbayListing } = require('../ebay/ebayListing');
const { createJobLogger } = require('../lib/logger');
const { cleanupJobFiles } = require('../lib/cleanup');
const { validateFBListing } = require('../lib/fbCompliance');
const { canPost, recordPost, checkDuplicate, recordPosting } = require('../lib/rateLimiter');
const { getProxy, closeAllProxies } = require('../lib/proxyManager');
const {
    humanDelay, humanType, humanClick, humanScroll,
    randomizeViewport, applyStealthPatches, injectFingerprint, trySelectors,
    retryStep, detectCaptcha, waitForCaptchaSolution
} = require('../lib/humanBehavior');

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// --- Configuration ---
const HEADLESS = process.env.HEADLESS !== 'false';
const DRY_RUN = process.env.DRY_RUN === 'true';
const WORKER_ID = process.env.WORKER_ID || `${require('os').hostname()}-${process.pid}`;

// --- Payment info (required env vars, no defaults) ---
const REQUIRED_PAYMENT_FIELDS = [
    'PAYMENT_NAME', 'PAYMENT_CARD_NUMBER', 'PAYMENT_EXP_MONTH',
    'PAYMENT_EXP_YEAR', 'PAYMENT_CVC', 'PAYMENT_ADDRESS',
    'PAYMENT_CITY', 'PAYMENT_STATE', 'PAYMENT_ZIP', 'PAYMENT_PHONE'
];

function getPaymentInfo() {
    const missing = REQUIRED_PAYMENT_FIELDS.filter(key => !process.env[key]);
    if (missing.length > 0) {
        throw new Error(`Missing required payment env vars: ${missing.join(', ')}`);
    }
    return {
        name: process.env.PAYMENT_NAME,
        cardNumber: process.env.PAYMENT_CARD_NUMBER,
        expMonth: process.env.PAYMENT_EXP_MONTH,
        expYear: process.env.PAYMENT_EXP_YEAR,
        cvc: process.env.PAYMENT_CVC,
        address: process.env.PAYMENT_ADDRESS,
        city: process.env.PAYMENT_CITY,
        state: process.env.PAYMENT_STATE,
        zip: process.env.PAYMENT_ZIP,
        phone: process.env.PAYMENT_PHONE
    };
}

// --- Track open browsers for graceful shutdown ---
const openBrowsers = new Set();
function getOpenBrowsers() { return openBrowsers; }

// ============================
// FALLBACK SELECTOR DEFINITIONS
// ============================
// Multiple selectors per element — if FB/CL updates HTML, the next one still works.
// Text-based XPath is the most resilient (user-facing text rarely changes).

const FB_SELECTORS = {
    titleInput: [
        'xpath///label[.//span[contains(text(), "Title")]]//input',
        'label[aria-label="Title"] input',
        'input[placeholder*="title" i]',
        'input[name="title"]'
    ],
    priceInput: [
        'xpath///label[.//span[contains(text(), "Price")]]//input',
        'label[aria-label="Price"] input',
        'input[placeholder*="price" i]'
    ],
    descriptionInput: [
        'xpath///label[.//span[contains(text(), "Description")]]//textarea',
        'xpath///label[.//span[contains(text(), "Description")]]//input',
        'textarea[placeholder*="description" i]',
        'textarea[aria-label*="description" i]'
    ],
    categoryButton: [
        'xpath///label[.//span[contains(text(), "Category")]]/following::div[@role="button"][1]',
        'xpath///label[.//span[contains(text(), "Category")]]//input',
        'xpath///span[contains(text(), "Category")]/ancestor::label//input',
        'xpath///span[contains(text(), "Category")]/ancestor::label/following-sibling::div',
        'xpath///label[.//span[contains(text(), "Category")]]',
    ],
    conditionDropdown: [
        'xpath///label[.//span[contains(text(), "Condition")]]',
        'xpath///span[contains(text(), "Condition")]/ancestor::label'
    ],
    imageUpload: [
        'input[type="file"][accept*="image"]',
        'input[type="file"][accept*="video"]',
        'div[aria-label="Add photos"] input[type="file"]',
        'xpath///div[contains(@aria-label, "photo")]//input[@type="file"]',
        'xpath///div[contains(@aria-label, "Photo")]//input[@type="file"]',
        'input[type="file"]'
    ],
    nextButton: [
        'div[aria-label="Next"]',
        'xpath///div[@aria-label="Next"]',
        'xpath///span[contains(text(), "Next")]/ancestor::div[@role="button"]',
        'xpath///span[text()="Next"]/..'
    ],
    publishButton: [
        'div[aria-label="Publish"]',
        'xpath///span[contains(text(), "Publish")]/ancestor::div[@role="button"]',
        'xpath///span[text()="Publish"]/..'
    ],
    loginField: [
        'input[name="email"]',
        'input[id="email"]',
        '#email'
    ]
};

const CL_SELECTORS = {
    postingTitle: ['input[name="PostingTitle"]', '#PostingTitle'],
    price: ['input[name="price"]', '#price'],
    postal: ['input[name="postal"]', '#postal_code'],
    postingBody: ['textarea[name="PostingBody"]', '#PostingBody'],
    email: ['input[name="FromEMail"]', '#FromEMail'],
    fileInput: ['input[type="file"]'],
    goButton: ['button[name="go"]', 'button.continue', 'xpath///button[@name="go"]'],
    doneImagesButton: [
        'xpath///button[contains(text(), "done with images")]',
        'xpath///button[contains(text(), "Done with images")]'
    ],
    paymentNameField: [
        'xpath///label[contains(text(), "Name")]/following::input[1]',
        'xpath///div[contains(text(), "Name")]/following::input[1]',
        'input[name="cardholderName"]'
    ]
};

// ============================
// IMAGE DOWNLOAD
// ============================

const downloadImage = (url, filepath, redirectsLeft = 5) => {
    return new Promise((resolve, reject) => {
        const protocol = url.startsWith('https') ? https : require('http');
        protocol.get(url, (response) => {
            if ([301, 302, 307, 308].includes(response.statusCode) && response.headers.location) {
                if (redirectsLeft <= 0) return reject(new Error('Too many redirects'));
                downloadImage(response.headers.location, filepath, redirectsLeft - 1).then(resolve).catch(reject);
                return;
            }
            if (response.statusCode !== 200) {
                return reject(new Error(`HTTP ${response.statusCode} for ${url}`));
            }
            const file = fs.createWriteStream(filepath);
            response.pipe(file);
            file.on('finish', () => { file.close(); resolve(filepath); });
            file.on('error', (err) => { fs.unlink(filepath, () => {}); reject(err); });
        }).on('error', (err) => { fs.unlink(filepath, () => {}); reject(err); });
    });
};

// ============================
// TEXT SANITIZATION
// ============================

const escapeRegExp = (v) => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const sanitizePublicText = (text, clientName) => {
    if (!text) return '';
    if (!clientName) return text.trim();
    const name = escapeRegExp(clientName);
    let result = text;
    [new RegExp(`${name}\\s*-\\s*`, 'ig'), new RegExp(`${name}\\s*:\\s*`, 'ig'), new RegExp(name, 'ig')]
        .forEach(p => { result = result.replace(p, ''); });
    return result.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
};

const containsClientName = (text, clientName) => {
    if (!clientName || !text) return false;
    return new RegExp(escapeRegExp(clientName), 'i').test(text);
};

// ============================
// MAIN AUTOMATION FUNCTION
// ============================

async function runListingAutomation(docId, item, db, admin) {
    const log = createJobLogger({ inventoryId: docId });
    const listingTitle = item.clientName ? `${item.clientName} - ${item.title}` : item.title;
    log.info('New job received', { title: listingTitle });

    const listingRef = db.collection('inventory').doc(docId);
    const platformValue = (item.platform || '').toLowerCase();
    const shouldRunCraigslist = platformValue.includes('craigslist') || platformValue.includes('cl') || platformValue.includes('both') || platformValue.includes('all');
    const shouldRunFacebook = platformValue.includes('facebook') || platformValue.includes('fb') || platformValue.includes('both') || platformValue.includes('all');
    const shouldRunEbay = platformValue.includes('ebay') || platformValue.includes('both') || platformValue.includes('all');
    log.info('Platform targets', { platform: item.platform, craigslist: shouldRunCraigslist, facebook: shouldRunFacebook, ebay: shouldRunEbay });

    // --- Payment validation (CL only) ---
    let paymentInfo = null;
    if (shouldRunCraigslist) {
        try { paymentInfo = getPaymentInfo(); }
        catch (err) {
            log.error('Payment config validation failed', { error: err.message });
            await listingRef.update({ status: 'Error', lastError: { platform: 'JOB', message: err.message, screenshotPath: '' }, lastUpdated: admin.firestore.FieldValue.serverTimestamp() });
            return { success: false, lastError: { platform: 'JOB', message: err.message, screenshotPath: '' }, screenshots: [] };
        }
    }

    // --- Text sanitization ---
    const publicTitle = sanitizePublicText(item.title || '', item.clientName || '');
    const publicDescription = sanitizePublicText(item.description || '', item.clientName || '');
    const fbDescription = publicDescription || publicTitle;

    if (item.clientName && (containsClientName(publicTitle, item.clientName) || containsClientName(publicDescription, item.clientName))) {
        const message = 'Client name detected in public fields after sanitization';
        log.error(message);
        await listingRef.update({ status: 'Error', lastError: { platform: 'JOB', message, screenshotPath: '' }, finishedAt: admin.firestore.FieldValue.serverTimestamp(), lastUpdated: admin.firestore.FieldValue.serverTimestamp() });
        return { success: false, lastError: { platform: 'JOB', message, screenshotPath: '' }, screenshots: [] };
    }

    // --- FB Compliance Check (BEFORE launching browser) ---
    if (shouldRunFacebook) {
        const compliance = validateFBListing(item, publicTitle, publicDescription);
        if (!compliance.valid) {
            const message = `FB compliance failed: ${compliance.errors.join('; ')}`;
            log.error(message);
            await listingRef.update({ status: 'Compliance Error', lastError: { platform: 'FB', message, screenshotPath: '' }, finishedAt: admin.firestore.FieldValue.serverTimestamp(), lastUpdated: admin.firestore.FieldValue.serverTimestamp() });
            return { success: false, complianceFailed: true, errors: compliance.errors, lastError: { platform: 'FB', message, screenshotPath: '' }, screenshots: [] };
        }
        if (compliance.warnings.length > 0) log.warn('FB compliance warnings', { warnings: compliance.warnings });
    }

    // --- Rate Limit Checks ---
    if (shouldRunFacebook) {
        const fbRate = await canPost(db, 'facebook', WORKER_ID);
        if (!fbRate.allowed) {
            log.warn('Facebook rate limited', { reason: fbRate.reason, waitMs: fbRate.waitMs });
            if (fbRate.waitMs > 0 && fbRate.waitMs <= 20 * 60 * 1000) {
                log.info('Waiting for FB rate limit window', { waitMs: fbRate.waitMs });
                await delay(fbRate.waitMs);
            } else {
                await listingRef.update({ status: 'Error', lastError: { platform: 'FB', message: `Rate limited: ${fbRate.reason}`, screenshotPath: '' }, lastUpdated: admin.firestore.FieldValue.serverTimestamp() });
                return { success: false, lastError: { platform: 'FB', message: fbRate.reason, screenshotPath: '' }, screenshots: [] };
            }
        }
    }
    if (shouldRunCraigslist) {
        const clRate = await canPost(db, 'craigslist', WORKER_ID);
        if (!clRate.allowed) {
            log.warn('CL rate limited', { reason: clRate.reason, waitMs: clRate.waitMs });
            if (clRate.waitMs > 0 && clRate.waitMs <= 35 * 60 * 1000) {
                log.info('Waiting for CL rate limit window', { waitMs: clRate.waitMs });
                await delay(clRate.waitMs);
            } else {
                await listingRef.update({ status: 'Error', lastError: { platform: 'CL', message: `Rate limited: ${clRate.reason}`, screenshotPath: '' }, lastUpdated: admin.firestore.FieldValue.serverTimestamp() });
                return { success: false, lastError: { platform: 'CL', message: clRate.reason, screenshotPath: '' }, screenshots: [] };
            }
        }
    }

    // --- Duplicate Detection ---
    if (shouldRunFacebook) {
        const fbDup = await checkDuplicate(db, publicTitle, 'facebook');
        if (fbDup.isDuplicate) log.warn('Duplicate FB listing detected — proceeding with caution', { title: publicTitle });
    }

    // --- Progress tracking ---
    const initialProgress = {};
    if (shouldRunCraigslist) initialProgress.craigslist = 'queued';
    if (shouldRunFacebook) initialProgress.facebook = 'queued';
    if (shouldRunEbay) initialProgress.ebay = 'queued';

    const cleanData = (data) => Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined));
    const updateListing = (data) => listingRef.update(cleanData({ ...data, lastUpdated: admin.firestore.FieldValue.serverTimestamp() }));

    const debugDir = path.join(__dirname, '..', 'debug_screenshots');
    // Clean screenshots older than 48 hours
    try {
        if (fs.existsSync(debugDir)) {
            const cutoff = Date.now() - (48 * 60 * 60 * 1000);
            for (const file of fs.readdirSync(debugDir)) {
                const filePath = path.join(debugDir, file);
                if (fs.statSync(filePath).mtimeMs < cutoff) fs.unlinkSync(filePath);
            }
        }
    } catch (_) {}
    const screenshots = [];
    const captureScreenshot = async (step, page) => {
        const safeStep = (step || 'unknown').replace(/[^a-z0-9_-]/gi, '-');
        const filePath = path.join(debugDir, `${docId}_${safeStep}.png`);
        if (!fs.existsSync(debugDir)) fs.mkdirSync(debugDir, { recursive: true });
        if (page) await page.screenshot({ path: filePath, fullPage: true }).catch(() => {});
        screenshots.push(filePath);
        return filePath;
    };

    await updateListing({
        status: 'Running',
        startedAt: admin.firestore.FieldValue.serverTimestamp(),
        progress: initialProgress,
        lastError: null,
        ...(shouldRunEbay ? { 'ebay.status': 'queued', 'ebay.enabled': true } : {})
    });

    // --- Download images (for CL + FB Puppeteer) ---
    const downloadedPaths = [];
    if (shouldRunCraigslist || shouldRunFacebook) {
        if (item.imageUrls && item.imageUrls.length > 0) {
            log.info('Downloading images', { count: item.imageUrls.length });
            const tempDir = path.join(__dirname, '..', 'temp_downloads');
            if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);
            for (let i = 0; i < item.imageUrls.length; i++) {
                try {
                    const destPath = path.join(tempDir, `img_${docId}_${i}.jpg`);
                    await downloadImage(item.imageUrls[i], destPath);

                    // Validate downloaded file is a real image
                    const stats = fs.statSync(destPath);
                    if (stats.size < 1024) {
                        log.warn('Downloaded file too small, skipping', { index: i, size: stats.size });
                        fs.unlinkSync(destPath);
                        continue;
                    }
                    const fd = fs.openSync(destPath, 'r');
                    const magicBuf = Buffer.alloc(4);
                    fs.readSync(fd, magicBuf, 0, 4, 0);
                    fs.closeSync(fd);
                    const isJPEG = magicBuf[0] === 0xFF && magicBuf[1] === 0xD8;
                    const isPNG = magicBuf[0] === 0x89 && magicBuf[1] === 0x50 && magicBuf[2] === 0x4E && magicBuf[3] === 0x47;
                    if (!isJPEG && !isPNG) {
                        log.warn('Downloaded file is not valid JPEG/PNG, skipping', { index: i });
                        fs.unlinkSync(destPath);
                        continue;
                    }
                    downloadedPaths.push(destPath);
                } catch (e) { log.warn('Image download failed', { index: i, error: e.message }); }
            }
        } else { log.info('No images found in listing'); }
    }

    // --- Launch browser ---
    let browser = null;
    let pageCL = null;
    let pageFB = null;
    let proxyCleanup = () => {};

    // Detect browser crashes — fail fast instead of hanging on timeouts
    let browserDisconnected = false;
    const ensureBrowserAlive = () => {
        if (browserDisconnected) throw new Error('Browser disconnected unexpectedly');
    };

    try {
        if (shouldRunCraigslist || shouldRunFacebook) {
            const launchArgs = [
                '--disable-notifications',
                '--disable-background-timer-throttling',
                '--disable-backgrounding-occluded-windows',
                '--disable-renderer-backgrounding',
                '--disable-features=CalculateNativeWinOcclusion',
                // Anti-detection
                '--disable-blink-features=AutomationControlled',
                '--disable-infobars',
                '--window-size=1920,1080'
            ];
            if (HEADLESS) { launchArgs.push('--no-sandbox', '--disable-setuid-sandbox'); }
            else { launchArgs.push('--start-maximized'); }

            // Proxy: residential IP rotation (if configured)
            const proxy = await getProxy({ sessionId: docId });
            if (proxy.proxyUrl) {
                launchArgs.push(`--proxy-server=${proxy.proxyUrl}`);
                log.info('Browser launching with proxy');
            }
            proxyCleanup = proxy.cleanup;

            browser = await puppeteer.launch({
                headless: HEADLESS,
                defaultViewport: null,
                executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
                userDataDir: "./chrome_profile",
                args: launchArgs
            });
            openBrowsers.add(browser);

            browser.on('disconnected', () => {
                browserDisconnected = true;
                log.error('Browser disconnected unexpectedly');
            });

            if (shouldRunCraigslist) {
                ensureBrowserAlive();
                pageCL = await browser.newPage();
                await applyStealthPatches(pageCL);
                await injectFingerprint(pageCL);
                await randomizeViewport(pageCL);
                pageCL.setDefaultTimeout(60000);
                pageCL.setDefaultNavigationTimeout(90000);
            }
            if (shouldRunFacebook) {
                ensureBrowserAlive();
                pageFB = await browser.newPage();
                await applyStealthPatches(pageFB);
                await injectFingerprint(pageFB);
                await randomizeViewport(pageFB);
                pageFB.setDefaultTimeout(60000);
                pageFB.setDefaultNavigationTimeout(90000);
            }
        }

        // ============================
        // CRAIGSLIST — Robust Puppeteer
        // ============================
        const runCraigslist = async (page) => {
            if (!shouldRunCraigslist) return 'skipped';
            ensureBrowserAlive();
            await updateListing({ 'progress.craigslist': 'running' });
            log.info('Starting Craigslist automation', { platform: 'CL' });

            try {
                // Step 1: Navigate
                await retryStep(async () => {
                    const clPostUrl = process.env.CL_POST_URL || 'https://post.craigslist.org/c/den';
                    await page.goto(clPostUrl, { waitUntil: 'domcontentloaded' });
                    const captcha = await detectCaptcha(page);
                    if (captcha.detected) {
                        log.warn('CAPTCHA on CL', { type: captcha.type });
                        // Try auto-solve first (requires CAPTCHA_API_KEY)
                        if (process.env.CAPTCHA_API_KEY) {
                            try {
                                const { solved } = await page.solveRecaptchas();
                                if (solved.length > 0) { log.info('CL CAPTCHA auto-solved'); }
                                else { const manual = await waitForCaptchaSolution(page, 5 * 60 * 1000, log); if (!manual) throw new Error('CL CAPTCHA not solved'); }
                            } catch (solveErr) { log.warn('Auto-solve failed, waiting for manual', { error: solveErr.message }); const manual = await waitForCaptchaSolution(page, 5 * 60 * 1000, log); if (!manual) throw new Error('CL CAPTCHA not solved within timeout'); }
                        } else {
                            const manual = await waitForCaptchaSolution(page, 5 * 60 * 1000, log);
                            if (!manual) throw new Error('CL CAPTCHA not solved within timeout');
                        }
                    }
                    if (page.url().includes('login')) {
                        log.warn('CL login required — waiting for manual login (up to 120s)', { platform: 'CL' });
                        await page.waitForFunction(
                            () => !window.location.href.includes('login'),
                            { timeout: 120000 }
                        ).catch(() => { throw new Error('CL login timed out after 120 seconds'); });
                        log.info('CL login detected, continuing', { platform: 'CL' });
                        await page.goto(clPostUrl, { waitUntil: 'domcontentloaded' });
                    }
                }, { maxRetries: 2, stepName: 'cl_navigate', page, captureScreenshot, log });

                // Step 2: Location
                try {
                    const clLocationCode = process.env.CL_LOCATION_CODE || 'den';
                    await page.waitForSelector(`input[value="${clLocationCode}"]`, { timeout: 3000 });
                    await humanDelay(300, 700);
                    await page.click(`input[value="${clLocationCode}"]`);
                    const goBtn = await trySelectors(page, CL_SELECTORS.goButton, 2000);
                    if (goBtn) await humanClick(page, goBtn);
                } catch (_) {}

                // Step 3: Category — find by label text instead of hardcoded index
                await retryStep(async () => {
                    try {
                        await page.waitForSelector('.picker', { timeout: 5000 });

                        const categoryText = process.env.CL_CATEGORY || 'for sale by owner';
                        const categoryClicked = await page.evaluate((target) => {
                            const labels = Array.from(document.querySelectorAll('label'));
                            const match = labels.find(l =>
                                l.textContent.trim().toLowerCase().includes(target.toLowerCase())
                            );
                            if (match) {
                                const radio = match.querySelector('input[type="radio"]')
                                    || document.getElementById(match.getAttribute('for'));
                                if (radio) { radio.click(); return true; }
                                match.click(); return true;
                            }
                            // Fallback: check radio parent text
                            const radios = Array.from(document.querySelectorAll('input[type="radio"]'));
                            for (const radio of radios) {
                                const parent = radio.closest('label') || radio.parentElement;
                                if (parent && parent.textContent.toLowerCase().includes(target.toLowerCase())) {
                                    radio.click(); return true;
                                }
                            }
                            return false;
                        }, categoryText);

                        if (!categoryClicked) {
                            log.warn('Could not find category by text, falling back to index 24', { target: categoryText });
                            const radios = await page.$$('input[type="radio"]');
                            if (radios.length > 24) await radios[24].click();
                            else if (radios.length > 0) await radios[radios.length - 1].click();
                        }

                        await humanDelay(500, 1000);
                        try { await page.waitForNavigation({ timeout: 3000 }); }
                        catch (_) {
                            const goBtn = await trySelectors(page, CL_SELECTORS.goButton, 2000);
                            if (goBtn) { await humanClick(page, goBtn); await page.waitForNavigation({ timeout: 5000 }).catch(() => {}); }
                        }
                    } catch (_) {
                        const goBtn = await trySelectors(page, CL_SELECTORS.goButton, 2000);
                        if (goBtn) { await humanClick(page, goBtn); await page.waitForNavigation({ timeout: 5000 }).catch(() => {}); }
                    }
                }, { maxRetries: 1, stepName: 'cl_category', page, captureScreenshot, log });

                // Step 4: Subarea
                try {
                    const clSubarea = process.env.CL_SUBAREA || 'city of denver';
                    await page.evaluate((subarea) => {
                        const labels = Array.from(document.querySelectorAll('label'));
                        const den = labels.find(el => el.textContent.toLowerCase().includes(subarea));
                        if (den) den.click();
                    }, clSubarea);
                    await humanDelay(300, 600);
                    const goBtn = await trySelectors(page, CL_SELECTORS.goButton, 2000);
                    if (goBtn) { await Promise.all([page.waitForNavigation({ timeout: 5000 }).catch(() => {}), humanClick(page, goBtn)]); }
                } catch (_) {}

                // Step 5: Fill form
                await retryStep(async () => {
                    log.info('Filling CL form', { platform: 'CL' });
                    const titleField = await trySelectors(page, CL_SELECTORS.postingTitle, 10000);
                    if (!titleField) throw new Error('Could not find CL title field');

                    let finalBody = `${publicTitle}\n\n`;
                    finalBody += (publicDescription && publicDescription.trim() !== "") ? publicDescription : "Item available for pickup.";
                    finalBody += "\n\nItem Available for Pickup. Please contact for details.";

                    // Email
                    const emailField = await trySelectors(page, CL_SELECTORS.email, 2000);
                    if (emailField) {
                        const emailValue = await page.evaluate(el => el.value, emailField);
                        if (!emailValue) {
                            const clEmail = process.env.CL_EMAIL;
                            if (!clEmail) throw new Error('CL_EMAIL environment variable required');
                            await humanType(page, emailField, clEmail, { typoChance: 0 });
                        }
                    }

                    await humanType(page, titleField, publicTitle, { typoChance: 0 });
                    await humanDelay(300, 700);

                    const priceField = await trySelectors(page, CL_SELECTORS.price, 3000);
                    if (priceField) { await humanType(page, priceField, item.price.replace(/[^0-9.]/g, ''), { typoChance: 0 }); await humanDelay(200, 500); }

                    const postalField = await trySelectors(page, CL_SELECTORS.postal, 3000);
                    if (postalField) { await humanType(page, postalField, process.env.CL_POSTAL || '80202', { typoChance: 0 }); await humanDelay(200, 500); }

                    const bodyField = await trySelectors(page, CL_SELECTORS.postingBody, 3000);
                    if (bodyField) await humanType(page, bodyField, finalBody, { typoChance: 0 });

                    // Uncheck contact options
                    for (const sel of ['input[name="show_phone_ok"]', 'input[name="contact_text_ok"]', 'input[name="phone_calls_ok"]']) {
                        const el = await page.$(sel);
                        if (el) { const checked = await page.evaluate(e => e.checked, el).catch(() => false); if (checked) await el.click().catch(() => {}); }
                    }
                    const phoneInput = await page.$('input[name="contact_phone"]');
                    if (phoneInput) { await phoneInput.click({ clickCount: 3 }).catch(() => {}); await page.keyboard.press('Backspace').catch(() => {}); }

                    await humanDelay(500, 1000);
                    const goBtn = await trySelectors(page, CL_SELECTORS.goButton, 3000);
                    if (goBtn) {
                        await humanClick(page, goBtn);
                        const navOk = await page.waitForNavigation({ timeout: 12000 }).then(() => true).catch(() => false);
                        if (!navOk) {
                            const errText = await page.evaluate(() => {
                                const errs = Array.from(document.querySelectorAll('.error, .warn, .postingerror')).map(n => n.textContent.trim()).filter(Boolean);
                                return errs.join(' | ').slice(0, 400) || 'CL form did not advance';
                            }).catch(() => 'CL form did not advance');
                            throw new Error(`[CL] ${errText}`);
                        }
                    }
                }, { maxRetries: 2, stepName: 'cl_fill_form', page, captureScreenshot, log });

                // Step 6: Images
                if (downloadedPaths.length > 0) {
                    await retryStep(async () => {
                        let onImagePage = false;
                        for (let a = 0; a < 5 && !onImagePage; a++) {
                            if (await trySelectors(page, CL_SELECTORS.fileInput, 2000)) { onImagePage = true; break; }
                            const goBtn = await trySelectors(page, CL_SELECTORS.goButton, 1000);
                            if (goBtn) { await humanClick(page, goBtn); await page.waitForNavigation({ timeout: 3000 }).catch(() => {}); }
                            else await humanDelay(500, 1000);
                        }
                        log.info('Uploading images to CL', { count: downloadedPaths.length });
                        const fileInput = await trySelectors(page, CL_SELECTORS.fileInput, 10000);
                        if (fileInput) {
                            await fileInput.uploadFile(...downloadedPaths);
                            // Poll for upload completion instead of fixed delay
                            await page.waitForFunction((expectedCount) => {
                                const thumbs = document.querySelectorAll('.imgthumb, .thumb img, [id^="imgPrev"]');
                                if (thumbs.length >= expectedCount) return true;
                                const spinners = document.querySelectorAll('.uploading, .upload-progress, .spinner');
                                return spinners.length === 0 && thumbs.length > 0;
                            }, { timeout: 20000 }, downloadedPaths.length).catch(() => {
                                log.warn('CL image upload verification timed out, proceeding', { platform: 'CL' });
                            });
                            await humanDelay(1000, 2000);
                            const doneBtn = await trySelectors(page, CL_SELECTORS.doneImagesButton, 5000);
                            if (doneBtn) { await humanClick(page, doneBtn); await page.waitForNavigation({ timeout: 5000 }).catch(() => {}); }
                        }
                    }, { maxRetries: 2, stepName: 'cl_images', page, captureScreenshot, log });
                }

                // Step 7: Payment
                await retryStep(async () => {
                    log.info('Navigating to payment', { platform: 'CL' });
                    const goBtn = await trySelectors(page, CL_SELECTORS.goButton, 3000);
                    if (goBtn) {
                        await humanClick(page, goBtn);
                        await page.waitForNavigation({ timeout: 20000 }).catch(() => {});
                        await humanDelay(1500, 3000);
                        await humanScroll(page, 5);
                    }

                    log.info('Filling payment info', { platform: 'CL' });
                    // Find payment iframe
                    let paymentFrame = null;
                    for (const frame of page.frames()) {
                        const hasCardField = await frame.$('input[name="cardName"], input[name="cardNumber"]').catch(() => null);
                        if (hasCardField) { paymentFrame = frame; break; }
                    }
                    if (!paymentFrame) {
                        // Fallback: try first iframe on page
                        const iframeEl = await page.$('iframe');
                        if (iframeEl) paymentFrame = await iframeEl.contentFrame();
                    }

                    if (paymentFrame) {
                        // Named selectors (from watcher.py — field names confirmed in CL payment iframe)
                        const fieldMap = {
                            'cardName': paymentInfo.name,
                            'cardNumber': paymentInfo.cardNumber,
                            'expMonth': paymentInfo.expMonth,
                            'expYear': paymentInfo.expYear,
                            'cvCode': paymentInfo.cvc,
                            'billingAddress': paymentInfo.address,
                            'billingCity': paymentInfo.city,
                            'billingState': paymentInfo.state,
                            'billingPostal': paymentInfo.zip,
                        };

                        let filledCount = 0;
                        for (const [fieldName, value] of Object.entries(fieldMap)) {
                            try {
                                const field = await paymentFrame.$(`input[name="${fieldName}"]`);
                                if (field) {
                                    await field.click({ clickCount: 3 });
                                    await humanDelay(50, 150);
                                    await field.type(value);
                                    await humanDelay(80, 200);
                                    filledCount++;
                                }
                            } catch (e) { log.warn(`Failed to fill ${fieldName}`, { error: e.message }); }
                        }

                        if (filledCount === 0) {
                            // Fallback: Tab-based navigation if named selectors not found
                            log.warn('Named payment selectors failed, falling back to Tab navigation', { platform: 'CL' });
                            const nameField = await trySelectors(paymentFrame, CL_SELECTORS.paymentNameField, 1500);
                            if (nameField) {
                                await nameField.click({ clickCount: 3 });
                                await humanDelay(100, 300);
                                await nameField.type(paymentInfo.name);
                                const pressTab = async (text) => { await page.keyboard.press('Tab'); await humanDelay(100, 300); if (text) await page.keyboard.type(text); await humanDelay(100, 300); };
                                await pressTab(paymentInfo.cardNumber);
                                await pressTab(`${paymentInfo.expMonth}${paymentInfo.expYear}`);
                                await pressTab(paymentInfo.cvc);
                                await pressTab(paymentInfo.address);
                                await pressTab(paymentInfo.city);
                                await pressTab(paymentInfo.state);
                                await pressTab(paymentInfo.zip);
                            }
                        }
                        log.info('Payment info filled', { platform: 'CL', filledByName: filledCount });
                    }
                }, { maxRetries: 2, stepName: 'cl_payment', page, captureScreenshot, log });

                // DRY RUN: stop before final submission
                if (DRY_RUN) {
                    await captureScreenshot('CL_dry_run_ready', page);
                    log.info('DRY RUN — stopping before CL submission', { platform: 'CL' });
                    await updateListing({ 'progress.craigslist': 'success' });
                    return 'dry_run';
                }

                await recordPost(db, 'craigslist', WORKER_ID);
                await recordPosting(db, publicTitle, 'craigslist', docId);
                await updateListing({ 'progress.craigslist': 'success' });
                log.info('CL automation complete');
                return 'success';
            } catch (e) {
                const screenshotPath = await captureScreenshot('CL_error', page);
                await updateListing({ 'progress.craigslist': 'error', lastError: { platform: 'CL', message: e.message || String(e), screenshotPath } });
                log.error('CL automation failed', { error: e.message, screenshotPath });
                return 'error';
            }
        };

        // ============================
        // FACEBOOK MARKETPLACE — Robust Puppeteer
        // ============================
        const runFacebook = async (page) => {
            if (!shouldRunFacebook) return 'skipped';
            ensureBrowserAlive();
            await updateListing({ 'progress.facebook': 'running' });
            log.info('Starting FB Marketplace automation', { platform: 'FB' });

            try {
                // Step 1: Navigate
                await retryStep(async () => {
                    await page.goto('https://www.facebook.com/marketplace/create/item', { waitUntil: 'domcontentloaded' });
                    await humanDelay(2000, 4000);

                    const captcha = await detectCaptcha(page);
                    if (captcha.detected) {
                        log.warn('FB checkpoint detected', { type: captcha.type });
                        if (process.env.CAPTCHA_API_KEY) {
                            try {
                                const { solved } = await page.solveRecaptchas();
                                if (solved.length > 0) { log.info('FB CAPTCHA auto-solved'); }
                                else { const manual = await waitForCaptchaSolution(page, 5 * 60 * 1000, log); if (!manual) throw new Error('FB checkpoint not resolved'); }
                            } catch (solveErr) { log.warn('Auto-solve failed, waiting for manual', { error: solveErr.message }); const manual = await waitForCaptchaSolution(page, 5 * 60 * 1000, log); if (!manual) throw new Error('FB checkpoint not resolved within timeout'); }
                        } else {
                            const manual = await waitForCaptchaSolution(page, 5 * 60 * 1000, log);
                            if (!manual) throw new Error('FB checkpoint not resolved within timeout');
                        }
                    }

                    const loginField = await trySelectors(page, FB_SELECTORS.loginField, 3000);
                    if (loginField) {
                        log.warn('FB login required — waiting for manual login (up to 120s)', { platform: 'FB' });
                        await page.waitForFunction(
                            () => !document.querySelector('input[name="email"]'),
                            { timeout: 120000 }
                        ).catch(() => { throw new Error('FB login timed out after 120 seconds'); });
                        log.info('FB login detected, continuing', { platform: 'FB' });
                        await page.goto('https://www.facebook.com/marketplace/create/item', { waitUntil: 'domcontentloaded' });
                        await humanDelay(2000, 4000);
                    }

                    await page.keyboard.press('Escape').catch(() => {});
                    await humanDelay(300, 600);
                }, { maxRetries: 2, stepName: 'fb_navigate', page, captureScreenshot, log });

                // Step 2: Wait for form
                await retryStep(async () => {
                    const titleField = await trySelectors(page, FB_SELECTORS.titleInput, 30000);
                    if (!titleField) throw new Error('FB form did not load — title field not found');
                }, { maxRetries: 2, stepName: 'fb_wait_form', page, captureScreenshot, log });

                // Step 3: Upload images
                if (downloadedPaths.length > 0) {
                    await retryStep(async () => {
                        log.info('Uploading images to FB', { count: downloadedPaths.length, paths: downloadedPaths.map(p => p.split('/').pop()) });

                        // Verify files exist on disk
                        const validPaths = downloadedPaths.filter(p => {
                            const exists = require('fs').existsSync(p);
                            if (!exists) log.warn('Image file missing from disk', { path: p });
                            return exists;
                        });
                        if (validPaths.length === 0) {
                            log.error('No valid image files to upload', { platform: 'FB' });
                            return;
                        }

                        // Find ALL file inputs on the page (FB hides them)
                        const fileInputs = await page.$$('input[type="file"]');
                        log.info('Found file inputs on page', { count: fileInputs.length });

                        let uploaded = false;
                        for (const fileInput of fileInputs) {
                            try {
                                await fileInput.uploadFile(...validPaths);
                                uploaded = true;
                                log.info('Files sent to input', { platform: 'FB' });
                                break;
                            } catch (e) {
                                log.warn('File input rejected upload, trying next', { error: e.message });
                            }
                        }

                        if (!uploaded) {
                            log.error('Could not upload to any file input', { platform: 'FB' });
                            await captureScreenshot('FB_no_file_input', page);
                            return;
                        }

                        // Wait for thumbnails to appear
                        await page.waitForFunction((expectedCount) => {
                            const imgs = document.querySelectorAll('img[src^="blob:"], img[src*="scontent"]');
                            return imgs.length >= expectedCount;
                        }, { timeout: 25000 }, validPaths.length).catch(() => {
                            log.warn('Image thumbnail verification timed out — may still have uploaded', { platform: 'FB' });
                        });

                        await captureScreenshot('FB_after_image_upload', page);
                        await humanDelay(500, 1000);
                        await page.keyboard.press('Escape').catch(() => {});
                        await humanDelay(200, 400);
                    }, { maxRetries: 2, stepName: 'fb_images', page, captureScreenshot, log });
                }

                // Step 4: Fill form
                await retryStep(async () => {
                    log.info('Filling FB form', { platform: 'FB' });

                    const titleField = await trySelectors(page, FB_SELECTORS.titleInput, 5000);
                    if (titleField) { await humanType(page, titleField, publicTitle); await humanDelay(500, 1000); }

                    const priceField = await trySelectors(page, FB_SELECTORS.priceInput, 5000);
                    if (priceField) { await humanType(page, priceField, item.price.replace(/[^0-9]/g, ''), { typoChance: 0 }); await humanDelay(500, 1000); }

                    const descField = await trySelectors(page, FB_SELECTORS.descriptionInput, 5000);
                    if (descField) { await humanType(page, descField, fbDescription); await humanDelay(500, 1000); }

                    await humanScroll(page, 10);
                }, { maxRetries: 2, stepName: 'fb_fill_form', page, captureScreenshot, log });

                // Step 5: Category — FB uses a combobox (click → type → pick from results)
                await retryStep(async () => {
                    log.info('Selecting category', { platform: 'FB' });
                    await captureScreenshot('FB_before_category', page);

                    const categoryMap = {
                        'furniture': 'Furniture', 'electronics': 'Electronics',
                        'clothing': 'Clothing', 'vehicles': 'Vehicles',
                        'home': 'Home', 'sporting': 'Sporting Goods',
                        'toys': 'Toys', 'tools': 'Tools',
                        'appliances': 'Appliances', 'bikes': 'Bicycles',
                        'musical instruments': 'Musical Instruments', 'jewelry': 'Jewelry',
                        'books': 'Books', 'baby+kid': 'Baby',
                        'auto parts': 'Auto Parts', 'collectibles': 'Collectibles',
                        'antiques': 'Antiques', 'general': 'Miscellaneous',
                        'other': 'Miscellaneous',
                    };
                    const itemCategory = (item.category || '').toLowerCase();
                    const targetCategory = categoryMap[itemCategory] || process.env.FB_CATEGORY || 'Miscellaneous';

                    // Strategy 1: Find a combobox/input inside the category label and type into it
                    const catInput = await trySelectors(page, [
                        'xpath///label[.//span[contains(text(), "Category")]]//input',
                        'xpath///span[contains(text(), "Category")]/ancestor::label//input',
                    ], 3000);

                    if (catInput) {
                        log.info('Found category input field — typing search', { platform: 'FB', target: targetCategory });
                        await humanClick(page, catInput);
                        await humanDelay(300, 600);
                        await humanType(page, catInput, targetCategory, { clearFirst: true, typoChance: 0 });
                        await humanDelay(800, 1500);

                        // Pick the first matching result from the dropdown
                        const picked = await page.evaluate((target) => {
                            const options = Array.from(document.querySelectorAll(
                                '[role="option"], [role="listbox"] [role="option"], [role="menuitem"], [role="listbox"] > div'
                            ));
                            const match = options.find(el =>
                                el.textContent.trim().toLowerCase().includes(target.toLowerCase()) && el.offsetParent !== null
                            );
                            if (match) { match.click(); return match.textContent.trim().slice(0, 50); }
                            return null;
                        }, targetCategory);

                        if (picked) {
                            log.info('Category selected via search', { platform: 'FB', picked });
                        } else {
                            // Try just clicking the first visible option
                            log.warn('No matching option found, clicking first result', { platform: 'FB' });
                            await page.keyboard.press('ArrowDown');
                            await humanDelay(200, 400);
                            await page.keyboard.press('Enter');
                        }
                        await humanDelay(300, 600);
                        return;
                    }

                    // Strategy 2: Click the category button/dropdown
                    const catBtn = await trySelectors(page, FB_SELECTORS.categoryButton, 3000);
                    if (catBtn) {
                        log.info('Found category button — clicking', { platform: 'FB' });
                        await humanClick(page, catBtn);
                        await humanDelay(800, 1500);
                        await captureScreenshot('FB_category_opened', page);

                        const picked = await page.evaluate((target) => {
                            const candidates = Array.from(document.querySelectorAll(
                                '[role="option"], [role="listbox"] [role="option"], [role="menuitem"], [role="listbox"] > div, [role="menu"] > div'
                            ));
                            const match = candidates.find(el =>
                                el.textContent.trim().toLowerCase().includes(target.toLowerCase()) && el.offsetParent !== null
                            );
                            if (match) { match.click(); return match.textContent.trim().slice(0, 50); }
                            return null;
                        }, targetCategory);

                        if (picked) {
                            log.info('Category selected via dropdown', { platform: 'FB', picked });
                        } else {
                            log.warn('Could not find category in dropdown', { platform: 'FB', target: targetCategory });
                            await page.keyboard.press('Escape');
                        }
                        await humanDelay(300, 600);
                        return;
                    }

                    log.warn('No category control found — continuing without category', { platform: 'FB' });
                    await captureScreenshot('FB_no_category', page);
                }, { maxRetries: 1, stepName: 'fb_category', page, captureScreenshot, log });

                // Step 6: Condition — find by text instead of arrow-key counting
                try {
                    log.info('Selecting condition', { platform: 'FB' });
                    const condDrop = await trySelectors(page, FB_SELECTORS.conditionDropdown, 5000);
                    if (condDrop) {
                        await humanClick(page, condDrop);
                        await humanDelay(400, 800);

                        const targetCondition = process.env.FB_CONDITION || 'Used';
                        const clicked = await page.evaluate((target) => {
                            // Try role="option" elements first (FB dropdown pattern)
                            const options = Array.from(document.querySelectorAll(
                                '[role="option"], [role="listbox"] [role="option"], [role="menu"] [role="menuitem"]'
                            ));
                            const match = options.find(el =>
                                el.textContent.trim().toLowerCase().includes(target.toLowerCase())
                            );
                            if (match) { match.click(); return true; }

                            // Fallback: visible spans matching the target text
                            const spans = Array.from(document.querySelectorAll('span'));
                            const spanMatch = spans.find(el =>
                                el.textContent.trim().toLowerCase() === target.toLowerCase()
                                && el.offsetParent !== null
                            );
                            if (spanMatch) { spanMatch.click(); return true; }
                            return false;
                        }, targetCondition);

                        if (clicked) {
                            log.info('Condition selected', { platform: 'FB', condition: targetCondition });
                        } else {
                            log.warn('Could not find condition by text, falling back to ArrowDown', { target: targetCondition });
                            for (let i = 0; i < 3; i++) { await page.keyboard.press("ArrowDown"); await humanDelay(50, 150); }
                            await page.keyboard.press("Enter");
                        }
                        await humanDelay(300, 600);
                    } else {
                        log.warn('Condition dropdown not found', { platform: 'FB' });
                        await captureScreenshot('FB_no_condition', page);
                    }
                } catch (e) {
                    log.warn('Condition selection failed', { platform: 'FB', error: e.message });
                    await captureScreenshot('FB_condition_error', page);
                }

                // Step 7: Next → Delivery
                await retryStep(async () => {
                    log.info('Moving to delivery options', { platform: 'FB' });
                    await humanScroll(page, 5);
                    const nextBtn = await trySelectors(page, FB_SELECTORS.nextButton, 5000);
                    if (nextBtn) { await humanClick(page, nextBtn); await humanDelay(1500, 3000); }
                }, { maxRetries: 2, stepName: 'fb_next', page, captureScreenshot, log });

                // Step 8: Public meetup — case-insensitive with fallback terms
                try {
                    const meetupTerms = ['public meetup', 'meet up', 'public meet', 'meetup spot'];
                    await page.waitForFunction((terms) => {
                        const spans = Array.from(document.querySelectorAll('span'));
                        return spans.some(el =>
                            terms.some(term => el.textContent.toLowerCase().includes(term))
                        );
                    }, { timeout: 10000 }, meetupTerms);
                    await humanDelay(500, 1000);
                    await page.evaluate((terms) => {
                        const spans = Array.from(document.querySelectorAll('span'));
                        const target = spans.find(el =>
                            terms.some(term => el.textContent.toLowerCase().includes(term))
                        );
                        if (target) target.click();
                    }, meetupTerms);
                    await humanDelay(500, 1000);
                } catch (_) { log.warn('Could not find Public meetup toggle', { platform: 'FB' }); }

                // Step 9: Finalize / Publish + Verification
                await retryStep(async () => {
                    log.info('Finalizing FB listing', { platform: 'FB' });
                    const nextBtn = await trySelectors(page, FB_SELECTORS.nextButton, 5000);
                    if (nextBtn) { await humanClick(page, nextBtn); await humanDelay(1500, 3000); }

                    const publishBtn = await trySelectors(page, FB_SELECTORS.publishButton, 10000);
                    if (!publishBtn) {
                        await captureScreenshot('FB_no_publish_btn', page);
                        throw new Error('Publish button not found — listing was not posted');
                    }

                    // DRY RUN: stop before clicking Publish
                    if (DRY_RUN) {
                        await captureScreenshot('FB_dry_run_ready', page);
                        log.info('DRY RUN — stopping before FB publish click', { platform: 'FB' });
                        await updateListing({ 'progress.facebook': 'success' });
                        return 'dry_run';
                    }

                    await humanClick(page, publishBtn);
                    await humanDelay(2000, 4000);
                    log.info('Clicked Publish', { platform: 'FB' });

                    // Verify publish succeeded
                    const publishResult = await page.waitForFunction(() => {
                        const body = document.body.innerText.toLowerCase();
                        if (body.includes('your listing is published') ||
                            body.includes('listed on marketplace') ||
                            body.includes('your item is listed') ||
                            body.includes('you\'re all set')) {
                            return { success: true };
                        }
                        // Check if URL changed to marketplace (another success signal)
                        if (window.location.href.includes('/marketplace/') && !window.location.href.includes('/create/')) {
                            return { success: true };
                        }
                        const alerts = document.querySelectorAll('[role="alert"]');
                        for (const alert of alerts) {
                            const text = alert.textContent.trim();
                            if (text.length > 5) return { success: false, error: text.slice(0, 300) };
                        }
                        return null; // keep waiting
                    }, { timeout: 30000 }).catch(() => null);

                    if (publishResult) {
                        const result = await publishResult.jsonValue();
                        if (result && result.success) {
                            log.info('Listing confirmed published', { platform: 'FB' });
                        } else if (result && !result.success) {
                            throw new Error(`FB publish failed: ${result.error}`);
                        }
                    } else {
                        await captureScreenshot('FB_publish_uncertain', page);
                        log.warn('Publish verification timed out — could not confirm listing was posted', { platform: 'FB' });
                        throw new Error('Could not verify listing was published — check FB manually');
                    }
                }, { maxRetries: 2, stepName: 'fb_finalize', page, captureScreenshot, log });

                await recordPost(db, 'facebook', WORKER_ID);
                await recordPosting(db, publicTitle, 'facebook', docId);
                await updateListing({ 'progress.facebook': 'success' });
                log.info('FB automation complete');
                return 'success';
            } catch (e) {
                const screenshotPath = await captureScreenshot('FB_error', page);
                await updateListing({ 'progress.facebook': 'error', lastError: { platform: 'FB', message: e.message || String(e), screenshotPath } });
                log.error('FB automation failed', { error: e.message, screenshotPath });
                return 'error';
            }
        };

        // ============================
        // EBAY — API (unchanged)
        // ============================
        const runEbay = async () => {
            if (!shouldRunEbay) return { status: 'skipped' };
            await updateListing({ 'progress.ebay': 'running', 'ebay.enabled': true, 'ebay.status': 'running', 'ebay.error': null, 'ebay.lastRunAt': admin.firestore.FieldValue.serverTimestamp() });
            try {
                const ebayResult = await runEbayListing({ inventoryId: docId, item, publicTitle, publicDescription, db, admin });
                if (!ebayResult.ok) {
                    await updateListing({ 'progress.ebay': 'error', 'ebay.status': 'failed', 'ebay.error': { message: ebayResult.message || 'eBay listing failed', code: ebayResult.code || null, raw: ebayResult.rawError || null }, lastError: { platform: 'EBAY', message: ebayResult.message || 'eBay listing failed', screenshotPath: '' } });
                    return { status: 'error', error: ebayResult };
                }
                const ebayStatus = ebayResult.status === 'published' ? 'published' : 'ready_to_publish';
                const ebayUpdate = { 'progress.ebay': 'success', 'ebay.enabled': true, 'ebay.marketplaceId': ebayResult.marketplaceId || null, 'ebay.sku': ebayResult.sku || null, 'ebay.offerId': ebayResult.offerId || null, 'ebay.listingId': ebayResult.listingId || null, 'ebay.inventoryItemId': ebayResult.inventoryItemId || null, 'ebay.status': ebayStatus, 'ebay.error': null, 'ebay.merchantLocationKey': ebayResult.merchantLocationKey || null, 'ebay.paymentPolicyId': ebayResult.paymentPolicyId || null, 'ebay.fulfillmentPolicyId': ebayResult.fulfillmentPolicyId || null, 'ebay.returnPolicyId': ebayResult.returnPolicyId || null, 'ebay.lastRunAt': admin.firestore.FieldValue.serverTimestamp() };
                if (ebayStatus === 'published') ebayUpdate['ebay.publishedAt'] = admin.firestore.FieldValue.serverTimestamp();
                await updateListing(ebayUpdate);
                return { status: 'success', result: ebayResult };
            } catch (error) {
                const message = error.message || String(error);
                await updateListing({ 'progress.ebay': 'error', 'ebay.status': 'failed', 'ebay.error': { message, code: null, raw: null }, lastError: { platform: 'EBAY', message, screenshotPath: '' } });
                return { status: 'error', error: { message } };
            }
        };

        // ============================
        // RUN ALL PLATFORMS IN PARALLEL
        // ============================
        let focusTicker = null;
        if (pageCL && pageFB) {
            let focusIndex = 0;
            focusTicker = setInterval(() => {
                const target = focusIndex % 2 === 0 ? pageCL : pageFB;
                focusIndex++;
                if (target) target.bringToFront().catch(() => {});
            }, 1500);
        }

        let craigslistResult = 'skipped';
        let facebookResult = 'skipped';
        let ebayResult = { status: 'skipped' };
        try {
            [craigslistResult, facebookResult, ebayResult] = await Promise.all([
                runCraigslist(pageCL),
                runFacebook(pageFB),
                runEbay()
            ]);
        } finally { if (focusTicker) clearInterval(focusTicker); }

        const hadError = [craigslistResult, facebookResult].includes('error') || ebayResult.status === 'error';
        await updateListing({ status: hadError ? 'Error' : 'Active', finishedAt: admin.firestore.FieldValue.serverTimestamp() });
        log.info('Job complete', { success: !hadError, craigslist: craigslistResult, facebook: facebookResult, ebay: ebayResult.status });

        return {
            success: !hadError,
            lastError: hadError ? { message: 'Automation failed', platform: 'JOB', screenshotPath: '' } : null,
            screenshots,
            results: {
                craigslist: craigslistResult,
                facebook: facebookResult,
                ebay: ebayResult.status === 'success' ? { ok: true, offerId: ebayResult.result.offerId || null, listingId: ebayResult.result.listingId || null } :
                       ebayResult.status === 'error' ? { ok: false, error: ebayResult.error || null } : { ok: true, skipped: true }
            }
        };
    } finally {
        if (browser) { try { await browser.close(); } catch (e) { log.warn('Failed to close browser', { error: e.message }); } openBrowsers.delete(browser); }
        await proxyCleanup();
        cleanupJobFiles(docId);
    }
}

module.exports = { runListingAutomation, getOpenBrowsers, closeAllProxies };
