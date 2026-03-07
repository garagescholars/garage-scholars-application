"use strict";
/**
 * Garage Scholars Mobile App — Server-Side Constants
 * Mirror of mobile/src/constants/collections.ts for Cloud Functions
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CLIENT_BALANCE_PERCENT = exports.CLIENT_DEPOSIT_PERCENT = exports.CONVENIENCE_FEE_PERCENT = exports.PAY_PERIOD_BOUNDARIES = exports.TAX_1099_THRESHOLD = exports.COMPLETION_SPLIT_PERCENT = exports.CHECKIN_SPLIT_PERCENT = exports.MINIMUM_SCORE_FOR_PAYMENT = exports.PAYMENT_RELEASE_HOURS = exports.MAX_RECENT_CLAIMS = exports.TIER_THRESHOLDS = exports.TRANSFER_EXPIRY_MINUTES = exports.SCORE_LOCK_HOURS = exports.SCORING_WEIGHTS = exports.GS_COLLECTIONS = void 0;
exports.GS_COLLECTIONS = {
    PROFILES: "gs_profiles",
    SCHOLAR_PROFILES: "gs_scholarProfiles",
    JOBS: "gs_jobs",
    RECENT_CLAIMS: "gs_recentClaims",
    JOB_CHECKINS: "gs_jobCheckins",
    JOB_QUALITY_SCORES: "gs_jobQualityScores",
    SCHOLAR_GOALS: "gs_scholarGoals",
    SCHOLAR_ACHIEVEMENTS: "gs_scholarAchievements",
    JOB_TRANSFERS: "gs_jobTransfers",
    JOB_RESCHEDULES: "gs_jobReschedules",
    SCHOLAR_ANALYTICS: "gs_scholarAnalytics",
    // Payment collections
    PAYOUTS: "gs_payouts",
    CUSTOMER_PAYMENTS: "gs_customerPayments",
    PAYMENT_PERIODS: "gs_paymentPeriods",
    STRIPE_ACCOUNTS: "gs_stripeAccounts",
    PLATFORM_CONFIG: "gs_platformConfig",
    // Escalation & prep collections
    ESCALATIONS: "gs_escalations",
    JOB_PREP: "gs_jobPrep",
    // Activity feed
    ACTIVITY_FEED: "gs_activityFeed",
    // Social media & review campaigns
    SOCIAL_CONTENT_QUEUE: "gs_socialContentQueue",
    REVIEW_CAMPAIGNS: "gs_reviewCampaigns",
    // Inventory & donation collections
    RESALE_DONATION_ITEMS: "gs_resaleDonationItems",
    GYM_INSTALL_PHOTOS: "gs_gymInstallPhotos",
    DONATION_RECEIPTS: "gs_donationReceipts",
    // Hiring pipeline collections
    HIRING_APPLICANTS: "gs_hiringApplicants",
    HIRING_VIDEO_COMPLETIONS: "gs_hiringVideoCompletions",
    HIRING_INTERVIEW_SCORES: "gs_hiringInterviewScores",
    HIRING_VIDEO_TOKENS: "gs_hiringVideoTokens",
};
/** Quality score weights — must total 1.0 */
exports.SCORING_WEIGHTS = {
    PHOTO_QUALITY: 0.4,
    COMPLETION: 0.3,
    TIMELINESS: 0.3,
};
/** Score lock window in hours */
exports.SCORE_LOCK_HOURS = 48;
/** Direct transfer expiry in minutes */
exports.TRANSFER_EXPIRY_MINUTES = 15;
/** Scholar tier thresholds (payScore) */
exports.TIER_THRESHOLDS = {
    new: 0,
    standard: 2.5,
    elite: 3.5,
    top_hustler: 4.5,
};
/** Max recent claims to keep */
exports.MAX_RECENT_CLAIMS = 50;
// ── Payment Constants ──
/** Hours after checkout before second payout is released */
exports.PAYMENT_RELEASE_HOURS = 72;
/** Minimum quality score to auto-release completion payout */
exports.MINIMUM_SCORE_FOR_PAYMENT = 2.0;
/** First split percentage (paid on check-in) */
exports.CHECKIN_SPLIT_PERCENT = 50;
/** Second split percentage (paid after quality window) */
exports.COMPLETION_SPLIT_PERCENT = 50;
/** 1099-NEC filing threshold */
exports.TAX_1099_THRESHOLD = 600;
/** Days of month when biweekly pay periods start */
exports.PAY_PERIOD_BOUNDARIES = [1, 16];
/** Convenience fee percentage for card payments */
exports.CONVENIENCE_FEE_PERCENT = 3.0;
// ── Client Split Payment Constants ──
/** Client deposit percentage (paid upfront after sale) */
exports.CLIENT_DEPOSIT_PERCENT = 50;
/** Client balance percentage (invoiced after job completion) */
exports.CLIENT_BALANCE_PERCENT = 50;
