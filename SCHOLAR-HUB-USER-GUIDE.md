# Garage Scholars - Scholar Hub User Guide

**Version:** 1.0
**Last Updated:** March 5, 2026
**GitHub Repo:** [tsodia/garage-scholars-applications](https://github.com/tsodia/garage-scholars-applications)

---

## Table of Contents

1. [Platform Overview](#1-platform-overview)
2. [How to Log In](#2-how-to-log-in)
3. [Application Structure & Layout](#3-application-structure--layout)
4. [Admin Heavy View — Resale Concierge](#4-admin-heavy-view--resale-concierge)
5. [Admin Light View — Scheduling System (Admin)](#5-admin-light-view--scheduling-system-admin)
6. [Scholar View — Scheduling System (Scholar)](#6-scholar-view--scheduling-system-scholar)
7. [Marketing Website](#7-marketing-website)
8. [Key Workflows Step-by-Step](#8-key-workflows-step-by-step)
9. [Data & Backend Architecture](#9-data--backend-architecture)
10. [Deployment & Environment](#10-deployment--environment)
11. [Troubleshooting](#11-troubleshooting)

---

## 1. Platform Overview

Garage Scholars is a **three-application platform** built on Firebase and deployed across Vercel and Firebase Hosting:

| Application | Purpose | Who Uses It | URL |
|---|---|---|---|
| **Resale Concierge** | Manage resale listings across eBay, Craigslist, Facebook Marketplace | Admins only | `garage-scholars-resale.web.app` |
| **Scheduling System** | Job assignment, check-in/out, quality control, payouts | Admins + Scholars | `garage-scholars-scheduling.web.app` |
| **Marketing Website** | Public-facing site with quote requests | Customers | `garage-scholars-website.vercel.app` |

**Shared Backend:**
- Firebase Authentication (Google Sign-In)
- Cloud Firestore (database)
- Firebase Storage (photos/videos)
- Cloud Functions (business logic, email, payments)

---

## 2. How to Log In

### Resale Concierge (Admin Only)

1. Navigate to **garage-scholars-resale.web.app**
2. You'll see the "Garage Scholars Internal" login screen with "Restricted Access. Authorized Personnel Only."
3. Click **"Sign in with Google"**
4. Select your Google account
5. **Only these emails are authorized:**
   - `tylerzsodia@gmail.com`
   - `zach.harmon25@gmail.com`
   - `garagescholars@gmail.com`
6. If you sign in with a non-whitelisted email, you will be **automatically signed out**

### Scheduling System (Admin + Scholar)

1. Navigate to **garage-scholars-scheduling.web.app**
2. Click **"Sign in with Google"**
3. **Admin emails** (same whitelist as above) get full admin access
4. **New scholars** must request access:
   - Go to `/create-account`
   - Submit signup request with your info
   - An admin must approve your request before you can access the system
5. Once approved, you log in with the same Google Sign-In flow

### Important Notes
- All authentication uses **Google OAuth** — no username/password
- Sessions persist until you manually log out
- Your profile photo and display name come from your Google account

---

## 3. Application Structure & Layout

The platform has three distinct "views" based on who is using it and which application they're in:

```
Garage Scholars Platform
|
|-- ADMIN HEAVY: Resale Concierge (full admin dashboard)
|     |-- Dashboard (metrics & analytics)
|     |-- Inventory Management
|     |-- Review Queue (safety checks)
|     |-- Payouts & Commission
|     |-- Messages (buyer conversations)
|     |-- Settings (integrations, rate limits)
|
|-- ADMIN LIGHT: Scheduling System (admin mode)
|     |-- Master Schedule (list + calendar views)
|     |-- Add Job modal
|     |-- Pending Approvals
|     |-- Admin Controls (transfer, reschedule, cancel)
|     |-- SMS Outbox
|     |-- Payout Management + 1099 Export
|
|-- SCHOLAR VIEW: Scheduling System (scholar mode)
|     |-- My Schedule (assigned jobs)
|     |-- Job Board (available jobs)
|     |-- Job Detail (check-in/out, checklists)
|     |-- Profile (earnings, goals, stats)
|     |-- Notifications
```

---

## 4. Admin Heavy View — Resale Concierge

This is the **full-featured admin dashboard** for managing resale inventory. Dark-themed UI with a fixed sidebar on the left.

### 4.1 Dashboard

The landing page after login. Displays real-time metrics:

**Top Metric Cards (4x2 grid):**
- Active Listings — number of items currently live
- Portfolio Value — total dollar value of active inventory
- Items Sold — count of completed sales
- Gross Revenue — total sales revenue
- Average Sale Price — revenue / items sold
- Success Rate — percentage of automation jobs that succeeded
- Needs Review — items awaiting safety approval
- Unread Messages — buyer messages needing response

**Below the metrics:**
- Platform Revenue Breakdown (bar chart by eBay/CL/FB)
- Recent Sales list (5 most recent)
- Activity Feed (8 most recent automation jobs with status)

### 4.2 Inventory Management

The core listing management view.

**Search & Filters:**
- Search by title or client name
- Filter by status: All | Needs Review | Pending | Running | Active | Error | Denied
- Filter by platform: All | Craigslist | Facebook | eBay

**Table Columns:**
- Thumbnail (hover to preview full image)
- Item Title
- Price
- Date Listed
- Client Name
- Platform badge (CL/FB/eBay)
- Status with per-platform progress indicators

**Listing Status Flow:**
```
Needs Review --> Pending --> Running --> Active
                                    --> Error (retryable)
                                    --> Compliance Error (fix required)
             --> Denied (admin rejected)
```

**Actions:**
- **"+ New Listing"** — opens the Add Listing modal
- Click any item to **edit** in the listing modal
- **"Retry"** button on errored items
- View automation history via the **Job Detail Drawer**

### 4.3 Add / Edit Listing Modal

**Fields:**
- Item Title (required)
- Price (required)
- Client Name
- Description (required)
- Platform: Both (FB+CL) | All (CL+FB+eBay) | Craigslist Only | Facebook Only | eBay Only
- Condition: New | Like New | Good | Used | For Parts
- Photos: Upload up to 6 images (supports JPG, PNG, HEIC, WebP)

**Image Processing (automatic):**
- HEIC files converted to JPEG
- Images resized to max 1200px
- JPEG compressed at 70% quality

**Actions in Edit Mode:**
- **Save Changes** — updates the listing
- **Re-Post to Marketplaces** — re-queues for automation
- **Remove Item** — two options:
  - "Sold by Garage Scholars" — moves to `sold_inventory` archive
  - "Duplicate / Void" — permanently deletes

### 4.4 Review Queue (Safety Approval)

Before a listing goes live, it must pass a **10-point safety check**:

| # | Check | Rule |
|---|---|---|
| 1 | Title length | 5–80 characters |
| 2 | Description | 20+ characters |
| 3 | Price range | $1 – $99,999 |
| 4 | Photos | At least 1 uploaded |
| 5 | Condition | Must be set |
| 6 | No ALL CAPS title | Prevents spammy titles |
| 7 | No phone numbers | In description |
| 8 | No URLs | In description |
| 9 | No prohibited items | See list below |
| 10 | Client name | Must be provided |

**Prohibited Item Categories:**
- Weapons (guns, ammo, firearms, AR-15, shotgun, etc.)
- Drugs (marijuana, cannabis, THC, CBD, vape, etc.)
- Animals (puppy, kitten, livestock, reptile)
- Adult items
- Counterfeits (replica, knockoff, bootleg, fake)
- Hazardous (explosive, firework, pepper spray)
- Regulated (prescription, medication)
- Digital goods (gift card, NFT, software license)

**Risk Scoring:**
- 0–2 failures = Low risk (green)
- 1 failure = Medium risk (amber)
- 3+ failures = High risk (red)
- Prohibited keyword detected = **Critical** (blocks approval)

**Actions:**
- **Approve & Post** — sets status to "Pending" and triggers marketplace automation
- **Deny** — sets status to "Denied" (requires a reason)

### 4.5 Payouts & Commission

Tracks the 50/50 revenue split between Garage Scholars and clients.

**Commission Model:** Garage Scholars takes **50%** of every sale.

**Summary Cards:**
- Gross Revenue (all sales)
- Our Commission (50%)
- Total Owed to Clients
- Total Paid Out

**Per-Client Breakdown:**
- Client name with avatar
- Items sold count
- Outstanding balance (owed minus paid)
- Expandable view showing:
  - Individual item sales with commission splits
  - Payout history (method, amount, date, notes)
  - **"Record Payout"** button

**Recording a Payout:**
1. Click "Record Payout" on a client
2. Select payment method: Venmo | Zelle | PayPal | Cash | Check
3. Add optional notes (e.g., Venmo handle)
4. Confirm — creates payout record and sends confirmation email

**Filters:** Unpaid (default) | All

### 4.6 Messages (Buyer Conversations)

Two-pane layout: inbox on the left, chat on the right.

**Inbox shows:**
- Buyer name
- Platform badge (eBay, Craigslist, Facebook, Other)
- Item title
- Last message preview
- Unread indicator (blue dot)

**Actions:**
- Click a conversation to open it and mark as read
- **"+ New"** to create a new conversation (buyer name, platform, item title, initial message)
- Send replies within the app
- Note: For marketplace-specific messages, reply on the platform directly

### 4.7 Settings

**eBay Connection:**
- Status indicator (green = connected, red = expired token)
- Environment: production or sandbox
- Publish mode: Auto-publish or Draft-only

**Rate Limits (Today):**
- Facebook: 10 posts/day max
- Other platforms: 20 posts/day max
- Color-coded progress bars (green/amber/red)

**Backend Worker Health:**
- Online/Offline status
- Uptime, jobs processed, success/failure counts
- Active jobs vs max concurrent jobs
- Worker ID

### 4.8 Notifications Panel

Slide-in panel from the right side. Shows automation alerts:

- **Dead Letter Job** — a job permanently failed after 3 retries (red)
- **Compliance Failed** — listing violated platform policies (amber)

**Actions:** Retry | Dismiss | Mark All Read

### 4.9 Job Detail Drawer

Opens when you click an inventory item's automation history:

- **Platform Status Cards** — per-platform (CL/FB/eBay) status with listing IDs
- **Error Detail** — last error message and platform
- **Automation Job Timeline** — chronological list of all attempts with status, error, worker ID, timestamp
- **Actions:** Retry Automation | Edit | Mark Sold

---

## 5. Admin Light View — Scheduling System (Admin)

This is a lighter admin interface focused on **job management and scholar oversight**.

### 5.1 Master Schedule

View all jobs across all scholars:

- **List View** — sortable table of all jobs
- **Calendar View** — visual calendar layout
- **Filters** — by status, date, scholar

**Job Statuses:**
```
UPCOMING --> IN_PROGRESS --> REVIEW_PENDING --> COMPLETED
                                            --> CHANGES_REQUESTED
         --> CANCELLED
```

### 5.2 Add Job

Create a new garage clean-out job:
- Client name
- Address (full address with components)
- Date and time
- Pay amount ($275–$600+ typical range)
- Description and special instructions
- Assign to a specific scholar (optional)

### 5.3 Pending Approvals

Review scholar requests:
- Scholars can request to add custom tasks to their job checklists
- Admins approve or reject each task request
- Status: PENDING | APPROVED

### 5.4 Admin Controls

- **Transfer Job** — reassign a job from one scholar to another
- **Reschedule** — change job date/time
- **Cancel** — cancel a job

### 5.5 SMS Outbox

Monitor SMS broadcasts sent to the team:
- Milestone celebration messages
- Generated by Gemini AI for engaging content
- Sent to scholars' registered phone numbers

### 5.6 Payout Management

**Approve & Pay workflow:**
1. Job appears in REVIEW_PENDING status
2. Review side-by-side check-in/check-out photos
3. Review completed checklist with timestamps
4. See calculated work duration
5. Click **"Approve & Pay $[amount]"** — creates payout record, updates job to COMPLETED
6. Or click **"Request Changes"** — adds notes, sets job to CHANGES_REQUESTED

**Payout Dashboard:**
- Summary cards: Pending | Paid (YTD) | Total Payouts
- Mark individual payouts as paid with method (Venmo, Zelle, Cash, Check)
- Add transaction notes/IDs

**1099 Tax Export:**
- Click "Export for Taxes"
- Auto-filters scholars earning >$600/year
- Downloads CSV: Scholar Name, Email, Total Paid (YTD), Tax ID
- Named: `1099-data-2026.csv`

### 5.7 Email Notifications (Automatic)

When a scholar completes a job (status -> REVIEW_PENDING):
- Cloud Function triggers automatically
- Sends formatted email to `garagescholars@gmail.com`
- Includes embedded check-in/check-out photos
- Clickable video link
- One-click approve/pay button
- Work duration calculation

---

## 6. Scholar View — Scheduling System (Scholar)

This is the **employee-facing view** for scholars doing the actual garage clean-out work.

### 6.1 Dashboard / Home

- Welcome message with scholar's name
- **Goal Tracker** — visual progress toward monthly income goal with milestone celebrations
- List of upcoming assigned jobs

### 6.2 My Schedule

All jobs assigned to you, sorted by date:
- Job cards showing: client name, address, date/time, pay, status
- Status color coding:
  - Blue = Upcoming
  - Yellow = In Progress
  - Orange = Review Pending
  - Green = Completed
  - Red = Cancelled

### 6.3 Job Board

Browse available unassigned jobs:
- Jobs marked as **"Hot"** if high-pay or urgent
- Click to claim a job (moves to UPCOMING status)

### 6.4 Job Detail View

The main work interface for executing a job:

**Check-In Process:**
1. Arrive at the property
2. Click **"Check In"**
3. Take/upload a photo of the front of the house
4. Photo uploads to Firebase Storage
5. Job status changes to IN_PROGRESS

**Checklist Management:**
- View assigned tasks
- Check off completed tasks (real-time sync across devices)
- Request to add custom tasks (requires admin approval)

**Check-Out Process:**
1. Complete all checklist items
2. Click **"Complete Job (Check Out)"**
3. Upload a front-of-house "after" photo
4. Record a video of the organized garage
5. Media uploads to Firebase Storage
6. Job status changes to REVIEW_PENDING
7. Admin receives email notification with all media

**Quality Report:**
- AI-powered analysis (Google Gemini) compares before/after photos
- Generates quality assessment automatically

### 6.5 Profile

- **Personal Stats:** Rating, completed jobs, experience level
- **Earnings:** Pending and paid amounts
- **Goal Setting:** Set monthly income goal
- **Phone Number:** Register for SMS milestone alerts
- **1099 Info:** Download tax information if earnings exceed $600

### 6.6 Notifications

Real-time alerts:
- 3-day warning before upcoming jobs
- Task approval/rejection notifications
- Milestone celebration messages
- Job status changes

---

## 7. Marketing Website

The public-facing website at `garage-scholars-website.vercel.app`:

- Static HTML/CSS site
- **Quote Request Modal** — customers submit their info for a quote
- Submissions go to Firestore and trigger a Cloud Function
- No login required for customers

---

## 8. Key Workflows Step-by-Step

### 8.1 Creating and Posting a Resale Listing (Admin)

```
1. Resale Concierge > Click "+ New Listing"
2. Fill in title, price, client name, description
3. Select platform (Both, All, CL Only, FB Only, eBay Only)
4. Select condition
5. Upload up to 6 photos
6. Click "Create & Post"
7. Item appears in Review Queue with status "Needs Review"
8. Review safety checks (10-point inspection)
9. Click "Approve & Post"
10. Status changes to "Pending"
11. Backend automation picks up the job
12. Status changes to "Running" then "Active" when posted
13. If error: view in Job Detail Drawer, click "Retry"
```

### 8.2 Recording a Client Payout (Admin)

```
1. Resale Concierge > Payouts tab
2. Find client with outstanding balance
3. Expand their section
4. Review sold items and commission splits
5. Click "Record Payout ($X.XX)"
6. Select payment method (Venmo/Zelle/PayPal/Cash/Check)
7. Add notes (e.g., "@handle" for Venmo)
8. Confirm — payout recorded, confirmation email sent
```

### 8.3 Full Job Lifecycle (Scheduling)

```
ADMIN:
1. Scheduling System > Click "Add Job"
2. Fill in client, address, date/time, pay, description
3. Assign to a scholar (or leave unassigned for Job Board)

SCHOLAR:
4. See job in My Schedule (or claim from Job Board)
5. On job day, click "Check In"
6. Upload front-of-house photo
7. Work through checklist items (checking each off)
8. When done, click "Complete Job (Check Out)"
9. Upload after photo + garage video

ADMIN:
10. Receive email notification with all media
11. Review in Pending Reviews
12. Compare check-in vs check-out photos
13. Click "Approve & Pay $[amount]"
14. Payout record created
15. Mark as paid with payment method
```

### 8.4 Handling a Failed Automation (Admin)

```
1. Notification badge appears (bell icon, top-right)
2. Open Notifications Panel
3. See "Dead Letter Job" or "Compliance Failed" alert
4. Click the linked inventory item
5. Job Detail Drawer opens with full timeline
6. Review error messages and debug screenshots
7. If fixable: edit the listing, then click "Retry Automation"
8. If compliance issue: fix the flagged content, then retry
9. Dismiss the notification
```

---

## 9. Data & Backend Architecture

### 9.1 Firestore Collections

| Collection | Purpose |
|---|---|
| `inventory` | Resale listings (active) |
| `sold_inventory` | Archived sold items |
| `automationJobs` | Marketplace posting job queue |
| `conversations` | Buyer message threads |
| `payouts` | Client and scholar payment records |
| `adminNotifications` | Automation failure alerts |
| `rateLimits` | Platform posting rate limits |
| `postingHistory` | Duplicate detection log |
| `integrations/ebay` | eBay OAuth tokens |
| `mail` | Transactional email queue |
| `users` | Scholar/admin accounts |
| `serviceJobs` (or `jobs`) | Garage clean-out job records |
| `signupRequests` | Pending scholar signup approvals |

### 9.2 Backend Automation Worker

The backend is **not a REST API** — it's a **Firestore-driven job queue worker**:

- Polls Firestore every 5 seconds for pending inventory items
- Claims jobs with a 5-minute lease
- Launches headless Chrome with anti-detection (stealth plugins, fingerprinting, proxies)
- Posts to Craigslist, Facebook Marketplace, and/or eBay in parallel
- Retries up to 3 times before dead-lettering
- Rate limits: FB = 10/day, CL = 20/day

**Health endpoints:**
- `GET /health` — worker status
- `GET /stats` — job processing statistics

### 9.3 Cloud Functions (5 total)

1. `generateSopForJob` — AI-generated standard operating procedures
2. `approveSignup` — admin approves scholar signup
3. `declineSignup` — admin rejects scholar signup
4. `submitQuoteRequest` — handles website quote form
5. `sendJobReviewEmail` — emails admin when scholar completes a job

---

## 10. Deployment & Environment

### 10.1 Hosting

| App | Host | Build Tool |
|---|---|---|
| Marketing Website | Vercel | Static HTML |
| Resale Concierge | Firebase Hosting | Vite (React) |
| Scheduling System | Firebase Hosting | Vite (React + TypeScript) |
| Backend Worker | Local / Server | Node.js |

### 10.2 Key Environment Variables

**Frontend apps** use `VITE_FIREBASE_*` prefixed variables:
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

**Backend** uses:
- `WORKER_ID`, `MAX_ATTEMPTS`, `MAX_CONCURRENT_JOBS`
- `EBAY_CLIENT_ID`, `EBAY_CLIENT_SECRET`
- `PROXY_URL`, `CAPTCHA_API_KEY`
- `CL_EMAIL`, `CL_LOCATION_CODE`
- Payment card details for Craigslist posting fees

### 10.3 Deploy Commands

```bash
# Frontend (Resale Concierge)
cd frontend && npm run build
firebase deploy --only hosting:resale

# Scheduling System
cd schedulingsystem && npm run build
firebase deploy --only hosting:scheduling

# Cloud Functions
cd schedulingsystem/functions && npm install && npm run build
firebase deploy --only functions

# Website
# Push to GitHub > Vercel auto-deploys

# Backend Worker
cd backend && node server.js
```

---

## 11. Troubleshooting

| Problem | Solution |
|---|---|
| Can't log in | Verify your email is in the whitelist (App.jsx line 16-20) |
| Photos not loading in review modal | Check Firebase Storage paths and rules |
| Listing stuck in "Running" | Check backend worker health at `/health` endpoint |
| Automation keeps failing | Open Job Detail Drawer, check error + screenshots |
| Payout not appearing | Verify payout document was created in Firestore |
| eBay token expired (red status) | Go to Settings, re-authorize eBay connection |
| Rate limit hit | Wait for the rolling 24-hour window to reset |
| Scholar can't access scheduling | Admin must approve their signup request first |
| 1099 export is empty | Check year filter and $600 threshold |
| Checklist not syncing | Verify Firestore listeners and `merge: true` pattern |
| Email notifications not sending | Check Firebase email extension config and Gmail app password |

---

## Quick Reference

**Firebase Project:** `garage-scholars-v2`
**GitHub:** `tsodia/garage-scholars-applications`
**Admin Emails:** tylerzsodia@gmail.com, zach.harmon25@gmail.com, garagescholars@gmail.com
**Commission Split:** 50/50
**Tax Threshold:** $600/year for 1099
**Rate Limits:** Facebook 10/day, Craigslist 20/day
**Max Retry Attempts:** 3 before dead letter
