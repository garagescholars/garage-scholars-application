# Garage Scholars — Tech Stack Complete User Guide

**Source:** `garagescholars/garage-tech-stack` (GitHub Organization)
**Firebase Project:** `garage-scholars-v2`
**Last Updated:** March 6, 2026

---

## Table of Contents

1. [Platform Map — What Lives Where](#1-platform-map)
2. [How to Log In to Each Application](#2-how-to-log-in)
3. [Admin Heavy — Resale Concierge](#3-admin-heavy--resale-concierge)
4. [Admin Light — Scheduling System (Admin Mode)](#4-admin-light--scheduling-system-admin-mode)
5. [Scholar View — Scheduling System (Scholar Mode)](#5-scholar-view--scheduling-system-scholar-mode)
6. [Mobile App (Expo/React Native)](#6-mobile-app)
7. [Marketing Website](#7-marketing-website)
8. [Hiring & Recruitment Pipelines](#8-hiring--recruitment-pipelines)
9. [Backend Automation Worker](#9-backend-automation-worker)
10. [Step-by-Step Workflows](#10-step-by-step-workflows)
11. [Database Collections Reference](#11-database-collections-reference)
12. [Deployment & Dev Setup](#12-deployment--dev-setup)
13. [Troubleshooting](#13-troubleshooting)

---

## 1. Platform Map

The tech stack contains **5 applications** and **2 recruitment pipelines**:

| App | Type | Who Uses It | URL | Code Location |
|-----|------|-------------|-----|---------------|
| **Resale Concierge** | React SPA (Vite) | Admins only | `garage-scholars-resale.web.app` | `frontend/` |
| **Scheduling System (Web)** | React + TypeScript (Vite) | Admins + Scholars | `garage-scholars-scheduling.web.app` | `schedulingsystem/` |
| **Mobile App** | Expo (React Native) | Admins + Scholars | iOS/Android + Web | `mobile/` |
| **Marketing Website** | Static HTML/CSS/JS | Public (customers) | `garage-scholars-website.vercel.app` | `Website/` |
| **Backend Worker** | Node.js (Puppeteer) | Automated | `localhost:3001` | `backend/` |
| **Scholar Recruitment** | Static HTML + Firestore | Admins (hiring) | `garagescholars.com/apply` | `scholarrecruitment/` |
| **Technician Hiring** | HTML + Cloud Functions + AI | Admins (hiring) | Multiple Vercel apps | `hiring/` |

---

## 2. How to Log In

### 2.1 Resale Concierge (Admin Only)

1. Go to **`garage-scholars-resale.web.app`**
2. You see "Garage Scholars Internal — Restricted Access. Authorized Personnel Only."
3. Click **"Sign in with Google"**
4. Only these 3 emails have access:
   - `tylerzsodia@gmail.com`
   - `zach.harmon25@gmail.com`
   - `garagescholars@gmail.com`
5. Any other email is **immediately signed out**

### 2.2 Scheduling System — Web (Admin or Scholar)

1. Go to **`garage-scholars-scheduling.web.app`**
2. Click **"Sign in"** — uses email/password via Firebase Auth

**If you're an admin:**
- Log in with one of the admin emails listed above
- You're automatically detected as admin and see the full admin interface
- You can use the **"View as Scholar"** dropdown to impersonate any scholar

**If you're a new scholar:**
1. Go to **`/create-account`**
2. Enter your full name, email, password (min 6 characters), and select "Scholar" role
3. Your request goes into the `signupRequests` queue
4. You're redirected to **`/pending-approval`** — wait here
5. An admin must approve you from the Admin Dashboard
6. Once approved, your `gs_profiles` doc gets `isActive: true` and you can log in

### 2.3 Mobile App (Admin or Scholar)

1. Download or open the Expo app
2. **Phone login (mobile):** Enter your phone number → receive SMS code → enter 6-digit code
3. **Email login (web):** Enter email + password
4. **New users:** Tap "Create Account" → fill form → wait for admin approval
5. **First-time scholars** go through a **4-step onboarding:**
   - Step 1: Enter your full name
   - Step 2: Upload profile picture (or skip)
   - Step 3: Enable notifications
   - Step 4: Enable location permissions
6. After onboarding, you land on the Jobs feed

**Role routing:**
- Admin emails → `/(admin)/jobs`
- Scholars → `/(scholar)/jobs`
- Unapproved accounts → signed out

### 2.4 Marketing Website (No Login)

- Go to `garage-scholars-website.vercel.app`
- Public — no authentication required
- Customers use the "Get a Quote" modal to submit requests

---

## 3. Admin Heavy — Resale Concierge

This is the **full-featured admin dashboard** for managing resale inventory across eBay, Craigslist, and Facebook Marketplace. Dark-themed, sidebar navigation.

### Layout

```
┌──────────────┬────────────────────────────────────────┐
│              │                                        │
│  SIDEBAR     │       MAIN CONTENT AREA                │
│              │                                        │
│  Dashboard   │  (changes based on active tab)         │
│  Inventory   │                                        │
│  Review Queue│                                        │
│  Payouts     │                                        │
│  Messages    │                                        │
│  Settings    │                                        │
│              │                                        │
│  ─────────── │                                        │
│  Notifications                                        │
│              │                                        │
│  [User]      │                                        │
│  [Logout]    │                                        │
└──────────────┴────────────────────────────────────────┘
```

On mobile: sidebar collapses to a hamburger menu in the top header.

### 3.1 Dashboard

The landing page after login. Real-time metrics pulled from Firestore.

**Top Row (4 cards):**
- **Active Listings** — count of items in `inventory`
- **Portfolio Value** — sum of all active listing prices
- **Items Sold** — count of `sold_inventory` docs
- **Gross Revenue** — total from sold items (highlighted in emerald)

**Second Row (4 cards):**
- **Avg Sale Price** — revenue / items sold
- **Success Rate** — % of automation jobs that succeeded
- **Needs Review** — items with status "Needs Review" (clickable → jumps to Review Queue)
- **Unread Messages** — conversations marked unread

**Below:**
- **Platform Revenue Breakdown** — horizontal bar chart by platform (CL=purple, FB=blue, eBay=amber)
- **Recent Sales** — last 5 sold items with thumbnail, title, date, price
- **Activity Feed** — last 8 automation jobs with status icons and timestamps

### 3.2 Inventory

Full table of all listings with search, filters, and actions.

**Controls:**
- **"+ New Listing"** button (teal) — opens Add Listing modal
- **Search bar** — searches by title or client name
- **Status filter:** All | Needs Review | Pending | Running | Active | Error | Denied
- **Platform filter:** All | Craigslist | Facebook | eBay

**Table columns:**
| Column | Description |
|--------|-------------|
| Item Name | Thumbnail (hover for large preview) + title |
| Price | In teal monospace |
| Date Listed | When created |
| Client Name | Who the item belongs to |
| Platform | Badge: CL / FB / EB / multi |
| Status | Color-coded badge + per-platform progress icons |

**Status colors:** Needs Review=amber, Pending=slate, Running=blue, Active=emerald, Error=rose, Denied=rose

**Row actions:**
- Click row → opens Edit modal
- Error items show **"Retry"** button
- Click status → opens **Job Detail Drawer**

**Listing Status Flow:**
```
Needs Review → (admin approves) → Pending → Running → Active
                                                    → Error (retryable)
                                                    → Compliance Error (fix content first)
             → (admin denies) → Denied
```

### 3.3 Add / Edit Listing Modal

**Form fields:**
- **Item Title** (required)
- **Price** (required)
- **Client Name** (optional)
- **Description** (required, 4-row textarea)
- **Platform:** Both (FB+CL) | All (CL+FB+eBay) | Craigslist Only | Facebook Only | eBay Only
- **Condition:** New | Like New | Good | Used | For Parts
- **Photos:** Up to 6 images (JPG, PNG, HEIC, WebP supported)

Images are automatically processed: HEIC→JPEG conversion, resize to max 1200px, compress at 70% quality.

**Create mode:** Status set to "Needs Review"
**Edit mode:** Status set to "Pending" (re-queued for automation)

**Remove Item options:**
- **"Sold by Garage Scholars"** → moves to `sold_inventory` (counts toward revenue)
- **"Duplicate / Void"** → permanently deletes (no revenue)

### 3.4 Review Queue

Safety gate before listings go live. Shows items with status "Needs Review".

**10-Point Safety Check (automated):**

| # | Check | Rule |
|---|-------|------|
| 1 | Title length | 5–80 characters |
| 2 | Description | 20+ characters |
| 3 | Price range | $1 – $99,999 |
| 4 | Photos | At least 1 |
| 5 | Condition | Must be set |
| 6 | No ALL CAPS title | Prevents spam |
| 7 | No phone numbers | In description |
| 8 | No URLs | In description |
| 9 | No prohibited items | Keyword scan (see below) |
| 10 | Client name | Must be provided |

**Prohibited keywords:** guns, rifles, ammo, firearms, AR-15, marijuana, cannabis, THC, CBD, vape, puppy, kitten, livestock, adult toys, replicas, knockoffs, bootlegs, explosives, fireworks, pepper spray, prescriptions, medications, gift cards, NFTs, software licenses, concert tickets

**Risk levels:**
- **Low** (0–2 fails) — green, can approve
- **Medium** (1 fail) — amber, can approve
- **High** (3+ fails) — orange, can approve with caution
- **Critical** (prohibited keyword) — red, **approval blocked**

**Actions:**
- **Approve & Post** → status = "Pending", automation kicks off
- **Deny** → requires a reason, status = "Denied"

### 3.5 Payouts & Commission

Tracks the **50/50 revenue split** between Garage Scholars and clients.

**Summary cards:**
- Gross Revenue (all sales)
- Our Commission (50%)
- Total Owed to Clients
- Total Paid Out

**Per-client expandable cards show:**
- Items sold count + outstanding balance
- Individual item breakdown (title, date, price, client's 50% share)
- Payout history (method, amount, date, notes)
- **"Record Payout"** button if balance > $0

**Recording a payout:**
1. Click "Record Payout ($X.XX)"
2. Select method: Venmo | Zelle | PayPal | Cash | Check
3. Add optional notes (e.g., "@handle")
4. Confirm → creates payout doc + sends confirmation email

**Filters:** Unpaid (default) | All Clients

### 3.6 Messages

Two-pane buyer conversation interface.

**Left pane (Inbox):**
- List of all conversations
- Shows: buyer name, platform badge (eBay/CL/FB/Other), item title, last message preview, unread dot
- **"+ New"** button to create a conversation

**Right pane (Chat):**
- Message thread with owner messages (right, teal) and buyer messages (left, slate)
- Text input + Send button
- Note banner: "Replies stay in this app. For marketplace messages, reply on the platform directly."

**New conversation form:** Buyer name, platform dropdown, item title, initial message (optional)

### 3.7 Settings

**eBay Connection:** Status (green/red), environment (production/sandbox), publish mode (auto/draft)
**Rate Limits:** Facebook = 10/day, Others = 20/day, with color-coded progress bars
**Backend Worker Health:** Online/offline status, uptime, jobs processed, success/fail counts, active jobs

### 3.8 Notifications Panel

Slide-in from right. Shows automation alerts:
- **Dead Letter Job** (red) — permanently failed after 3 retries
- **Compliance Failed** (amber) — content violated platform policies

**Actions:** Retry (re-queues item) | Dismiss | Mark All Read

### 3.9 Job Detail Drawer

Opens from inventory table. Shows full automation history for a listing:
- **Platform Status Cards** — per-platform (CL/FB/eBay) with status icons
- **eBay details** — listing ID, offer ID, SKU, error messages
- **Last Error** — error message + triggering platform
- **Automation Timeline** — chronological list of all job attempts with status, error, worker ID, timestamp

**Actions:** Retry Automation | Edit | Mark Sold

---

## 4. Admin Light — Scheduling System (Admin Mode)

This is the **job management interface** for overseeing scholar work. Lighter than the Resale Concierge. Blue-themed.

### Layout

```
┌────────────────────────────────────────────────────────┐
│  HEADER: Garage Scholars    [View as: Scholar ▼]  🔔   │
├────────────────────────────────────────────────────────┤
│                                                        │
│  [My Schedule]  [Job Board 🔥]    [+ Add Job]          │
│                                                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Job Card                                         │  │
│  │ Client Name · Status Badge · $Pay                │  │
│  │ Address · Date/Time                              │  │
│  │ [Transfer] [Reschedule] [Cancel]                 │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│  Sidebar/Bottom:                                       │
│  [Admin Dashboard] [Pending Approvals] [Profile]       │
└────────────────────────────────────────────────────────┘
```

### 4.1 Main Schedule View

- **Two tabs:** "My Schedule" (all jobs) + "Job Board" (unassigned/available)
- **View toggle:** List view or Calendar view
- **"+ Add Job"** button in header
- **"View as Scholar"** dropdown — impersonate any scholar to see their view

### 4.2 Job Cards

Each job shows:
- Client name, status badge, pay amount ($)
- Address, date, scheduled time
- For available jobs: simulated "Scholars watching" count (social proof)
- High-pay jobs: flame badge + orange ring
- Urgent jobs (< 3 days): zap badge

**Admin action buttons on each card:**
- **Transfer** → reassign to different scholar (direct or requeue)
- **Reschedule** → change date/time
- **Cancel** → cancel with reason

### 4.3 Add Job (Create Form)

**Form fields:**
- Client: name, email, phone
- Property: address
- Job: description, estimated hours (1–12)
- Payout: scholar payout ($50–$1,000), client price ($100–$3,000)
- Scheduled date and time
- Access instructions (gates, keys, etc.)
- Sell vs keep preference

Creates job with status `APPROVED_FOR_POSTING` — immediately appears on scholars' Job Board.

### 4.4 Admin Dashboard (`/admin`)

Five sections:

1. **Pending Signup Requests** — new scholar accounts awaiting approval
   - Approve or Decline buttons per request

2. **Jobs for Review** — jobs with status `REVIEW_PENDING`
   - Opens review modal with:
     - Side-by-side check-in vs check-out photos
     - Garage walkthrough video
     - Checklist completion status
     - Work duration calculation
   - **"Approve & Pay $XXX"** → creates payout, status = COMPLETED
   - **"Request Changes"** → adds notes, status = CHANGES_REQUESTED

3. **Completed Jobs — Extract Inventory** — link finished jobs to resale items

4. **Admin Notifications** — system alerts

5. **View as Scholar** — impersonate dropdown at top

### 4.5 Pending Approvals

Shows all jobs with **pending task requests** from scholars:
- Each card shows job address, date, and list of pending tasks
- **"Approve All (N)"** — bulk approve all tasks for that job
- Per-task: **Approve** (green) or **Reject** (red)
- Confirmation modal before action
- SMS notification sent to scholar on approval/rejection

### 4.6 Payouts (`/admin/payouts`)

**Summary cards:** Pending amount | Paid YTD | Total payout count

**Table:** Payout ID, Scholar, Job ID, Amount, Status, Action

**Actions:**
- **"Mark as Paid"** → modal for payment method + transaction ID
- **"Export for Taxes"** → CSV of scholars with >$600 YTD (1099 compliance)

**Payout model:** 50% at check-in, 50% after 24 hours (held if customer complaint filed)

### 4.7 Team Settings (Profile → Admin section)

- Per-scholar: set monthly income goal ($), set phone number for SMS alerts
- Progress bar showing each scholar's goal completion

### 4.8 SMS Outbox

Real-time log of milestone SMS broadcasts:
- When a scholar hits 80%, 90%, or 100% of their monthly goal
- Gemini AI generates a celebratory message (max 140 chars)
- Sent to all team members with registered phone numbers

---

## 5. Scholar View — Scheduling System (Scholar Mode)

This is the **employee-facing view** for scholars doing the actual work. Simpler, focused on jobs and earnings.

### Layout

```
┌────────────────────────────────────────────────────────┐
│  HEADER: Garage Scholars    Welcome, [Name]!      🔔   │
├────────────────────────────────────────────────────────┤
│                                                        │
│  [My Schedule]  [Job Board 🔥]                         │
│                                                        │
│  Goal Tracker: ████████░░░░ 75% ($2,250 / $3,000)     │
│                                                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Job Card                                         │  │
│  │ Client Name · UPCOMING · $350                    │  │
│  │ 123 Main St · Mar 8 · 9:00 AM                    │  │
│  │           [View Details →]                       │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│  Footer: [Profile] [Notifications]                     │
└────────────────────────────────────────────────────────┘
```

### 5.1 My Schedule

All jobs assigned to you, sorted by date.

**Job card shows:** client name, status badge, pay ($), address, date/time

**Status colors:**
- Blue = Upcoming
- Yellow = In Progress
- Orange = Review Pending
- Green = Completed
- Red = Cancelled

Click any job → opens **Job Detail View**

### 5.2 Job Board

Browse available unassigned jobs (status: `APPROVED_FOR_POSTING`).

- Jobs marked **"Hot"** if high-pay or urgent (< 3 days away)
- Shows simulated "Scholars watching" count for social proof
- **"Claim Job — $XXX"** button on each card
- Claiming opens a confirmation modal (address, time, 2-hour cancel window)
- On claim: job moves to your My Schedule, status = UPCOMING

### 5.3 Job Detail View (4 Steps)

The main work interface. Stepped progression:

**Step 1 — Details:**
- Standard Operating Procedure (SOP) — collapsible sections
- Checklist with task status (Completed / Pending / Waiting for Approval)
- **"Add Task"** — scholars can request new tasks (requires admin approval)
- Intake media upload (up to 3 photos for QA baseline)

**Step 2 — Check-In:**
1. Click **"Start Job (Check In)"**
2. Take/upload a photo of the front of the house
3. Photo uploads to Firebase Storage
4. Job status → IN_PROGRESS
5. 50% payout auto-created

**Step 3 — Check-Out:**
1. Complete all checklist items
2. Click **"Complete Job (Check Out)"**
3. Upload an "after" photo of the front of the house
4. Record a video walkthrough of the organized garage (required)
5. Media uploads to Storage
6. Job status → REVIEW_PENDING
7. Admin receives email notification with all media

**Step 4 — Report:**
- Quality report generated by Google Gemini AI (compares before/after photos)
- Shows "Checkout Successful" for scholars
- Admin sees "Quality Control Review" with scoring

### 5.4 Profile

- **Avatar** with initials + "Verified Specialist" badge
- **Stats:** Rating, completed jobs, experience level
- **Earnings:** Pending payouts, paid YTD, recent payout list
- **Goal Setting:** Set monthly income goal ($ amount)
- **Phone Number:** Register for SMS milestone alerts
- **1099 Info:** Download tax information if earnings > $600
- **Version:** v1.2.1

### 5.5 Notifications

Real-time alerts:
- **3-Day Warning** — job coming up in 3 days
- **Checklist Request** — admin has pending task approvals (banner)
- **Celebration** — hit 80%, 90%, or 100% of monthly goal
- Bell icon shows unread count
- Click notification → jumps to relevant job

---

## 6. Mobile App

The mobile app (Expo/React Native) is the **most feature-rich** version, with everything the web scheduling system has plus:

### Scholar-Only Features (Mobile)

| Screen | What It Does |
|--------|-------------|
| **Jobs Feed** | Browse available jobs with search, hot jobs carousel, recent claims banner, social proof viewer counts |
| **Job Detail** | Urgency badge, countdown timer, viewer count, claim button with celebration animation |
| **My Jobs** | Active/Completed tabs, quick stats bar, long-press to cancel |
| **Check-In (4 steps)** | 1) GPS geofence verification (~100m), 2) Check-in video, 3) Before photos (min 3), 4) Freight receipt |
| **Check-Out** | Guided item capture (4+ photo angles), donation items, after photos, checkout video, quality assessment |
| **Video Prep Gate** | Must watch required assembly/setup videos before check-in allowed |
| **Transfer Job** | Transfer to specific scholar or requeue to open board |
| **Reschedule** | Request date/time change (admin approval needed) |
| **Escalate** | Report issues with photos + description, live comment thread |
| **Donation Receipt** | Upload receipt from donation center |
| **Goals** | Three tabs: Goals (progress bars), Leaderboard (rankings by pay score), Achievements (earned badges) |
| **Set Goal** | Create monthly goal: Jobs count or Earnings target |
| **Profile** | Pay score (stars), stats grid, tier progress (New → Standard → Elite → Top Hustler) |
| **Payment Setup** | Link bank account via Stripe Connect |
| **Score History** | Pay score changes over time with reasons |
| **Payments** | Full payment history with status |

### Admin-Only Features (Mobile)

| Screen | What It Does |
|--------|-------------|
| **All Jobs** | Search + status filter pills, create job button |
| **Create Job** | Full form: title, description, address, scheduling, pricing, client info, SOP, package tier |
| **Job Detail** | Edit, status controls, view media & quality scores, dispute resolution, payment release |
| **Scholars List** | All scholars with search, pay score, tier badge, tap for detail |
| **Scholar Detail** | Profile, stats, pay score history, recent jobs, activate/disable account |
| **Transfers** | Pending transfers + reschedules, approve/decline |
| **Analytics** | KPI cards, charts, scholar trends, quality metrics |
| **Payouts** | Pending/paid list, manual release, CSV export |
| **Leads** | Customer intake, SOP generation & approval, inventory extraction |
| **Social Media** | Before/after content queue for social posting |
| **Share App** | QR code + share links for recruitment |
| **Settings** | Platform config, notification settings, team management |

### Mobile Navigation

**Scholar tabs:** Jobs | My Jobs | Goals | Profile
**Admin tabs (mobile):** Jobs | Scholars | Transfers | Analytics | More
**Admin sidebar (web 1024px+):** Full sidebar with all admin screens

---

## 7. Marketing Website

Static site at `garage-scholars-website.vercel.app`.

**Pages:**
- **Homepage** (`index.html`) — hero, services, pricing, FAQ, team
- **About** (`about.html`) — founder bios (Zach Harmon PT/DPT + Tyler Sodia PhD)
- **Contact** (`contact.html`) — contact form
- **Apply** (`apply.html`) — scholar + technician recruitment
- **Privacy Policy** + **Terms of Use**
- **Coming Soon** — AR garage visualizer

**Quote Modal ("Get a Quote"):**
1. Customer fills form: name, email, phone, zip, service type, package, garage size, description
2. Uploads **minimum 3 photos** (auto-compressed to 1200px, 70% quality)
3. Submits → Firebase Cloud Function `submitQuoteRequest()` → stored in Firestore `quoteRequests`

**Newsletter signup** in footer → writes to `newsletterSubscriptions` collection.

---

## 8. Hiring & Recruitment Pipelines

### 8.1 Scholar Recruitment (`scholarrecruitment/`)

**Purpose:** Recruit 20–50 college students as Garage Scholars

**Landing page** (`landing-page/index.html`):
- Mobile-optimized application form
- Fields: name, phone, email, school, year, availability, has car?, referral source, why join?
- Writes to `scholarApplications` collection

**Admin dashboard** (`tracking/admin-dashboard.html`):
- Real-time list of applicants
- Filter by status: New | Interviewed | Hired | Rejected
- Quick-action buttons (call, email, update status)
- Conversion metrics

**Flyer template** (`assets/flyer-template.html`): Printable with QR codes
**Response templates** (`templates/response-templates.md`): 50+ SMS/email/phone scripts

### 8.2 Technician Hiring (`hiring/`)

**Purpose:** AI-powered zero-touch screening pipeline for technicians

**3-Stage Pipeline:**
```
Application Form → Claude AI Score → Video Screen → Gemini Analysis → Zoom → Composite Score
```

**Stage 1 — Application** (`application-form/index.html`):
- 6 screening questions → writes to `gs_hiringApplicants`
- Cloud Function scores with Claude AI (4 dimensions: Skills 30%, Reliability 15%, Conscientiousness 25%, Problem-Solving 30%)
- Pass threshold: ≥60 + no red flags

**Stage 2 — Video** (`video-app/index.html` at `gs-video-screen.vercel.app`):
- 5 video prompts (60–90 sec each)
- Uploads to Firebase Storage → Gemini 2.0 Flash analyzes
- Score: 5 dimensions, pass ≥65

**Stage 3 — Zoom Interview** (`interview-scoring/index.html` at `interview-scoring-weld.vercel.app`):
- Founder inputs score (0–100)
- **Composite:** Application 20% + Video 30% + Zoom 50%
- ≥75 → HIRE | 60–74 → FOUNDER REVIEW | <60 → REJECT

**Cost per hire:** ~$0.30–0.50 (AI costs) + ~17 min founder time

---

## 9. Backend Automation Worker

**Location:** `backend/`
**Purpose:** Automated marketplace listing via Puppeteer

This is **not a REST API** — it's a Firestore-driven job queue worker that:

1. Polls `inventory` collection every 5 seconds for status="Pending" items
2. Claims jobs with a distributed lease system (5-min lease, prevents duplicates)
3. Launches headless Chrome with anti-detection:
   - Puppeteer Extra + Stealth plugin
   - Fingerprint generation + injection
   - Ghost-cursor (Bezier mouse movements)
   - Residential proxy rotation (optional)
   - Human-like typing with occasional typos
4. Posts to **Craigslist**, **Facebook Marketplace**, and/or **eBay** in parallel
5. Retries up to 3 times before dead-lettering with admin notification

**Rate limits:** Facebook = 10/day (15-min gap), Craigslist = 20/day (30-min gap)

**Compliance checks** (before posting):
- Prohibited keywords (weapons, drugs, animals, counterfeit, etc.)
- Title/description quality (no spam, no phone numbers, no URLs)
- Image validation (valid format, not placeholder, not too small)

**Health endpoints:**
- `GET /health` → worker status, uptime, active jobs
- `GET /stats` → jobs processed, succeeded, failed

---

## 10. Step-by-Step Workflows

### 10.1 Creating a Resale Listing (Admin)

```
1. Resale Concierge → Inventory tab → "+ New Listing"
2. Fill: title, price, client name, description
3. Select platform (Both / All / CL Only / FB Only / eBay Only)
4. Select condition (New / Like New / Good / Used / For Parts)
5. Upload up to 6 photos
6. Click "Create & Post" → status = "Needs Review"
7. Go to Review Queue tab
8. Review the 10-point safety check
9. If checks pass → "Approve & Post" → status = "Pending"
10. Backend worker picks it up → status = "Running"
11. Posted successfully → status = "Active"
12. If error → view in Notifications or Job Detail Drawer → "Retry"
```

### 10.2 Full Job Lifecycle (Scheduling)

```
ADMIN:
1. Scheduling System → "+ Add Job"
2. Fill client info, address, date/time, payout amount, description
3. Submit → status = APPROVED_FOR_POSTING
4. Job appears on scholars' Job Board

SCHOLAR:
5. Open Job Board → see available jobs
6. Click "Claim Job — $XXX" → confirm in modal
7. Job moves to My Schedule, status = UPCOMING
8. On job day → open job → "Start Job (Check In)"
9. Upload front-of-house photo → status = IN_PROGRESS
10. Work through checklist (check off each task)
11. "Complete Job (Check Out)"
12. Upload after photo + garage walkthrough video
13. Status = REVIEW_PENDING

ADMIN:
14. Receives email notification with all media
15. Open Admin Dashboard → Jobs for Review
16. Compare check-in vs check-out photos
17. Watch garage video
18. Review checklist completion
19. "Approve & Pay $XXX" → payout created, status = COMPLETED
    OR "Request Changes" → status = CHANGES_REQUESTED
20. Mark payout as paid in Payouts page (select Venmo/Zelle/Cash/Check)
```

### 10.3 Approving a New Scholar

```
SCHOLAR:
1. Go to /create-account
2. Fill: name, email, password, role = Scholar
3. Submit → redirected to /pending-approval

ADMIN:
4. Open Admin Dashboard
5. See "Pending Signup Requests" section
6. Click "Approve" → Cloud Function sets isActive = true
   OR "Decline" → Cloud Function rejects
```

### 10.4 Recording a Client Payout (Resale)

```
1. Resale Concierge → Payouts tab
2. Find client with outstanding balance
3. Click to expand their card
4. Review sold items and 50/50 commission splits
5. Click "Record Payout ($X.XX)"
6. Select method: Venmo / Zelle / PayPal / Cash / Check
7. Add notes (e.g., "@username")
8. Confirm → payout doc created + confirmation email sent
```

### 10.5 Handling a Failed Automation

```
1. Bell icon shows notification badge
2. Click → Notifications Panel slides in
3. See "Dead Letter Job" or "Compliance Failed" alert
4. Click the linked inventory item → Job Detail Drawer opens
5. Review error message and automation timeline
6. If content issue: click "Edit" → fix title/description/images → save
7. Click "Retry Automation" → status reset to "Pending"
8. Dismiss the notification
```

---

## 11. Database Collections Reference

### Resale System

| Collection | Purpose |
|-----------|---------|
| `inventory` | Active resale listings |
| `sold_inventory` | Archived sold items |
| `automationJobs` | Marketplace posting job queue |
| `conversations` | Buyer message threads |
| `conversations/{id}/messages` | Individual messages |
| `payouts` | Client payout records |
| `adminNotifications` | Automation failure alerts |
| `rateLimits` | Platform posting rate limits |
| `postingHistory` | Duplicate detection log |
| `integrations/ebay` | eBay OAuth tokens |
| `mail` | Transactional email queue |

### Scheduling System

| Collection | Purpose |
|-----------|---------|
| `gs_profiles` | User profiles (auth UID as doc ID) |
| `gs_scholarProfiles` | Scholar-specific analytics |
| `gs_jobs` | All job listings |
| `gs_recentClaims` | Recently claimed jobs (social proof) |
| `gs_jobCheckins` | Check-in records |
| `gs_jobQualityScores` | Quality scoring after completion |
| `gs_scholarGoals` | Monthly goals |
| `gs_scholarAchievements` | Milestone achievements |
| `gs_jobTransfers` | Job transfer requests |
| `gs_jobReschedules` | Reschedule requests |
| `gs_scholarAnalytics` | Computed daily analytics |
| `gs_payouts` | Scholar payout records |
| `gs_customerPayments` | Customer payment tracking |
| `gs_stripeAccounts` | Stripe Connect integration |
| `gs_platformConfig` | App-wide configuration |
| `signupRequests` | New account request queue |
| `adminNotifications` | Admin alerts |

### Hiring & Recruitment

| Collection | Purpose |
|-----------|---------|
| `scholarApplications` | College scholar applications |
| `gs_hiringApplicants` | Technician applications |
| `gs_hiringVideoCompletions` | Video screen completions |
| `gs_hiringInterviewScores` | Zoom interview scores |
| `gs_calBookingWebhook` | Cal.com booking data |

### Website

| Collection | Purpose |
|-----------|---------|
| `quoteRequests` | Customer quote submissions |
| `newsletterSubscriptions` | Email signups |

---

## 12. Deployment & Dev Setup

### Local Development

```bash
# Resale Concierge
cd frontend && npm install && npm run dev
# → Vite dev server (default port 5173)

# Scheduling System (web)
cd schedulingsystem && npm install && npm run dev
# → Vite dev server

# Mobile App
cd mobile && npm install && npx expo start
# → Expo dev server (iOS/Android/Web)

# Backend Worker
cd backend && node server.js
# → Health check at localhost:3001

# Marketing Website
cd Website && node build.js
# → Opens built HTML files directly

# Cloud Functions
cd schedulingsystem/functions && npm install && npm run build
```

### Production Deployment

| App | Command |
|-----|---------|
| Website | Push to GitHub → Vercel auto-deploys |
| Resale Concierge | `cd frontend && npm run build && firebase deploy --only hosting:resale` |
| Scheduling System | `cd schedulingsystem && npm run build && firebase deploy --only hosting:scheduling` |
| Cloud Functions | `cd schedulingsystem/functions && npm run build && firebase deploy --only functions` |
| Backend Worker | `cd backend && node server.js` (on VM/Cloud Run) |
| Mobile | `cd mobile && eas build` (Expo Application Services) |

### Environment Variables

**Frontend apps** use `VITE_FIREBASE_*` prefix:
`VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`

**Backend** uses: `WORKER_ID`, `MAX_ATTEMPTS`, `MAX_CONCURRENT_JOBS`, `EBAY_CLIENT_ID`, `EBAY_CLIENT_SECRET`, `PROXY_URL`, `CAPTCHA_API_KEY`, `CL_EMAIL`, platform rate limit configs, payment card details

---

## 13. Troubleshooting

| Problem | Solution |
|---------|----------|
| Can't log in to Resale Concierge | Verify email is in the 3-email whitelist in App.jsx |
| Can't log in to Scheduling | Check if account is approved (gs_profiles.isActive = true) |
| Scholar stuck on /pending-approval | Admin must approve in Admin Dashboard → Pending Signup Requests |
| Photos not loading in review modal | Check Firebase Storage paths and security rules |
| Listing stuck in "Running" | Check backend worker at /health endpoint |
| Automation keeps failing | Open Job Detail Drawer → check error + debug screenshots |
| eBay token expired (red in Settings) | Re-authorize eBay connection |
| Rate limit hit | Wait for rolling 24-hour window to reset |
| Payout not appearing | Verify payout document created in Firestore |
| 1099 export empty | Check year filter and $600 threshold |
| Checklist not syncing real-time | Verify Firestore onSnapshot listeners |
| Email notifications not sending | Check Firebase email extension + Gmail app password |
| Mobile GPS check-in fails | Must be within ~100m of job site (geofence) |
| Video prep gate blocking check-in | Scholar must confirm watching all required videos first |
| SMS celebrations not sending | Verify phone numbers set in Profile/Team Settings |

---

## Quick Reference

| Key | Value |
|-----|-------|
| **Firebase Project** | `garage-scholars-v2` |
| **GitHub Org** | `garagescholars/garage-tech-stack` |
| **Admin Emails** | tylerzsodia@gmail.com, zach.harmon25@gmail.com |
| **Third Admin** (Resale only) | garagescholars@gmail.com |
| **Resale Commission** | 50/50 split |
| **Scholar Payout Split** | 50% at check-in, 50% after 24hrs |
| **Tax Threshold** | $600/year for 1099 |
| **Rate Limits** | Facebook 10/day, Craigslist 20/day |
| **Max Automation Retries** | 3 before dead letter |
| **Geofence Radius** | ~100m for check-in |
| **Complaint Window** | 48 hours after job completion |
| **Scholar Tiers** | New → Standard → Elite → Top Hustler |
| **Hiring Composite** | App 20% + Video 30% + Zoom 50% |
