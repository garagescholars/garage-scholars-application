import { Timestamp } from "firebase/firestore";

// ── Roles & Enums ──

export type Role = "admin" | "scholar" | "customer";
export type UserStatus = "active" | "disabled" | "pending";
export type ScholarTier = "new" | "standard" | "elite" | "top_hustler";
export type UrgencyLevel = "standard" | "rush" | "same_day";

export type JobStatus =
  | "LEAD"
  | "INTAKE_SUBMITTED"
  | "SOP_NEEDS_REVIEW"
  | "APPROVED_FOR_POSTING"
  | "UPCOMING"
  | "IN_PROGRESS"
  | "REVIEW_PENDING"
  | "COMPLETED"
  | "CANCELLED"
  | "DISPUTED"
  | "REOPENED";

// ── Profiles (gs_profiles) ──

export type GsProfile = {
  uid: string;
  role: Role;
  fullName: string;
  phone: string;
  email: string;
  avatarUrl?: string;
  pushToken?: string;
  isActive: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

// ── Scholar Profiles (gs_scholarProfiles) ──

export type GsScholarProfile = {
  scholarId: string;
  scholarName: string;
  monthlyJobGoal: number;
  monthlyMoneyGoal: number;
  totalJobsCompleted: number;
  totalEarnings: number;
  payScore: number;
  cancellationRate: number;
  acceptanceRate: number;
  tier: ScholarTier;
  showOnLeaderboard: boolean;
  onboardingComplete?: boolean;
  // Payment fields
  stripeAccountId?: string;
  stripeOnboardingComplete?: boolean;
  bankLinked?: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

// Backward-compatible merged profile used by useAuth
export type UserProfile = {
  uid: string;
  email: string;
  name: string;
  role: Role;
  status: UserStatus;
  phoneNumber?: string;
  avatarUrl?: string;
  pushToken?: string;
  // Scholar-specific (from gs_scholarProfiles)
  monthlyJobGoal?: number;
  monthlyMoneyGoal?: number;
  payScore?: number;
  tier?: ScholarTier;
  totalJobsCompleted?: number;
  totalEarnings?: number;
  cancellationRate?: number;
  acceptanceRate?: number;
  showOnLeaderboard?: boolean;
  onboardingComplete?: boolean;
};

// ── Jobs (gs_jobs) ──

export type GsJob = {
  id: string;
  title: string;
  description?: string;
  address: string;
  lat?: number;
  lng?: number;

  // Scheduling
  scheduledDate: string;
  scheduledTimeStart: string;
  scheduledTimeEnd?: string;

  // Pricing
  payout: number;
  urgencyLevel: UrgencyLevel;
  rushBonus: number;

  // Status
  status: JobStatus;

  // Social proof
  currentViewers: number;
  viewerFloor: number;
  totalViews: number;

  // Assignments
  claimedBy?: string | null;
  claimedByName?: string | null;
  claimedAt?: Timestamp | null;

  // Client / Customer
  clientName?: string;
  customerId?: string | null;
  customerName?: string;
  customerPhone?: string;
  customerNotes?: string;

  // Reopened tracking
  reopenedAt?: Timestamp | null;
  reopenCount: number;

  // SOP / checklist
  sopContent?: string;
  checklist?: ChecklistItem[];

  // Payment tracking
  firstPayoutId?: string;
  secondPayoutId?: string;
  paymentStatus?: "unpaid" | "first_paid" | "held" | "fully_paid";

  // Phase X: Client intake & SOP fields
  clientEmail?: string;
  clientPhone?: string;
  estimatedHours?: number;
  clientPrice?: number;
  accessConstraints?: string;
  resaleConcierge?: boolean;
  donationOptIn?: boolean;
  productSelections?: Record<string, any>;
  package?: string;
  packageTier?: string;
  generatedSOP?: string;
  sopApprovedBy?: string;
  sopApprovedAt?: string;
  inventoryExtracted?: boolean;
  extractedItemIds?: string[];
  intakeImageUrls?: string[];

  // Checkout completion tracking
  resaleStatus?: "pending" | "captured" | "not_applicable";
  donationStatus?: "pending" | "captured" | "receipt_uploaded" | "not_applicable";
  gymInstallStatus?: "pending" | "captured" | "not_applicable";

  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

// Keep backward-compat alias
export type ServiceJob = GsJob;

export type ChecklistItem = {
  id: string;
  text: string;
  completed: boolean;
  approvalStatus?: "pending" | "approved" | "rejected";
};

// ── Recent Claims (gs_recentClaims) ──

export type GsRecentClaim = {
  id: string;
  jobId: string;
  jobTitle: string;
  scholarName: string;
  payout: number;
  claimedAt: Timestamp;
};

// ── Job Checkins (gs_jobCheckins) ──

export type GsJobCheckin = {
  id: string;
  jobId: string;
  scholarId: string;

  // Check-in
  checkinTime?: Timestamp | null;
  checkinVideoUrl?: string;
  checkinLat?: number;
  checkinLng?: number;
  checkinGeofenceValid: boolean;
  freightReceiptUrl?: string;

  // Check-out
  checkoutTime?: Timestamp | null;
  checkoutVideoUrl?: string;
  checkoutLat?: number;
  checkoutLng?: number;

  // Photos
  beforePhotos: string[];
  afterPhotos: string[];

  createdAt?: Timestamp;
};

// ── Quality Scores (gs_jobQualityScores) ──

export type JobQualityScore = {
  id: string;
  jobId: string;
  scholarId: string;
  photoQualityScore: number;
  completionScore: number;
  timelinessScore: number;
  complaintWindowEnd?: Timestamp;
  customerComplaint: boolean;
  complaintDetails?: string;
  complaintPhotos?: string[];
  finalScore?: number | null;
  scoreLocked: boolean;
  scoreLockedAt?: Timestamp | null;
  createdAt?: Timestamp;
};

// ── Scholar Goals (gs_scholarGoals) ──

export type ScholarGoal = {
  id: string;
  scholarId: string;
  month: number;
  year: number;
  goalType: "jobs" | "money";
  goalTarget: number;
  currentProgress: number;
  goalMet: boolean;
  notifiedAt90: boolean;
  notifiedAt100: boolean;
  createdAt?: Timestamp;
};

// ── Scholar Achievements (gs_scholarAchievements) ──

export type ScholarAchievement = {
  id: string;
  scholarId: string;
  achievementType: string;
  title: string;
  description?: string;
  month?: number;
  year?: number;
  createdAt?: Timestamp;
};

// ── Job Transfers (gs_jobTransfers) ──

export type JobTransfer = {
  id: string;
  jobId: string;
  jobTitle?: string;
  fromScholarId: string;
  fromScholarName?: string;
  toScholarId?: string | null;
  toScholarName?: string | null;
  reason?: string;
  transferType: "direct" | "requeue";
  status: "pending" | "accepted" | "declined" | "expired";
  expiresAt?: Timestamp;
  createdAt?: Timestamp;
};

// ── Job Reschedules (gs_jobReschedules) ──

export type JobReschedule = {
  id: string;
  jobId: string;
  jobTitle?: string;
  requestedBy: string;
  requestedByName?: string;
  requesterRole: "scholar" | "customer" | "admin";
  originalDate: string;
  originalTimeStart: string;
  newDate: string;
  newTimeStart: string;
  newTimeEnd?: string;
  status: "pending" | "approved" | "declined";
  approvedBy?: string | null;
  approvedAt?: Timestamp | null;
  createdAt?: Timestamp;
};

// ── Scholar Analytics (gs_scholarAnalytics) ──

export type GsScholarAnalytics = {
  scholarId: string;
  scholarName: string;
  jobsThisMonth: number;
  earningsThisMonth: number;
  avgPayScoreThisMonth: number;
  jobsLast30Days: number;
  jobsLast90Days: number;
  earningsLast30Days: number;
  earningsLast90Days: number;
  avgClaimResponseMinutes: number;
  cancellationsThisMonth: number;
  reschedulesThisMonth: number;
  jobsTrend: "increasing" | "stable" | "declining";
  earningsTrend: "increasing" | "stable" | "declining";
  totalJobsAllTime: number;
  totalEarningsAllTime: number;
  memberSince?: Timestamp;
  lastUpdated?: Timestamp;
};

// ── Payouts (gs_payouts) ──

export type PayoutSplitType = "checkin_50" | "completion_50" | "resale" | "full";
export type PayoutStatus = "pending" | "processing" | "paid" | "failed" | "held";
export type PayoutMethod = "stripe_ach" | "manual_zelle" | "manual_venmo" | "manual_cash" | "manual_check";

export type GsPayout = {
  id: string;
  jobId: string;
  scholarId?: string;
  customerId?: string;
  recipientName?: string;
  amount: number;
  splitType: PayoutSplitType;
  status: PayoutStatus;
  stripeTransferId?: string;
  paymentMethod: PayoutMethod;
  releaseEligibleAt?: Timestamp;
  qualityScoreAtRelease?: number;
  complaintWindowPassed: boolean;
  holdReason?: string;
  taxYear: number;
  notes?: string;
  createdAt?: Timestamp;
  paidAt?: Timestamp;
};

/** @deprecated Use GsPayout instead */
export type Payout = GsPayout;

// ── Customer Payments (gs_customerPayments) ──

export type CustomerPaymentType = "package" | "one_off" | "retention_monthly";
export type CustomerPaymentMethod = "ach" | "card";
export type CustomerPaymentStatus = "pending" | "processing" | "succeeded" | "failed" | "refunded";

export type GsCustomerPayment = {
  id: string;
  customerId: string;
  customerName: string;
  jobId?: string;
  amount: number;
  type: CustomerPaymentType;
  stripePaymentIntentId?: string;
  stripeSubscriptionId?: string;
  paymentMethod: CustomerPaymentMethod;
  convenienceFee: number;
  totalCharged: number;
  status: CustomerPaymentStatus;
  description?: string;
  createdAt?: Timestamp;
  paidAt?: Timestamp;
};

// ── Payment Periods (gs_paymentPeriods) ──

export type PaymentPeriodStatus = "open" | "closed" | "reported";

export type ScholarPeriodBreakdown = {
  scholarId: string;
  scholarName: string;
  jobCount: number;
  totalPaid: number;
  payoutIds: string[];
};

export type GsPaymentPeriod = {
  id: string;
  periodType: "biweekly";
  startDate: string;
  endDate: string;
  totalPayouts: number;
  totalAmount: number;
  scholarBreakdowns: ScholarPeriodBreakdown[];
  cpaReportSentAt?: Timestamp;
  status: PaymentPeriodStatus;
  createdAt?: Timestamp;
};

// ── Stripe Accounts (gs_stripeAccounts) ──

export type StripeAccountType = "scholar" | "resale_customer";

export type GsStripeAccount = {
  id: string;
  userId: string;
  stripeAccountId: string;
  accountType: StripeAccountType;
  onboardingComplete: boolean;
  payoutsEnabled: boolean;
  bankLast4?: string;
  taxIdProvided: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

// ── Platform Config (gs_platformConfig/payments) ──

export type GsPaymentConfig = {
  stripeEnabled: boolean;
  checkinSplitPercent: number;
  completionSplitPercent: number;
  paymentReleaseWindowHours: number;
  minimumScoreForRelease: number;
  cpaEmail: string;
  cpaAutoEmailEnabled: boolean;
  cpaReportFrequency: "biweekly";
  convenienceFeePercent: number;
  achPreferred: boolean;
};

// ── SOP Types ──

export type SopSection = {
  title: string;
  body: string;
};

export type SopSectionStep = {
  id: string;
  text: string;
  isCompleted: boolean;
  status: "pending" | "approved" | "rejected";
};

export type SopRequiredPhoto = {
  id: string;
  label: string;
  phase: string;
};

// ── Client (Phase X) ──

export type Client = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  stats?: {
    totalRevenue: number;
    totalJobs: number;
  };
  createdAt?: Timestamp;
};

// ── Property (Phase X) ──

export type Property = {
  id: string;
  clientId: string;
  address: string;
  type?: string;
  notes?: string;
  createdAt?: Timestamp;
};

// ── Inventory Item ──

export type InventoryItem = {
  id: string;
  title: string;
  description?: string;
  price: number;
  condition: "new" | "used";
  platform: string;
  status: "Pending" | "Active" | "Sold" | "Removed";
  imageUrls: string[];
  clientId?: string;
  clientName?: string;
  propertyId?: string;
  sourceServiceJobId?: string;
  dateListed?: string;
  lastUpdated?: Timestamp;
  createdAt?: Timestamp;
};

// ── Signup Request ──

export type SignupRequest = {
  id: string;
  fullName: string;
  email: string;
  role: "scholar" | "customer";
  status: "pending" | "approved" | "declined";
  createdAt?: Timestamp;
};

// ── Admin Notification ──

export type AdminNotification = {
  id: string;
  title: string;
  message: string;
  type: string;
  unread: boolean;
  createdAt?: Timestamp;
};

// ── Escalation System ──

export type EscalationStatus = "open" | "resolved";

export type EscalationResponse = {
  id: string;
  authorId: string;
  authorName: string;
  authorRole: "scholar" | "admin";
  text: string;
  createdAt?: Timestamp;
};

export type GsEscalation = {
  id: string;
  jobId: string;
  jobTitle: string;
  scholarId: string;
  scholarName: string;
  status: EscalationStatus;
  description: string;
  attemptedSolutions: string;
  equipmentId?: string;
  equipmentName?: string;
  photoUrls: string[];
  responses: EscalationResponse[];
  resolvedBy?: string;
  resolvedByName?: string;
  resolvedAt?: Timestamp;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

// ── Pre-Job Video Homework ──

export type VideoConfirmation = {
  equipmentId: string;
  equipmentName: string;
  manualUrl: string;
  confirmedAt: Timestamp | null;
};

export type GsJobPrep = {
  id: string;
  jobId: string;
  scholarId: string;
  scholarName: string;
  videoConfirmations: VideoConfirmation[];
  allConfirmed: boolean;
  reminder48hSent: boolean;
  reminder24hSent: boolean;
  reminder2hSent: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

// ── Activity Feed (gs_activityFeed) ──

export type ActivityFeedType = "claim" | "goal_met" | "achievement" | "milestone";

export type GsActivityFeedItem = {
  id: string;
  type: ActivityFeedType;
  scholarName: string;
  message: string;
  icon?: string;
  accentColor?: string;
  createdAt?: Timestamp;
};

// ── Social Media Content Queue (gs_socialContentQueue) ──

export type SocialContentStatus = "pending" | "processing" | "posted" | "failed" | "permanently_failed";

export type SocialContentType = "before_after" | "resale" | "donation" | "gym_install";

export type GsSocialContentItem = {
  id: string;
  jobId: string;
  scholarId: string;
  jobTitle: string;
  address: string;
  packageTier: string;
  beforePhotoUrl: string;
  afterPhotoUrl: string;
  contentType?: SocialContentType;
  itemName?: string;
  itemPhotos?: string[];
  status: SocialContentStatus;
  compositeUrl?: string;
  caption?: string;
  fbPostId?: string;
  igPostId?: string;
  error?: string;
  retryCount?: number;
  createdAt?: Timestamp;
  postedAt?: Timestamp;
  failedAt?: Timestamp;
};

// ── Google Review Campaign (gs_reviewCampaigns) ──

export type GsReviewCampaign = {
  id: string;
  jobId: string;
  jobTitle: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  completedAt?: Timestamp;
  day3Sent: boolean;
  day3SentAt?: Timestamp;
  day5Sent: boolean;
  day5SentAt?: Timestamp;
  templateIndex: number;
};

// ── Resale & Donation Items (gs_resale_donation_items) ──

export type ItemCondition = "like_new" | "good" | "fair" | "poor";
export type ResaleDonationStatus = "photos_taken" | "ai_analyzed" | "worker_confirmed" | "listed" | "sold" | "donated";

export type GsResaleDonationItem = {
  id: string;
  jobId: string;
  type: "resale" | "donation";
  photos: Record<string, string>; // key = angle name, value = Storage URL
  aiSuggestion?: {
    name: string;
    description: string;
    condition: ItemCondition;
    estimatedPrice?: number;
    category: string;
  };
  workerConfirmed?: {
    name: string;
    description: string;
    condition: string;
    estimatedPrice?: number;
    confirmedAt: Timestamp;
  };
  status: ResaleDonationStatus;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

// ── Donation Receipts (gs_donation_receipts) ──

export type GsDonationReceipt = {
  id: string;
  jobId: string;
  donationCenter: string;
  receiptPhotoUrl: string;
  itemIds: string[];
  emailSentTo: string[];
  uploadedAt?: Timestamp;
  uploadedBy: string;
};

// ── Consultation Mockups (gs_consultations) ──

export type ConsultationServiceType = "garage_org" | "gym_install";
export type ConsultationStatus = "draft" | "photos_captured" | "generating" | "ready" | "shared";
export type MockupStatus = "idle" | "generating" | "ready" | "failed";

export type MockupShade = {
  status: MockupStatus;
  imageUrl: string | null;
  bmCode: string;   // e.g. "HC-169"
  bmName: string;   // e.g. "Coventry Gray"
  hex: string;      // e.g. "#A7A9A5"
};

// Legacy type for backward compatibility with old tier-based consultations
export type MockupTier = {
  status: MockupStatus;
  imageUrl: string | null;
  kontextStatus?: MockupStatus;
  kontextUrl?: string | null;
  flux2Status?: MockupStatus;
  flux2Url?: string | null;
};

// Space context types
export type GarageSize = "1-car" | "2-car" | "3-car" | "oversized";
export type CeilingHeight = "8ft" | "9ft" | "10ft+" | "open-joists";
export type CurrentState = "empty" | "cluttered" | "partial-storage" | "cars-parked";
export type StylePreference = "clean-modern" | "workshop" | "minimalist";

// Garage addon option types
export type ShelvingOption = "none" | "1-unit" | "2-units" | "3-units";
export type OverheadOption = "none" | "2-racks" | "4-racks";
export type CabinetOption = "none" | "basic-wire" | "premium-newage";
export type WallOrgOption = "none" | "pegboard" | "slatwall";
export type GarageFlooringType = "none" | "polyaspartic" | "click-in-plate";
export type BikeRackOption = "none" | "wall-2" | "wall-4";

// Shade key for consultation mockups
export type ShadeKey = "shade1" | "shade2" | "shade3";

// Gym addon option types
export type GymFlooringType = "none" | "stall-mats" | "rubber-tiles";
export type RackOption = "none" | "wall-mount" | "half-rack" | "full-power-cage";
export type BenchOption = "none" | "flat" | "adjustable-fid";
export type CableOption = "none" | "single-stack" | "functional-trainer" | "crossover";
export type GymAccessory = "mirrors" | "pull-up-rig" | "dumbbell-rack" | "kettlebells";

// Benjamin Moore color reference (stored on Firestore doc)
export type BMColorRef = { code: string; name: string } | null;

export type GsConsultation = {
  id: string;
  clientName: string;
  clientEmail: string | null;
  clientPhone: string | null;
  address: string;
  createdBy: string;
  createdAt?: Timestamp;
  jobId: string | null;

  serviceType: ConsultationServiceType;

  // Space context (for smarter AI prompts)
  garageSize?: GarageSize;
  ceilingHeight?: CeilingHeight;
  currentState?: CurrentState[];
  itemsToPreserve?: string;
  stylePreference?: StylePreference;
  dreamDescription?: string;

  spacePhotoUrls: {
    wide: string;
    left?: string;
    right?: string;
    floor?: string;
  };

  garageAddons: {
    shelving: ShelvingOption;
    overheadStorage: OverheadOption;
    cabinets: CabinetOption;
    wallOrg: WallOrgOption;
    flooringType: GarageFlooringType;
    flooringColor: BMColorRef;
    bikeRack: BikeRackOption;
  };

  gymAddons: {
    flooringType: GymFlooringType;
    flooringColor: BMColorRef;
    rackSystem: RackOption;
    bench: BenchOption;
    cableMachine: CableOption;
    accessories: GymAccessory[];
  };

  mockups: {
    shade1: MockupShade;
    shade2: MockupShade;
    shade3: MockupShade;
  };

  status: ConsultationStatus;
  updatedAt?: Timestamp;
};

// ── Gym Installation Photos (gs_gym_install_photos) ──

export type GsGymInstallPhotos = {
  id: string;
  jobId: string;
  photos: string[];
  equipmentInstalled: string[];
  notes?: string;
  capturedAt?: Timestamp;
  capturedBy: string;
};
