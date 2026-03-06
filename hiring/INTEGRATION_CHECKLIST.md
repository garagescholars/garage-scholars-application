# Garage Scholars — Hiring Pipeline Integration Checklist

**Role:** Systems Engineer, Hiring & Recruiting Operations
**System:** Zero-Touch Applicant Screening & Evaluation Pipeline
**Stack:** Firebase Cloud Functions | Firestore | Firebase Storage | Anthropic Claude | Google Gemini | Cal.com
**Reference:** `Garage Scholars Documentation/garage_scholars_ hiring automation guide.docx`

---

## System Architecture Overview

```
ENTRY POINTS
├─ garagescholars.com/apply.html                    (source: "direct")
├─ garagescholars.com/apply.html?source=indeed      (Indeed job posting)
├─ garagescholars.com/apply.html?source=handshake   (Handshake posting)
├─ garagescholars.com/apply.html?source=referral    (Flyer / referral link)
└─ [standalone] hiring/application-form/index.html  (backup / direct link)
    │
    ▼ Firestore Trigger
gs_hiringApplicants → gsScoreHiringApplication (Claude AI, 4 dimensions)
    │
    ├─ PASS (≥60) → Video invite email → status: video_invited
    └─ FAIL → Rejection email → status: rejected
    │
    ▼ Firestore Trigger
gs_hiringVideoCompletions → gsProcessVideoCompletion (Gemini 2.0 Flash, native video, 5 dimensions)
    │
    ├─ PASS (≥65) → Zoom invite email (Cal.com) → status: zoom_invited
    └─ FAIL → Rejection email → status: rejected
    │
    ▼ HTTP Webhook
Cal.com booking → gsCalBookingWebhook → Founder dossier email → status: zoom_scheduled
    │
    ▼ Firestore Trigger
gs_hiringInterviewScores → gsProcessInterviewScore (Weighted: App 20% + Video 30% + Zoom 50%)
    │
    ├─ ≥75 → Offer email → status: hired
    ├─ 60-74 → Founder review email → status: review_needed
    └─ <60 → Rejection email → status: rejected
    │
    ▼ Scheduled (Monday 8 AM MST)
gsHiringWeeklyDigest → Pipeline summary email to founders
```

### Where the code lives

| Component | Location |
|-----------|----------|
| Cloud Functions (all 7) | `mobile/functions/src/gs-hiring.ts` |
| Type definitions | `mobile/functions/src/gs-hiring-types.ts` |
| Function exports | `mobile/functions/src/index.ts` |
| Application form (website) | `Website/src/pages/apply.html` |
| Application form (standalone) | `hiring/application-form/index.html` |
| Video recording app | `hiring/video-app/index.html` → deployed at `https://gs-video-screen.vercel.app` |
| Interview scoring UI | `hiring/interview-scoring/index.html` → deployed at `https://interview-scoring-weld.vercel.app` |
| Firestore rules | `mobile/firestore.rules` |
| Storage rules | `mobile/storage.rules` |
| Collection constants | `mobile/functions/src/gs-constants.ts` |

---

## PHASE 1: Entry Point Integration

### 1.1 Website — "Join Our Team"

- [x] `Website/src/pages/apply.html` rewritten to submit to `gs_hiringApplicants`
- [x] Form includes: name, email, phone, source, isStudent (conditional: school, year), 6 screening questions
- [x] Source auto-detected from URL param `?source=`
- [x] Form writes `status: 'pending_ai'` and `appliedAt: serverTimestamp()`
- [x] Success message: "Application Received! You'll hear from us within 24-48 hours."
- [x] Website rebuilt: `cd Website && node build.js` (built Feb 28)
- [x] Deployed to Vercel: `garage-scholars-website` (auto-deploys on push to main)
- [x] Header nav "Join Our Team" → apply.html
- [x] Footer "Join Our Team" → apply.html
- [x] Verified live: `apply.html?source=indeed` → dropdown auto-selects "Indeed"
- [x] Verified live: `apply.html?source=handshake` → dropdown auto-selects "Handshake"

