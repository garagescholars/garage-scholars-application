
export enum JobStatus {
  LEAD = 'LEAD',
  UPCOMING = 'UPCOMING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  REVIEW_PENDING = 'REVIEW_PENDING',
  CANCELLED = 'CANCELLED',
  INTAKE_SUBMITTED = 'INTAKE_SUBMITTED',
  SOP_NEEDS_REVIEW = 'SOP_NEEDS_REVIEW',
  APPROVED_FOR_POSTING = 'APPROVED_FOR_POSTING'
}

export type UserRole = 'scholar' | 'admin';

export interface Task {
  id: string;
  text: string;
  isCompleted: boolean;
  status?: 'APPROVED' | 'PENDING'; // Default is APPROVED if undefined
  addedBy?: UserRole;
  actionTimestamp?: string; // ISO String when admin approved/rejected or employee added
}

export interface User {
  id: string;
  name: string;
  role: UserRole;
  monthlyGoal: number; // Represents Currency Target (e.g. 3000 for $3000)
  avatarInitials: string;
  achievedMilestones: number[]; // Tracks percentages hit: [80, 90, 100]
  phoneNumber?: string; // For SMS Alerts
}

export interface Job {
  id: string;
  clientName: string;
  address: string;
  date: string; // ISO String
  scheduledEndTime: string; // ISO String - Expected completion time
  pay: number;
  description: string;
  status: JobStatus;
  locationLat: number;
  locationLng: number;
  checkInTime?: string;
  checkOutTime?: string;
  checkInMedia?: JobMedia;
  checkOutMedia?: JobMedia;
  qualityReport?: string;
  checklist: Task[];
  assigneeId?: string; // 'user-1' is the current logged in user
  assigneeName?: string;
  cancellationReason?: string;
  sopId?: string;
  intakeMediaPaths?: string[];
  // SOP generation fields
  generatedSOP?: string;        // Final approved SOP text (markdown)
  sopApprovedBy?: string;       // UID of admin who approved
  sopApprovedAt?: string;       // ISO timestamp
  packageTier?: string;         // 'undergraduate' | 'graduate' | 'doctorate'
  shelvingSelections?: string;  // Shelving choices description
  addOns?: string;              // Comma-separated add-on list
  // Lead/Quote specific fields
  clientEmail?: string;
  clientPhone?: string;
  zipcode?: string;
  serviceType?: string;
  package?: string;
  garageSize?: string;
  quoteRequestId?: string; // Reference to original quote request
  createdAt?: any;
  updatedAt?: any;
}

export interface SopSectionStep {
  id: string;
  text: string;
  requiresApproval?: boolean;
  requiredPhotoKey?: string;
}

export interface SopSection {
  title: string;
  steps: SopSectionStep[];
}

export interface SopRequiredPhoto {
  key: string;
  label: string;
  required: boolean;
}

export interface SopDoc {
  id: string;
  jobId: string;
  qaStatus: 'NEEDS_REVIEW' | 'APPROVED' | 'REJECTED';
  brandStyleVersion: 'v1';
  sections: SopSection[];
  requiredPhotos: SopRequiredPhoto[];
  createdAt?: string;
  updatedAt?: string;
}

export interface JobMedia {
  photoFrontOfHouse: string; // Base64
  photoAfter?: string; // After-service photo (checkout)
  videoGarage: string; // Base64 or Blob URL
  timestamp: string; // Submission Timestamp
  photoTimestamp?: string; // ISO String for Photo Upload
  videoTimestamp?: string; // ISO String for Video Upload
}

export interface Notification {
  id: string;
  jobId: string;
  message: string;
  type: '3_DAY' | '1_DAY' | '6_HOUR' | 'CHECKOUT_REMINDER' | 'CHECKLIST_REQUEST' | 'CELEBRATION';
  isRead: boolean;
  timestamp: string;
}

export interface Payout {
  id: string;
  jobId: string; // DEPRECATED: Use serviceJobId instead
  serviceJobId?: string; // NEW: Reference to serviceJobs/{id}
  scholarId: string;
  scholarName: string;
  scholarEmail?: string;
  amount: number;
  status: 'pending' | 'paid' | 'failed';
  createdAt: string;
  paidAt?: string;
  paymentMethod?: 'Venmo' | 'Zelle' | 'Cash' | 'Check';
  transactionNote?: string;
  approvedBy?: string;
}

// ============================================================================
// PHASE X: NEW DATA MODEL TYPES
// ============================================================================

/**
 * Client - Central registry of all Garage Scholars clients
 */
