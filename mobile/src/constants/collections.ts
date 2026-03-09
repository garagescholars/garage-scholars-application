// Single source of truth for all Firestore collection names.
// All collections prefixed with gs_ to namespace within the shared Firebase project.
export const COLLECTIONS = {
  PROFILES: 'gs_profiles',
  SCHOLAR_PROFILES: 'gs_scholarProfiles',
  JOBS: 'gs_jobs',
  RECENT_CLAIMS: 'gs_recentClaims',
  JOB_CHECKINS: 'gs_jobCheckins',
  JOB_QUALITY_SCORES: 'gs_jobQualityScores',
  SCHOLAR_GOALS: 'gs_scholarGoals',
  SCHOLAR_ACHIEVEMENTS: 'gs_scholarAchievements',
  JOB_TRANSFERS: 'gs_jobTransfers',
  JOB_RESCHEDULES: 'gs_jobReschedules',
  SCHOLAR_ANALYTICS: 'gs_scholarAnalytics',
  // Payment collections
  PAYOUTS: 'gs_payouts',
  CUSTOMER_PAYMENTS: 'gs_customerPayments',
  PAYMENT_PERIODS: 'gs_paymentPeriods',
  STRIPE_ACCOUNTS: 'gs_stripeAccounts',
  PLATFORM_CONFIG: 'gs_platformConfig',
  // Web admin collections
  SIGNUP_REQUESTS: 'signupRequests',
  ADMIN_NOTIFICATIONS: 'adminNotifications',
  INVENTORY: 'inventory',
  CLIENTS: 'clients',
  PROPERTIES: 'properties',
  // Escalation & prep collections
  ESCALATIONS: 'gs_escalations',
  JOB_PREP: 'gs_jobPrep',
  // Activity feed
  ACTIVITY_FEED: 'gs_activityFeed',
  // Social media & review campaigns
  SOCIAL_CONTENT_QUEUE: 'gs_socialContentQueue',
  REVIEW_CAMPAIGNS: 'gs_reviewCampaigns',
  // Resale, donation & gym install
  RESALE_DONATION_ITEMS: 'gs_resale_donation_items',
  DONATION_RECEIPTS: 'gs_donation_receipts',
  GYM_INSTALL_PHOTOS: 'gs_gym_install_photos',
  // Consultation mockups
  CONSULTATIONS: 'gs_consultations',
} as const;