### 1.2 Indeed Job Posting *(Manual — Tyler)*

- [ ] Update Indeed job posting description to include application link:
  ```
  APPLY HERE: https://garagescholars.com/apply.html?source=indeed
  ```
- [ ] Indeed posting "How to apply" section points to the URL above
- [ ] Screening questions in Indeed posting match Spec Step 6.1 (for context, not submission):
  1. Transportation & vehicle situation
  2. Tools owned/used
  3. Independent physical project
  4. Problem-solving scenario
  5. Availability & commitments
  6. Why this job interests you
- [x] Verified: Link loads with source="indeed" pre-selected (tested Mar 1)

### 1.3 Handshake Job Posting *(Manual — Tyler)*

- [ ] Update Handshake posting to include application link:
  ```
  APPLY HERE: https://garagescholars.com/apply.html?source=handshake
  ```
- [x] Verified: Link loads with source="handshake" pre-selected (tested Mar 1)

### 1.4 Referral / Flyer Distribution *(Manual — Cowork)*

- [x] Referral link ready: `https://garagescholars.com/apply.html?source=referral`
- [ ] Create flyer / QR code pointing to referral URL
- [x] Verified: Referral link loads with source="referral" pre-selected (tested Mar 1)

### 1.5 Standalone Backup Form

- [x] `hiring/application-form/index.html` has URL param source detection
- [x] Firebase config is real (garage-scholars-v2 project, not placeholder)
- [x] Form submits to same `gs_hiringApplicants` collection
- [x] Primary form lives on garagescholars.com/apply.html — standalone serves as backup

---

## PHASE 2: Secrets & Environment Variables

### 2.1 Firebase Secrets (required for Cloud Functions)

- [x] `GEMINI_API_KEY` — Set (shared with social media poster)
- [x] `ANTHROPIC_API_KEY` — Set (shared with SOP generator)
- [x] `CAL_WEBHOOK_SECRET` — Set (`gs-hiring-webhook-2026`)
- [x] All secrets verified accessible via `firebase functions:secrets:access`

### 2.2 Environment Config (optional overrides)

- [x] `VIDEO_APP_URL` — Hardcoded default: `https://gs-video-screen.vercel.app` (updated Mar 1)
- [x] `CAL_LINK` — Hardcoded default: `https://cal.com/garagescholars/interview` (verified live Mar 1)

---

## PHASE 3: Firebase Rules & Security

### 3.1 Firestore Rules (Spec SEC-001 through SEC-007)

- [x] `mobile/firestore.rules` includes:
  - `gs_hiringApplicants`: public create + get, admin-only list/update/delete (video app can update status to pending_video)
  - `gs_hiringVideoCompletions`: public create, admin-only read/update/delete
  - `gs_hiringInterviewScores`: admin-only read/write
- [x] Rules deployed: `firebase deploy --only firestore:rules,firestore:indexes`

### 3.2 Storage Rules

- [x] `mobile/storage.rules` includes:
  - `hiring-videos/{applicantId}/{videoFile}`: public write (video types only, max 100MB), authenticated read
- [x] Rules deployed: `firebase deploy --only storage`

### 3.3 Security Verification (Spec Step 8.3)

- [x] SEC-001: All API keys accessed via Firebase secrets / `defineSecret` (none hardcoded in source)
- [x] SEC-002: Firestore admin-only rules enforced for scoring collections
- [x] SEC-003: Video app uses Firestore document IDs (UUID-like) for applicant IDs
- [x] SEC-005: No PII beyond answers/transcripts sent to AI APIs
- [x] SEC-007: Rejection emails contain no scoring data (verified in email templates in gs-hiring.ts)

---

## PHASE 4: Deployment

### 4.1 Cloud Functions

