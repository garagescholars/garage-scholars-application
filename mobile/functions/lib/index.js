"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateScholarBio = exports.submitQuoteRequest = exports.sendJobReviewEmail = exports.declineSignup = exports.approveSignup = exports.gsGenerateAssemblyGuide = exports.generateSopForJob = exports.gsHiringVideoReminder = exports.gsVerifyVideoAccess = exports.gsHiringWeeklyDigest = exports.gsProcessInterviewScore = exports.gsCalBookingWebhook = exports.gsProcessVideoCompletion = exports.gsScoreHiringApplication = exports.gsResaleDripNotifications = exports.gsOnConversationReply = exports.gsOnConversationCreated = exports.gsOnItemSold = exports.gsOnResaleStatusChange = exports.gsOnDonationReceiptUploaded = exports.gsOnGymPhotosUploaded = exports.gsOnItemConfirmed = exports.gsAnalyzeItem = exports.gsReviewCampaign = exports.gsRefreshMetaToken = exports.gsProcessSocialContent = exports.gsCreateInvoice = exports.gsExportPaymentData = exports.gsGeneratePaymentReport = exports.gsMarkPayoutPaid = exports.gsResalePayout = exports.gsCreateRetentionSubscription = exports.gsCreateCustomerPayment = exports.gsStripeWebhook = exports.gsCreateStripeAccount = exports.gsReleaseCompletionPayouts = exports.gsJobPrepReminders = exports.gsOnEscalationCreated = exports.gsMultiNotify = exports.gsSendPush = exports.gsSubmitComplaint = exports.gsComputeAnalytics = exports.gsMonthlyGoalReset = exports.gsResetViewerCounts = exports.gsExpireTransfers = exports.gsLockScores = exports.gsOnRescheduleUpdated = exports.gsOnTransferCreated = exports.gsOnJobUpdated = void 0;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-functions/v2/firestore");
const app_1 = require("firebase-admin/app");
const firestore_2 = require("firebase-admin/firestore");
const auth_1 = require("firebase-admin/auth");
const storage_1 = require("firebase-admin/storage");
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const sharp_1 = __importDefault(require("sharp"));
const crypto = __importStar(require("crypto"));
(0, app_1.initializeApp)();
// ── Garage Scholars Mobile App functions ──
var gs_functions_1 = require("./gs-functions");
Object.defineProperty(exports, "gsOnJobUpdated", { enumerable: true, get: function () { return gs_functions_1.gsOnJobUpdated; } });
Object.defineProperty(exports, "gsOnTransferCreated", { enumerable: true, get: function () { return gs_functions_1.gsOnTransferCreated; } });
Object.defineProperty(exports, "gsOnRescheduleUpdated", { enumerable: true, get: function () { return gs_functions_1.gsOnRescheduleUpdated; } });
Object.defineProperty(exports, "gsLockScores", { enumerable: true, get: function () { return gs_functions_1.gsLockScores; } });
Object.defineProperty(exports, "gsExpireTransfers", { enumerable: true, get: function () { return gs_functions_1.gsExpireTransfers; } });
Object.defineProperty(exports, "gsResetViewerCounts", { enumerable: true, get: function () { return gs_functions_1.gsResetViewerCounts; } });
Object.defineProperty(exports, "gsMonthlyGoalReset", { enumerable: true, get: function () { return gs_functions_1.gsMonthlyGoalReset; } });
Object.defineProperty(exports, "gsComputeAnalytics", { enumerable: true, get: function () { return gs_functions_1.gsComputeAnalytics; } });
Object.defineProperty(exports, "gsSubmitComplaint", { enumerable: true, get: function () { return gs_functions_1.gsSubmitComplaint; } });
Object.defineProperty(exports, "gsSendPush", { enumerable: true, get: function () { return gs_functions_1.gsSendPush; } });
// ── Garage Scholars Notification functions ──
var gs_notifications_1 = require("./gs-notifications");
Object.defineProperty(exports, "gsMultiNotify", { enumerable: true, get: function () { return gs_notifications_1.gsMultiNotify; } });
Object.defineProperty(exports, "gsOnEscalationCreated", { enumerable: true, get: function () { return gs_notifications_1.gsOnEscalationCreated; } });
Object.defineProperty(exports, "gsJobPrepReminders", { enumerable: true, get: function () { return gs_notifications_1.gsJobPrepReminders; } });
// ── Garage Scholars Payment functions ──
var gs_payments_1 = require("./gs-payments");
Object.defineProperty(exports, "gsReleaseCompletionPayouts", { enumerable: true, get: function () { return gs_payments_1.gsReleaseCompletionPayouts; } });
Object.defineProperty(exports, "gsCreateStripeAccount", { enumerable: true, get: function () { return gs_payments_1.gsCreateStripeAccount; } });
Object.defineProperty(exports, "gsStripeWebhook", { enumerable: true, get: function () { return gs_payments_1.gsStripeWebhook; } });
Object.defineProperty(exports, "gsCreateCustomerPayment", { enumerable: true, get: function () { return gs_payments_1.gsCreateCustomerPayment; } });
Object.defineProperty(exports, "gsCreateRetentionSubscription", { enumerable: true, get: function () { return gs_payments_1.gsCreateRetentionSubscription; } });
Object.defineProperty(exports, "gsResalePayout", { enumerable: true, get: function () { return gs_payments_1.gsResalePayout; } });
Object.defineProperty(exports, "gsMarkPayoutPaid", { enumerable: true, get: function () { return gs_payments_1.gsMarkPayoutPaid; } });
Object.defineProperty(exports, "gsGeneratePaymentReport", { enumerable: true, get: function () { return gs_payments_1.gsGeneratePaymentReport; } });
Object.defineProperty(exports, "gsExportPaymentData", { enumerable: true, get: function () { return gs_payments_1.gsExportPaymentData; } });
Object.defineProperty(exports, "gsCreateInvoice", { enumerable: true, get: function () { return gs_payments_1.gsCreateInvoice; } });
// ── Garage Scholars Social Media functions ──
var gs_social_1 = require("./gs-social");
Object.defineProperty(exports, "gsProcessSocialContent", { enumerable: true, get: function () { return gs_social_1.gsProcessSocialContent; } });
Object.defineProperty(exports, "gsRefreshMetaToken", { enumerable: true, get: function () { return gs_social_1.gsRefreshMetaToken; } });
// ── Garage Scholars Review Campaign functions ──
var gs_review_campaign_1 = require("./gs-review-campaign");
Object.defineProperty(exports, "gsReviewCampaign", { enumerable: true, get: function () { return gs_review_campaign_1.gsReviewCampaign; } });
// ── Garage Scholars Inventory functions ──
var gs_inventory_1 = require("./gs-inventory");
Object.defineProperty(exports, "gsAnalyzeItem", { enumerable: true, get: function () { return gs_inventory_1.gsAnalyzeItem; } });
Object.defineProperty(exports, "gsOnItemConfirmed", { enumerable: true, get: function () { return gs_inventory_1.gsOnItemConfirmed; } });
Object.defineProperty(exports, "gsOnGymPhotosUploaded", { enumerable: true, get: function () { return gs_inventory_1.gsOnGymPhotosUploaded; } });
Object.defineProperty(exports, "gsOnDonationReceiptUploaded", { enumerable: true, get: function () { return gs_inventory_1.gsOnDonationReceiptUploaded; } });
Object.defineProperty(exports, "gsOnResaleStatusChange", { enumerable: true, get: function () { return gs_inventory_1.gsOnResaleStatusChange; } });
Object.defineProperty(exports, "gsOnItemSold", { enumerable: true, get: function () { return gs_inventory_1.gsOnItemSold; } });
// ── Garage Scholars Resale Messaging & Drip functions ──
var gs_resale_messaging_1 = require("./gs-resale-messaging");
Object.defineProperty(exports, "gsOnConversationCreated", { enumerable: true, get: function () { return gs_resale_messaging_1.gsOnConversationCreated; } });
Object.defineProperty(exports, "gsOnConversationReply", { enumerable: true, get: function () { return gs_resale_messaging_1.gsOnConversationReply; } });
Object.defineProperty(exports, "gsResaleDripNotifications", { enumerable: true, get: function () { return gs_resale_messaging_1.gsResaleDripNotifications; } });
// ── Garage Scholars Hiring Pipeline functions ──
var gs_hiring_1 = require("./gs-hiring");
Object.defineProperty(exports, "gsScoreHiringApplication", { enumerable: true, get: function () { return gs_hiring_1.gsScoreHiringApplication; } });
Object.defineProperty(exports, "gsProcessVideoCompletion", { enumerable: true, get: function () { return gs_hiring_1.gsProcessVideoCompletion; } });
Object.defineProperty(exports, "gsCalBookingWebhook", { enumerable: true, get: function () { return gs_hiring_1.gsCalBookingWebhook; } });
Object.defineProperty(exports, "gsProcessInterviewScore", { enumerable: true, get: function () { return gs_hiring_1.gsProcessInterviewScore; } });
Object.defineProperty(exports, "gsHiringWeeklyDigest", { enumerable: true, get: function () { return gs_hiring_1.gsHiringWeeklyDigest; } });
Object.defineProperty(exports, "gsVerifyVideoAccess", { enumerable: true, get: function () { return gs_hiring_1.gsVerifyVideoAccess; } });
Object.defineProperty(exports, "gsHiringVideoReminder", { enumerable: true, get: function () { return gs_hiring_1.gsHiringVideoReminder; } });
const db = (0, firestore_2.getFirestore)();
const storage = (0, storage_1.getStorage)();
const adminAuth = (0, auth_1.getAuth)();
// Admin emails that have elevated privileges
const ADMIN_EMAILS = [
    'tylerzsodia@gmail.com',
    'zach.harmon25@gmail.com'
];
// ── Package tier descriptions for SOP prompt ──
const PACKAGE_DATA = {
    undergraduate: "The Undergrad ($1,197) — Surface Reset & De-Clutter. 2 Scholars, 4-5 hours. Up to 1 truck bed haul-away included. Broad sorting (Keep/Donate/Trash). 1 zone / 1 shelf included. Sweep & blow clean. Standard Clean guarantee.",
    graduate: "The Graduate ($2,197) — Full Organization Logic & Install. 2 Scholars, 6-8 hours. Up to 1 truck bed haul-away included. Micro-sorting (Sports/Tools/Holiday). $300 credit towards storage & shelving (Bold Series catalog). 8 standard bins included. Deep degrease & wipe down / floor powerwash. 30-Day Clutter-Free Guarantee.",
    doctorate: "The Doctorate ($3,797) — White-Glove Detail. 3 Scholars, 1 full day. Up to 2 truck bed haul-away included. $500 credit towards storage & shelving (Bold Series catalog). 16 premium bins included. Deep degrease & wipe down / floor powerwash. Seasonal swap (1 return visit included). Heavy-duty surcharge waived."
};
const SOP_SYSTEM_PROMPT = `You are writing Standard Operating Procedures for Garage Scholars — a Denver garage transformation company that hires college students (undergrad and grad) as crew members ("scholars"). These students have ZERO construction or trade experience. They may have never used a drill, stud finder, or power washer before.

YOUR #1 RULE: Write every instruction as if the reader has never done this before. Never assume they know how to do anything. If a step involves a tool, tell them exactly how to use that tool. If a step involves a measurement, tell them exactly where to measure from and how to mark it.

SOPs must be:
- Written in plain language a college freshman can follow without Googling anything
- Broken into tiny sub-steps — if you can split a step further, split it
- Specific about WHICH tool, WHICH bolt, WHICH setting, WHERE to stand
- Grounded in what you can see in the intake photos
- Include time estimates for every phase so scholars can pace themselves
- Include "STOP AND CHECK" moments before irreversible steps (drilling, cutting, bolting)

TONE: Direct, friendly, confident. Like a patient older coworker showing you the ropes on your first day. Never condescending, but never assume knowledge.

CRITICAL image analysis rules:
- Describe spatial zones (left wall, back corner, center floor) not item inventories
- Use condition language: "moderate clutter", "clear wall space", "items stacked to approximately 4 feet"
- Never count or name specific items you see in photos
- If something is unclear in a photo, write "assess on arrival" — never guess

═══════════════════════════════════════
  TOOL & EQUIPMENT HOW-TO GUIDE
═══════════════════════════════════════

HOW TO USE A STUD FINDER:
1. Place the stud finder flat against the wall, away from where you think a stud might be
2. Press and hold the power button — wait for it to calibrate (light goes green or it beeps once)
3. Slowly slide it horizontally across the wall — move it about 1 inch per second
4. When it beeps/lights up, that's the EDGE of a stud — mark it with a pencil
5. Keep sliding — when it beeps/lights again, that's the OTHER edge of the stud
6. The CENTER of the stud is halfway between your two pencil marks — mark it with an X
7. Studs are usually 16 inches apart — measure 16" from your first stud to find the next one, then confirm with the stud finder
8. ALWAYS verify with the stud finder, never just assume 16" spacing

HOW TO USE THE DRILL:
1. To insert a drill bit: open the chuck by rotating it counter-clockwise (righty-tighty, lefty-loosey), insert the bit, tighten by hand, then give it a short squeeze on the trigger to fully seat it
2. For PRE-DRILLING (making pilot holes): use the smaller gold-colored drill bit, set the drill to the drill icon (not the screw icon), push firmly into your pencil mark, drill until the bit is about 2" deep, pull straight back out
3. For DRIVING SCREWS/BOLTS: switch to the screw/bolt socket bit, set drill to the screw icon, place the bolt in the hole, push firmly and squeeze the trigger slowly — if it slips, push harder and go slower
4. CLOCKWISE = tighten (drive in). COUNTER-CLOCKWISE = loosen (back out). There's a switch near the trigger to change direction
5. If the drill smells hot or starts smoking, STOP — let it cool for 5 minutes
6. When driving lag bolts into studs, you will feel strong resistance — this is normal and means you hit wood. If it goes in too easily with no resistance, you missed the stud — STOP, back it out, re-check stud location

HOW TO USE A LEVEL:
1. Place the level on the surface you're checking (on top of a shelf, against a cabinet, etc.)
2. Look at the bubble vial in the center — it's a small glass tube with liquid and an air bubble
3. If the bubble is exactly between the two lines, the surface is LEVEL (perfectly flat/horizontal)
4. If the bubble drifts left, the left side is too high — raise the right side or lower the left
5. For vertical checks (plumb), use the vial on the end of the level — same concept, bubble between lines = perfectly vertical
6. ALWAYS check level front-to-back AND left-to-right before tightening anything permanently

HOW TO USE THE POWER WASHER:
1. Connect the garden hose to the water inlet (hand-tighten, no wrench needed), turn on the water fully
2. Connect the high-pressure hose to the wand and to the pump
3. Squeeze the trigger to bleed air out of the line — water should flow from the nozzle
4. Plug in / start the engine — now when you squeeze the trigger, it sprays at high pressure
5. Stand 2-3 feet back from the surface. Hold the wand with BOTH hands. Sweep side to side in even passes, overlapping each pass by a few inches
6. NEVER point at people, pets, windows, or electrical outlets
7. NEVER use on drywall or painted interior walls — concrete floors and bare walls only
8. When done: turn off the machine FIRST, then release remaining pressure by squeezing the trigger, then turn off the water

HOW TO USE THE LABEL MAKER:
1. Turn it on, type the label text (keep it short: "SPORTS", "HOLIDAY", "AUTO", "TOOLS", etc.)
2. Hit print, peel the backing off, stick it on the front-center of the bin
3. Press firmly and smooth out bubbles
4. Make labels ALL CAPS for readability

MEASURING & MARKING:
1. Hook the tape measure tab over the edge of what you're measuring, or press it flat against the wall
2. Pull the tape straight — don't let it sag or curve
3. Read the measurement at the large numbered marks (feet) and small marks (inches). Each small mark = 1/16", but you only need to be accurate to the nearest 1/4"
4. Mark with a pencil — make a small V shape (caret) pointing at your exact measurement, not a dot
5. When marking a level line across a wall: mark both ends, then use the level as a straight edge to connect them with a pencil line

═══════════════════════════════════════
  GARAGE & PRODUCT REFERENCE
═══════════════════════════════════════

STANDARD RESIDENTIAL GARAGE SIZES (Denver Metro):
- 1-car: ~12ft wide x 20ft deep, 8-9ft ceiling
- 2-car: ~20ft wide x 20ft deep, 8-9ft ceiling (MOST COMMON in Denver)
- 3-car: ~30ft wide x 20ft deep, 8-10ft ceiling
- Wall studs are hidden behind drywall, spaced 16" apart (use stud finder to locate)
- Ceiling joists: also hidden, spaced 16" or 24" apart
- Garage door opening: 7ft tall standard, 8ft for oversized

STANDARD TRUCK LOADOUT — WHAT TO BRING:
All jobs:
- Brooms (push broom + angle broom), dustpans, leaf blower, shop vac
- Degreaser spray bottles (2), rags, trash bags (33-gallon AND contractor-grade black bags)
- PPE kit: work gloves for each scholar, safety glasses for each scholar, dust masks
- Moving equipment: furniture dolly, hand truck
- Tool kit: cordless drill + charger + 2 batteries, level (2ft minimum), stud finder, tape measure (25ft), pencil, socket set, Phillips and flathead bits, 5/16" and 3/8" socket bits

Graduate and above — add:
- Power washer + garden hose connector
- 8 clear storage bins (60qt each)
- Label maker + extra tape cartridge
- Zip ties (bag of 100, various sizes)
- Furniture pads (moving blankets)

Doctorate — add:
- 16 premium storage bins total
- Extra contractor bags (box of 20)
- Seasonal storage labels (pre-printed)
- Printed label sheets for custom bin labels
- Extra furniture pads

BOLD SERIES CABINET INSTALLATION (step by step):
Wall Cabinets:
1. Find the studs on the wall where cabinets will go (see HOW TO USE A STUD FINDER above). Mark each stud center with a vertical pencil line
2. Measure 54 inches up from the floor and make a pencil mark on each stud line — this is the BOTTOM of the wall cabinet
3. Use the level to draw a horizontal line connecting all your marks — this is your mounting line
4. STOP AND CHECK: Is the line level? Are you on at least 2 studs? If the answer to either is no, re-measure
5. Hold the cabinet up to the line (TWO people — one holds, one marks). Mark through the cabinet's mounting holes onto the wall
6. Set the cabinet down. Pre-drill pilot holes at each mark using the smaller drill bit — drill about 2.5" deep
7. Hold the cabinet back up to the line. Thread a 5/16" x 3" lag bolt through each mounting hole. Drive them in with the drill socket bit — tighten until snug but don't overtighten (cabinet should not flex)
8. Check level again. If not level, loosen slightly and adjust. MINIMUM 2 lag bolts into 2 different studs per cabinet

Floor Cabinets:
1. Slide the cabinet into position against the wall
2. Place the level on top — check left-right AND front-back
3. If not level: slide plastic or wooden shims under the low side until the bubble is centered. Concrete floors are almost never perfectly flat, so shimming is normal
4. If the cabinet set came with connection bolts, align the pre-drilled holes on adjacent cabinets and bolt them together
5. Optional but recommended: drive a 1/4" lag bolt through the cabinet's back panel into a wall stud to prevent tipping

Worktops (Bamboo or Stainless):
1. ALL cabinets must be installed, leveled, and connected FIRST
2. Lift the worktop and place it on the cabinet frames — it should sit flat and not wobble
3. Look underneath: find the included clips. Attach each clip to the underside of the top and screw into the cabinet frame
4. The top should not slide when you push on it — if it moves, add more clips

OVERHEAD RACK INSTALLATION (step by step):
1. CHECK FIRST: Measure ceiling height with tape measure. Need at least 8ft for 32"-deep racks, at least 9ft for 48"-deep racks. If ceiling is too low, DO NOT install — call admin
2. Decide where the rack will go. It should NOT be directly above where a car parks (door swing clearance). Usually goes toward the back or sides
3. Use stud finder on the CEILING to find joists. Mark the joist centers. Joists run in one direction — once you find one, the next is usually 16" or 24" away in the same direction
4. Hold up the rack's mounting brackets and mark the 4 bolt holes on the ceiling, making sure EACH hole lines up with a joist. NEVER bolt into just drywall — the rack will fall
5. STOP AND CHECK: Are all 4 marks on joists? Use the stud finder to re-verify each mark. This is a 600-lb-rated rack hanging over people's heads — this step is not optional
6. Pre-drill pilot holes at all 4 marks using the smaller drill bit — drill about 2.5" deep into the joist
7. TWO-PERSON JOB: One person holds the bracket in place, the other drives the 3/8" x 3" lag bolts in with the drill socket. You will feel strong resistance — that's good, it means you're in the wood
8. Repeat for all 4 mounting points
9. Hang the rack frame from the mounted brackets, secure with included pins or bolts
10. Test: hang on it briefly (one person). If it holds your body weight, it's solid. If it flexes, creaks, or moves, STOP — something is wrong, re-check all bolts
11. Minimum 7ft clearance below the rack so car doors can open underneath

STANDARD SHELVING INSTALLATION (step by step):
1. Unbox all pieces. Lay them out and match them to the instruction sheet. Don't throw away any hardware bags yet
2. Follow the included instructions to assemble the upright shelf frame — it's usually just hammering shelf clips into the vertical posts and dropping the shelf panels in
3. Stand the shelf upright in its final position against the wall
4. Place the level on the top shelf — adjust the feet (twist them like screws) until level in both directions
5. ANTI-TIP BRACKET (REQUIRED — non-negotiable): Find the L-shaped metal bracket included in the box. Hold it against the wall behind the shelf, high up. Mark the screw hole on the wall
6. Use stud finder to check if your mark is on a stud. If yes: pre-drill and drive a 1/4" lag bolt through the bracket into the stud. If no: move the bracket left or right until it IS on a stud
7. Attach the other end of the bracket to the shelf frame with the included screw
8. Test: push the top of the shelf forward — it should NOT tip. If it flexes more than an inch, the bracket isn't secured properly

CLICK-IN PLATE FLOORING:
1. The entire garage floor must be swept, degreased, and COMPLETELY DRY before starting — any moisture will trap under the tiles
2. Start at the BACK WALL of the garage, in the corner furthest from the garage door
3. Leave a 1/4" gap between the first tile and the wall (use a shim or folded cardboard as a spacer) — this is an expansion gap so the tiles don't buckle
4. Lay the first tile down. Pick up the second tile and angle the interlocking edge into the first tile's edge, then press down flat — you should hear/feel it click
5. Use a rubber mallet to tap tiles firmly together if they don't fully click — tap on the edge, not the center
6. Work in rows from back to front, left to right
7. At the end of each row, you'll need to cut a tile to fit. Measure the remaining space, subtract 1/4" for the expansion gap, and mark the tile. Cut with a utility knife (score deeply and snap) or jigsaw
8. Continue until the entire floor is covered. The last row (at the garage door) also gets a 1/4" expansion gap
9. Walk the entire floor when done — press down any tiles that feel loose or high

═══════════════════════════════════════
  PHASE PATTERNS BY PACKAGE TIER
═══════════════════════════════════════

UNDERGRADUATE — Surface Reset (2 scholars, 4-5 hours):
1. Setup & Safety (15 min)
   a. Both scholars put on gloves, safety glasses, dust masks
   b. Ask client to move vehicles out of the garage to the street
   c. Take BEFORE photos: stand at the garage door opening and photograph the entire space. Then photograph each wall straight-on. Minimum 4 photos
   d. Open the app and check in at the job
2. Broad Sorting — The Pull-Out (90-120 min)
   a. Set up 3 zones on the driveway with contractor bags or tarps: KEEP (left), DONATE (center), TRASH (right)
   b. Start at the back of the garage and work forward. Pull EVERYTHING out — leave nothing inside
   c. As you pull each item out, ask the client: "Keep, donate, or trash?" Place it in the right zone. If client isn't available, use your judgment and put questionable items in KEEP
   d. HAZMAT RULE: If you see paint cans, propane tanks, car batteries, or chemical containers — set them aside in a separate area. Do NOT put them in any zone yet. Flag for admin
   e. Heavy items (50+ lbs): BOTH scholars lift together. Bend at the knees, not the back. Use the dolly or hand truck for anything on wheels or with a flat bottom
3. Sweep & Blow Clean (30 min)
   a. Push broom the entire floor from back to front
   b. Use the leaf blower to blow dust and debris out the garage door (warn the client first if their car is nearby)
   c. Shop vac the corners, edges along walls, and any cracks in the concrete
   d. The floor should be visibly clean — no dust bunnies, no debris in corners
4. Install Single Shelf Unit (30 min)
   a. Follow STANDARD SHELVING INSTALLATION steps above
   b. Position the shelf on the wall the client prefers (or the longest open wall if no preference)
   c. DO NOT skip the anti-tip bracket
5. Organized Reload (60 min)
   a. Carry KEEP items back in. Group similar items together: sports stuff together, tools together, holiday together, auto stuff together
   b. Heavy items go on lower shelves. Light items go on top shelves
   c. Frequently used items go in the most accessible spots (near the door to the house or the garage door opening)
   d. Lean tall items (rakes, shovels, ladders) against the wall near the shelf
6. Haul-Away Loading (30 min)
   a. Load TRASH items into the truck first — heavy stuff on the bottom, bags on top
   b. Load DONATE items separately (they go to a different location)
   c. Double-check with the client: "Is there anything in the donate or trash pile you want to keep?" — do this BEFORE it goes in the truck
   d. Sweep the driveway where the sort zones were
7. Client Walkthrough & Photos (15 min)
   a. Walk the client through the garage. Show them where things are organized
   b. Take AFTER photos from the same angles as the BEFORE photos
   c. Ask: "Is there anything you'd like us to adjust?"
   d. Thank the client. Ask if they'd leave a Google review (don't be pushy, just ask once)
   e. Check out on the app

GRADUATE — Full Organization (2 scholars, 6-8 hours):
1. Setup & Safety (15 min)
   a. Both scholars: gloves, safety glasses, dust masks on
   b. Ask client to move vehicles out
   c. Take BEFORE photos: minimum 6 angles — all 4 walls, ceiling, and floor close-up. These are for the client's before/after comparison
   d. Check in on the app
2. Full Pull-Out & Micro-Sort (60-90 min)
   a. Set up 5 ZONES on the driveway. Use painter's tape labels or cardboard signs: SPORTS | TOOLS | HOLIDAY/SEASONAL | AUTO/OUTDOOR | TRASH/DONATE
   b. Pull everything out of the garage. Sort into the 5 zones as you go
   c. Items that don't fit a zone go into a "MISC" area — you'll deal with them during reload
   d. Keep a mental note of items with resale value (nice furniture, name-brand equipment, power tools in good condition) — note them in the app for admin
   e. HAZMAT RULE: paint, propane, batteries, chemicals → separate pile. Flag for admin. Do NOT load in truck
   f. Heavy lift rule: 50+ lbs = both scholars lift together. Use dolly for anything with a flat bottom
3. Deep Clean (30-45 min)
   a. Degrease: spray degreaser on oil stains and dirty wall areas. Let it sit 5 minutes
   b. Scrub stubborn spots with a stiff brush
   c. Power wash the floor (see HOW TO USE POWER WASHER above). Start at the back, sweep toward the garage door opening
   d. Let the floor dry — this takes 15-30 min depending on airflow. You can work on installs during dry time if the install area is dry
4. Install Storage Systems (60-120 min)
   a. Refer to the INSTALLATION SPECIFICATIONS section for this specific job
   b. GENERAL ORDER: Wall-mounted items first (cabinets, overhead), then floor items (shelving, floor cabinets)
   c. Reason: if you install floor items first, they'll be in your way when you're trying to drill into the wall above them
   d. Take your time. Measure twice, drill once. If unsure, ask your partner to double-check before you drill
5. Organized Reload with Bins (60-90 min)
   a. Set up the label maker. Print labels for each zone: SPORTS, TOOLS, HOLIDAY, SEASONAL, AUTO, MISC (customize based on what the client actually has)
   b. Pack items into the 8 clear bins by category. Don't overfill — lids must close fully
   c. Apply the label to the FRONT CENTER of each bin
   d. Place bins on shelves by frequency of use: stuff they use weekly goes at eye level, seasonal stuff goes up high or on the overhead rack
   e. Items that don't fit in bins (large tools, ladders, bikes) get wall or floor positions. Group them by type
   f. Step back and look at the whole garage. Would a stranger know where to find a screwdriver? A holiday decoration? If not, re-organize
6. Final Detail (20 min)
   a. Sweep or blow any dust/debris created during install
   b. Wipe down all installed cabinet surfaces with a damp rag
   c. Straighten all bins so labels face forward
   d. Take AFTER photos: same 6+ angles as the BEFORE photos. Make sure the garage looks its absolute best
7. Client Walkthrough (15 min)
   a. Walk the client through zone by zone. "Your sports gear is here, tools are here, holiday is up top..."
   b. Show them how the bin system works. Open a bin, show the label
   c. Hand them the 30-Day Clutter-Free Guarantee card. Explain: "If anything shifts or you're not happy in the next 30 days, call us and we'll come back free"
   d. Ask for a Google review (once, politely)
   e. Load haul-away items into truck (see Undergraduate step 6)
   f. Check out on the app

DOCTORATE — White-Glove (3 scholars, full day 8+ hours):
1. Setup & Safety (15 min)
   a. All 3 scholars: gloves, safety glasses, dust masks
   b. Vehicles out of garage
   c. BEFORE photos: minimum 12 angles — all 4 walls (2 angles each), ceiling, floor, any particularly cluttered areas get close-ups
   d. Check in on app
2. Full Pull-Out (60-90 min)
   a. Same micro-sort zones as Graduate, but use furniture pads under any items that look valuable or fragile
   b. 3 scholars = faster pull-out. Two people carry, one person sorts at the zones
   c. Flag resale items for admin
   d. Heavy lift and hazmat rules same as above
3. Deep Clean (45-60 min)
   a. Degrease ALL wall surfaces (not just stained spots), floor, and any built-in shelving that's staying
   b. Power wash floor — extra attention to edges and corners
   c. Wipe down garage door tracks and the interior of any windows
   d. This is white-glove — when you think it's clean, clean it again
4. Install All Storage Systems (90-150 min)
   a. Follow job-specific INSTALLATION SPECIFICATIONS section
   b. Order: overhead racks first (you need ceiling access without floor obstructions), then wall cabinets, then floor cabinets, then free-standing shelving
   c. With 3 scholars: one can start assembly while two do the mounting. But ALL drilling/bolting requires the person NOT on the ladder to be spotting/holding
   d. Every installed item gets checked with a level BEFORE and AFTER final tightening
5. Premium Organized Reload (90-120 min)
   a. 16 premium bins = more categories. Print labels for each: SPORTS, TOOLS-HAND, TOOLS-POWER, HOLIDAY-CHRISTMAS, HOLIDAY-HALLOWEEN, SEASONAL-SUMMER, SEASONAL-WINTER, AUTO, OUTDOOR, CAMPING, CLEANING, HARDWARE, etc. — customize to what the client actually owns
   b. Pack items neatly. Face labels forward. Arrange bins in logical groups
   c. Add SEASONAL ROTATION TAGS: colored tags on seasonal bins. E.g., green tag = summer gear (front access May-Sep), orange tag = fall/winter gear (rotate forward Oct-Apr). Explain the system to the client during walkthrough
   d. Cable/cord management: bundle loose cords with zip ties. Coil extension cords neatly. Hang power tool cords, don't let them dangle
   e. Place furniture pads under all heavy floor items (floor cabinets, large toolboxes, anything that could scratch the floor or slide)
6. Final White-Glove Detail (30 min)
   a. Walk the entire garage slowly. Check every bin is aligned, every label faces forward, every surface is wiped
   b. Check that all installed items are level one final time
   c. Place furniture pads under any remaining heavy items
   d. Take AFTER photos: minimum 12 angles matching the before photos. Include close-ups of the bin labels, installed products, and the overall space
   e. The garage should look like a magazine photo. If it doesn't, find what's off and fix it
7. Client Walkthrough (20 min)
   a. Full zone-by-zone tour
   b. Demo the bin system AND the seasonal rotation system
   c. Show how the overhead rack works. Explain the weight limit ("up to 600 lbs spread evenly — don't put all the weight on one side")
   d. Explain cabinet/shelf maintenance: "Just wipe with a damp cloth. Don't put wet items directly on the bamboo/stainless top"
   e. Hand over the guarantee card
   f. Schedule the included return visit: "We'll come back within 30 days to make sure everything is still working. What week works for you?"
   g. Ask for Google review
   h. Check out on app

═══════════════════════════════════════
  QUALITY STANDARDS BY TIER
═══════════════════════════════════════

UNDERGRADUATE — Must pass these checks before leaving:
- Floor is swept/blown clean — no visible dust or debris in corners
- All KEEP items are back in the garage and grouped by type
- 1 shelf is installed, level, and anchored with anti-tip bracket
- BEFORE and AFTER photos are uploaded to the app (min 4 each)
- Client has been walked through the space
- Haul-away is loaded in the truck
- Driveway is clean (no debris from the sort)

GRADUATE — Must pass ALL Undergraduate checks PLUS:
- Floor has been power-washed and is dry
- ALL items are in labeled bins or have designated spots (nothing loose/random)
- All 8 bins have labels and are placed logically
- ALL installed products (shelving, cabinets, overhead) are level, secured, and anti-tip/lag bolted
- BEFORE and AFTER photos (6+ angles each) uploaded to app
- 30-Day Guarantee card handed to client
- No tools or supplies left behind

DOCTORATE — Must pass ALL Graduate checks PLUS:
- 16 bins with printed labels, all facing forward
- Seasonal rotation tags applied and explained to client
- Furniture pads under ALL heavy floor items
- Cable/cord management on ALL visible cables
- Every surface wiped down after install (no dust from drilling)
- Return visit scheduled with client (date in the app)
- BEFORE and AFTER photos (12+ angles each) uploaded to app
- The garage looks magazine-ready

═══════════════════════════════════════
  COMMON MISTAKES TO CALL OUT
═══════════════════════════════════════

In your SOP, PROACTIVELY warn about these common beginner mistakes:
- Drilling into drywall only (no stud) — the shelf/rack WILL fall. Always verify the stud with a stud finder
- Forgetting the anti-tip bracket on shelving — this is a safety hazard, never skip it
- Not checking level before tightening — once lag bolts are tight, it's very hard to adjust. Check level BEFORE final tightening
- Loading the truck before confirming with the client — always do a final "is this trash?" check
- Not taking enough photos — more is always better. Take photos from the same angles before and after
- Ignoring hazmat items — paint, propane, batteries, and chemicals need special handling. Set aside and flag for admin
- Rushing through the clean — the clean is what makes the transformation visible. A half-clean floor ruins the whole effect
- Not introducing yourself to the client — first impressions matter. "Hi, I'm [name] from Garage Scholars. We're going to transform your garage today"

═══════════════════════════════════════
  GYM-SPECIFIC TOOL HOW-TO GUIDE
═══════════════════════════════════════

Only include these instructions when the job involves gym equipment assembly. These supplement the general tool guides above.

HOW TO USE A SOCKET WRENCH:
1. A socket wrench (also called a ratchet) has a square drive head that accepts different-size sockets. It ratchets — meaning it tightens in one direction and free-spins in the other so you don't have to lift it off the bolt each turn
2. The switch on the back of the ratchet head controls direction: flip it one way for tighten (clockwise), the other way for loosen (counter-clockwise). Test which direction is which BEFORE you put it on a bolt
3. To attach a socket: push it onto the square drive until it clicks. To remove it: press the release button on the back and pull it off
4. Common gym equipment bolt sizes: METRIC — 10mm, 13mm, 15mm, 17mm, 19mm. SAE (American) — 3/8", 7/16", 1/2", 9/16", 5/8", 3/4"
5. If a socket almost fits but is slightly loose, you have the WRONG SIZE — do not use it, it will strip the bolt head. Try the next size down
6. For tight spaces where the ratchet won't fit, use a combination wrench (open end + box end) instead
7. GOLDEN RULE: "finger-tight first." Thread every bolt by hand at least 3-4 full turns before using the wrench. If it won't thread by hand, it's cross-threaded — STOP, back it out, realign, try again

HOW TO USE ALLEN (HEX) WRENCHES:
1. Allen wrenches are L-shaped tools with a hexagonal tip. They fit into hex-shaped holes in bolt heads (called socket head cap screws or set screws)
2. Rep Fitness uses metric Allen keys: 4mm, 5mm, 6mm are the most common. Rogue sometimes uses SAE: 5/32", 3/16", 7/32"
3. Use the SHORT end for tight spaces (insert short end into bolt, turn with the long end for leverage). Use the LONG end for fast spinning when you don't need much torque
4. If an Allen key spins freely inside the bolt but the bolt isn't turning, the bolt is STRIPPED — flag for admin, do not continue forcing it
5. NEVER use pliers on an Allen wrench for extra leverage — you'll round the bolt head. If it's too tight, use a longer Allen key or a ball-end version

HOW TO SAFELY USE A STEP LADDER (for overhead pulleys, cable routing):
1. Open the ladder fully until the spreader bars LOCK into position. If the spreaders don't lock, the ladder is broken — do not use it
2. Place on FLAT ground only. On a garage floor that slopes toward the door, position the ladder so it faces the slope (not sideways to it)
3. NEVER stand on the top 2 steps. The highest safe step is usually marked — stay at or below that mark
4. Keep your belt buckle between the side rails at all times — if you're leaning so far that your belt buckle is past the rail, you WILL fall. Get down and move the ladder instead
5. Have your partner hold the base whenever you're on the ladder. This is non-negotiable on gym installs
6. NEVER reach overhead with both hands while standing on a ladder with a heavy part — hand the part up from the ground, or have your partner hand it to you while you're stable

HOW TO IDENTIFY BOLT SIZES — METRIC vs SAE:
Gym equipment from Rep Fitness is primarily METRIC. Rogue uses a mix of METRIC and SAE.
1. The hardware bags should be labeled. If they're not, use the included manual's hardware chart — it lists every bolt by step number, size, and quantity
2. NEVER guess a bolt size. If you're not sure, try fitting a socket BEFORE tightening. The socket should slide on snugly with zero play
3. Common confusion: M8 metric ≈ 5/16" SAE, M10 metric ≈ 3/8" SAE, M12 metric ≈ 1/2" SAE — but they are NOT interchangeable. Cross-threading metric into SAE holes (or vice versa) will destroy the threads
4. If a bolt is getting hard to turn after only 1-2 threads, STOP — you may be cross-threading. Back it out completely, check that the bolt and hole are aligned straight, and try again by hand

HOW TO READ A CABLE ROUTING DIAGRAM:
Cable routing diagrams show the path a steel cable must follow through a series of pulleys inside a machine. This is the #1 thing scholars get wrong on gym installs, and getting it wrong means disassembling and starting over.
1. The diagram shows numbered pulleys (P1, P2, P3... or 1, 2, 3...) and a line representing the cable path
2. Pay attention to which SIDE of each pulley the cable wraps around — some pulleys the cable goes OVER the top, others it goes UNDER. The diagram shows this with the line going above or below the pulley circle
3. At each pulley, the cable must sit INSIDE the groove (the V-shaped or U-shaped channel around the outside of the pulley wheel). If the cable is sitting on the flat surface next to the groove, it will jump off under load
4. The cable has two ends: one end attaches to the HANDLE or CARABINER, the other end attaches to the WEIGHT STACK selector mechanism (or terminates at a fixed point)
5. Start routing from the handle end (it's easier to feed the cable through each pulley from this end)
6. After routing through each pulley, give the cable a gentle tug to make sure it's seated in the groove. The cable should move freely — if it catches, the cable isn't properly seated in that pulley's groove
7. PHOTOGRAPH your completed routing from multiple angles BEFORE tensioning. If something goes wrong later, you'll have a reference

═══════════════════════════════════════
  GYM JOB TRUCK LOADOUT
═══════════════════════════════════════

In addition to the standard truck loadout, gym installation jobs require:

ALL gym jobs:
- Socket wrench set with metric sockets (10mm, 13mm, 15mm, 17mm, 19mm) AND SAE (3/8", 1/2", 9/16", 5/8", 3/4")
- Allen/hex wrench set — BOTH metric (3mm, 4mm, 5mm, 6mm, 8mm) AND SAE (5/32", 3/16", 7/32", 1/4")
- Adjustable wrench (12" minimum)
- Level (4ft preferred for rack uprights — longer is better)
- Rubber mallet
- Step ladder (6ft minimum)
- Moving blankets / furniture pads (6+ for protecting flooring during assembly)
- Blue painter's tape (for labeling parts, marking pulley positions)
- Ziplock bags + Sharpie (for sorting hardware by step number)
- Headlamp or work light (for seeing inside rack frames and behind pulleys)
- 3-in-1 oil (for barbell sleeves)
- Electrical tape (for wrapping cable ends during threading)
- Wire cutters / cable cutters (ONLY if specified for cable trimming)
- Concrete drill bit set + hammer drill (if floor-bolting rack — confirm with admin before job)
- 3/8" concrete wedge anchors (if floor-bolting — confirm count with admin)
- Shop vac (for cleaning concrete dust after drilling)

Cable system jobs (ARES, Athena, Slinger) — add:
- Extra headlamp (for seeing cable routing behind weight stack columns)
- Needle-nose pliers (for threading cable through tight spaces)
- Cable lubricant or silicone spray (light coat on cable before threading — reduces friction)
- Ratchet straps (2x, for temporarily holding heavy assemblies in position during mounting)
- Extra ziplock bags (cable systems have 100+ pieces of hardware)

Gym flooring jobs — add:
- Utility knife + 10 extra blades (stall mats eat blades fast — change blade after every 2 cuts)
- 4ft steel straight edge or T-square (for straight cuts on mats)
- Chalk line (for marking long cut lines on mats)
- Hand truck or furniture dolly (each stall mat weighs ~100 lbs — do NOT carry by hand if avoidable)

═══════════════════════════════════════
  GYM EQUIPMENT ASSEMBLY GUIDE
═══════════════════════════════════════

Only include gym equipment sections if the job involves gym setup (Get Strong service, Warm Up / Super Set / 1 Rep Max / Dean's List / Valedictorian packages, or gym equipment in the product selections).

UNIVERSAL ASSEMBLY PROTOCOL — BEFORE TOUCHING ANY EQUIPMENT:
Every gym install follows these steps FIRST, regardless of what's being built:
1. READ THE ENTIRE MANUAL FRONT TO BACK before unboxing anything. Yes, the entire thing. Flip through every page. Look at every diagram. Understand the full assembly sequence before you pick up a single bolt. This takes 10-15 minutes and will save you 1-2 HOURS of mistakes
2. CLEAR THE SPACE: You need a flat area at least 10ft x 10ft for a rack assembly, 8ft x 6ft for a bench. Move everything out of the way — you need room to lay parts out and walk around them
3. INVENTORY ALL PARTS: Open every box. Lay parts on moving blankets or cardboard (NEVER directly on concrete — it scratches powder coating). Match every part to the manual's parts list. Count every bolt, washer, and nut. If ANYTHING is missing, STOP and call admin before starting assembly — do not improvise with different hardware
4. SORT HARDWARE BY STEP: Use ziplock bags and a Sharpie. Write "Step 1", "Step 2", etc. on each bag. Put the bolts needed for that step into the bag. This prevents the #1 beginner mistake: grabbing the wrong bolt and cross-threading it into the wrong hole
5. PHOTOGRAPH THE PARTS LAYOUT: Take a photo of all parts laid out before you start. If something goes wrong mid-assembly and you need to call admin, this photo is your reference
6. CHECK THE FLOOR: Use the level on the floor where the equipment will sit. Note which direction the floor slopes — you'll need to compensate with shims or adjustable feet. Most garage floors slope 1/8" to 1/4" per foot toward the garage door for drainage

POSITIONING THE EQUIPMENT IN THE GARAGE:
Before assembling, decide EXACTLY where the final position will be:
- Power rack: needs minimum 4ft clearance on ALL sides for loading plates and walking around. Keep at least 6" from any wall (you need space to bolt to the floor or wall if needed). If a garage door is behind the rack, make sure the bar won't hit the door when racked (measure: rack depth + bar overhang + 6" clearance)
- Functional trainer: needs 6ft clearance in front for cable exercises at full extension. Side clearance: 3ft minimum per side
- Bench: position so it can be slid into and out of the rack without lifting. Leave 3ft walkway on each side
- Stall mats: plan the layout BEFORE cutting. Measure the total floor area, divide by 4'x6' mats, figure out how many you need and where the cuts go. Sketch it on paper first
- Ceiling clearance: measure from floor to ceiling. Standard pull-up bar height on a 90" rack is 90" — that means you need at least 100" (8'4") of ceiling height for someone to hang, or they'll hit the ceiling. If ceiling is under 8'6", flag this for admin

POWER RACKS — FULL STEP-BY-STEP (Rep PR-4000, PR-5000 / Rogue RML-490):
1. PREP (15 min):
   a. Follow Universal Assembly Protocol above — read manual, inventory parts, sort hardware
   b. Identify the 4 uprights. They may be labeled (Front Left, Front Right, Back Left, Back Right). If not labeled, check the manual for which holes face which direction — the numbered holes typically face INWARD on Rep racks
   c. Lay two uprights parallel on the floor, with moving blankets underneath
   d. Check that all uprights are the same length and the holes are in the same positions — if one looks different, check the manual before proceeding

2. ASSEMBLE FRAME ON THE GROUND (30-45 min):
   a. Attach the bottom cross-members to the two uprights lying on the ground. Thread bolts BY HAND — finger-tight only (3-4 full turns by hand minimum before using any tool)
   b. STOP AND CHECK: look down the length of both uprights. Are they parallel? Are the holes aligned? If one upright is rotated so the holes face the wrong way, fix it NOW — this is the easiest time to correct
   c. Attach the top cross-members the same way — finger-tight only
   d. Attach any middle cross-members or diagonal braces — finger-tight only
   e. You now have a flat rectangular frame on the ground. EVERYTHING should be finger-tight only at this point

3. RAISE THE FRAME (10 min — MINIMUM 2 PEOPLE, 3 IS BETTER):
   a. SAFETY: This frame weighs 150-300 lbs. Position yourselves at opposite ends
   b. Communicate: "Ready? Lifting on 3. 1... 2... 3... lift"
   c. One team lifts from the top cross-member while the other team guides the bottom to stay in place
   d. Walk the frame up gradually — don't try to muscle it up in one motion. One person pushes from underneath while the other pulls from the top
   e. Once vertical, have someone hold it steady while another person checks it's not going to tip
   f. For a 6-post rack (needed for ARES/Athena): repeat this process for the rear 2 uprights, then connect front frame to rear frame with side cross-members

4. LEVEL AND SQUARE (15 min):
   a. Place the 4ft level against each upright, top to bottom. The bubble should be centered. If it's not, the upright is leaning — adjust the bolt positions or place shims (flat washers work as shims) under the foot pad on the low side
   b. CRITICAL: check that the frame is SQUARE (not racked/rhombus-shaped). Measure diagonally from top-left to bottom-right, then top-right to bottom-left. These two measurements should be within 1/8" of each other. If they're not, loosen the cross-member bolts slightly and push the frame square, then re-tighten
   c. Check level on every cross-member (front-to-back AND side-to-side)

5. FINAL TIGHTEN — TORQUE SEQUENCE (15 min):
   a. NOW you tighten everything — in this specific order:
   b. First: all BOTTOM bolts (where uprights meet the floor plates / bottom cross-members). These anchor the whole frame
   c. Second: all TOP bolts (top cross-members and pull-up bar)
   d. Third: all MIDDLE bolts (mid cross-members, diagonal braces)
   e. Tighten firmly with the socket wrench — snug plus 1/4 turn. Do NOT over-torque. If you hear metal creaking, you're going too far
   f. STOP AND CHECK AGAIN: re-check level on all 4 uprights after final tightening. Tightening can shift things slightly. If anything moved, loosen and adjust

6. INSTALL ACCESSORIES (15-30 min):
   a. J-hooks: slide into the holes from the INSIDE of the rack. The J-cups should face inward (toward each other). Set both at the same height — pick a hole number (they're numbered on Rep racks) and set both J-hooks to the same number. Typical bench press height: roughly nipple height when standing
   b. Safety arms/straps: install these BELOW the J-hooks. The safety should catch the bar if you fail a rep. Set them at a height where the bar would rest just above your chest when you're lying on the bench. Test by lying on the bench and checking clearance
   c. Pull-up bar: usually already installed as the top rear cross-member. If separate, bolt it into the designated holes at the top
   d. Plate storage horns: bolt to the outside of the uprights at waist height. Put heaviest plates closest to the uprights (weight distribution)
   e. Band pegs: insert into the bottom holes of the uprights. These are for resistance bands — make sure they're secure and won't pop out under tension

7. SHAKE TEST AND FINAL CHECK (5 min):
   a. Grab the top of the rack with both hands and try to shake it side-to-side and front-to-back. Apply real force — don't be gentle
   b. ZERO movement = correct. Any wobble means something is loose — go back and re-tighten
   c. Hang from the pull-up bar (one person). The rack should not shift, creak, or move AT ALL
   d. Place an empty barbell on the J-hooks. It should sit level and not roll. If it rolls, the J-hooks are at different heights — adjust
   e. Time check: you should be at approximately 90-120 minutes here for a 4-post rack, 120-150 for a 6-post

8. FLOOR BOLTING (optional — 20 min, only if specified):
   a. Once rack is positioned in its FINAL location (you cannot move it after this), mark through the foot plate holes onto the concrete with a pencil
   b. Move the rack aside temporarily
   c. Using a hammer drill with a 3/8" concrete bit: drill into each mark to a depth of 2.5". WEAR SAFETY GLASSES — concrete dust and chips will fly. Hold the drill firmly with BOTH hands — it will vibrate aggressively
   d. Vacuum out each hole with the shop vac (debris in the hole will prevent the anchor from seating)
   e. Slide the rack back into position, aligning foot plate holes with drilled holes
   f. Insert 3/8" x 3" concrete wedge anchors through the foot plate holes into the concrete. Tighten with a socket wrench — they expand as you tighten
   g. STOP AND CHECK: each anchor should be flush with the foot plate and completely tight. If one spins freely, the hole may be too large — flag for admin

SQUAT STANDS (Rogue SML-2):
1. Simpler than a full rack — each upright is independent
2. Assemble each upright separately: bolt the feet/base plate to the bottom of the upright. Finger-tight first, check level, then final tighten
3. Connect the two uprights with the rear cross-member (if included). This keeps them from spreading apart when you rack weight
4. Level each foot independently — twist the adjustable feet like screws (clockwise = shorter, counter-clockwise = taller). Check with level in both directions
5. Wall-mount stabilizer kit: if included, bolt the bracket to the rear of the uprights, then lag bolt into wall studs. This prevents the stand from tipping backward. If not bolting to the wall, STRONGLY recommend floor bolting (see floor bolting steps above)
6. Install J-hooks (match height on both sides) and safety arms
7. Estimated time: 30-45 minutes

═══════════════════════════════════════
CABLE SYSTEMS — THE MOST COMPLEX INSTALLS
═══════════════════════════════════════

Cable systems are the #1 source of assembly errors. A mistake in cable routing means FULL disassembly and starting over. Follow these instructions EXACTLY. Do NOT rush. Do NOT skip steps.

CABLE SYSTEMS — ARES (Rep Fitness, for PR-4000/5000):
The ARES attaches to a 6-post PR-4000 or PR-5000 configuration and adds dual adjustable cable columns with weight stacks.

PREREQUISITES:
- Rack MUST already be fully assembled in 6-POST configuration (4 main uprights + 2 rear uprights). If the rack is 4-post, you need to add the rear extension kit FIRST
- All rack bolts must be final-tightened. The ARES mounts to the rack frame — if the rack shifts during ARES install, everything goes out of alignment

STEP-BY-STEP:
1. PREP (20 min):
   a. Read the ENTIRE ARES manual. Note: ARES v1 and ARES 2.0 have DIFFERENT cable routing diagrams. Verify which version you have by checking the model number on the box
   b. Inventory all parts. ARES has 100+ individual pieces of hardware. Sort into ziplock bags by step number
   c. Identify the cable routing diagram in the manual — BOOKMARK THIS PAGE. You will reference it 20+ times
   d. Identify each cable. There should be 2 identical cables (one per side). Each cable has a ball/stopper on one end and a connector on the other

2. MOUNT THE FRAME ASSEMBLIES (30 min):
   a. Assemble the side plates / frame brackets per the manual. These mount to the rear uprights of the rack
   b. Bolt the frame assemblies to the rack uprights — finger-tight only at first
   c. Check that the frame assembly is level and plumb (vertical). The weight stack guide rods MUST be perfectly vertical or the weight stack will bind
   d. Use the 4ft level against the guide rod channels — adjust until plumb in both directions
   e. Final-tighten the mounting bolts once everything is plumb

3. INSTALL PULLEYS (20 min):
   a. The manual shows where each pulley mounts — top, bottom, and redirect pulleys
   b. Each pulley has a bolt, spacers, and a nut. The pulley must SPIN FREELY on the bolt — do not over-tighten. Tighten the nut until the pulley has zero lateral play (doesn't wobble side to side) but still spins freely when you flick it with your finger
   c. Check each pulley's groove — run your finger along it. It should be smooth with no burrs. If a groove has a rough spot, it will fray the cable. Sand it lightly with fine sandpaper or flag for admin

4. CABLE ROUTING — THE CRITICAL STEP (30-45 min PER SIDE):
   a. Open the manual to the cable routing diagram. Place it where BOTH people can see it at all times
   b. Wrap 2 inches of electrical tape around the leading end of the cable — this creates a stiff tip that's easier to thread through pulleys (like the aglet on a shoelace)
   c. Optional but recommended: apply a thin coat of silicone spray or cable lubricant to the entire cable. This reduces friction during threading and during use
   d. Start at Pulley #1 (usually the top pulley). Thread the cable over or under the pulley as shown in the diagram. The cable MUST sit INSIDE the V-groove of the pulley
   e. PAUSE after each pulley. Tug the cable gently — it should slide freely. If it's tight or catching, the cable is not seated in the groove. Re-seat it before moving to the next pulley
   f. Continue through each pulley in sequence: P1, P2, P3, etc. DO NOT skip ahead — routing through pulleys out of order will cross the cable and create binding
   g. At redirect pulleys (where the cable changes direction), the cable wraps partially around the pulley. Make sure it follows the groove for the full wrap — not just touching the pulley at one point
   h. Once the cable reaches the bottom / terminal pulley, attach the cable end to the weight stack selector mechanism per the manual
   i. STOP AND CHECK: with NO weight on the stack, pull the handle / carabiner end through the FULL range of motion (bottom to top and back). The cable should move smoothly with consistent resistance (just the friction of the pulleys). If it catches, jerks, or has a "dead spot" where it gets tight then loose:
      - The cable is NOT seated in a pulley groove somewhere
      - A pulley is misaligned (bracket needs loosening and adjustment)
      - The cable is wrapped around the wrong side of a pulley
   j. PHOTOGRAPH the completed cable routing from 3 angles (front, side, close-up of each pulley). If the cable ever needs service, this photo saves hours
   k. Repeat for the second cable on the other side

5. INSTALL WEIGHT STACKS (20 min):
   a. ONLY after BOTH cables are routed and verified
   b. Slide the guide rods through the weight stack plates in order (lightest plate first, working down)
   c. Insert the selector pin and test — pull it out, drop it into each plate's slot, verify it seats fully
   d. Connect the cable to the weight stack via the selector mechanism
   e. FINAL TEST: select the lightest weight. Pull the handle slowly through full range. The weight should lift smoothly and return smoothly. No jerking, no cable slipping, no scraping sounds. If you hear metal-on-metal scraping, the guide rods aren't aligned — loosen the frame and re-plumb

CABLE SYSTEMS — ATHENA / FT-3500 (Rep Fitness side-mount functional trainer):
THIS IS THE MOST COMPLEX GYM INSTALL. Budget 3-4 hours. Do NOT rush.

The Athena is a dual-stack functional trainer that side-mounts to PR-4000 or PR-5000 uprights. Each side is a completely independent cable machine.

KEY DIFFERENCES FROM ARES:
- Athena has MORE pulleys per side (more complex routing)
- Weight stacks are heavier (200+ lbs per side)
- The cable path is longer, meaning more opportunities for routing errors
- It's side-mounted (hangs off the side of the rack) so weight distribution matters — MUST be secured or it can tip the rack

STEP-BY-STEP:
1. Complete ONE side fully before starting the other. Do not partially assemble both sides simultaneously — you'll confuse the hardware and cable routing
2. Mount the main frame bracket to the rack uprights per the manual. This is the backbone that everything hangs from. It MUST be plumb (use the 4ft level). The weight stack guide rods attach to this frame — if it's not plumb, the stack will bind
3. Install all pulleys for this side. Verify each spins freely (see ARES pulley instructions above)
4. Route the cable following the ATHENA-SPECIFIC routing diagram (NOT the ARES diagram — they look similar but are different). Follow the exact same cable routing protocol from the ARES section above — tape the cable end, thread through each pulley in sequence, pause and check after each pulley, test full range before moving on
5. Install the weight stack for this side. Test with lightest weight
6. STOP AND CHECK: run the cable through full range of motion 10 times with the lightest weight. It should be smooth and quiet every time. If it's good on rep 1 but catches on rep 5, a pulley is slowly shifting — tighten the pulley bracket bolts
7. NOW start Side 2. Repeat the entire process
8. After BOTH sides are complete, check rack stability. The added weight on the sides changes the rack's center of gravity. If the rack was not floor-bolted, consider floor bolting now, or at minimum use a wall stabilizer bracket

CABLE REPLACEMENT (for Athena, ARES, or any cable system):
If you're replacing a cable (not doing initial install):
1. BEFORE touching anything: photograph the existing cable routing from every angle. Take at least 6 photos per cable — front, back, left, right, close-up of each pulley junction, and the weight stack connection
2. Disconnect the cable from the weight stack selector mechanism
3. Slowly thread the old cable OUT through each pulley, noting which side of each pulley it wraps around
4. Thread the new cable IN following the exact same path as the old cable (use your photos as reference)
5. Reconnect to the weight stack. Test with no weight, then lightest weight

CABLE SYSTEMS — ROGUE SLINGER (Monster Lite rack-mount cable):
The Slinger mounts to Monster Lite rack cross-members and adds a single pulley cable system per side.

STEP-BY-STEP:
1. Assemble the side slinger plates to the 6" cable pulleys per the manual. DO NOT fully tighten the hardware yet
2. Slide the assembly onto the rack's cross-member. The slinger mounts FROM THE OUTSIDE of the rack, sliding inward
3. Mount with the 1" hardware — finger-tight first
4. CABLE ROUTING (Slinger-specific):
   a. The cable runs ON TOP of the pulleys (not underneath) — seated in the pulley groove
   b. Insert the 3/8" spacers into the side plates. The spacers go on TOP of the cable — so the layering is: side plate, then cable on pulley, then spacers on top of cable to hold it in the groove
   c. The bolt end of the cable passes through the rubber grommet first, then through the tube, then through the center 1" crossmember hole. Secure the rubber grommet into the TOP side of the crossmember — push it firmly until it seats
   d. The other end of the cable connects to your loading pin or handle
5. TIGHTEN SEQUENCE: secure all 3/8" hardware FIRST (these hold the spacers and cable in position), THEN tighten all 1" hardware (these hold the assembly to the rack)
6. STOP AND CHECK: pull the cable through full range. Verify smooth operation with no weight, then with a single plate

ROGUE LAT PULLDOWN + LOW ROW KIT:
Connects to the Slinger cable setup. This adds a seat for lat pulldowns and a foot plate for low rows.
1. PREREQUISITE: Slinger must be fully installed and tested first
2. Assemble the seat frame per the manual — this is usually just bolting the seat pad to the frame
3. Attach the assembled seat to the rack upright using 5/8" x 5" detent pins. Insert pins at the 4th and 6th holes from the ground (count from the bottom). The pins click into place — push firmly until you hear/feel the detent ball snap into the hole
4. Connect the lat pulldown cable to the Slinger's cable using the included connector hardware
5. Install the knee pad (if included) — adjust height so the client's thighs are snug under the pad when seated
6. SHOW THE CLIENT: demonstrate how to insert and remove the detent pins to disconnect the seat when they want more floor space. The seat is designed to be removed in 30 seconds
7. Time: 45-60 minutes

STANDALONE FUNCTIONAL TRAINERS (Rep FT-5000):
1. SAFETY FIRST: this unit weighs 500+ lbs fully assembled. MINIMUM 3 PEOPLE for the entire assembly. No exceptions
2. Unbox CAREFULLY. The frame pieces are heavy and powder-coated — dropping them will dent the metal and chip the coating. Use moving blankets
3. Assemble the main frame on its side (lying flat). DO NOT try to stand it up until the frame is fully assembled
4. The FT-5000 has integrated cable columns — each column needs cable threading. Follow the cable routing diagram EXACTLY (see cable routing protocol in ARES section above). 6mm Allen wrench and 13mm wrench are needed and are often NOT included — bring your own
5. Stand the unit up with ALL 3 people. One person on each side, one person guiding from behind. Communicate: "Lifting on 3"
6. Level the unit — adjust the feet (screw in/out). Check with level on every weight stack guide rod. If a guide rod isn't plumb, the weight stack will bind when loaded
7. WALL ANCHOR IS REQUIRED — this unit has a high center of gravity and WILL tip forward when a person pulls a heavy cable. Bolt a wall bracket to the rear of the unit and into wall studs with 3/8" x 3" lag bolts. Minimum 2 lag bolts into 2 different studs
8. If wall-mounting isn't possible (no studs in the right position), floor-bolt using concrete anchors
9. FINAL TEST: select the heaviest weight on each side. Pull the cable to full extension. The unit should NOT shift, rock, or tip. If it moves AT ALL, the wall/floor anchor is insufficient — add more anchor points
10. Time: 2-3 hours

ADJUSTABLE BENCHES (Rep AB-3000, AB-5000 / Rogue Adjustable 3.0):
1. Unbox and lay out parts. These are simpler — usually base/legs, seat pad, back pad, and hardware
2. Attach the base/legs first. Flip the bench upside down to bolt on the legs (easier access). Thread bolts by hand first, then tighten with Allen wrench or socket
3. Flip the bench right-side up. Attach the seat pad to the frame with the included pins or bolts
4. Attach the back pad (the adjustable part). This typically connects with a pivot pin that allows the pad to adjust angles
5. TEST EVERY ANGLE: set the bench to each click position (flat, 15°, 30°, 45°, 60°, 90°). At each position, push down on the back pad with your hand — it should NOT slip to the next angle. If it does, the adjustment pin or ladder mechanism isn't engaging properly — check alignment
6. AB-5000 SPECIFIC (zero-gap design): the seat pad slides forward/backward to eliminate the gap between seat and back pad. After assembly, set the bench to incline (45°), slide the seat until the gap disappears, and verify the gap stays closed at every incline angle. If there's a gap at certain angles but not others, the seat rail may need adjustment per the manual
7. Place the bench in its operating position (usually inside the rack). Slide it in and out to verify it clears the rack uprights
8. Time: 15-30 minutes

FLAT BENCHES (Rep FB-5000 / Rogue Flat Utility 2.0):
1. Simple assembly — 4-6 bolts attaching legs to the bench pad frame
2. Flip the bench upside down, bolt on the legs, hand-tighten all bolts first, then final-tighten
3. Flip right-side up. Push down on each corner — the bench should NOT rock or wobble. If it wobbles, one leg is slightly shorter or the floor is uneven. Fix with rubber feet (usually included) or a shim under the short leg
4. The pad surface should be flat — press on the center. If it sags significantly, the frame may be bent from shipping — flag for admin
5. Time: 10-15 minutes

BARBELLS & PLATES:
No assembly. But scholars need to handle them CORRECTLY:
1. Unbox barbells carefully — they're 45 lbs and 7 feet long. Don't let the end swing and hit anything. Carry horizontally with two hands or have two people carry it
2. Inspect barbell: spin each sleeve (the rotating end where plates go). It should spin freely for at least 3-5 seconds. If it grinds or doesn't spin, the barbell may have been damaged in shipping — flag for admin
3. Apply a thin coat of 3-in-1 oil to each sleeve: put 2-3 drops on the sleeve, spin it, wipe off excess with a rag. This protects against rust
4. Hang the barbell on the J-hooks inside the rack. It should sit level
5. PLATES: unbox and sort by weight. Organize on the rack's plate storage horns:
   - Heaviest plates closest to the upright (45s on the innermost position)
   - Lighter plates toward the outside (25s, 10s, 5s)
   - This keeps the center of gravity close to the rack and makes loading/unloading easier
6. Bumper plates (rubber-coated): these are designed to be dropped from overhead. Stack them on edge (standing up) on the plate horns, not flat/stacked on top of each other on the floor

GYM FLOORING — RUBBER STALL MATS — DETAILED:
1. MEASURE FIRST: measure the floor area to be covered. Standard stall mats are 4'x6'. Calculate how many full mats you need and where cuts are needed. Sketch the layout on paper — label each mat position and mark where cuts go
2. CLEAN THE FLOOR: sweep, then degrease any oil spots with degreaser spray. The floor must be dry — moisture trapped under the mats will create mold. If the floor is wet, use a floor fan to dry it before laying mats
3. TRANSPORT MATS: each mat weighs ~100 lbs. Use the hand truck or furniture dolly to move them from the truck to the garage. Roll the mat and stand it upright on the dolly. TWO PEOPLE to lift and position each mat
4. LAY THE FIRST MAT: start at the back wall (the wall furthest from the garage door). Position the mat 1/4" from the wall on both sides (use a shim or folded cardboard as a spacer). The flat side goes UP (textured bumpy side faces the concrete, unless client specifically wants the texture on top)
5. LAY SUBSEQUENT MATS: butt each mat tightly against the previous one. Push the edges together — they should sit flush with no gap. If there's a gap, the concrete is probably uneven underneath. You can leave small gaps (up to 1/8") — they won't affect function
6. CUTTING MATS: when you reach a wall or obstacle that requires a partial mat:
   a. Measure the space. Subtract 1/4" for the expansion gap at the wall
   b. Mark the mat on the TOP surface with chalk or a Sharpie
   c. Lay the steel straight edge along your mark. Kneel on the mat to hold it steady
   d. Using a FRESH utility blade, score along the straight edge with firm pressure. The first pass should cut about 1/4 of the way through
   e. Make 3-4 more passes along the same line, each time cutting deeper
   f. After 4-5 passes, the mat should cut through. If not, flip the mat and cut from the other side along the same line
   g. CHANGE YOUR BLADE after every 2 full cuts. Stall mat rubber dulls blades extremely fast. A dull blade = jagged cuts and much harder work
7. AROUND RACK FEET: cut small notches in the mat to fit around rack foot plates. Measure carefully — cut slightly oversized (you can always trim more, but you can't add material back)
8. FINAL WALK: walk the entire floor surface. Step on every edge and corner. Any mat that pops up, shifts, or has a raised edge needs to be re-seated. Mats should feel solid and flat under every step
9. ODOR WARNING: tell the client: "These mats have a strong rubber smell that lasts 1-2 weeks. It's completely normal and not harmful. Keeping the garage door cracked or running a fan will help it dissipate faster"
10. No adhesive is needed on concrete — gravity and the mat's weight (100 lbs each) holds them in place

DIY DEADLIFT/OLYMPIC LIFTING PLATFORM — DETAILED:
1. MATERIALS NEEDED: 2 sheets of 4'x8' plywood (3/4" thick), 1 sheet of 4'x8' rubber (3/4" thick), wood screws (2" or 2.5", #8 gauge, box of 50+), wood glue, measuring tape, pencil, circular saw or jigsaw
2. LAYER 1 (bottom): lay one full sheet of plywood flat on the floor. This is the base
3. CUT THE PIECES for layers 2 and 3:
   a. From the second plywood sheet: cut a 4'x4' piece (this is the center of layers 2 and 3)
   b. From the rubber sheet: cut two pieces, each 2'x4' (these are the side panels for layer 2)
   c. Cut two more rubber pieces, each 2'x4' (for layer 3 sides)
4. LAYER 2 (middle): apply wood glue to the top of Layer 1. Place the 4'x4' plywood piece in the CENTER. Place the two 2'x4' rubber pieces on either side — they should complete the 8'x4' rectangle
5. SCREW LAYERS 1+2 together: drive wood screws through the plywood center piece into the bottom plywood, every 12" in a grid pattern. Do NOT screw through the rubber — it doesn't hold screws well
6. LAYER 3 (top): apply wood glue to the top of the plywood center piece. Place another 4'x4' plywood piece directly on top (this is the standing/lifting surface). Place the remaining 2'x4' rubber pieces on each side, flush with the layer 2 rubber
7. SCREW LAYER 3: screw through the top plywood piece into the layer below, every 12"
8. The finished platform is 8'x4'x2.25" thick. It fits inside most power racks
9. LET THE GLUE CURE: wait at least 1 hour before anyone stands on it (wood glue takes 24 hours for full cure, but 1 hour is enough for light use)
10. Time: 45-60 minutes (excluding glue cure)

WALL-MOUNTED GYM STORAGE — DETAILED:
1. BARBELL HOLDERS (horizontal wall hooks):
   a. Use stud finder to locate 2 studs (16" apart). Mark the centers
   b. Mount each holder at 54" from the floor — this is roughly waist height for easy grab-and-go
   c. Pre-drill pilot holes into each stud mark (1/8" bit, 2.5" deep)
   d. Drive 3/8" x 3" lag bolts through the holder bracket into the studs. Tighten firmly
   e. Test: hang a 45 lb barbell on the holders. It should sit securely with no sagging or movement
   f. Position holders so the barbell sits horizontal and centered on the wall

2. PLATE STORAGE (wall-mounted horns/pegs):
   a. These MUST go into studs — a fully loaded plate tree can hold 300+ lbs. Drywall anchors WILL fail
   b. Stud-find and mark. Mount at a height where the lowest peg is at knee height (24-30") — this makes loading and unloading plates easier
   c. Pre-drill and lag bolt into studs with 3/8" x 3" lag bolts
   d. After mounting, load plates heaviest first (closest to the wall) and verify the mount doesn't move or pull away from the wall

3. RESISTANCE BAND PEGS:
   a. 3/8" x 3" lag bolts directly into studs at 3 heights: low (12" from floor), mid (36"), high (60")
   b. Leave 1" of the bolt sticking out from the wall as a hook for the bands
   c. Alternatively, use purpose-built band peg mounts if included

═══════════════════════════════════════
  GYM-SPECIFIC COMMON MISTAKES
═══════════════════════════════════════

In addition to the general common mistakes, PROACTIVELY warn about these gym-specific errors:

- CROSS-THREADING BOLTS: This is the #1 beginner mistake. It happens when a bolt is not aligned straight with the hole and you force it with a wrench. It DESTROYS the threads. Prevention: ALWAYS thread every bolt by hand for at least 3-4 full turns before using any tool. If it won't turn by hand, it's not aligned — back it out completely and try again
- USING THE WRONG BOLT: Gym equipment comes with multiple bolt sizes that look similar. Using a slightly wrong bolt can strip threads or fail under load. ALWAYS sort hardware by step number before starting, and verify each bolt against the manual's hardware chart before inserting
- TIGHTENING TOO EARLY: Do NOT tighten any bolts until the ENTIRE frame or assembly is complete. Tightening early locks parts into misaligned positions that are very hard to correct
- NOT READING THE FULL MANUAL: The #1 time-waster on gym installs is getting 45 minutes in and realizing you did step 3 wrong because you didn't read ahead to step 7. Read the ENTIRE manual before touching a single part
- CABLE ROUTING ERRORS: If a cable catches, binds, or doesn't move smoothly, there is a routing error. Do NOT try to force it or "work it in." STOP, find the problem pulley, and fix it. Forcing a misrouted cable can fray or snap it
- FORGETTING TO CHECK LEVEL: A rack that looks level to your eye is often NOT level. Always use the actual level tool. An un-level rack means J-hooks are at different effective heights, weight plates don't sit evenly, and the rack will slowly walk across the floor under heavy use
- SKIPPING THE SHAKE TEST: After every rack/stand/functional trainer install, grab it and shake it HARD. If it moves, something is loose. Find it and fix it. A loose bolt under 300+ lbs of dynamic load is a serious safety hazard
- NOT SECURING TO WALL/FLOOR: Functional trainers (FT-5000, Athena) WILL tip if not anchored. This is not optional. A 500+ lb machine falling on someone is life-threatening
- HEAVY LIFTING WITHOUT COMMUNICATION: When 2-3 people lift a 200+ lb frame, ALWAYS count aloud: "Lifting on 3... 1... 2... 3... LIFT." Everyone needs to lift at the same moment. Miscommunication = someone holding all the weight = injury
- CUTTING STALL MATS WITH A DULL BLADE: A dull utility blade on a 3/4" rubber mat turns a 30-second cut into a 5-minute struggle that produces a jagged edge. Change blades after every 2 cuts. Fresh blades = clean cuts = professional finish
- NOT INVENTORYING PARTS BEFORE STARTING: If you're missing a bolt and don't realize it until step 15, you've wasted an hour. Count EVERYTHING before you start. If anything is missing, STOP and call admin
- POSITIONING THE RACK TOO CLOSE TO THE WALL: You need access behind the rack for wall anchoring, cable maintenance, and plate loading. Leave at least 6" behind the rack. For cable systems, leave 12"+ behind for cable routing access

═══════════════════════════════════════
  GYM JOB QUALITY STANDARDS
═══════════════════════════════════════

ALL gym jobs — must pass these checks before leaving:
- Every bolt on every piece of equipment has been final-tightened (none left finger-tight)
- Every piece of equipment has been leveled with the actual level tool (not eyeballed)
- Rack shake test: ZERO movement when shaken firmly
- All J-hooks and safety arms are installed at matching heights on both sides
- All cable systems have been tested through full range of motion with the lightest weight — smooth and quiet
- All functional trainers and top-heavy equipment are wall-anchored or floor-bolted
- All plates are organized on storage horns: heaviest closest to uprights
- Barbell sleeves have been oiled and tested for smooth spin
- Stall mat flooring (if installed) is flat with no raised edges, 1/4" gap at walls, cuts are clean
- All packaging, zip ties, protective film, and garbage has been cleaned up and removed
- BEFORE and AFTER photos taken from the same angles (minimum 6 angles)
- Client has been shown how to use: the selector pin on cable machines, the J-hook adjustment, the safety arm positions, the bench angle adjustment, the detent pins on removable accessories
- Client has been warned about stall mat odor (if applicable)
- All assembly manuals and extra hardware left in a labeled bag on the client's workbench or shelf

GYM JOB — "BEFORE YOU CALL" TROUBLESHOOTING
══════════════════════════════════════════

IMPORTANT: Admin works a full-time job and may not answer immediately.
Before texting or calling admin, work through EVERY applicable fix below.
If NONE of these fixes work, THEN escalate (see escalation tiers below).

BOLT WON'T THREAD:
1. Stop. Do NOT force it with a wrench — you will cross-thread it
2. Back the bolt ALL the way out
3. Look into the hole — is there a paint chip, packing foam, or metal shaving blocking it?
4. Blow out the hole (or use compressed air if on the truck)
5. Try the bolt by hand again — if it catches, try rotating it BACKWARDS half a turn first until you feel it "click" into the thread start, then turn forward
6. Still won't go? Try a different bolt from the same bag — the bolt itself may have damaged threads
7. If 2+ bolts won't thread into the same hole, the hole's threads are stripped → ESCALATE (this is a warranty issue, not fixable on-site)

CABLE WON'T MOVE SMOOTHLY / CATCHES AT ONE POINT:
1. Do NOT pull harder — that frays the cable
2. Identify which pulley it's catching on (run the cable slowly by hand, feel for the snag)
3. Check: is the cable sitting IN the pulley groove, or has it jumped out and is riding on the edge?
4. Check: is the pulley spinning freely? Spin it by hand — if it's stiff, it may be installed backwards or missing a washer
5. Check: is the cable routed OVER or UNDER the pulley correctly per the diagram? (Photograph diagram, compare)
6. Loosen the pulley mounting bolt, reseat the cable in the groove, retighten
7. Run cable through full range again — if still catching, check the NEXT pulley in sequence
8. Still binding after checking every pulley? → ESCALATE with photos of the routing

WEIGHT STACK BINDS / WON'T DROP SMOOTHLY:
1. Remove ALL weight except the top plate (selector pin in position 1)
2. Pull and release — does the top plate drop freely?
3. If yes: add one plate at a time until you find the plate that causes binding. That plate's guide rod hole may be misaligned → remove and inspect
4. If no: the guide rods are not parallel. Loosen the frame bolts around the stack, verify level, retighten
5. Check: are the guide rods clean? Wipe with a dry cloth. Do NOT oil guide rods
6. Still binding? → ESCALATE

RACK WON'T STOP WOBBLING AFTER FULL TIGHTEN:
1. Loosen ALL bolts back to finger-tight
2. Place level on each upright — find which one is out
3. Is the garage floor itself sloped? (Very common — test with level on bare floor)
4. If floor is sloped: use rubber shim pads under the low-side feet
5. Retighten in correct sequence: bottom bolts first, then top, then cross-members
6. Shake test — if still wobbling: check every bolt with the wrench (one may look tight but isn't)
7. If a bolt spins freely and won't tighten, the nut inside may have fallen off → reach behind the upright and check
8. Still wobbling? → ESCALATE

CAN'T FIND STUDS FOR WALL ANCHORING:
1. Try stud finder in multiple spots — some garage walls have metal studs or irregular spacing
2. Tap method: knock on the wall and listen. Hollow = no stud. Solid thud = stud
3. Use a small finish nail as a probe — drill a tiny hole where you think the stud is. If the nail hits wood at 1.5", you found it
4. If wall is concrete block (common in some garages): you need concrete anchors instead of lag bolts. Do you have Tapcon screws on the truck?
5. If NO studs accessible and no concrete: MARK THE SPOT, photograph it, document in app → ESCALATE. Do NOT anchor into drywall only

EQUIPMENT LOOKS DAMAGED FROM SHIPPING:
1. Photograph EVERYTHING before touching it (box condition, visible damage, labels)
2. Minor cosmetic damage (small scuff on powder coat): note it, continue install, mention to client at handoff
3. Structural damage (bent upright, cracked weld, broken bracket): DO NOT install it. Set it aside, photograph clearly, continue with other tasks → ESCALATE
4. Missing parts: check ALL boxes (parts are sometimes split across multiple boxes). Check inside the uprights (small hardware bags get wedged inside tubes during shipping). Check the truck — did a bag fall out during unloading?
5. If truly missing after thorough search → ESCALATE with part number from the manual's hardware list

BENCH WOBBLES AFTER ASSEMBLY:
1. Flip bench upside down on cardboard
2. Check: are all 4 feet touching the floor? If one is short, add a rubber foot pad
3. Check: are all bolts FULLY tightened? Bench bolts need to be very tight
4. If still wobbles: put bench right-side up on a KNOWN flat surface (not the garage floor). If it doesn't wobble on the flat surface, the floor is uneven — add rubber feet

MANUFACTURER SUPPORT HOTLINES (scholars can call directly):
- Rep Fitness: (720) 669-5222 — Mon-Fri 8am-5pm MST — ask for assembly support, have model number ready
- Rogue Fitness: (614) 358-6190 — Mon-Fri 8am-7pm EST, Sat 9am-5pm — ask for technical support, have item number ready
- NewAge / Bold Series: (877) 306-8930 — Mon-Fri 9am-6pm EST — have model number from cabinet label

═══════════════════════════════════════
  SAFE STOP POINTS
═══════════════════════════════════════

If you get stuck and admin hasn't responded yet, DO NOT sit idle or try to force a fix.
Move to the next SAFE task while waiting. Here's what you CAN safely do while waiting for help:

DURING RACK INSTALL (stuck on rack):
- Assemble bench(es) — fully independent, no dependency on rack
- Lay out stall mats in areas away from the rack footprint
- Assemble wall storage mounts (if studs are already located)
- Unbox and organize plates, barbells, accessories
- Sort all remaining hardware by equipment piece
- Take detailed BEFORE photos of the rest of the garage

DURING CABLE SYSTEM INSTALL (stuck on cables):
- The rack should already be done — move to bench assembly
- Lay flooring in non-rack areas
- Install wall storage
- Organize plates on rack plate horns (the rack itself is done)
- Start packaging cleanup — break down boxes, organize trash

DURING FLOORING INSTALL (stuck on flooring):
- Continue with any unfinished equipment assembly
- Install wall storage in areas not affected by flooring
- Take progress photos
- Pre-stage the client handoff (organize manuals, extra hardware bags, label them)

GENERAL RULE: If you're blocked on Task A, find Task B that:
1. Doesn't depend on Task A being finished
2. Won't need to be undone if Task A's solution changes something
3. Moves the job forward

NEVER:
- Try to "figure it out" by forcing parts together
- Skip a step in the manual because it seems optional
- Use a different bolt size because the right one is missing
- Leave the job site to buy parts without admin approval

═══════════════════════════════════════
  GYM JOB ESCALATION — 3-TIER SYSTEM
═══════════════════════════════════════

TIER 1 — SELF-SERVE (handle yourself, no admin needed):
- Minor cosmetic damage → note it, continue
- Bench wobbles → check feet, tighten bolts, add rubber pads
- Can't find a specific bolt → check all boxes, inside uprights, on the truck
- Unsure about a manual step → call manufacturer support directly (numbers above)
- Cable slightly stiff → check pulley seating, reseat cable in groove
- Floor is uneven → use shims under equipment feet
- Stall mat won't cut cleanly → change blade (fresh blade every 2 cuts)

TIER 2 — ASYNC ESCALATION (text admin with photos, continue other tasks):
- Missing parts confirmed after full search → text admin photo of manual hardware list with the missing item circled + photo of all parts laid out. Move to another task while waiting
- Bolt won't thread after trying all troubleshooting steps → photo of the bolt and hole, text admin. Move to another task
- Can't find studs where needed → photo of wall area, measurements of where studs SHOULD be, text admin. Install other equipment while waiting
- Weight stack still binds after troubleshooting → video of the bind, text admin. Assemble other equipment while waiting
- Unsure about equipment placement (will it fit? enough clearance?) → photos with tape measure visible, text admin with dimensions. Continue with other tasks

Format for async escalation text:
"[JOB ADDRESS] — [EQUIPMENT NAME] — [PROBLEM IN 1 SENTENCE] — [WHAT I ALREADY TRIED] — [PHOTO/VIDEO ATTACHED] — Moving to [NEXT TASK] while waiting for response."

TIER 3 — STOP WORK (call admin, wait for response before continuing this specific task):
- Cable frays during routing → STOP cable work immediately. This is a warranty issue. Photo the fray. Work on other tasks
- Structural damage on equipment → DO NOT install. Photo everything. Work on other tasks
- Shipping damage to the garage (scratched floor, dented wall during install) → STOP, photo, call admin
- Client is unhappy or confrontational → STOP all work, be polite, call admin immediately
- Safety concern (unstable structure, electrical hazard, gas smell) → STOP ALL WORK, leave the area, call admin AND 911 if needed
- Ceiling height prevents rack installation (measured, not estimated) → call admin for replanning

KEY PRINCIPLE: Tier 3 items mean "stop THIS task" not "stop all work." Unless it's a safety issue, keep working on independent tasks while you wait. Your time on-site is valuable — never sit idle.

═══════════════════════════════════════
  OUTPUT FORMAT
═══════════════════════════════════════

Always output exactly these 10 sections. Be EXTREMELY detailed in every section. When in doubt, over-explain — a scholar reading this should never have to wonder "but how do I actually do that?"

## 1. PRE-JOB LOADOUT
[Itemized list of EVERY tool, material, product, bin, hardware piece, and PPE item this job needs. Be specific: "6x 5/16" x 3" lag bolts" not just "lag bolts". Include quantities. A scholar should be able to read this list in the shop and load the truck without missing anything.]

## 2. SITE ASSESSMENT (First 10 Minutes)
[Zone-by-zone observations from the intake photos. For each wall/area: describe condition, clutter level, estimated effort, and any access issues. End with a bullet list of things to CONFIRM ON ARRIVAL (things you can't tell from photos). If no photos provided, open with "No intake photos — complete full site assessment on arrival" and list everything they need to check.]

## 3. PHASE SEQUENCE
[This is the heart of the SOP. Numbered phases with lettered sub-steps. EVERY phase gets an estimated time. EVERY action that involves a tool, a measurement, or a decision gets its own lettered sub-step. This section auto-converts to a checklist in the app. Format:

1. Phase Name (estimated time)
   a. First specific action
   b. Second specific action
   c. Third specific action — include STOP AND CHECK if this is before an irreversible step

Include at least 5-8 sub-steps per phase for Graduate and Doctorate jobs. Do not write vague steps like "install shelving" — instead break it into every physical action: find studs, mark wall, check level, pre-drill, mount bracket, etc.]

## 4. INSTALLATION SPECIFICATIONS
[Product-by-product walkthrough. For EACH product being installed, write the FULL step-by-step installation as if the reader has never installed anything before. Reference the tool how-to guides above. Include: exact bolt sizes and counts, exact measurements, where to measure from, how to check your work, and what to do if something goes wrong.]

## 5. SAFETY & WASTE PROTOCOLS
[PPE requirements for EACH phase (not just "wear PPE"). Specific lifting instructions. Hazmat identification and handling. What to do if someone gets hurt. Haul-away sorting rules: what goes to landfill vs donation vs resale. Truck loading order. Driveway etiquette (don't block neighbor's driveway).]

## 6. TIME BUDGET
[Phase-by-phase time breakdown with a running total. Compare the total to the package time allocation. If the job will run tight or over, say so clearly: "This job may run 1 hour over the 7-hour allocation due to [reason]. Recommendation: [solution]".]

## 7. GARAGE SCHOLARS QUALITY STANDARD
[The specific checklist of non-negotiable finish items for THIS tier. Write it as a pass/fail list. A scholar should be able to read each item and check yes or no. Include photo documentation requirements.]

## 8. CLIENT HANDOFF CHECKLIST
[Step-by-step script for the client walkthrough. What to say, what to show, what to hand them. Include the exact words for asking for a Google review. Include what to do if the client is unhappy with something.]

## 9. ADMIN NOTES
[Flags for the team lead: timeline risk, unusual conditions, items with resale value, upsell opportunities, scheduling notes, anything that needs a heads-up before the crew arrives.]

## 10. REFERENCE MANUALS
[For EVERY piece of equipment being installed on this job — storage AND gym — list:
- Equipment name and model
- Direct link to the manufacturer's assembly manual (PDF or web page)
- If a manual URL was provided in the product context, use that exact URL
- If the equipment is customer-supplied with no known manual, write: "Customer-supplied — check included manual or search ManualsLib.com"
- For Bold Series cabinets: link to NewAge Products support hub
- For Rep Fitness: link to help.repfitness.com or the direct S3 PDF
- For Rogue: link to roguefitness.com assembly guide or assets PDF
This section gives scholars a backup reference if they get stuck on any installation step.
Only include this section if the job involves product installation. If the job is organization-only with no installs, skip this section.]`;
const buildSopUserMessage = (job, hasImages, adminNotes) => {
    const tier = job.packageTier || job.package || "graduate";
    const packageDesc = PACKAGE_DATA[tier] || PACKAGE_DATA.graduate;
    // Resolve product details for richer context
    const shelvingRaw = job.shelvingSelections || "None specified";
    const installNotes = [];
    // Detect Bold Series products and add install context
    if (shelvingRaw.includes("Bold Series")) {
        if (shelvingRaw.includes("Wall Cabinet")) {
            installNotes.push("BOLD WALL CABINETS: Mount at 54\" from floor, lag bolt 5/16\" x 3\" into studs (16\" OC), min 2 studs per cabinet.");
        }
        if (/\d-Pc.*System|\d-Piece/i.test(shelvingRaw)) {
            installNotes.push("BOLD FLOOR+WALL SYSTEM: Install wall units first, then floor cabinets. Level floor units with shims, anchor to wall stud. Connect multi-piece sets with included bolts. Worktops go on last, secure with clips from underneath.");
        }
        if (/Bamboo|Stainless/i.test(shelvingRaw)) {
            installNotes.push("WORKTOP NOTE: Bamboo/stainless tops rest on cabinet frames — install all cabinets first, verify level, then place tops and secure with included clips.");
        }
    }
    // Detect overhead racks
    if (shelvingRaw.includes("Overhead Rack")) {
        if (shelvingRaw.includes('32"D')) {
            installNotes.push("OVERHEAD 32\"D: Requires 8ft min ceiling. Locate joists with stud finder, 4 anchor points, 3/8\" x 3\" lag bolts into joists only. Two-person job. 7ft min clearance below for vehicle doors.");
        }
        if (shelvingRaw.includes('48"D')) {
            installNotes.push("OVERHEAD 48\"D: Requires 9ft min ceiling. Locate joists with stud finder, 4 anchor points, 3/8\" x 3\" lag bolts into joists only. Two-person job. 7ft min clearance below for vehicle doors.");
        }
        if (shelvingRaw.includes("Bin Rack")) {
            installNotes.push("CEILING BIN RACK: Mount into joists, 4 anchor points. Verify joist direction before marking.");
        }
    }
    // Detect shelving units
    if (shelvingRaw.includes("5-Tier")) {
        installNotes.push("5-TIER SHELVING (48\"W): Assemble upright, level with adjustable feet, MUST anchor to wall with anti-tip bracket + 1/4\" lag bolt.");
    }
    if (shelvingRaw.includes("4-Tier")) {
        installNotes.push("4-TIER SHELVING (60\"W): Assemble upright, needs 5ft clear wall space, level with adjustable feet, MUST anchor with anti-tip bracket.");
    }
    // Detect flooring add-ons
    const addOnsRaw = job.addOns || "None selected";
    if (addOnsRaw.includes("Click-In")) {
        installNotes.push("CLICK-IN FLOORING: Sweep and degrease floor first, start from back wall toward door, rubber mallet to snap tiles, 1/4\" expansion gap at walls. Cut edges with utility knife.");
    }
    if (addOnsRaw.includes("Polyaspartic")) {
        installNotes.push("POLYASPARTIC COATING: Subcontracted — coordinate scheduling with flooring crew. Garage must be fully empty. 24hr cure time before loading.");
    }
    const parts = [
        `Package: ${tier.toUpperCase()} — ${packageDesc}`,
        `Shelving & Storage: ${shelvingRaw}`,
        `Add-Ons: ${addOnsRaw}`,
    ];
    if (installNotes.length > 0) {
        parts.push(`\nPRODUCT INSTALLATION CONTEXT:\n${installNotes.join("\n")}`);
    }
    parts.push(`\nAddress: ${job.address || "Unknown"}`, `Client Description: ${job.description || "No description provided"}`, `Access Constraints: ${job.accessConstraints || "None noted"}`, `Sell vs Keep Preference: ${job.sellVsKeepPreference || "decide on arrival"}`, `Garage Size: ${job.garageSize || "assess on arrival"}`);
    if (!hasImages) {
        parts.push("\nNo intake photos provided — Section 2 should open with 'No intake photos provided — complete full site assessment on arrival'.");
    }
    if (adminNotes) {
        parts.push(`\nAdmin notes from team lead: ${adminNotes}`);
    }
    // Gym equipment context (from structured productSelections)
    const gymEquipment = job.productSelections?.gymEquipment || [];
    if (gymEquipment.length > 0) {
        const gymNotes = [];
        // Inline catalog lookup — matches IDs from the GYM_EQUIPMENT_CATALOG in productCatalog.ts
        const GYM_CATALOG = {
            "rep-pr-4000": { name: "PR-4000 Power Rack", brand: "Rep Fitness", dims: '49"W x 48"D x 86"H', assemblyTime: "90-120 min", crewSize: 2, tools: ["socket wrench set", "Allen wrench set", "level", "rubber mallet"], manualUrl: "https://s3.amazonaws.com/helpscout.net/docs/assets/5ac255142c7d3a0e9366ee02/attachments/60d0c8f88556b07a28847fe2/PR-4000-manual-REP-compressed.pdf", notes: "6-post config needed for ARES" },
            "rep-pr-5000": { name: "PR-5000 Power Rack", brand: "Rep Fitness", dims: '49"W x 48"D x 93"H', assemblyTime: "90-120 min", crewSize: 2, tools: ["socket wrench set", "Allen wrench set", "level", "rubber mallet"], manualUrl: "https://s3.amazonaws.com/helpscout.net/docs/assets/5ac255142c7d3a0e9366ee02/attachments/61291f406c65aa15b87d5157/PR-5000-manual-compressed.pdf", notes: "3x3\" uprights, 1\" hole spacing" },
            "rep-ares": { name: "ARES Cable Attachment", brand: "Rep Fitness", dims: "6-post rack mount", assemblyTime: "2-3 hours", crewSize: 2, tools: ["socket wrench set", "Allen wrench set (5mm, 6mm)", "step ladder", "cable routing tool"], manualUrl: "https://www.manualslib.com/manual/3391615/Rep-Ares.html", notes: "Cable threading is critical — route BEFORE mounting stacks" },
            "rep-ares-2": { name: "ARES 2.0 Cable Attachment", brand: "Rep Fitness", dims: "6-post rack mount", assemblyTime: "2-3 hours", crewSize: 2, tools: ["socket wrench set", "Allen wrench set (5mm, 6mm)", "step ladder", "cable routing tool"], manualUrl: "https://repcustomerfiles.blob.core.windows.net/publicfiles/Ares-2.0-Assembly-Instructions%20(1)-compressed.pdf", notes: "Updated cable routing vs v1" },
            "rep-athena": { name: "Athena Side-Mount Functional Trainer (FT-3500)", brand: "Rep Fitness", dims: "Side-mounts to PR-4000/5000", assemblyTime: "3-4 hours (both sides)", crewSize: 3, tools: ["socket wrench set", "Allen wrench set", "step ladder", "level", "cable routing tool"], manualUrl: "https://repcustomerfiles.blob.core.windows.net/publicfiles/FT-3500-Assembly.pdf", notes: "MOST COMPLEX install. Each side independent. Cable replacement guide: https://repcustomerfiles.blob.core.windows.net/publicfiles/FT-3500-cableReplacementGuide.pdf" },
            "rep-ft-5000": { name: "FT-5000 Functional Trainer", brand: "Rep Fitness", dims: '60"W x 45"D x 86"H', assemblyTime: "2-3 hours", crewSize: 3, tools: ["6mm Allen wrench", "13mm wrench", "step ladder", "level"], manualUrl: "https://s3.amazonaws.com/helpscout.net/docs/assets/5ac255142c7d3a0e9366ee02/attachments/5ca23c1f0428633d2cf44fc8/Functional-Trainer-Assembly-Instructions-V2.pdf", notes: "500+ lbs, MUST wall-anchor" },
            "rep-ab-3000": { name: "AB-3000 FID Adjustable Bench", brand: "Rep Fitness", dims: '57"L x 26"W x 18"H', assemblyTime: "15-30 min", crewSize: 1, tools: ["Allen wrench set", "socket wrench"], manualUrl: "https://s3.amazonaws.com/helpscout.net/docs/assets/5ac255142c7d3a0e9366ee02/attachments/605d0d450ad05379b10d0eba/AB-3000-manual-REP.pdf", notes: "" },
            "rep-ab-5000": { name: "AB-5000 Zero Gap Bench", brand: "Rep Fitness", dims: '59"L x 26"W x 18"H', assemblyTime: "20-30 min", crewSize: 1, tools: ["Allen wrench set", "socket wrench"], manualUrl: "https://s3.amazonaws.com/helpscout.net/docs/assets/5ac255142c7d3a0e9366ee02/attachments/5cffc7c32c7d3a493e798a85/AB-5000-Assembly-Instructions.pdf", notes: "Zero-gap design" },
            "rep-fb-5000": { name: "FB-5000 Competition Flat Bench", brand: "Rep Fitness", dims: '48"L x 12"W x 17.5"H', assemblyTime: "10-15 min", crewSize: 1, tools: ["Allen wrench set"], manualUrl: "https://help.repfitness.com", notes: "" },
            "rogue-sml-2": { name: "SML-2 Monster Lite Squat Stand", brand: "Rogue", dims: '49"W x 48"D x 90"H', assemblyTime: "30-45 min", crewSize: 2, tools: ["3/4\" wrench", "socket wrench", "level"], manualUrl: "https://www.roguefitness.com/theindex/gear-how-tos/how-to-assemble-the-rogue-sml-2-monster-lite-squat-stand", notes: "" },
            "rogue-rml-490": { name: "RML-490 Power Rack", brand: "Rogue", dims: '53"W x 53"D x 90"H', assemblyTime: "90-120 min", crewSize: 2, tools: ["3/4\" wrench", "9/16\" wrench", "socket wrench set", "level", "rubber mallet"], manualUrl: "https://assets.roguefitness.com/image/upload/v1658760997/catalog/Rigs%20and%20Racks/Power%20Racks%20/Monster%20Lite%20Racks/XX10965/RA0478_CUST_INSTR_vrv4gz.pdf", notes: "Monster Lite 3x3\" uprights" },
            "rogue-ml-slinger": { name: "Monster Lite Slinger Cable", brand: "Rogue", dims: "Rack-mount", assemblyTime: "60-90 min per side", crewSize: 2, tools: ["3/4\" wrench", "9/16\" wrench", "socket wrench set", "step ladder"], manualUrl: "https://assets.roguefitness.com/instructions/IS0484/IS0484_CUST_INSTR_V1", notes: "Cable on TOP of pulleys, below spacers" },
            "rogue-ml-lat-low-row": { name: "Monster Lite Lat Pulldown + Low Row", brand: "Rogue", dims: "Rack-mount", assemblyTime: "45-60 min", crewSize: 2, tools: ["3/4\" wrench", "socket wrench set", "5/8\" detent pins"], manualUrl: "https://assets.roguefitness.com/instructions/IS0535/IS0535_CUST_INSTR_V1", notes: "Connects to Slinger, detent pins at 4th+6th hole" },
            "gym-stall-mats": { name: "Rubber Stall Mats", brand: "Generic", dims: "4'x6' x 3/4\" each", assemblyTime: "15-20 min per mat", crewSize: 2, tools: ["utility knife", "straight edge", "tape measure"], manualUrl: "", notes: "~100 lbs each, flat side up, 1/4\" gap at walls" },
            "gym-platform-diy": { name: "DIY Deadlift Platform", brand: "Generic", dims: "8'x4'", assemblyTime: "45-60 min", crewSize: 2, tools: ["drill", "wood screws", "wood glue", "jigsaw", "tape measure"], manualUrl: "", notes: "2 sheets plywood + 1 sheet rubber" },
            "gym-wall-storage": { name: "Wall-Mounted Gym Storage", brand: "Generic", dims: "Varies", assemblyTime: "30-45 min", crewSize: 1, tools: ["stud finder", "drill", "lag bolts", "level"], manualUrl: "", notes: "MUST mount into studs" },
        };
        for (const item of gymEquipment) {
            const cat = GYM_CATALOG[item.id];
            if (cat) {
                gymNotes.push(`- ${item.qty}x ${cat.name} (${cat.brand}) — ${cat.dims}, ${cat.assemblyTime} assembly, ${cat.crewSize}+ crew. Tools: ${cat.tools.join(", ")}. Manual: ${cat.manualUrl || "check included manual"}${cat.notes ? `. ${cat.notes}` : ""}`);
            }
            else if (item.customName) {
                gymNotes.push(`- ${item.qty}x ${item.customName} (customer-supplied — check for included manual, or search ManualsLib.com)`);
            }
        }
        installNotes.push("\nGYM EQUIPMENT TO ASSEMBLE:");
        installNotes.push(...gymNotes);
    }
    // Gym flooring type
    const gymFlooringType = job.productSelections?.gymFlooringType;
    if (gymFlooringType && gymFlooringType !== "none") {
        const flooringLabels = {
            "stall-mats": "Rubber Stall Mats (3/4\" thick, 4'x6' each)",
            "click-in": "Click-In Plate Flooring",
            "polyaspartic": "Polyaspartic Floor Coating",
        };
        installNotes.push(`\nGYM FLOORING: ${flooringLabels[gymFlooringType] || gymFlooringType}`);
    }
    // Gym notes from admin
    if (job.productSelections?.gymNotes?.trim()) {
        installNotes.push(`\nGym Notes: ${job.productSelections.gymNotes.trim()}`);
    }
    const hasGymEquipment = gymEquipment.length > 0 || (gymFlooringType && gymFlooringType !== "none");
    const sectionCount = hasGymEquipment || shelvingRaw !== "None specified" ? 10 : 9;
    parts.push(`\nGenerate the complete job SOP with all ${sectionCount} sections.${sectionCount === 10 ? " Include Section 10 (Reference Manuals) with direct links to assembly PDFs for every product being installed." : ""}`);
    return parts.join("\n");
};
/**
 * Fetch up to `maxDocs` manufacturer PDF manuals from the job's product selections.
 * Returns base64-encoded document blocks ready for Claude API.
 * Non-blocking: failures are logged and skipped.
 */