export interface Client {
  id: string;
  name: string;
  email: string;
  phone?: string;
  createdAt: any; // Firestore Timestamp
  source: 'scheduling' | 'resale' | 'both';

  stats: {
    totalServiceJobs: number;
    totalPropertiesServiced: number;
    totalItemsListed: number;
    totalItemsSold: number;
    totalRevenue: number;
  };

  notes?: string;
  tags?: string[];
}

/**
 * Property - Physical locations where service jobs occur
 */
export interface Property {
  id: string;
  clientId: string; // Reference to clients/{id}

  address: string;
  city: string;
  state: string;
  zip: string;

  serviceJobIds: string[];
  inventoryItemIds: string[];

  createdAt: any; // Firestore Timestamp
  lastServicedAt?: any; // Firestore Timestamp
  propertyType?: 'residential' | 'commercial' | 'storage';
  notes?: string;
}

/**
 * ServiceJob - Enhanced Job interface with client/property references
 * (Replaces Job interface for scheduling app in Phase X)
 */
export interface ServiceJob extends Job {
  // NEW: Structured references
  clientId?: string; // Reference to clients/{id}
  propertyId?: string; // Reference to properties/{id}

  // NEW: Inventory extraction tracking
  inventoryExtracted: boolean;
  extractedItemIds?: string[]; // References to inventory/{id}

  // Legacy: clientName and address preserved for backward compatibility
  // Use clientId/propertyId for new code
}

/**
 * InventoryItem - Items from Resale Concierge app
 * (Shared interface for cross-app visibility)
 */
export interface InventoryItem {
  id: string;

  title: string;
  price: string;
  description: string;
  condition?: 'new' | 'used';

  // NEW: Structured source tracking
  clientId?: string; // Reference to clients/{id}
  propertyId?: string; // Reference to properties/{id}
  sourceServiceJobId?: string; // Reference to serviceJobs/{id}

  // Legacy field (DEPRECATED)
  clientName?: string;

  platform: 'Both' | 'All' | 'Craigslist' | 'FB Marketplace' | 'eBay Only';
  status: 'Pending' | 'Running' | 'Active' | 'Error';

  imageUrls: string[];

  activeJobId?: string; // Reference to automationJobs/{id}
  progress?: {
    craigslist?: 'queued' | 'running' | 'success' | 'error';
    facebook?: 'queued' | 'running' | 'success' | 'error';
    ebay?: 'queued' | 'running' | 'success' | 'error';
  };

  ebay?: {
    enabled: boolean;
    status: 'queued' | 'running' | 'ready_to_publish' | 'published' | 'failed';
    sku?: string;
    offerId?: string;
    listingId?: string;
    inventoryItemId?: string;
    marketplaceId?: string;
    merchantLocationKey?: string;
    paymentPolicyId?: string;
    fulfillmentPolicyId?: string;
    returnPolicyId?: string;
    error?: {
      message: string;
      code: string | null;
      raw: any;
    };
    lastRunAt?: any;
    publishedAt?: any;
  };

  dateListed: string;
  lastUpdated: any; // Firestore Timestamp
  lastError?: {
    platform: string;
    message: string;
    screenshotPath: string;
  };
}

/**
 * AutomationJob - Queue jobs for marketplace listing automation
 * (Used by Resale Concierge backend)
 */
export interface AutomationJob {
  id: string;
  inventoryId: string; // Reference to inventory/{id}

  status: 'queued' | 'running' | 'succeeded' | 'failed';
  attempts: number;

  // Lease system
  leaseOwner: string | null;
  leaseExpiresAt: any | null; // Firestore Timestamp

  createdAt: any; // Firestore Timestamp
  startedAt?: any;
  finishedAt?: any;

  lastError?: {
    platform: string;
    message: string;
    screenshotPath: string;
  };

  artifacts: {
    screenshots: string[];
  };

  results?: {
    craigslist?: 'success' | 'error' | 'skipped';
    facebook?: 'success' | 'error' | 'skipped';
    ebay?: {
      ok: boolean;
      offerId?: string;
      listingId?: string;
      error?: any;
      skipped?: boolean;
    };
  };
}

/**
 * Enhanced User interface with app access controls
 */
export interface EnhancedUser extends User {
  appAccess?: {
    scheduling: boolean;
    resale: boolean;
  };
}