- [x] All 7 functions implemented and exported in `mobile/functions/src/index.ts`:
  - `gsScoreHiringApplication` (Claude Haiku, 512MB, 120s)
  - `gsProcessVideoCompletion` (Gemini 2.0 Flash, 1GB, 300s)
  - `gsCalBookingWebhook` (HTTP, 256MB, 30s)
  - `gsProcessInterviewScore` (256MB, 60s)
  - `gsHiringWeeklyDigest` (scheduled Mon 8am MST, 256MB, 60s)
  - `gsVerifyVideoAccess` (HTTP, 256MB, 30s) — token-based video app security
  - `gsHiringVideoReminder` (scheduled every 6h, 256MB, 60s) — 48h reminder + 96h auto-reject
- [x] Build: `cd mobile/functions && npm run build` (zero errors)
- [x] Deployed: All 7 hiring functions live (last deploy: Mar 1)

### 4.2 Website

- [x] Build: `cd Website && node build.js` (built Feb 28)
- [x] Pushed to main → auto-deploys to Vercel (`garage-scholars-website`)
- [x] Verified live: `https://garagescholars.com/apply.html` (tested Mar 1)

### 4.3 Video Screen App

- [x] Hosted at `https://gs-video-screen.vercel.app`
- [x] Security: Token-based access — applicants can only access via personalized link in email
- [x] Token verification via `gsVerifyVideoAccess` Cloud Function on page load
- [x] Domain added to Firebase Auth authorized domains
- [x] Security headers: CSP, HSTS, camera/mic permissions

### 4.4 Cal.com Setup

- [x] Create Cal.com account
- [x] Create event type: "Garage Scholars Interview"
- [x] Configure webhook:
  - URL: `https://us-central1-garage-scholars-v2.cloudfunctions.net/gsCalBookingWebhook`
  - Events: `BOOKING_CREATED`
  - Secret: `gs-hiring-webhook-2026`
- [x] Booking page live: `https://cal.com/garagescholars/interview` (verified Mar 1)
- [x] `admin@garagescholars.com` Google Calendar connected in Cal.com
  - Share admin calendar with personal Gmail accounts for visibility as needed
- [x] E2E test: Webhook fires → dossier email received (tested Mar 1)

---

## PHASE 5: End-to-End Testing (Spec Step 9)

**E2E test run: March 1, 2026 — ALL STAGES PASSED**
Test script: `hiring/e2e-test/run-e2e.mjs`

### 5.1 Application Intake (FR-001, FR-002)

- [x] Submit test application via programmatic Firestore write → doc created in `gs_hiringApplicants`
- [x] `gsScoreHiringApplication` triggers within 5 seconds
- [x] AI scores appear on applicant doc: `appScores.composite_score` = 91, `appScores.pass` = true

### 5.2 Pass/Fail Emails (FR-003, FR-004)

- [x] Strong applicant (score ≥60): receives video invite email with unique link
- [x] Founders receive notification email for both outcomes
- [x] Video invite link format: `{VIDEO_APP_URL}?id={applicantId}&token={token}`

### 5.3 Video Screen (FR-005, FR-006, FR-007)

- [x] 5 mock WebM videos generated with ffmpeg, uploaded to Firebase Storage
- [x] `gs_hiringVideoCompletions` doc created → triggers `gsProcessVideoCompletion`
- [x] Gemini scores all 5 videos via native video input → `videoScores` stored on applicant doc
- [x] Video scores include: composite, 5 dimensions, strengths, concerns, red_flags
- [x] Mock blue-screen videos correctly scored 0/100 and rejected (expected behavior)

### 5.4 Video Pass/Fail (FR-008)

- [x] Video fail (<65 or red flags): rejection email sent (verified with mock videos)
- [x] Founders notified with scores + strengths/concerns

### 5.5 Zoom Booking (FR-009)

- [x] HMAC-signed Cal.com webhook accepted (HTTP 200) → `gsCalBookingWebhook`
- [x] Applicant status → `zoom_scheduled`
- [x] Founder dossier email sent with scores + contact info + Zoom time

### 5.6 Decision Engine (FR-010, FR-011, FR-012)

- [x] Create `gs_hiringInterviewScores` doc with test data (6 questions + gut_check)
- [x] `gsProcessInterviewScore` calculates weighted final: App 18/20 + Video 22/30 + Zoom 42/50 = 81/100
- [x] Score ≥75 + gut="yes" → HIRE decision, offer email sent, status → `hired`