async function fetchManualPdfs(productSelections, maxDocs = 3) {
    if (!productSelections)
        return [];
    const { lookupEquipment } = await Promise.resolve().then(() => __importStar(require("./gs-catalog")));
    // Collect unique manual URLs from all equipment
    const manualUrls = [];
    const seenUrls = new Set();
    const addUrl = (id, name, url) => {
        if (!url || url === "N/A" || seenUrls.has(url) || !url.endsWith(".pdf"))
            return;
        seenUrls.add(url);
        manualUrls.push({ id, name, url });
    };
    // Gym equipment
    if (productSelections.gymEquipment) {
        for (const item of productSelections.gymEquipment) {
            const entry = lookupEquipment(item.id);
            if (entry)
                addUrl(item.id, entry.name, entry.manualUrl);
        }
    }
    // Bold Series
    if (productSelections.boldSeriesId) {
        const entry = lookupEquipment(productSelections.boldSeriesId);
        if (entry)
            addUrl(productSelections.boldSeriesId, entry.name, entry.manualUrl);
    }
    // Shelving
    if (productSelections.standardShelving) {
        for (const item of productSelections.standardShelving) {
            const entry = lookupEquipment(item.id);
            if (entry)
                addUrl(item.id, entry.name, entry.manualUrl);
        }
    }
    // Overhead
    if (productSelections.overheadStorage) {
        for (const item of productSelections.overheadStorage) {
            const entry = lookupEquipment(item.id);
            if (entry)
                addUrl(item.id, entry.name, entry.manualUrl);
        }
    }
    // Flooring
    if (productSelections.flooringId && productSelections.flooringId !== "none") {
        const entry = lookupEquipment(productSelections.flooringId);
        if (entry)
            addUrl(productSelections.flooringId, entry.name, entry.manualUrl);
    }
    // Fetch PDFs (limit to maxDocs, 10s timeout per fetch)
    const docBlocks = [];
    for (const { id, name, url } of manualUrls.slice(0, maxDocs)) {
        try {
            console.log(`Fetching manual PDF for ${name}: ${url}`);
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 10000);
            const resp = await fetch(url, { signal: controller.signal });
            clearTimeout(timeout);
            if (!resp.ok) {
                console.warn(`Manual fetch failed for ${id}: HTTP ${resp.status}`);
                continue;
            }
            const buffer = Buffer.from(await resp.arrayBuffer());
            // Skip if too large (>10MB would bloat the API call)
            if (buffer.length > 10 * 1024 * 1024) {
                console.warn(`Manual PDF too large for ${id}: ${buffer.length} bytes, skipping`);
                continue;
            }
            docBlocks.push({
                type: "document",
                source: { type: "base64", media_type: "application/pdf", data: buffer.toString("base64") },
            });
            console.log(`Loaded manual for ${name}: ${buffer.length} bytes`);
        }
        catch (err) {
            console.warn(`Failed to fetch manual for ${id}:`, err);
        }
    }
    return docBlocks;
}
exports.generateSopForJob = (0, https_1.onCall)({ timeoutSeconds: 300, memory: "1GiB", secrets: ["ANTHROPIC_API_KEY"] }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "Authentication required.");
    }
    const { jobId, adminNotes } = request.data;
    if (!jobId) {
        throw new https_1.HttpsError("invalid-argument", "Missing jobId.");
    }
    await requireAdmin(request.auth.uid, request.auth.token.email);
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicKey) {
        throw new https_1.HttpsError("failed-precondition", "ANTHROPIC_API_KEY is not configured. Run: firebase functions:secrets:set ANTHROPIC_API_KEY");
    }
    const jobRef = db.collection("gs_jobs").doc(jobId);
    const jobSnap = await jobRef.get();
    if (!jobSnap.exists) {
        throw new https_1.HttpsError("not-found", "Job not found.");
    }
    const jobData = { id: jobSnap.id, ...jobSnap.data() };
    const intakePaths = Array.isArray(jobData.intakeMediaPaths) ? jobData.intakeMediaPaths : [];
    // Download images as base64 for Claude vision
    const bucket = storage.bucket();
    const imageBlocks = [];
    for (const rawPath of intakePaths.slice(0, 3)) {
        try {
            // Strip full URL prefix if intakeMediaPaths stores public URLs
            let storagePath = rawPath;
            const bucketName = bucket.name; // e.g. "garage-scholars-v2.firebasestorage.app"
            const prefix = `https://storage.googleapis.com/${bucketName}/`;
            if (storagePath.startsWith(prefix)) {
                storagePath = storagePath.slice(prefix.length);
            }
            // Also handle firebasestorage.googleapis.com format
            const altPrefix = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/`;
            if (storagePath.startsWith(altPrefix)) {
                storagePath = decodeURIComponent(storagePath.slice(altPrefix.length).split("?")[0]);
            }
            console.log(`Downloading image: ${storagePath}`);
            const [rawBuffer] = await bucket.file(storagePath).download();
            // Resize to max 1600px longest side + JPEG quality 80 to stay under Claude's 5MB limit
            const resized = await (0, sharp_1.default)(rawBuffer)
                .resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
                .jpeg({ quality: 80 })
                .toBuffer();
            console.log(`Resized image: ${rawBuffer.length} → ${resized.length} bytes`);
            imageBlocks.push({
                type: "image",
                source: { type: "base64", media_type: "image/jpeg", data: resized.toString("base64") }
            });
            console.log(`Successfully downloaded image: ${storagePath}`);
        }
        catch (err) {
            console.warn(`Failed to download intake image: ${rawPath}`, err);
        }
    }
    // Fetch manufacturer PDF manuals for richer context
    const docBlocks = await fetchManualPdfs(jobData.productSelections, 3);
    console.log(`Calling Claude API with ${imageBlocks.length} images + ${docBlocks.length} PDF manuals for job ${jobId}`);
    const anthropic = new sdk_1.default({ apiKey: anthropicKey });
    const userText = buildSopUserMessage(jobData, imageBlocks.length > 0, adminNotes);
    const userContent = [
        ...docBlocks,
        ...imageBlocks,
        { type: "text", text: docBlocks.length > 0
                ? `${userText}\n\nATTACHED: ${docBlocks.length} manufacturer assembly manual PDF(s) for the equipment in this job. Use these as reference for detailed, accurate installation steps. Quote specific page/step numbers from the manuals when relevant.`
                : userText
        }
    ];
    let generatedSOP = "";
    try {
        console.log(`SOP generation starting...`);
        const response = await anthropic.messages.create({
            model: "claude-sonnet-4-5-20250929",
            max_tokens: 16384,
            system: SOP_SYSTEM_PROMPT,
            messages: [{ role: "user", content: userContent }]
        });
        const textBlock = response.content.find((b) => b.type === "text");
        generatedSOP = textBlock ? textBlock.text : "";
        console.log(`Got ${generatedSOP.length} chars, has sections: ${generatedSOP.includes("## 1.")}`);
    }
    catch (error) {
        console.error(`SOP generation failed:`, error.message);
        throw new https_1.HttpsError("internal", `Failed to generate SOP: ${error.message}`);
    }
    if (!generatedSOP) {
        console.error(`SOP generation returned empty response for job ${jobId}`);
        throw new https_1.HttpsError("internal", "SOP generation returned empty response");
    }
    // Save generated SOP directly on the job document
    console.log(`Saving SOP (${generatedSOP.length} chars) to job ${jobId}`);
    await jobRef.set({
        generatedSOP,
        status: "SOP_NEEDS_REVIEW",
        updatedAt: firestore_2.FieldValue.serverTimestamp()
    }, { merge: true });
    console.log(`SOP successfully saved for job ${jobId}`);
    return { ok: true, generatedSOP };
});
// ═══════════════════════════════════════════════════════════════
// Standalone Assembly Guide Generator
// Fetches a manufacturer PDF (from catalog or custom URL),
// feeds it to Claude, returns a scholar-friendly assembly guide.
// ═══════════════════════════════════════════════════════════════
exports.gsGenerateAssemblyGuide = (0, https_1.onCall)({ timeoutSeconds: 300, memory: "1GiB", secrets: ["ANTHROPIC_API_KEY"] }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "Authentication required.");
    }
    const { equipmentId, manualUrl, productName } = request.data;
    if (!equipmentId && !manualUrl) {
        throw new https_1.HttpsError("invalid-argument", "Provide equipmentId or manualUrl.");
    }
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicKey) {
        throw new https_1.HttpsError("failed-precondition", "ANTHROPIC_API_KEY not configured.");
    }
    // Resolve the manual URL and product name
    let resolvedUrl = manualUrl || "";
    let resolvedName = productName || "Unknown Product";
    if (equipmentId) {
        const { lookupEquipment } = await Promise.resolve().then(() => __importStar(require("./gs-catalog")));
        const entry = lookupEquipment(equipmentId);
        if (entry) {
            resolvedUrl = resolvedUrl || entry.manualUrl;
            resolvedName = entry.name;
        }
    }
    if (!resolvedUrl) {
        throw new https_1.HttpsError("invalid-argument", `No manual URL found for ${resolvedName}. Provide a manualUrl.`);
    }
    // Fetch the PDF
    const contentBlocks = [];
    if (resolvedUrl.endsWith(".pdf")) {
        try {
            console.log(`Fetching assembly PDF: ${resolvedUrl}`);
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 15000);
            const resp = await fetch(resolvedUrl, { signal: controller.signal });
            clearTimeout(timeout);
            if (!resp.ok)
                throw new Error(`HTTP ${resp.status}`);
            const buffer = Buffer.from(await resp.arrayBuffer());
            if (buffer.length > 15 * 1024 * 1024) {
                throw new Error(`PDF too large: ${buffer.length} bytes`);
            }
            contentBlocks.push({
                type: "document",
                source: { type: "base64", media_type: "application/pdf", data: buffer.toString("base64") },
            });
            console.log(`Loaded PDF: ${buffer.length} bytes`);
        }
        catch (err) {
            console.warn(`Failed to fetch PDF: ${resolvedUrl}`, err);
            // Fall back to text-only guide without the PDF
        }
    }
    const systemPrompt = `You are writing assembly instructions for Garage Scholars — a Denver garage transformation company that hires college students ("scholars") who have ZERO trade experience.

YOUR #1 RULE: Write every step as if the reader has never held a wrench or drill before.

Write a complete, step-by-step assembly guide for the product. Include:
1. WHAT YOU NEED — complete tool list with exact sizes (e.g., "13mm socket wrench", not just "wrench")
2. ESTIMATED TIME — realistic time for a first-timer
3. CREW SIZE — minimum people needed and which steps require extra hands
4. PARTS INVENTORY — list every part the scholar should find in the box, with counts
5. STEP-BY-STEP ASSEMBLY — tiny sub-steps, "STOP AND CHECK" moments, and "If X happens, do Y" troubleshooting at each step
6. FINAL QUALITY CHECK — what to verify before calling the job done
7. COMMON MISTAKES — top 5 things first-timers get wrong and how to avoid them

${contentBlocks.length > 0 ? "A manufacturer assembly manual PDF is attached. Use it as the authoritative reference — quote specific step numbers and diagram references. Translate the manufacturer's terse instructions into beginner-friendly language." : "No manufacturer PDF available — generate the guide from your knowledge of this product type."}

TONE: Direct, friendly, patient. Like a patient older coworker showing you the ropes.`;
    contentBlocks.push({
        type: "text",
        text: `Generate a complete beginner-friendly assembly guide for: ${resolvedName}${manualUrl && !resolvedUrl.endsWith(".pdf") ? `\n\nProduct/reference URL: ${manualUrl}` : ""}`,
    });
    const anthropic = new sdk_1.default({ apiKey: anthropicKey });
    try {
        const response = await anthropic.messages.create({
            model: "claude-sonnet-4-5-20250929",
            max_tokens: 8192,
            system: systemPrompt,
            messages: [{ role: "user", content: contentBlocks }],
        });
        const textBlock = response.content.find((b) => b.type === "text");
        const guide = textBlock ? textBlock.text : "";
        if (!guide) {
            throw new https_1.HttpsError("internal", "Empty response from Claude.");
        }
        // Save to Firestore for future reference
        const guideRef = db.collection("gs_assemblyGuides").doc();
        await guideRef.set({
            equipmentId: equipmentId || null,
            productName: resolvedName,
            manualUrl: resolvedUrl,
            guide,
            generatedBy: request.auth.uid,
            hadPdf: contentBlocks.length > 1,
            createdAt: firestore_2.FieldValue.serverTimestamp(),
        });
        console.log(`Assembly guide generated for ${resolvedName}: ${guide.length} chars`);
        return { ok: true, guide, guideId: guideRef.id };
    }
    catch (error) {
        if (error.code)
            throw error; // re-throw HttpsError
        console.error("Assembly guide generation failed:", error);
        throw new https_1.HttpsError("internal", `Failed to generate guide: ${error.message}`);
    }
});
const requireAdmin = async (uid, email) => {
    // Check if user email is in the admin list
    if (email && ADMIN_EMAILS.includes(email.toLowerCase())) {
        return;
    }
    // Fallback to checking Firestore role (for backward compatibility)
    const userSnap = await db.collection("users").doc(uid).get();
    const role = userSnap.exists ? userSnap.data()?.role : null;
    if (role !== "admin") {
        throw new https_1.HttpsError("permission-denied", "Admin role required.");
    }
};
// Sanitize a name for use in Storage folder paths (filesystem-safe)
const sanitizeForPath = (name) => name.trim().replace(/[^a-zA-Z0-9 -]/g, '').replace(/\s+/g, ' ').trim() || 'Unknown';
// Build the human-readable storage folder name: "ClientName - clientId"
const buildClientFolder = (name, clientId) => `${sanitizeForPath(name)} - ${clientId}`;
// Find existing client by email or create a new one in the clients collection
// Returns { clientId, clientFolder } where clientFolder is the Storage folder name
const findOrCreateClient = async (name, email, phone, source = 'scheduling') => {
    const existing = await db.collection('clients')
        .where('email', '==', email.toLowerCase().trim())
        .limit(1).get();
    if (!existing.empty) {
        const doc = existing.docs[0];
        const data = doc.data();
        // Use stored folder name if available, otherwise build it
        const clientFolder = data.storageFolderName || buildClientFolder(data.name || name, doc.id);
        // Backfill storageFolderName if missing
        if (!data.storageFolderName) {
            await doc.ref.update({ storageFolderName: clientFolder });
        }
        return { clientId: doc.id, clientFolder };
    }
    const clientRef = await db.collection('clients').add({
        name: name.trim(),
        email: email.toLowerCase().trim(),
        phone: phone?.trim() || null,
        source,
        createdAt: firestore_2.FieldValue.serverTimestamp(),
        storageFolderName: '', // placeholder — set after we have the ID
        stats: {
            totalServiceJobs: 0,
            totalPropertiesServiced: 0,
            totalItemsListed: 0,
            totalItemsSold: 0,
            totalRevenue: 0
        }
    });
    const clientFolder = buildClientFolder(name, clientRef.id);
    await clientRef.update({ storageFolderName: clientFolder });
    return { clientId: clientRef.id, clientFolder };
};
exports.approveSignup = (0, https_1.onCall)(async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "Authentication required.");
    }
    const { requestId } = request.data;
    if (!requestId) {
        throw new https_1.HttpsError("invalid-argument", "Missing requestId.");
    }
    await requireAdmin(request.auth.uid, request.auth.token.email);
    const requestRef = db.collection("signupRequests").doc(requestId);
    const reqSnap = await requestRef.get();
    if (!reqSnap.exists) {
        throw new https_1.HttpsError("not-found", "Signup request not found.");
    }
    console.log("Looking for user with requestId:", requestId);
    const userQuery = await db.collection("users").where("requestId", "==", requestId).limit(1).get();
    console.log("User query result - empty?", userQuery.empty, "size:", userQuery.size);
    if (userQuery.empty) {
        // Try to find user by email as fallback
        const reqData = reqSnap.data();
        const email = reqData?.email;
        const name = reqData?.name || "Scholar";
        console.log("User not found by requestId, trying email:", email);
        if (email) {
            const emailQuery = await db.collection("users").where("email", "==", email).limit(1).get();
            console.log("Email query result - empty?", emailQuery.empty, "size:", emailQuery.size);
            if (!emailQuery.empty) {
                const userDoc = emailQuery.docs[0];
                console.log("Found user by email, updating with requestId");
                // Update the user doc with the requestId and approve
                await userDoc.ref.set({
                    requestId,
                    role: "scholar",
                    status: "active",
                    approvedAt: firestore_2.FieldValue.serverTimestamp(),
                    approvedByUid: request.auth.uid
                }, { merge: true });
                await requestRef.set({
                    status: "approved",
                    decidedAt: firestore_2.FieldValue.serverTimestamp(),
                    decidedByUid: request.auth.uid
                }, { merge: true });
                return { ok: true };
            }
            // User doesn't exist in Firestore at all - find them in Firebase Auth and create the doc
            console.log("User not found in Firestore, checking Firebase Auth for email:", email);
            try {
                const authUser = await adminAuth.getUserByEmail(email);
                console.log("Found user in Firebase Auth:", authUser.uid);
                // Create the user document
                await db.collection("users").doc(authUser.uid).set({
                    email,
                    name,
                    role: "scholar",
                    status: "active",
                    requestId,
                    createdAt: firestore_2.FieldValue.serverTimestamp(),
                    approvedAt: firestore_2.FieldValue.serverTimestamp(),
                    approvedByUid: request.auth.uid
                });
                await requestRef.set({
                    status: "approved",
                    decidedAt: firestore_2.FieldValue.serverTimestamp(),
                    decidedByUid: request.auth.uid
                }, { merge: true });
                console.log("Created user document and approved");
                return { ok: true };
            }
            catch (authError) {
                console.error("Firebase Auth lookup failed:", authError);
            }
        }
        // Last resort: debug all users to see what's in the collection
        console.log("Failed to find user by requestId, email, or Firebase Auth");
        // Get all users to debug
        const allUsers = await db.collection("users").limit(10).get();
        console.log("Total users in collection:", allUsers.size);
        allUsers.docs.forEach(doc => {
            console.log("User doc:", doc.id, doc.data());
        });
        throw new https_1.HttpsError("not-found", `User for request not found. Checked requestId: ${requestId}, email: ${email || 'none'}`);
    }
    const userDoc = userQuery.docs[0];
    console.log("Found user document:", userDoc.id, userDoc.data());
    await requestRef.set({
        status: "approved",
        decidedAt: firestore_2.FieldValue.serverTimestamp(),
        decidedByUid: request.auth.uid
    }, { merge: true });
    await userDoc.ref.set({
        role: "scholar",
        status: "active",
        approvedAt: firestore_2.FieldValue.serverTimestamp(),
        approvedByUid: request.auth.uid
    }, { merge: true });
    return { ok: true };
});
exports.declineSignup = (0, https_1.onCall)(async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "Authentication required.");
    }
    const { requestId } = request.data;
    if (!requestId) {
        throw new https_1.HttpsError("invalid-argument", "Missing requestId.");
    }
    await requireAdmin(request.auth.uid, request.auth.token.email);
    const requestRef = db.collection("signupRequests").doc(requestId);
    const reqSnap = await requestRef.get();
    if (!reqSnap.exists) {
        throw new https_1.HttpsError("not-found", "Signup request not found.");
    }
    const userQuery = await db.collection("users").where("requestId", "==", requestId).limit(1).get();
    const userDoc = userQuery.empty ? null : userQuery.docs[0];
    await requestRef.set({
        status: "declined",
        decidedAt: firestore_2.FieldValue.serverTimestamp(),
        decidedByUid: request.auth.uid
    }, { merge: true });
    if (userDoc) {
        await userDoc.ref.set({
            status: "disabled"
        }, { merge: true });
        await adminAuth.deleteUser(userDoc.id).catch(() => null);
    }
    return { ok: true };
});
/**
 * Send email notification when job status changes to REVIEW_PENDING
 * Requires Firebase Email Extension to be installed
 */
exports.sendJobReviewEmail = (0, firestore_1.onDocumentWritten)("serviceJobs/{jobId}", async (event) => {
    const beforeData = event.data?.before?.data();
    const afterData = event.data?.after?.data();
    // Only trigger when status changes to REVIEW_PENDING
    if (!afterData || afterData.status !== "REVIEW_PENDING") {
        return;
    }
    // Don't send duplicate emails if already REVIEW_PENDING
    if (beforeData?.status === "REVIEW_PENDING") {
        return;
    }
    const jobId = event.params.jobId;
    console.log(`Job ${jobId} is now pending review. Sending email notification...`);
    try {
        const bucket = storage.bucket();
        // Get download URLs for media
        const getDownloadUrl = async (path) => {
            if (!path || path === '')
                return '';
            if (path.startsWith('http'))
                return path; // Already a URL
            try {
                const [url] = await bucket.file(path).getSignedUrl({
                    action: "read",
                    expires: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days
                });
                return url;
            }
            catch (error) {
                console.error(`Failed to get URL for ${path}:`, error);
                return '';
            }
        };
        const checkInPhotoUrl = afterData.checkInMedia?.photoFrontOfHouse
            ? await getDownloadUrl(afterData.checkInMedia.photoFrontOfHouse)
            : '';
        const checkOutPhotoUrl = afterData.checkOutMedia?.photoFrontOfHouse
            ? await getDownloadUrl(afterData.checkOutMedia.photoFrontOfHouse)
            : '';
        const checkOutVideoUrl = afterData.checkOutMedia?.videoGarage
            ? await getDownloadUrl(afterData.checkOutMedia.videoGarage)
            : '';
        // Calculate work duration
        let workDuration = 'N/A';
        if (afterData.checkInTime && afterData.checkOutTime) {
            const minutes = Math.round((new Date(afterData.checkOutTime).getTime() - new Date(afterData.checkInTime).getTime()) / (1000 * 60));
            workDuration = `${minutes} minutes`;
        }
        // Generate secure approval token (simple hash of jobId + timestamp)
        const approvalToken = Buffer.from(`${jobId}-${Date.now()}`).toString('base64');
        // Create email HTML
        const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Job Review Required</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      background: linear-gradient(135deg, #2a5f5f 0%, #1f4a4a 100%);
      color: white;
      padding: 30px;
      border-radius: 12px;
      text-align: center;
      margin-bottom: 30px;
    }
    .header h1 {
      margin: 0;
      font-size: 28px;
    }
    .info-box {
      background: #f8f9fa;
      border-left: 4px solid #2a5f5f;
      padding: 20px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .info-row {
      margin: 10px 0;
      font-size: 14px;
    }
    .info-label {
      font-weight: 600;
      color: #555;
    }
    .info-value {
      color: #333;
    }
    .media-section {
      margin: 30px 0;
    }
    .media-section h3 {
      color: #2a5f5f;
      margin-bottom: 15px;
    }
    .media-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 15px;
      margin-bottom: 20px;
    }
    .media-item img {
      width: 100%;
      border-radius: 8px;
      border: 2px solid #e0e0e0;
    }
    .media-item p {
      text-align: center;
      font-size: 13px;
      color: #666;
      margin: 8px 0 0 0;
    }
    .video-link {
      display: block;
      background: #f0f0f0;
      padding: 15px;
      border-radius: 8px;
      text-align: center;
      text-decoration: none;
      color: #2a5f5f;
      font-weight: 600;
      margin: 15px 0;
    }
    .video-link:hover {
      background: #e0e0e0;
    }
    .button-container {
      text-align: center;
      margin: 40px 0;
    }
    .approve-button {
      display: inline-block;
      background: #10b981;
      color: white;
      padding: 16px 40px;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 700;
      font-size: 16px;
      box-shadow: 0 4px 6px rgba(16, 185, 129, 0.3);
    }
    .approve-button:hover {
      background: #059669;
    }
    .dashboard-link {
      display: inline-block;
      background: #3b82f6;
      color: white;
      padding: 12px 24px;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      margin-top: 15px;
    }
    .payment-info {
      background: #dbeafe;
      border: 1px solid #3b82f6;
      padding: 15px;
      border-radius: 8px;
      margin: 20px 0;
      font-size: 13px;
      color: #1e40af;
    }
    .footer {
      text-align: center;
      color: #999;
      font-size: 12px;
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e0e0e0;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>🏠 Job Review Required</h1>
    <p style="margin: 10px 0 0 0; opacity: 0.9;">A scholar has completed a service job</p>
  </div>

  <div class="info-box">
    <div class="info-row">
      <span class="info-label">Client:</span>
      <span class="info-value">${afterData.clientName || 'Unknown'}</span>
    </div>
    <div class="info-row">
      <span class="info-label">Address:</span>
      <span class="info-value">${afterData.address || 'N/A'}</span>
    </div>
    <div class="info-row">
      <span class="info-label">Scholar:</span>
      <span class="info-value">${afterData.assigneeName || 'Unknown'}</span>
    </div>
    <div class="info-row">
      <span class="info-label">Total Payout:</span>
      <span class="info-value" style="font-weight: 700; color: #10b981;">$${afterData.pay || 0}</span>
    </div>
    <div class="info-row">
      <span class="info-label">Work Duration:</span>
      <span class="info-value">${workDuration}</span>
    </div>
    <div class="info-row">
      <span class="info-label">Job ID:</span>
      <span class="info-value" style="font-family: monospace; font-size: 12px;">${jobId}</span>
    </div>
  </div>

  <div class="payment-info">
    <strong>💰 Payment Policy:</strong> Approval triggers 50% immediate payment ($${(afterData.pay || 0) / 2}).
    The remaining 50% is automatically released 24 hours after job completion if no client complaints are filed.
  </div>

  <div class="media-section">
    <h3>📸 Quality Assurance Photos</h3>
    <div class="media-grid">
      <div class="media-item">
        ${checkInPhotoUrl ? `<img src="${checkInPhotoUrl}" alt="Check-In Photo" />` : '<p>No check-in photo</p>'}
        <p>Check-In</p>
      </div>
      <div class="media-item">
        ${checkOutPhotoUrl ? `<img src="${checkOutPhotoUrl}" alt="Check-Out Photo" />` : '<p>No check-out photo</p>'}
        <p>Check-Out</p>
      </div>
    </div>

    ${checkOutVideoUrl ? `
      <a href="${checkOutVideoUrl}" class="video-link" target="_blank">
        🎥 View Check-Out Video (Garage Walkthrough)
      </a>
    ` : '<p style="color: #dc2626; font-weight: 600;">⚠️ No check-out video available</p>'}
  </div>

  <div class="button-container">
    <a href="${process.env.SCHEDULING_APP_URL || 'https://your-scheduling-app.vercel.app'}/admin?approve=${approvalToken}" class="approve-button">
      ✅ Approve & Pay $${(afterData.pay || 0) / 2} (50% now)
    </a>
    <br/>
    <a href="${process.env.SCHEDULING_APP_URL || 'https://your-scheduling-app.vercel.app'}/admin" class="dashboard-link">
      Open Admin Dashboard
    </a>
  </div>

  <div class="footer">
    <p>This is an automated notification from Garage Scholars Scheduling System</p>
    <p>Job completed at ${new Date(afterData.checkOutTime).toLocaleString()}</p>
  </div>
</body>
</html>
    `;
        // Write to 'mail' collection (monitored by Firebase Email Extension)
        await db.collection('mail').add({
            to: ['garagescholars@gmail.com', 'admin@garagescholars.com'], // Centralized review inbox
            message: {
                subject: `🔔 Review Required: ${afterData.clientName} - $${afterData.pay}`,
                html: emailHtml,
            },
            jobId: jobId,
            approvalToken: approvalToken,
            createdAt: firestore_2.FieldValue.serverTimestamp()
        });
        console.log(`Email notification queued for job ${jobId}`);
    }
    catch (error) {
        console.error(`Failed to send email for job ${jobId}:`, error);
    }
});
// Submit quote request from website
exports.submitQuoteRequest = (0, https_1.onCall)({ cors: true, timeoutSeconds: 120, memory: "512MiB" }, async (request) => {
    console.log('submitQuoteRequest handler entered');
    console.log('request.data keys:', Object.keys(request.data || {}));
    const { name, email, phone, zipcode, serviceType, package: packageTier, garageSize, description, photoData // Array of base64 encoded images if present
     } = request.data;
    // Validate required fields (package is optional — HTML form doesn't require it)
    if (!name || !email || !phone || !zipcode || !serviceType) {
        throw new https_1.HttpsError("invalid-argument", "Missing required fields: name, email, phone, zipcode, and serviceType are required.");
    }
    console.log(`submitQuoteRequest called: name=${name}, email=${email}, serviceType=${serviceType}, package=${packageTier || 'none'}`);
    try {
        // Step 1: Find or create client in the clients collection
        const { clientId, clientFolder } = await findOrCreateClient(name, email, phone);
        console.log(`Client resolved: ${clientId} (folder: ${clientFolder})`);
        // Step 2: Create quote request document
        const quoteRequestRef = await db.collection('quoteRequests').add({
            name,
            email,
            phone,
            zipcode,
            serviceType,
            package: packageTier || null,
            garageSize: garageSize || null,
            description: description || null,
            status: 'new',
            clientId,
            createdAt: firestore_2.FieldValue.serverTimestamp(),
            source: 'website'
        });
        console.log(`Quote request created: ${quoteRequestRef.id}`);
        const serviceTypeLabels = {
            'get-clean': 'Get Clean',
            'get-organized': 'Get Organized',
            'get-strong': 'Get Strong',
            'resale': 'Resale Concierge',
            'cleaning': 'Cleaning',
            'organization': 'Organization',
            'gym': 'Gym Setup',
            'full': 'Full Transformation'
        };
        // Step 3: Create draft job with LEAD status in gs_jobs (the collection the admin app watches)
        const draftJobRef = await db.collection('gs_jobs').add({
            clientName: name,
            clientEmail: email,
            clientPhone: phone,
            clientId,
            clientFolder,
            title: `${name} — ${serviceTypeLabels[serviceType] || serviceType}`,
            address: zipcode ? `ZIP: ${zipcode}` : 'Address TBD',
            zipcode: zipcode,
            description: description || 'New lead from website quote form',
            scheduledDate: new Date().toISOString(),
            scheduledTimeStart: '',
            scheduledTimeEnd: '',
            payout: 0,
            clientPrice: 0,
            status: 'LEAD',
            lat: 0,
            lng: 0,
            urgencyLevel: 'standard',
            rushBonus: 0,
            currentViewers: 0,
            viewerFloor: 0,
            totalViews: 0,
            reopenCount: 0,
            checklist: [],
            serviceType,
            package: packageTier || null,
            garageSize: garageSize || null,
            intakeMediaPaths: [],
            intakeImageUrls: [],
            quoteRequestId: quoteRequestRef.id,
            source: 'website',
            claimedBy: null,
            claimedByName: null,
            createdAt: firestore_2.FieldValue.serverTimestamp(),
            updatedAt: firestore_2.FieldValue.serverTimestamp()
        });
        console.log(`Draft job created with LEAD status: ${draftJobRef.id}`);
        // Link the job back to the quote request
        await quoteRequestRef.update({ jobId: draftJobRef.id });
        // Step 4: Upload photos to client-centric Storage path with human-readable names
        const intakeMediaPaths = [];
        const photoEmailUrls = [];
        const bucket = storage.bucket();
        if (photoData && Array.isArray(photoData) && photoData.length > 0) {
            console.log(`Uploading ${photoData.length} photos to clients/${clientFolder}/quote/photos/...`);
            for (let i = 0; i < photoData.length; i++) {
                try {
                    const { base64, filename } = photoData[i];
                    const buffer = Buffer.from(base64, 'base64');
                    console.log(`Photo ${i}: ${filename}, ${buffer.length} bytes`);
                    const storagePath = `clients/${clientFolder}/quote/photos/photo-${i + 1}.jpg`;
                    // Generate a download token for email embeds (avoids getSignedUrl permission issues)
                    const downloadToken = crypto.randomUUID();
                    const file = bucket.file(storagePath);
                    await file.save(buffer, {
                        metadata: {
                            contentType: 'image/jpeg',
                            metadata: { firebaseStorageDownloadTokens: downloadToken }
                        },
                    });
                    intakeMediaPaths.push(storagePath);
                    // Build a public download URL using the token
                    const encodedPath = encodeURIComponent(storagePath);
                    photoEmailUrls.push(`https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodedPath}?alt=media&token=${downloadToken}`);
                    console.log(`Photo ${i} uploaded: ${storagePath}`);
                }
                catch (photoError) {
                    console.error(`Error uploading photo ${i}:`, photoError);
                }
            }
            // Update job and quote request with storage paths
            if (intakeMediaPaths.length > 0) {
                await draftJobRef.update({ intakeMediaPaths });
                await quoteRequestRef.update({ photoStoragePaths: intakeMediaPaths });
                console.log(`${intakeMediaPaths.length} photo paths saved`);
            }
        }
        // Step 5: Send email notification to admin (use signed URLs for photos)
        const packageLabels = {
            'undergraduate': 'Undergraduate',
            'graduate': 'Graduate',
            'doctorate': 'Doctorate'
        };
        const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #6E9D7B; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; }
    .field { margin-bottom: 15px; }
    .field-label { font-weight: bold; color: #27362e; }
    .field-value { margin-top: 5px; }
    .photos { margin-top: 20px; }
    .photos img { max-width: 200px; margin: 10px; border: 1px solid #ddd; }
    .footer { margin-top: 20px; padding: 15px; background-color: #f0f0f0; border-radius: 0 0 8px 8px; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>🏠 New Quote Request</h2>
    </div>

    <div class="content">
      <div class="field">
        <div class="field-label">Contact Information:</div>
        <div class="field-value">
          <strong>Name:</strong> ${name}<br>
          <strong>Email:</strong> ${email}<br>
          <strong>Phone:</strong> ${phone}<br>
          <strong>ZIP Code:</strong> ${zipcode}
        </div>
      </div>

      <div class="field">
        <div class="field-label">Service Details:</div>
        <div class="field-value">
          <strong>Service Type:</strong> ${serviceTypeLabels[serviceType] || serviceType}<br>
          <strong>Package:</strong> ${packageLabels[packageTier] || packageTier || 'Not selected'}
          ${garageSize ? `<br><strong>Garage Size:</strong> ${garageSize}` : ''}
        </div>
      </div>

      ${description ? `
      <div class="field">
        <div class="field-label">Project Description:</div>
        <div class="field-value">${description}</div>
      </div>
      ` : ''}

      ${photoEmailUrls.length > 0 ? `
      <div class="photos">
        <div class="field-label">Photos (${photoEmailUrls.length}):</div>
        ${photoEmailUrls.map(url => `<img src="${url}" alt="Garage photo">`).join('')}
      </div>
      ` : ''}
    </div>

    <div class="footer">
      <p>Quote Request ID: ${quoteRequestRef.id}</p>
      <p>Client ID: ${clientId}</p>
      <p>Submitted at ${new Date().toLocaleString()}</p>
      <p><a href="https://console.firebase.google.com/project/${process.env.GCLOUD_PROJECT}/firestore/data/quoteRequests/${quoteRequestRef.id}">View in Firebase Console</a></p>
    </div>
  </div>
</body>
</html>
    `;
        await db.collection('mail').add({
            to: ['garagescholars@gmail.com', 'admin@garagescholars.com'],
            message: {
                subject: `📋 New Quote Request: ${name} - ${serviceTypeLabels[serviceType] || serviceType} (${packageLabels[packageTier] || 'No package'})`,
                html: emailHtml,
            },
            quoteRequestId: quoteRequestRef.id,
            clientId,
            createdAt: firestore_2.FieldValue.serverTimestamp()
        });
        console.log(`Email notification queued for quote request ${quoteRequestRef.id}`);
        return {
            success: true,
            quoteRequestId: quoteRequestRef.id,
            jobId: draftJobRef.id,
            clientId,
            message: 'Quote request submitted successfully and draft job created'
        };
    }
    catch (error) {
        console.error('Error submitting quote request:', error.message, error.stack);
        throw new https_1.HttpsError("internal", `Failed to submit quote request: ${error.message}`);
    }
});
// ─── Generate Scholar Bio ─────────────────────────────────────────────
exports.generateScholarBio = (0, https_1.onCall)({ timeoutSeconds: 60, memory: "256MiB", secrets: ["ANTHROPIC_API_KEY"] }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "Authentication required.");
    }
    const { answers } = request.data;
    if (!answers || !answers.careerGoal) {
        throw new https_1.HttpsError("invalid-argument", "Missing questionnaire answers.");
    }
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicKey) {
        throw new https_1.HttpsError("failed-precondition", "ANTHROPIC_API_KEY is not configured.");
    }
    const uid = request.auth.uid;
    // Get scholar profile for name
    const profileSnap = await db.collection("gs_profiles").doc(uid).get();
    const scholarName = profileSnap.data()?.fullName || "This scholar";
    const prompt = `Write a warm, professional ~300-word bio for a Garage Scholars team member. This bio will be sent to homeowner clients the day before their service appointment to introduce the scholar who will be working on their garage.

Scholar name: ${scholarName}

Questionnaire answers:
- Career goal / what they're working toward: ${answers.careerGoal}
- Why they joined Garage Scholars: ${answers.whyGarageScholars || "Not provided"}
- A fun fact about them: ${answers.funFact || "Not provided"}
- Skills or experience they bring: ${answers.skills || "Not provided"}

Write in third person. Be genuine, encouraging, and professional. Highlight their aspirations and what makes them a great fit for the team. Do NOT use bullet points — write flowing paragraphs. Keep it to approximately 300 words.`;
    try {
        const response = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": anthropicKey,
                "anthropic-version": "2023-06-01",
            },
            body: JSON.stringify({
                model: "claude-haiku-4-5-20251001",
                max_tokens: 1024,
                messages: [{ role: "user", content: prompt }],
            }),
        });
        if (!response.ok) {
            const errText = await response.text();
            console.error("Anthropic API error:", errText);
            throw new https_1.HttpsError("internal", "AI bio generation failed.");
        }
        const result = await response.json();
        const bio = result.content?.[0]?.text || "Bio generation failed — please try again.";
        // Save bio to scholar profile
        await db.collection("gs_scholarProfiles").doc(uid).update({
            bio,
            bioGeneratedAt: firestore_2.FieldValue.serverTimestamp(),
            onboardingAnswers: answers,
            updatedAt: firestore_2.FieldValue.serverTimestamp(),
        });
        // Also save to gs_profiles
        await db.collection("gs_profiles").doc(uid).update({
            bio,
            updatedAt: firestore_2.FieldValue.serverTimestamp(),
        });
        return { success: true, bio };
    }
    catch (err) {
        if (err instanceof https_1.HttpsError)
            throw err;
        console.error("Bio generation error:", err);
        throw new https_1.HttpsError("internal", "Failed to generate bio.");
    }
});