export const MOCK_USERS: User[] = [
  { id: 'user-1', name: 'Alex Scholar', role: 'scholar', monthlyGoal: 3000, avatarInitials: 'AS', achievedMilestones: [], phoneNumber: '555-0123' },
  { id: 'user-2', name: 'Sarah Connor', role: 'scholar', monthlyGoal: 4500, avatarInitials: 'SC', achievedMilestones: [], phoneNumber: '555-0198' },
  { id: 'user-3', name: 'John Matrix', role: 'scholar', monthlyGoal: 3500, avatarInitials: 'JM', achievedMilestones: [], phoneNumber: '555-0145' },
  { id: 'user-4', name: 'Ellen Ripley', role: 'scholar', monthlyGoal: 5000, avatarInitials: 'ER', achievedMilestones: [], phoneNumber: '555-0167' },
];

export const MOCK_JOBS: Job[] = [
  {
    id: 'job-101',
    clientName: 'Smith Residence',
    address: '124 Maple Drive, Springfield',
    date: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
    scheduledEndTime: new Date(Date.now() + 86400000 + 14400000).toISOString(), // +4 hours
    pay: 350.00,
    description: 'Full garage organization and deep clean. Heavy lifting required for shelving units.',
    status: JobStatus.UPCOMING,
    locationLat: 34.05,
    locationLng: -118.25,
    assigneeId: 'user-1',
    assigneeName: 'Alex Scholar',
    checklist: [
      { id: 't1', text: 'Clear driveway for staging', isCompleted: false, status: 'APPROVED' },
      { id: 't2', text: 'Assemble 3 metal shelving units', isCompleted: false, status: 'APPROVED' },
      { id: 't3', text: 'Sort loose tools into labeled bins', isCompleted: false, status: 'PENDING', addedBy: 'scholar', actionTimestamp: new Date().toISOString() },
      { id: 't4', text: 'Sweep and hose down garage floor', isCompleted: false, status: 'APPROVED' }
    ]
  },
  {
    id: 'job-102',
    clientName: 'Johnson Estate',
    address: '8800 Sunset Blvd, Beverly Hills',
    date: new Date(Date.now() + 259200000).toISOString(), // 3 Days out
    scheduledEndTime: new Date(Date.now() + 259200000 + 18000000).toISOString(), // +5 hours
    pay: 600.00,
    description: 'Two-car garage + detached workspace organization.',
    status: JobStatus.UPCOMING,
    locationLat: 34.07,
    locationLng: -118.40,
    assigneeId: 'user-2',
    assigneeName: 'Sarah Connor',
    checklist: [
      { id: 't1', text: 'Photograph initial state of workspace', isCompleted: false, status: 'APPROVED' },
      { id: 't2', text: 'Break down and recycle old cardboard boxes', isCompleted: false, status: 'APPROVED' },
      { id: 't3', text: 'Organize workspace drawers by item type', isCompleted: false, status: 'APPROVED' },
      { id: 't4', text: 'Install wall hooks for bicycles', isCompleted: false, status: 'APPROVED' }
    ]
  },
  {
    id: 'job-103',
    clientName: 'Doe Bungalow',
    address: '45 Ocean View, Santa Monica',
    date: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
    scheduledEndTime: new Date(Date.now() + 3000000).toISOString(), // Ends in ~50 mins from now
    pay: 275.00,
    description: 'Standard cleaning and box labeling.',
    status: JobStatus.IN_PROGRESS, 
    locationLat: 34.01,
    locationLng: -118.49,
    assigneeId: 'user-1',
    assigneeName: 'Alex Scholar',
    checkInTime: new Date(Date.now() - 3600000).toISOString(),
    checklist: [
      { id: 't1', text: 'Label all holiday decoration boxes', isCompleted: true, status: 'APPROVED' },
      { id: 't2', text: 'Stack boxes safely against north wall', isCompleted: false, status: 'APPROVED' },
      { id: 't3', text: 'Wipe down workbench', isCompleted: false, status: 'APPROVED' }
    ]
  },
  {
    id: 'job-104',
    clientName: 'Tech Startup Garage',
    address: '500 Innovation Way, Silicon Beach',
    date: new Date(Date.now() + 432000000).toISOString(), // 5 Days out
    scheduledEndTime: new Date(Date.now() + 432000000 + 21600000).toISOString(), // +6 hours
    pay: 500.00,
    description: 'Convert garage into office space. Clear all debris.',
    status: JobStatus.UPCOMING,
    locationLat: 34.02,
    locationLng: -118.45,
    assigneeId: undefined, // Unassigned
    assigneeName: undefined,
    checklist: [
      { id: 't1', text: 'Remove old workbench', isCompleted: false, status: 'PENDING', addedBy: 'scholar', actionTimestamp: new Date().toISOString() },
      { id: 't2', text: 'Sweep and mop', isCompleted: false, status: 'APPROVED' }
    ]
  }
];