### 5.7 Weekly Digest (FR-014)

- [x] `gsHiringWeeklyDigest` deployed with enhanced funnel metrics
- [x] Now includes: pass rates, drop-off rates, time-to-hire, source breakdown

### 5.8 Error Handling (FR-013)

- [x] AI scoring failure → error notification email to founders (code verified)
- [x] Video processing failure → error notification email to founders (code verified)

---

## PHASE 6: Indeed / Handshake Job Posting Copy

### 6.1 Indeed Posting Template

```
TITLE: Garage Transformation Technician — $35-45/hr | Garage Scholars (Denver)

COMPANY: Garage Scholars
LOCATION: Denver Metro Area, CO
TYPE: Part-time / Flexible
PAY: $35-45/hour

ABOUT US:
We transform messy garages into organized, functional spaces. You'll install
shelves, wall-mounted storage, clean, organize, and interact with homeowners.
Founded by a Doctor of Physical Therapy and a PhD — we're a startup that
moves fast and values people who show up.

WHAT YOU'LL DO:
• Install shelving systems and wall-mounted storage
• Clean out and organize garages
• Interact professionally with homeowners
• Work independently at job sites across Denver

WHAT WE'RE LOOKING FOR:
• Reliable transportation to job sites
• Comfortable with basic tools (drill, level, tape measure)
• Self-starter who can work independently
• Available 10-20+ hours/week
• No experience required — we train you

BENEFITS:
• $35-45/hour
• Flexible schedule — work around classes or other commitments
• Same-day pay available
• Team jobs with friends
• Build real project management skills

HOW TO APPLY:
Apply directly at: https://garagescholars.com/apply.html?source=indeed
Quick application (5-10 min) — answer 6 short questions about your
experience and availability. No resume required.
```

### 6.2 Handshake Posting Template

Same as Indeed, but change the apply link to:
```
https://garagescholars.com/apply.html?source=handshake
```

---

## PHASE 7: Email Templates Verification (Spec Step 6.7)

All emails sent via Firestore `mail` collection (Firebase Firestore-Send-Email extension).
All email templates implemented in `mobile/functions/src/gs-hiring.ts`.

- [x] **Application rejection**: Subject = "Update on Your Garage Scholars Application"
- [x] **Video invite**: Subject = "Next Step — Garage Scholars Video Screen (5 min)"
- [x] **Video rejection**: Subject = "Update on Your Garage Scholars Application"
- [x] **Zoom invite**: Subject = "Garage Scholars — Let's Talk (15 min Zoom)"
- [x] **Founder dossier**: Subject = "[GS INTERVIEW] {name} — {datetime}"
- [x] **Offer email**: Subject = "Welcome to Garage Scholars"
- [x] **Final rejection**: Subject = "Update on Your Garage Scholars Application"
- [x] **Decision summary**: Subject = "[GS DECISION] {name} — {HIRE/REJECT/REVIEW} ({score}/100)"
- [x] **Weekly digest**: Subject = "[GS Hiring] Weekly Pipeline Digest — {date}"
- [x] **Error alerts**: Subject = "[GS Hiring ERROR] {description}"

---

## PHASE 8: Monitoring & Maintenance (Spec Step 10)

### 8.1 Weekly Review

- [ ] Monday 8 AM: Check weekly digest email for pipeline health
- [ ] Review funnel metrics:
  - Applications received per source (Indeed vs. Handshake vs. Website vs. Referral)
  - Pass rate at application stage (target: 30-40%)
  - Pass rate at video stage (target: 60-70% of those who passed app)
  - Zoom → offer rate (target: 70-80%)
  - Drop-off rate at video stage (target: <30%)

### 8.2 Monthly Calibration (Spec Step 10.1)

- [ ] Week 2: Review first 10 hires. Did AI scores correlate with Zoom performance?
- [ ] Week 4: Review first 3 hires' 30-day job performance
- [ ] Monthly: Check pass rates — adjust thresholds if too many pass (>50%) or too few (<10%)
- [ ] Tune AI scoring prompts based on hire quality data (after 10+ hires)

