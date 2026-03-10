/**
 * Garage Scholars Mobile App — Server-Side Constants
 * Mirror of mobile/src/constants/collections.ts for Cloud Functions
 */

export const GS_COLLECTIONS = {
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
  // Consultation mockups
  CONSULTATIONS: "gs_consultations",
} as const;

/** Quality score weights — must total 1.0 */
export const SCORING_WEIGHTS = {
  PHOTO_QUALITY: 0.4,
  COMPLETION: 0.3,
  TIMELINESS: 0.3,
} as const;

/** Score lock window in hours */
export const SCORE_LOCK_HOURS = 48;

/** Direct transfer expiry in minutes */
export const TRANSFER_EXPIRY_MINUTES = 15;

/** Scholar tier thresholds (payScore) */
export const TIER_THRESHOLDS = {
  new: 0,
  standard: 2.5,
  elite: 3.5,
  top_hustler: 4.5,
} as const;

/** Max recent claims to keep */
export const MAX_RECENT_CLAIMS = 50;

// ── Payment Constants ──

/** Hours after checkout before second payout is released */
export const PAYMENT_RELEASE_HOURS = 72;

/** Minimum quality score to auto-release completion payout */
export const MINIMUM_SCORE_FOR_PAYMENT = 2.0;

/** First split percentage (paid on check-in) */
export const CHECKIN_SPLIT_PERCENT = 50;

/** Second split percentage (paid after quality window) */
export const COMPLETION_SPLIT_PERCENT = 50;

/** 1099-NEC filing threshold */
export const TAX_1099_THRESHOLD = 600;

/** Days of month when biweekly pay periods start */
export const PAY_PERIOD_BOUNDARIES = [1, 16] as const;

/** Convenience fee percentage for card payments */
export const CONVENIENCE_FEE_PERCENT = 3.0;

// ── Package Pricing ──

/** One-time service package prices (in dollars) */
export const GS_PACKAGES = {
  // Garage Organization
  undergraduate: { name: "The Undergraduate", category: "Garage Organization", price: 1197, type: "one_time" as const },
  graduate:      { name: "The Graduate",      category: "Garage Organization", price: 2197, type: "one_time" as const },
  doctorate:     { name: "The Doctorate",     category: "Garage Organization", price: 3797, type: "one_time" as const },
  // Home Gym Installation
  warmup:   { name: "Warm Up",   category: "Home Gym Installation", price: 997,  type: "one_time" as const },
  superset: { name: "Super Set", category: "Home Gym Installation", price: 1997, type: "one_time" as const },
  "1repmax":  { name: "1 Rep Max",  category: "Home Gym Installation", price: 4797, type: "one_time" as const },
  // Combo Bundles
  "deans-list":    { name: "The Dean's List",    category: "Bundle", price: 6497, type: "one_time" as const },
  valedictorian:   { name: "The Valedictorian",  category: "Bundle", price: 7997, type: "one_time" as const },
  // Monthly Memberships
  freshman: { name: "The Freshman", category: "Monthly Membership", price: 97,  type: "recurring" as const },
  scholar:  { name: "The Scholar",  category: "Monthly Membership", price: 197, type: "recurring" as const },
  tenured:  { name: "The Tenured",  category: "Monthly Membership", price: 347, type: "recurring" as const },
} as const;

export type GsPackageKey = keyof typeof GS_PACKAGES;

/**
 * Stripe Price IDs — populated after running scripts/create-stripe-products.js
 * One-time packages use payment_intent flow; memberships use subscription flow.
 */
export const STRIPE_PRICE_IDS: Record<GsPackageKey, string> = {
  undergraduate: "price_1T8qOn4KuxCafVYJG7rXPu1D",
  graduate:      "price_1T8qOo4KuxCafVYJr8IGqYOB",
  doctorate:     "price_1T8qOo4KuxCafVYJeIoyPKc3",
  warmup:        "price_1T8qOp4KuxCafVYJrMVN9xSE",
  superset:      "price_1T8qOp4KuxCafVYJhakLcN3f",
  "1repmax":     "price_1T8qOq4KuxCafVYJcARQAkmQ",
  "deans-list":  "price_1T8qOq4KuxCafVYJBAknkwxG",
  valedictorian: "price_1T8qOq4KuxCafVYJY5EmxS0b",
  freshman:      "price_1T8qOr4KuxCafVYJE9AUQCfP",
  scholar:       "price_1T8qOr4KuxCafVYJECDBWQDI",
  tenured:       "price_1T8qOs4KuxCafVYJOyDUruPH",
};

// ── Client Split Payment Constants ──

/** Client deposit percentage (paid upfront after sale) */
export const CLIENT_DEPOSIT_PERCENT = 50;

/** Client balance percentage (invoiced after job completion) */
export const CLIENT_BALANCE_PERCENT = 50;