### 8.3 Ongoing Maintenance

- [ ] Monitor Firebase Functions error logs: `firebase functions:log`
- [ ] Check email delivery rates (Firestore-Send-Email extension logs)
- [ ] Verify GEMINI_API_KEY and ANTHROPIC_API_KEY remain valid
- [ ] Watch Firebase Storage usage (hiring videos)
- [x] Storage lifecycle rule: auto-delete `hiring-videos/` after 90 days (set via GCS API, Mar 1)

### 8.4 Improvement Backlog (Spec Step 10.2)

| Priority | Improvement | Trigger | Effort |
|----------|-------------|---------|--------|
| 1 | AI scoring prompt tuning | After 10+ hires | 2 hours |
| 2 | SMS notifications via Twilio | If email response time too slow | 1 hour |
| 3 | Founder dashboard in admin app | Volume > 20 applicants/week | 2 days |
| 4 | ~~48-hour video reminder email~~ | ~~FR-015~~ | ~~DONE~~ — `gsHiringVideoReminder` deployed (48h reminder + 96h auto-reject) |
| 5 | ~~Storage lifecycle rule (90-day delete)~~ | ~~SEC-004~~ | ~~DONE~~ — Set via GCS JSON API (Mar 1) |
| 6 | Indeed API integration (replace link approach) | When volume justifies | 4 hours |
| 7 | ~~Founder interview scoring UI~~ | ~~Replace manual Firestore writes~~ | ~~DONE~~ — deployed at `https://interview-scoring-weld.vercel.app` |

---

## PHASE 9: Founder Interview Scoring

**COMPLETED & DEPLOYED** — `https://interview-scoring-weld.vercel.app`

Source: `hiring/interview-scoring/index.html`

Founders sign in with Google (admin emails only: `tylerzsodia@gmail.com`, `zach.harmon25@gmail.com`).
The UI shows candidates in `zoom_scheduled` status with their full dossier (app scores, video scores, AI summaries, strengths, concerns).
Founders rate 6 questions (1-5), select gut check (yes/maybe/no), add notes, and submit.
Submission writes to `gs_hiringInterviewScores` → triggers `gsProcessInterviewScore` → weighted final → decision email.

Security:
- Google Sign-In with admin email whitelist (client + Firestore rules)
- `signInWithPopup` primary, `signInWithRedirect` fallback
- Vercel domain added to Firebase Auth authorized domains
- HSTS, X-Frame-Options DENY, CSP via Permissions-Policy, nosniff

**Redeploy:** `cd hiring/interview-scoring && npx vercel --prod`

---

## PHASE 10: Firebase Auth Authorized Domains

All hosting domains registered in Firebase Auth → Authentication → Settings:

| Domain | Purpose |
|--------|---------|
| `localhost` | Local development |
| `garage-scholars-v2.firebaseapp.com` | Firebase default |
| `garage-scholars-v2.web.app` | Firebase Hosting |
| `garage-scholars-resale.web.app` | Resale Concierge |
| `interview-scoring-weld.vercel.app` | Interview Scoring UI |
| `gs-video-screen.vercel.app` | Video Recording App |

---

## Quick Reference: Source Attribution Links

| Source | URL |
|--------|-----|
| Website | `https://garagescholars.com/apply.html` |
| Indeed | `https://garagescholars.com/apply.html?source=indeed` |
| Handshake | `https://garagescholars.com/apply.html?source=handshake` |
| Referral / Flyer | `https://garagescholars.com/apply.html?source=referral` |

## Quick Reference: Admin URLs

| Tool | URL |
|------|-----|
| Interview Scoring | `https://interview-scoring-weld.vercel.app` |
| Cal.com Booking | `https://cal.com/garagescholars/interview` |
| Firebase Console | `https://console.firebase.google.com/project/garage-scholars-v2` |

---

*Generated: February 2026 | Last updated: March 1, 2026 | Spec reference: garage_scholars_hiring_automation_guide.docx*
