/**
 * Garage Scholars Mobile App — Cloud Functions
 *
 * Firestore triggers, scheduled tasks, and callable functions
 * for the scholar job management mobile app.
 */

import { onDocumentWritten, onDocumentCreated } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import {
  GS_COLLECTIONS,
  SCORING_WEIGHTS,
  SCORE_LOCK_HOURS,
  TRANSFER_EXPIRY_MINUTES,
  TIER_THRESHOLDS,
  MAX_RECENT_CLAIMS,
} from "./gs-constants";
import { createCheckinPayout, holdCompletionPayout } from "./gs-payments";
import { buildVideoConfirmations } from "./gs-catalog";
import { GoogleGenerativeAI } from "@google/generative-ai";

const db = getFirestore();

// Max Firestore batch size
const BATCH_LIMIT = 500;

// ─── Helper: send Expo push notification ───
async function sendExpoPush(pushTokens: string[], title: string, body: string, data?: Record<string, string>) {
  const messages = pushTokens
    .filter((t) => t && t.startsWith("ExponentPushToken"))
    .map((to) => ({ to, title, body, sound: "default" as const, data }));

  if (messages.length === 0) return;

  try {
    const resp = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(messages),
    });
    const result = await resp.json();
    console.log(`Push sent to ${messages.length} tokens`, result);
  } catch (err) {
    console.error("Expo push failed:", err);
  }
}

// Helper: get push token for a user
async function getPushToken(uid: string): Promise<string | null> {
  const snap = await db.collection(GS_COLLECTIONS.PROFILES).doc(uid).get();
  return snap.exists ? (snap.data()?.pushToken as string) || null : null;
}

// Helper: get admin push tokens, optionally filtered by notification preference
type NotifCategory = "jobReviews" | "payoutAlerts" | "complaints" | "weeklyReport" | "mercuryAlerts" | "scholarCheckins";
async function getAdminTokens(category?: NotifCategory): Promise<string[]> {
  const snap = await db.collection(GS_COLLECTIONS.PROFILES).where("role", "==", "admin").get();
  return snap.docs
    .filter((d) => {
      const token = d.data().pushToken;
      if (!token) return false;
      // If category specified, check notification preferences (default to true)
      if (category) {
        const prefs = d.data().notificationPrefs;
        if (prefs && prefs[category] === false) return false;
      }
      return true;
    })
    .map((d) => d.data().pushToken as string);
}

// Helper: determine tier from payScore
function getTierFromScore(score: number): string {
  if (score >= TIER_THRESHOLDS.top_hustler) return "top_hustler";
  if (score >= TIER_THRESHOLDS.elite) return "elite";
  if (score >= TIER_THRESHOLDS.standard) return "standard";
  return "new";
}

// Helper: commit writes in chunks of BATCH_LIMIT
async function commitInChunks(
  ops: Array<{ ref: FirebaseFirestore.DocumentReference; data: Record<string, any>; type: "set" | "update" }>
) {
  for (let i = 0; i < ops.length; i += BATCH_LIMIT) {
    const chunk = ops.slice(i, i + BATCH_LIMIT);
    const batch = db.batch();
    for (const op of chunk) {
      if (op.type === "set") {
        batch.set(op.ref, op.data);
      } else {
        batch.update(op.ref, op.data);
      }
    }
    await batch.commit();
  }
}

/**
 * AI Photo Scoring — uses Gemini Vision to analyze before/after photos.
 * Scores photo quality on 5 criteria:
 *   1. Clarity & focus (not blurry)
 *   2. Proper lighting (well-lit, visible)
 *   3. Correct angles (shows the full work area)
 *   4. Before vs After comparison (clear difference visible)
 *   5. Professional presentation (clean framing, no clutter blocking view)
 *
 * Returns a score 0-5. Falls back to 3.0 (neutral) if AI fails.
 */
async function autoScorePhotos(jobId: string): Promise<number> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("GEMINI_API_KEY not set — skipping AI photo scoring");
    return 3.0;
  }

  // Get before/after photos from checkin doc
  const checkinSnap = await db.collection(GS_COLLECTIONS.JOB_CHECKINS)
    .where("jobId", "==", jobId).limit(1).get();

  if (checkinSnap.empty) {
    console.warn(`No checkin doc for job ${jobId} — default photo score 3.0`);
    await db.collection(GS_COLLECTIONS.JOB_QUALITY_SCORES).doc(jobId).update({
      photoQualityScore: 3.0,
      aiPhotoScorePending: false,
      aiPhotoScoreNote: "No checkin photos found",
    });
    return 3.0;
  }

  const checkinData = checkinSnap.docs[0].data();
  const beforePhotos: string[] = checkinData.beforePhotos || [];
  const afterPhotos: string[] = checkinData.afterPhotos || [];

  if (beforePhotos.length === 0 && afterPhotos.length === 0) {
    await db.collection(GS_COLLECTIONS.JOB_QUALITY_SCORES).doc(jobId).update({
      photoQualityScore: 1.0,
      aiPhotoScorePending: false,
      aiPhotoScoreNote: "No photos uploaded",
    });
    return 1.0;
  }

  try {
    // Download up to 3 before + 3 after photos for analysis (limit cost)
    const photoUrls = [
      ...beforePhotos.slice(0, 3).map((u) => ({ url: u, type: "before" })),
      ...afterPhotos.slice(0, 3).map((u) => ({ url: u, type: "after" })),
    ];

    const imageParts = await Promise.all(
      photoUrls.map(async ({ url }) => {
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`Failed to download: ${url}`);
        const buffer = Buffer.from(await resp.arrayBuffer());
        return {
          inlineData: {
            data: buffer.toString("base64"),
            mimeType: "image/jpeg",
          },
        };
      })
    );

    const photoLabels = photoUrls.map((p) => p.type).join(", ");

    const prompt = `You are a quality inspector for a garage organization and home service company.

You are reviewing ${beforePhotos.length} BEFORE photos and ${afterPhotos.length} AFTER photos from a job. The photos are in order: ${photoLabels}.

Score the photo documentation quality on these 5 criteria (each 1-5):

1. CLARITY: Are photos in focus, not blurry? Can you clearly see the work area?
2. LIGHTING: Are photos well-lit? Can you see details?
3. ANGLES: Do the photos show the full work area from useful angles?
4. TRANSFORMATION: Is there a clear visible difference between before and after? Does the after show improvement?
5. PROFESSIONALISM: Are photos framed well? No fingers blocking lens, no random clutter obscuring the view?

If there are NO before photos, score TRANSFORMATION as 1.
If there are NO after photos, score everything as 1.

Respond ONLY with a JSON object, no markdown:
{"clarity":0,"lighting":0,"angles":0,"transformation":0,"professionalism":0,"overall":0.0,"note":"one sentence summary"}

The "overall" field should be the weighted average: overall = (clarity + lighting + angles + transformation*2 + professionalism) / 6, rounded to 1 decimal.`;

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const result = await model.generateContent([prompt, ...imageParts]);
    const text = result.response.text()?.trim() || "";

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Gemini did not return valid JSON");
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const score = Math.max(0, Math.min(5, parseFloat(parsed.overall) || 3.0));

    await db.collection(GS_COLLECTIONS.JOB_QUALITY_SCORES).doc(jobId).update({
      photoQualityScore: score,
      aiPhotoScorePending: false,
      aiPhotoScoreNote: parsed.note || "",
      aiPhotoScoreDetail: {
        clarity: parsed.clarity || 0,
        lighting: parsed.lighting || 0,
        angles: parsed.angles || 0,
        transformation: parsed.transformation || 0,
        professionalism: parsed.professionalism || 0,
      },
    });

    console.log(`AI photo score for job ${jobId}: ${score} — ${parsed.note}`);
    return score;
  } catch (err) {
    console.error(`AI photo scoring failed for ${jobId}:`, err);
    // Fall back to neutral score
    await db.collection(GS_COLLECTIONS.JOB_QUALITY_SCORES).doc(jobId).update({
      photoQualityScore: 3.0,
      aiPhotoScorePending: false,
      aiPhotoScoreNote: "AI scoring failed — default score applied",
    });
    return 3.0;
  }
}

/**
 * Callable: Re-run AI photo scoring for a job (admin use).
 * Also allows admin to manually override any score.
 */
export const gsScoreJob = onCall(
  {
    cors: true,
    timeoutSeconds: 60,
    memory: "512MiB",
    secrets: ["GEMINI_API_KEY"],
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication required.");
    }

    const profileSnap = await db.collection(GS_COLLECTIONS.PROFILES).doc(request.auth.uid).get();
    if (!profileSnap.exists || profileSnap.data()?.role !== "admin") {
      throw new HttpsError("permission-denied", "Admin role required.");
    }

    const { jobId, photoQualityScore, completionScore, timelinessScore, rerunAi } = request.data as {
      jobId: string;
      photoQualityScore?: number;
      completionScore?: number;
      timelinessScore?: number;
      rerunAi?: boolean;
    };

    if (!jobId) {
      throw new HttpsError("invalid-argument", "jobId is required.");
    }

    const scoreRef = db.collection(GS_COLLECTIONS.JOB_QUALITY_SCORES).doc(jobId);
    const scoreSnap = await scoreRef.get();
    if (!scoreSnap.exists) {
      throw new HttpsError("not-found", "Quality score document not found for this job.");
    }
    if (scoreSnap.data()?.scoreLocked) {
      throw new HttpsError("failed-precondition", "Score is already locked and cannot be changed.");
    }

    // If rerunAi, re-score photos
    if (rerunAi) {
      await autoScorePhotos(jobId);
    }

    // Apply any manual overrides
    const updates: Record<string, any> = {
      adminReviewedBy: request.auth.uid,
      adminReviewedAt: FieldValue.serverTimestamp(),
    };

    if (photoQualityScore !== undefined) {
      updates.photoQualityScore = Math.max(0, Math.min(5, photoQualityScore));
      updates.adminOverrodePhoto = true;
    }
    if (completionScore !== undefined) {
      updates.completionScore = Math.max(0, Math.min(5, completionScore));
      updates.adminOverrodeCompletion = true;
    }
    if (timelinessScore !== undefined) {
      updates.timelinessScore = Math.max(0, Math.min(5, timelinessScore));
      updates.adminOverrodeTimeliness = true;
    }

    await scoreRef.update(updates);

    // Return the updated scores
    const updatedSnap = await scoreRef.get();
    const d = updatedSnap.data()!;
    return {
      ok: true,
      scores: {
        photoQualityScore: d.photoQualityScore,
        completionScore: d.completionScore,
        timelinessScore: d.timelinessScore,
        aiPhotoScoreNote: d.aiPhotoScoreNote || "",
        aiPhotoScoreDetail: d.aiPhotoScoreDetail || null,
      },
    };
  }
);

// ═══════════════════════════════════════════════════════════════
// 1. FIRESTORE TRIGGER: gs_jobs status changes
// ═══════════════════════════════════════════════════════════════
export const gsOnJobUpdated = onDocumentWritten(
  {
    document: `${GS_COLLECTIONS.JOBS}/{jobId}`,
    secrets: ["STRIPE_SECRET_KEY", "GEMINI_API_KEY"],
    memory: "512MiB",
  },
  async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    if (!after) return; // deleted

    const jobId = event.params.jobId;
    const oldStatus = before?.status;
    const newStatus = after.status;

    if (oldStatus === newStatus) return;

    console.log(`gs_jobs/${jobId}: ${oldStatus} → ${newStatus}`);

    // ── APPROVED_FOR_POSTING/REOPENED → UPCOMING (claimed) ──
    if (
      ["APPROVED_FOR_POSTING", "REOPENED"].includes(oldStatus) &&
      newStatus === "UPCOMING" &&
      after.claimedBy
    ) {
      // Write recent claim for FOMO banner
      const claimRef = db.collection(GS_COLLECTIONS.RECENT_CLAIMS).doc();
      await claimRef.set({
        jobId,
        jobTitle: after.title || "",
        scholarName: (after.claimedByName || "Scholar").split(" ")[0],
        payout: (after.payout || 0) + (after.rushBonus || 0),
        claimedAt: FieldValue.serverTimestamp(),
      });

      // Trim old recent claims
      const oldClaims = await db
        .collection(GS_COLLECTIONS.RECENT_CLAIMS)
        .orderBy("claimedAt", "desc")
        .offset(MAX_RECENT_CLAIMS)
        .get();
      const batch = db.batch();
      oldClaims.docs.forEach((d) => batch.delete(d.ref));
      if (!oldClaims.empty) await batch.commit();

      // Notify the scholar
      const token = await getPushToken(after.claimedBy);
      if (token) {
        await sendExpoPush(
          [token],
          "Job Claimed!",
          `You claimed "${after.title}" — $${(after.payout || 0) + (after.rushBonus || 0)}`,
          { screen: "my-jobs", jobId }
        );
      }

      // Create gs_jobPrep document for pre-job video homework
      if (after.productSelections) {
        try {
          const videoConfirmations = buildVideoConfirmations(after.productSelections);
          if (videoConfirmations.length > 0) {
            const prepDocId = `${jobId}_${after.claimedBy}`;
            await db.collection(GS_COLLECTIONS.JOB_PREP).doc(prepDocId).set({
              jobId,
              scholarId: after.claimedBy,
              scholarName: after.claimedByName || "Scholar",
              videoConfirmations,
              allConfirmed: false,
              reminder48hSent: false,
              reminder24hSent: false,
              reminder2hSent: false,
              createdAt: FieldValue.serverTimestamp(),
              updatedAt: FieldValue.serverTimestamp(),
            });
            console.log(`Created gs_jobPrep/${prepDocId} with ${videoConfirmations.length} items`);
          }
        } catch (err) {
          console.error(`Failed to create gs_jobPrep for job ${jobId}:`, err);
        }
      }
    }

    // ── UPCOMING → IN_PROGRESS (checked in) ──
    if (oldStatus === "UPCOMING" && newStatus === "IN_PROGRESS") {
      // Trigger first 50% payout (wrapped so payout failure doesn't crash trigger)
      try {
        await createCheckinPayout(jobId, after);
      } catch (err) {
        console.error(`createCheckinPayout failed for job ${jobId}:`, err);
      }

      const adminTokens = await getAdminTokens("scholarCheckins");
      if (adminTokens.length > 0) {
        await sendExpoPush(
          adminTokens,
          "Scholar Checked In",
          `${after.claimedByName || "A scholar"} checked in for "${after.title}"`,
          { screen: "admin-jobs", jobId }
        );
      }
    }

    // ── IN_PROGRESS → REVIEW_PENDING (checked out) ──
    if (oldStatus === "IN_PROGRESS" && newStatus === "REVIEW_PENDING") {
      // Auto-calculate timeliness score from timestamps
      let timelinessScore = 5.0; // default: on time
      try {
        const checkinSnap = await db.collection(GS_COLLECTIONS.JOB_CHECKINS)
          .where("jobId", "==", jobId).limit(1).get();
        if (!checkinSnap.empty) {
          const checkinData = checkinSnap.docs[0].data();
          const checkinTime = checkinData.checkinTime?.toDate?.();
          if (checkinTime && after.scheduledDate && after.scheduledTimeStart) {
            const scheduled = new Date(`${after.scheduledDate} ${after.scheduledTimeStart}`);
            const diffMinutes = (checkinTime.getTime() - scheduled.getTime()) / 60000;
            // Score: 5.0 if on time or early, -0.5 per 10 min late, min 0
            if (diffMinutes > 0) {
              timelinessScore = Math.max(0, 5.0 - (diffMinutes / 10) * 0.5);
            }
          }
        }
      } catch (err) {
        console.error("Error calculating timeliness:", err);
      }

      // Auto-calculate completion score from checklist
      let completionScore = 5.0; // default: all done
      try {
        const checklist = after.checklist || [];
        if (checklist.length > 0) {
          const completed = checklist.filter((c: any) => c.completed).length;
          completionScore = Math.round((completed / checklist.length) * 5 * 10) / 10;
        }
      } catch (err) {
        console.error("Error calculating completion:", err);
      }

      // Create quality score doc with auto-calculated scores
      // photoQualityScore starts at 0 — filled by AI Vision or admin
      await db.collection(GS_COLLECTIONS.JOB_QUALITY_SCORES).doc(jobId).set(
        {
          jobId,
          scholarId: after.claimedBy || "",
          photoQualityScore: 0, // Pending AI scoring or admin review
          completionScore,
          timelinessScore,
          finalScore: 0, // Calculated when score is locked
          autoScored: true,
          aiPhotoScorePending: true,
          customerComplaint: false,
          scoreLocked: false,
          scoreLockedAt: null,
          complaintWindowEnd: Timestamp.fromDate(
            new Date(Date.now() + SCORE_LOCK_HOURS * 60 * 60 * 1000)
          ),
          createdAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      // Trigger async AI photo scoring (fire and forget — won't block checkout)
      try {
        await autoScorePhotos(jobId);
      } catch (err) {
        console.error(`AI photo scoring failed for job ${jobId}:`, err);
      }

      const adminTokens = await getAdminTokens("jobReviews");
      if (adminTokens.length > 0) {
        await sendExpoPush(
          adminTokens,
          "Job Ready for Review",
          `${after.claimedByName || "A scholar"} completed "${after.title}" — review needed`,
          { screen: "admin-jobs", jobId }
        );
      }
    }

    // ── REVIEW_PENDING → COMPLETED ──
    if (oldStatus === "REVIEW_PENDING" && newStatus === "COMPLETED") {
      const scholarId = after.claimedBy;
      if (!scholarId) return;

      // Update scholar stats
      const profileRef = db.collection(GS_COLLECTIONS.SCHOLAR_PROFILES).doc(scholarId);
      await profileRef.set(
        {
          totalJobsCompleted: FieldValue.increment(1),
          totalEarnings: FieldValue.increment(
            (after.payout || 0) + (after.rushBonus || 0)
          ),
        },
        { merge: true }
      );

      // Read back updated profile for achievement checks
      const profileSnap = await profileRef.get();
      const profileData = profileSnap.data();
      const totalJobs = (profileData?.totalJobsCompleted as number) || 0;
      const scholarName = (profileData?.scholarName as string) || "Scholar";

      // Update current month goal progress
      const now = new Date();
      const month = now.getMonth() + 1;
      const year = now.getFullYear();
      const goalsSnap = await db
        .collection(GS_COLLECTIONS.SCHOLAR_GOALS)
        .where("scholarId", "==", scholarId)
        .where("month", "==", month)
        .where("year", "==", year)
        .get();

      const goalBatch = db.batch();
      goalsSnap.docs.forEach((goalDoc) => {
        const data = goalDoc.data();
        if (data.goalType === "jobs") {
          goalBatch.update(goalDoc.ref, { currentProgress: FieldValue.increment(1) });
        } else if (data.goalType === "money") {
          goalBatch.update(goalDoc.ref, {
            currentProgress: FieldValue.increment(
              (after.payout || 0) + (after.rushBonus || 0)
            ),
          });
        }
      });
      if (!goalsSnap.empty) await goalBatch.commit();

      // ── Goal milestone notifications (1B) ──
      const token = await getPushToken(scholarId);
      for (const goalDoc of goalsSnap.docs) {
        try {
          // Re-read the goal after increment to get updated progress
          const updatedGoalSnap = await goalDoc.ref.get();
          const g = updatedGoalSnap.data();
          if (!g || g.goalTarget <= 0) continue;

          const progress = g.currentProgress / g.goalTarget;
          const goalLabel = g.goalType === "jobs" ? "Jobs" : "Earnings";

          // 90% milestone
          if (progress >= 0.9 && progress < 1.0 && !g.notifiedAt90) {
            await goalDoc.ref.update({ notifiedAt90: true });
            if (token) {
              await sendExpoPush(
                [token],
                "Almost There!",
                `You're 90% to your monthly ${goalLabel} goal! Keep pushing!`,
                { screen: "goals" }
              );
            }
          }

          // 100% milestone
          if (progress >= 1.0 && !g.notifiedAt100) {
            await goalDoc.ref.update({ notifiedAt100: true, goalMet: true });

            // Notify the scholar
            if (token) {
              await sendExpoPush(
                [token],
                "Goal Crushed!",
                `You hit your monthly ${goalLabel} goal!`,
                { screen: "goals" }
              );
            }

            // Announce to ALL scholars
            const allScholars = await db.collection(GS_COLLECTIONS.SCHOLAR_PROFILES).get();
            const otherTokens: string[] = [];
            for (const s of allScholars.docs) {
              if (s.id === scholarId) continue;
              const t = await getPushToken(s.id);
              if (t) otherTokens.push(t);
            }
            if (otherTokens.length > 0) {
              await sendExpoPush(
                otherTokens,
                "Goal Achieved!",
                `${scholarName} just hit their monthly ${goalLabel.toLowerCase()} goal!`,
                { screen: "goals" }
              );
            }

            // Write to activity feed
            await db.collection(GS_COLLECTIONS.ACTIVITY_FEED).add({
              type: "goal_met",
              scholarName,
              message: `just crushed their monthly ${goalLabel.toLowerCase()} goal!`,
              icon: "flag",
              accentColor: "#10b981",
              createdAt: FieldValue.serverTimestamp(),
            });
          }
        } catch (err) {
          console.error(`Goal milestone check failed for ${goalDoc.id}:`, err);
        }
      }

      // ── Auto-grant achievements (1A) ──
      try {
        // Helper: grant achievement if not already earned
        const grantAchievement = async (
          type: string, title: string, description: string, checkMonth = true
        ) => {
          const achQuery = db.collection(GS_COLLECTIONS.SCHOLAR_ACHIEVEMENTS)
            .where("scholarId", "==", scholarId)
            .where("achievementType", "==", type);

          // For monthly achievements, check within this month
          const existingSnap = checkMonth
            ? await achQuery.where("month", "==", month).where("year", "==", year).get()
            : await achQuery.get();

          if (!existingSnap.empty) return; // Already earned

          await db.collection(GS_COLLECTIONS.SCHOLAR_ACHIEVEMENTS).add({
            scholarId,
            achievementType: type,
            title,
            description,
            month,
            year,
            createdAt: FieldValue.serverTimestamp(),
          });

          // Write to activity feed
          await db.collection(GS_COLLECTIONS.ACTIVITY_FEED).add({
            type: "achievement",
            scholarName,
            message: `earned the ${title} badge!`,
            icon: "trophy",
            accentColor: "#8b5cf6",
            createdAt: FieldValue.serverTimestamp(),
          });

          console.log(`Achievement granted: ${type} for scholar ${scholarId}`);
        };

        // first_job: totalJobsCompleted reaches 1
        if (totalJobs === 1) {
          await grantAchievement("first_job", "First Job", "Complete your first job", false);
        }

        // Count jobs this month for club achievements
        const jobsThisMonthSnap = await db.collection(GS_COLLECTIONS.JOBS)
          .where("claimedBy", "==", scholarId)
          .where("status", "==", "COMPLETED")
          .get();
        const jobsThisMonth = jobsThisMonthSnap.docs.filter((j) => {
          const ts = j.data().updatedAt;
          if (!ts) return false;
          const d = ts.toDate();
          return d.getMonth() + 1 === month && d.getFullYear() === year;
        }).length;

        // ten_club: 10 jobs in a single month
        if (jobsThisMonth >= 10) {
          await grantAchievement("ten_club", "10 Club", "Complete 10 jobs in a single month");
        }

        // twenty_five_club: 25 jobs in a single month
        if (jobsThisMonth >= 25) {
          await grantAchievement("twenty_five_club", "25 Club", "Complete 25 jobs in a single month");
        }

        // monthly_goal_met: any goal met this month
        for (const goalDoc of goalsSnap.docs) {
          const updatedGoal = await goalDoc.ref.get();
          const g = updatedGoal.data();
          if (g && g.goalMet) {
            await grantAchievement("monthly_goal_met", "Goal Crusher", "Hit your monthly goal");
            break; // Only grant once per month
          }
        }
      } catch (err) {
        console.error(`Achievement grant failed for scholar ${scholarId}:`, err);
      }

      // Notify scholar of job completion
      if (token) {
        await sendExpoPush(
          [token],
          "Job Approved!",
          `"${after.title}" is complete. Payment is being processed.`,
          { screen: "my-jobs", jobId }
        );
      }

      // ── Queue social media content ──
      try {
        const checkinSnap = await db.collection(GS_COLLECTIONS.JOB_CHECKINS)
          .doc(`${jobId}_${scholarId}`).get();
        const checkinData = checkinSnap.data();

        const beforePhotos = checkinData?.beforePhotos as string[] | undefined;
        const afterPhotos = checkinData?.afterPhotos as string[] | undefined;

        if (beforePhotos && beforePhotos.length > 0 && afterPhotos && afterPhotos.length > 0) {
          await db.collection(GS_COLLECTIONS.SOCIAL_CONTENT_QUEUE).add({
            jobId,
            scholarId,
            jobTitle: after.title || "",
            address: after.address || "",
            packageTier: after.packageTier || after.package || "",
            beforePhotoUrl: beforePhotos[0],
            afterPhotoUrl: afterPhotos[0],
            status: "pending",
            createdAt: FieldValue.serverTimestamp(),
          });
          console.log(`Social content queued for job ${jobId}`);
        }
      } catch (err) {
        console.error("Social content queue failed:", err);
      }

      // ── Queue review request campaign ──
      try {
        const customerEmail = after.clientEmail;
        const customerPhone = after.clientPhone || after.customerPhone;
        const customerName = after.clientName || after.customerName || "Valued Customer";

        if (customerEmail || customerPhone) {
          await db.collection(GS_COLLECTIONS.REVIEW_CAMPAIGNS).add({
            jobId,
            jobTitle: after.title || "",
            customerName,
            customerEmail: customerEmail || "",
            customerPhone: customerPhone || "",
            completedAt: FieldValue.serverTimestamp(),
            day3Sent: false,
            day5Sent: false,
            templateIndex: Math.floor(Math.random() * 3),
          });
          console.log(`Review campaign queued for job ${jobId}`);
        }
      } catch (err) {
        console.error("Review campaign queue failed:", err);
      }

      // ── Auto-send balance invoice if deposit was paid (50/50 split) ──
      try {
        if (
          after.clientPaymentType === "split_50_50" &&
          after.clientPaymentStatus === "deposit_paid" &&
          !after.balanceInvoiceId &&
          after.stripeCustomerId &&
          after.clientPrice > 0
        ) {
          const { getFirestore: gf, FieldValue: FV } = await import("firebase-admin/firestore");
          const { CLIENT_BALANCE_PERCENT } = await import("./gs-constants");

          const fullAmount = after.clientPrice;
          const balanceAmount = Math.round(fullAmount * (CLIENT_BALANCE_PERCENT / 100) * 100) / 100;
          const balanceCents = Math.round(balanceAmount * 100);
          const desc = after.title || `${after.serviceType || "Service"} Package`;

          // Lazy-load Stripe
          const Stripe = require("stripe");
          const stripeKey = process.env.STRIPE_SECRET_KEY?.trim();
          if (stripeKey) {
            const stripe = new Stripe(stripeKey);

            // Create invoice
            const invoice = await stripe.invoices.create({
              customer: after.stripeCustomerId,
              collection_method: "send_invoice",
              days_until_due: 3,
              description: `Garage Scholars — ${desc} — Balance Due`,
              metadata: {
                jobId,
                splitType: "balance_50",
                packageTier: after.package || "",
                platform: "garage_scholars",
              },
            });

            await stripe.invoiceItems.create({
              customer: after.stripeCustomerId,
              invoice: invoice.id,
              amount: balanceCents,
              currency: "usd",
              description: `${desc} — Balance (50%)`,
            });

            const finalized = await stripe.invoices.finalizeInvoice(invoice.id);
            await stripe.invoices.sendInvoice(invoice.id);

            // Record payment
            await db.collection("gs_customerPayments").add({
              customerId: after.stripeCustomerId,
              customerName: after.clientName,
              customerEmail: after.clientEmail,
              jobId,
              amount: balanceAmount,
              fullJobAmount: fullAmount,
              type: "invoice",
              splitType: "balance_50",
              stripeInvoiceId: invoice.id,
              stripePaymentIntentId: finalized.payment_intent || null,
              paymentMethod: "invoice",
              convenienceFee: 0,
              totalCharged: balanceAmount,
              status: "pending",
              description: `${desc} — Balance (50%)`,
              invoiceUrl: finalized.hosted_invoice_url || null,
              invoicePdf: finalized.invoice_pdf || null,
              createdAt: FV.serverTimestamp(),
            });

            // Update job
            await db.collection("gs_jobs").doc(jobId).update({
              balanceInvoiceId: invoice.id,
              clientPaymentStatus: "pending_balance",
              updatedAt: FV.serverTimestamp(),
            });

            // Notify admin
            await db.collection("mail").add({
              to: ["garagescholars@gmail.com"],
              message: {
                subject: `Balance Invoice Auto-Sent: ${after.clientName} — $${balanceAmount.toFixed(2)}`,
                html: `<h2>Balance Invoice Auto-Sent</h2>
                  <p><strong>Client:</strong> ${after.clientName} (${after.clientEmail})</p>
                  <p><strong>Balance:</strong> $${balanceAmount.toFixed(2)}</p>
                  <p><strong>Job:</strong> ${desc}</p>
                  <p><strong>Invoice:</strong> ${invoice.id}</p>
                  <p>This was automatically triggered by the job being marked as completed.</p>`,
              },
              createdAt: FV.serverTimestamp(),
            });

            console.log(`[gsOnJobUpdated] Balance invoice ${invoice.id} auto-sent for job ${jobId}`);
          } else {
            console.error(`[gsOnJobUpdated] STRIPE_SECRET_KEY not available for balance invoice on job ${jobId}`);
          }
        }
      } catch (err) {
        console.error(`[gsOnJobUpdated] Failed to auto-send balance invoice for job ${jobId}:`, err);
        // Don't throw — this is a best-effort trigger. The safety-net scheduler will catch it.
      }
    }
  }
);

// ═══════════════════════════════════════════════════════════════
// 2. FIRESTORE TRIGGER: Transfer created
// ═══════════════════════════════════════════════════════════════
export const gsOnTransferCreated = onDocumentCreated(
  `${GS_COLLECTIONS.JOB_TRANSFERS}/{transferId}`,
  async (event) => {
    const data = event.data?.data();
    if (!data) return;

    const transferId = event.params.transferId;
    console.log(`Transfer created: ${transferId}, type: ${data.transferType}`);

    if (data.transferType === "direct" && data.toScholarId) {
      // Notify target scholar
      const token = await getPushToken(data.toScholarId);
      if (token) {
        await sendExpoPush(
          [token],
          "Job Transfer Offer",
          `${data.fromScholarName || "A scholar"} wants to transfer "${data.jobTitle}" to you. Tap to respond.`,
          { screen: "transfers", transferId }
        );
      }
    } else if (data.transferType === "requeue") {
      // Notify all scholars about requeued job
      const scholarsSnap = await db
        .collection(GS_COLLECTIONS.SCHOLAR_PROFILES)
        .get();

      const tokens: string[] = [];
      for (const scholarDoc of scholarsSnap.docs) {
        if (scholarDoc.id === data.fromScholarId) continue;
        const t = await getPushToken(scholarDoc.id);
        if (t) tokens.push(t);
      }

      if (tokens.length > 0) {
        await sendExpoPush(
          tokens,
          "Job Available!",
          `"${data.jobTitle}" is back on the feed — $${data.payout || 0}`,
          { screen: "jobs" }
        );
      }
    }
  }
);

// ═══════════════════════════════════════════════════════════════
// 3. FIRESTORE TRIGGER: Reschedule approved/declined
// ═══════════════════════════════════════════════════════════════
export const gsOnRescheduleUpdated = onDocumentWritten(
  `${GS_COLLECTIONS.JOB_RESCHEDULES}/{rescheduleId}`,
  async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    if (!after || before?.status === after.status) return;

    if (after.status === "approved") {
      // Update job with new date/time
      const jobRef = db.collection(GS_COLLECTIONS.JOBS).doc(after.jobId);
      await jobRef.update({
        scheduledDate: after.newDate,
        scheduledTimeStart: after.newTimeStart || null,
        scheduledTimeEnd: after.newTimeEnd || null,
        updatedAt: FieldValue.serverTimestamp(),
      });

      const token = await getPushToken(after.requestedBy);
      if (token) {
        await sendExpoPush(
          [token],
          "Reschedule Approved",
          `Your reschedule for "${after.jobTitle}" was approved. New date: ${after.newDate}`,
          { screen: "my-jobs", jobId: after.jobId }
        );
      }
    } else if (after.status === "declined") {
      const token = await getPushToken(after.requestedBy);
      if (token) {
        await sendExpoPush(
          [token],
          "Reschedule Declined",
          `Your reschedule request for "${after.jobTitle}" was declined. Please keep the original schedule.`,
          { screen: "my-jobs", jobId: after.jobId }
        );
      }
    }
  }
);

// ═══════════════════════════════════════════════════════════════
// 4. SCHEDULED: Lock quality scores past 48hr window
// ═══════════════════════════════════════════════════════════════
export const gsLockScores = onSchedule("every 1 hours", async () => {
  console.log("gsLockScores: checking for scores to lock...");

  const now = Timestamp.now();
  const unlocked = await db
    .collection(GS_COLLECTIONS.JOB_QUALITY_SCORES)
    .where("scoreLocked", "==", false)
    .where("complaintWindowEnd", "<=", now)
    .get();

  if (unlocked.empty) {
    console.log("No scores to lock.");
    return;
  }

  console.log(`Locking ${unlocked.size} scores...`);
  const scholarScores: Record<string, number[]> = {};

  const lockOps: Array<{ ref: FirebaseFirestore.DocumentReference; data: Record<string, any>; type: "set" | "update" }> = [];
  for (const scoreDoc of unlocked.docs) {
    try {
      const data = scoreDoc.data();
      const finalScore =
        (data.photoQualityScore || 0) * SCORING_WEIGHTS.PHOTO_QUALITY +
        (data.completionScore || 0) * SCORING_WEIGHTS.COMPLETION +
        (data.timelinessScore || 0) * SCORING_WEIGHTS.TIMELINESS;

      lockOps.push({
        ref: scoreDoc.ref,
        data: {
          finalScore,
          scoreLocked: true,
          scoreLockedAt: FieldValue.serverTimestamp(),
        },
        type: "update",
      });

      if (data.scholarId) {
        if (!scholarScores[data.scholarId]) scholarScores[data.scholarId] = [];
        scholarScores[data.scholarId].push(finalScore);
      }
    } catch (err) {
      console.error(`Error processing score ${scoreDoc.id}:`, err);
    }
  }
  await commitInChunks(lockOps);

  // Update scholar payScores and tiers + check perfect_score achievement
  for (const [scholarId, newScores] of Object.entries(scholarScores)) {
    try {
      const allScores = await db
        .collection(GS_COLLECTIONS.JOB_QUALITY_SCORES)
        .where("scholarId", "==", scholarId)
        .where("scoreLocked", "==", true)
        .get();

      const scores = allScores.docs.map((d) => d.data().finalScore as number);
      const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
      const tier = getTierFromScore(avg);

      await db.collection(GS_COLLECTIONS.SCHOLAR_PROFILES).doc(scholarId).update({
        payScore: Math.round(avg * 100) / 100,
        tier,
      });

      console.log(`Scholar ${scholarId}: payScore=${avg.toFixed(2)}, tier=${tier}`);

      // perfect_score achievement: any locked score === 5.0
      const hasPerfect = newScores.some((s) => s === 5.0);
      if (hasPerfect) {
        const existingPerfect = await db.collection(GS_COLLECTIONS.SCHOLAR_ACHIEVEMENTS)
          .where("scholarId", "==", scholarId)
          .where("achievementType", "==", "perfect_score")
          .get();

        if (existingPerfect.empty) {
          const profileSnap = await db.collection(GS_COLLECTIONS.SCHOLAR_PROFILES).doc(scholarId).get();
          const scholarName = (profileSnap.data()?.scholarName as string) || "Scholar";

          await db.collection(GS_COLLECTIONS.SCHOLAR_ACHIEVEMENTS).add({
            scholarId,
            achievementType: "perfect_score",
            title: "Perfect Score",
            description: "Score 5.0 on a job",
            month: now.toDate().getMonth() + 1,
            year: now.toDate().getFullYear(),
            createdAt: FieldValue.serverTimestamp(),
          });

          await db.collection(GS_COLLECTIONS.ACTIVITY_FEED).add({
            type: "achievement",
            scholarName,
            message: "earned the Perfect Score badge!",
            icon: "star",
            accentColor: "#f59e0b",
            createdAt: FieldValue.serverTimestamp(),
          });

          console.log(`Perfect score achievement granted for scholar ${scholarId}`);
        }
      }
    } catch (err) {
      console.error(`Error updating scholar ${scholarId} tier:`, err);
    }
  }
});

// ═══════════════════════════════════════════════════════════════
// 5. SCHEDULED: Expire pending direct transfers past 15min
// ═══════════════════════════════════════════════════════════════
export const gsExpireTransfers = onSchedule("every 5 minutes", async () => {
  const cutoff = Timestamp.fromDate(
    new Date(Date.now() - TRANSFER_EXPIRY_MINUTES * 60 * 1000)
  );

  const expired = await db
    .collection(GS_COLLECTIONS.JOB_TRANSFERS)
    .where("transferType", "==", "direct")
    .where("status", "==", "pending")
    .where("createdAt", "<=", cutoff)
    .get();

  if (expired.empty) return;

  console.log(`Expiring ${expired.size} transfers...`);

  for (const transferDoc of expired.docs) {
    try {
      const data = transferDoc.data();

      // Mark transfer as expired
      await transferDoc.ref.update({
        status: "expired",
        updatedAt: FieldValue.serverTimestamp(),
      });

      // Requeue the job
      if (data.jobId) {
        await db.collection(GS_COLLECTIONS.JOBS).doc(data.jobId).update({
          status: "REOPENED",
          claimedBy: null,
          claimedByName: null,
          reopenedAt: FieldValue.serverTimestamp(),
          reopenCount: FieldValue.increment(1),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }

      // Notify the original scholar
      const token = await getPushToken(data.fromScholarId);
      if (token) {
        await sendExpoPush(
          [token],
          "Transfer Expired",
          `Your transfer for "${data.jobTitle}" expired. The job has been requeued.`,
          { screen: "my-jobs" }
        );
      }
    } catch (err) {
      console.error(`Error expiring transfer ${transferDoc.id}:`, err);
    }
  }
});

// ═══════════════════════════════════════════════════════════════
// 6. SCHEDULED: Reset viewer counts daily at 3am
// ═══════════════════════════════════════════════════════════════
export const gsResetViewerCounts = onSchedule("every day 03:00", async () => {
  console.log("Resetting viewer counts on all gs_jobs...");

  const jobs = await db
    .collection(GS_COLLECTIONS.JOBS)
    .where("currentViewers", ">", 0)
    .get();

  if (jobs.empty) {
    console.log("No jobs with active viewers.");
    return;
  }

  const ops = jobs.docs.map((jobDoc) => ({
    ref: jobDoc.ref,
    data: { currentViewers: 0 },
    type: "update" as const,
  }));
  await commitInChunks(ops);

  console.log(`Reset viewer counts on ${jobs.size} jobs.`);
});

// ═══════════════════════════════════════════════════════════════
// 7. SCHEDULED: Monthly goal reset (1st of each month)
// ═══════════════════════════════════════════════════════════════
export const gsMonthlyGoalReset = onSchedule("0 0 1 * *", async () => {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  console.log(`Creating monthly goals for ${year}-${month}...`);

  const scholars = await db.collection(GS_COLLECTIONS.SCHOLAR_PROFILES).get();
  const ops: Array<{ ref: FirebaseFirestore.DocumentReference; data: Record<string, any>; type: "set" | "update" }> = [];

  for (const scholarDoc of scholars.docs) {
    try {
      const data = scholarDoc.data();
      const scholarId = scholarDoc.id;

      // Create jobs goal
      if (data.monthlyJobGoal && data.monthlyJobGoal > 0) {
        const jobGoalRef = db.collection(GS_COLLECTIONS.SCHOLAR_GOALS).doc(`${scholarId}_${year}_${month}_jobs`);
        ops.push({
          ref: jobGoalRef,
          data: {
            scholarId,
            month,
            year,
            goalType: "jobs",
            goalTarget: data.monthlyJobGoal,
            currentProgress: 0,
            goalMet: false,
            notifiedAt90: false,
            notifiedAt100: false,
            createdAt: FieldValue.serverTimestamp(),
          },
          type: "set",
        });
      }

      // Create money goal
      if (data.monthlyMoneyGoal && data.monthlyMoneyGoal > 0) {
        const moneyGoalRef = db.collection(GS_COLLECTIONS.SCHOLAR_GOALS).doc(`${scholarId}_${year}_${month}_money`);
        ops.push({
          ref: moneyGoalRef,
          data: {
            scholarId,
            month,
            year,
            goalType: "money",
            goalTarget: data.monthlyMoneyGoal,
            currentProgress: 0,
            goalMet: false,
            notifiedAt90: false,
            notifiedAt100: false,
            createdAt: FieldValue.serverTimestamp(),
          },
          type: "set",
        });
      }
    } catch (err) {
      console.error(`Error creating goals for scholar ${scholarDoc.id}:`, err);
    }
  }

  await commitInChunks(ops);
  console.log(`Created ${ops.length} goals for ${scholars.size} scholars.`);
});

// ═══════════════════════════════════════════════════════════════
// 8. SCHEDULED: Compute analytics daily at 4am
// ═══════════════════════════════════════════════════════════════
export const gsComputeAnalytics = onSchedule(
  { schedule: "every day 04:00", timeoutSeconds: 540 },
  async () => {
    console.log("Computing scholar analytics...");

    const scholars = await db.collection(GS_COLLECTIONS.SCHOLAR_PROFILES).get();
    if (scholars.empty) return;

    // Bulk-fetch all data to avoid N+1 queries
    const [allJobsSnap, allScoresSnap, allTransfersSnap, allReschedulesSnap] = await Promise.all([
      db.collection(GS_COLLECTIONS.JOBS).get(),
      db.collection(GS_COLLECTIONS.JOB_QUALITY_SCORES).where("scoreLocked", "==", true).get(),
      db.collection(GS_COLLECTIONS.JOB_TRANSFERS).get(),
      db.collection(GS_COLLECTIONS.JOB_RESCHEDULES).get(),
    ]);

    // Index data by scholarId
    const jobsByScholar: Record<string, FirebaseFirestore.QueryDocumentSnapshot[]> = {};
    for (const jobDoc of allJobsSnap.docs) {
      const claimedBy = jobDoc.data().claimedBy;
      if (claimedBy) {
        if (!jobsByScholar[claimedBy]) jobsByScholar[claimedBy] = [];
        jobsByScholar[claimedBy].push(jobDoc);
      }
    }

    const scoresByScholar: Record<string, number[]> = {};
    for (const scoreDoc of allScoresSnap.docs) {
      const sid = scoreDoc.data().scholarId;
      if (sid) {
        if (!scoresByScholar[sid]) scoresByScholar[sid] = [];
        scoresByScholar[sid].push(scoreDoc.data().finalScore as number || 0);
      }
    }

    const transfersByScholar: Record<string, number> = {};
    for (const tDoc of allTransfersSnap.docs) {
      const sid = tDoc.data().fromScholarId;
      if (sid) transfersByScholar[sid] = (transfersByScholar[sid] || 0) + 1;
    }

    const reschedulesByScholar: Record<string, number> = {};
    for (const rDoc of allReschedulesSnap.docs) {
      const sid = rDoc.data().requestedBy;
      if (sid) reschedulesByScholar[sid] = (reschedulesByScholar[sid] || 0) + 1;
    }

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    for (const scholarDoc of scholars.docs) {
      try {
        const scholarId = scholarDoc.id;
        const profileData = scholarDoc.data();
        const scholarJobs = jobsByScholar[scholarId] || [];

        // Completed jobs
        const completedJobs = scholarJobs.filter((j) => j.data().status === "COMPLETED");
        const cancelledJobs = scholarJobs.filter((j) => j.data().status === "CANCELLED");

        // Total earnings
        const totalEarningsAllTime = completedJobs.reduce((sum, j) => {
          const d = j.data();
          return sum + (d.payout || 0) + (d.rushBonus || 0);
        }, 0);

        // Time-windowed stats helper
        const jobsInWindow = (jobs: FirebaseFirestore.QueryDocumentSnapshot[], after: Date) =>
          jobs.filter((j) => {
            const ts = j.data().updatedAt;
            return ts && ts.toDate() >= after;
          });

        const earningsInWindow = (jobs: FirebaseFirestore.QueryDocumentSnapshot[], after: Date) =>
          jobsInWindow(jobs, after).reduce((sum, j) => {
            const d = j.data();
            return sum + (d.payout || 0) + (d.rushBonus || 0);
          }, 0);

        const jobsThisMonth = jobsInWindow(completedJobs, monthStart).length;
        const earningsThisMonth = earningsInWindow(completedJobs, monthStart);
        const jobsLast30Days = jobsInWindow(completedJobs, thirtyDaysAgo).length;
        const jobsLast90Days = jobsInWindow(completedJobs, ninetyDaysAgo).length;
        const earningsLast30Days = earningsInWindow(completedJobs, thirtyDaysAgo);
        const earningsLast90Days = earningsInWindow(completedJobs, ninetyDaysAgo);
        const cancellationsThisMonth = jobsInWindow(cancelledJobs, monthStart).length;

        // Reschedules this month
        const reschedulesThisMonth = allReschedulesSnap.docs.filter((d) => {
          const data = d.data();
          if (data.requestedBy !== scholarId) return false;
          const ts = data.createdAt;
          return ts && ts.toDate() >= monthStart;
        }).length;

        // Quality scores
        const scores = scoresByScholar[scholarId] || [];
        const avgPayScoreThisMonth = scores.length > 0
          ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100
          : 0;

        // Avg claim response (time from job creation to claim) — simplified
        const claimResponseTimes: number[] = [];
        for (const j of scholarJobs) {
          const d = j.data();
          if (d.claimedAt && d.createdAt) {
            const diff = (d.claimedAt.toDate().getTime() - d.createdAt.toDate().getTime()) / 60000;
            if (diff > 0 && diff < 10080) claimResponseTimes.push(diff); // cap at 7 days
          }
        }
        const avgClaimResponseMinutes = claimResponseTimes.length > 0
          ? Math.round(claimResponseTimes.reduce((a, b) => a + b, 0) / claimResponseTimes.length)
          : 0;

        // Trends (compare last 30 days to previous 30 days)
        const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
        const jobsPrev30 = completedJobs.filter((j) => {
          const ts = j.data().updatedAt;
          return ts && ts.toDate() >= sixtyDaysAgo && ts.toDate() < thirtyDaysAgo;
        }).length;
        const earningsPrev30 = completedJobs
          .filter((j) => {
            const ts = j.data().updatedAt;
            return ts && ts.toDate() >= sixtyDaysAgo && ts.toDate() < thirtyDaysAgo;
          })
          .reduce((sum, j) => {
            const d = j.data();
            return sum + (d.payout || 0) + (d.rushBonus || 0);
          }, 0);

        const jobsTrend: "increasing" | "stable" | "declining" =
          jobsLast30Days > jobsPrev30 * 1.1 ? "increasing" :
          jobsLast30Days < jobsPrev30 * 0.9 ? "declining" : "stable";
        const earningsTrend: "increasing" | "stable" | "declining" =
          earningsLast30Days > earningsPrev30 * 1.1 ? "increasing" :
          earningsLast30Days < earningsPrev30 * 0.9 ? "declining" : "stable";

        // Write analytics doc matching GsScholarAnalytics type
        await db.collection(GS_COLLECTIONS.SCHOLAR_ANALYTICS).doc(scholarId).set({
          scholarId,
          scholarName: profileData.scholarName || "",
          jobsThisMonth,
          earningsThisMonth,
          avgPayScoreThisMonth,
          jobsLast30Days,
          jobsLast90Days,
          earningsLast30Days,
          earningsLast90Days,
          avgClaimResponseMinutes,
          cancellationsThisMonth,
          reschedulesThisMonth,
          jobsTrend,
          earningsTrend,
          totalJobsAllTime: completedJobs.length,
          totalEarningsAllTime,
          memberSince: profileData.createdAt || null,
          lastUpdated: FieldValue.serverTimestamp(),
        });

        // Sync key stats back to scholar profile
        const cancellationRate = scholarJobs.length > 0
          ? Math.round((cancelledJobs.length / scholarJobs.length) * 1000) / 10
          : 0;
        await db.collection(GS_COLLECTIONS.SCHOLAR_PROFILES).doc(scholarId).update({
          totalJobsCompleted: completedJobs.length,
          totalEarnings: totalEarningsAllTime,
          cancellationRate,
        });
      } catch (err) {
        console.error(`Error computing analytics for scholar ${scholarDoc.id}:`, err);
      }
    }

    console.log(`Analytics computed for ${scholars.size} scholars.`);
  }
);

// ═══════════════════════════════════════════════════════════════
// 9. CALLABLE: Submit customer complaint
// ═══════════════════════════════════════════════════════════════
export const gsSubmitComplaint = onCall(
  { cors: true, timeoutSeconds: 60 },
  async (request) => {
    const { jobId, description, photoUrls } = request.data as {
      jobId?: string;
      description?: string;
      photoUrls?: string[];
    };

    if (!jobId || !description) {
      throw new HttpsError("invalid-argument", "jobId and description are required.");
    }

    // Check the job exists
    const jobRef = db.collection(GS_COLLECTIONS.JOBS).doc(jobId);
    const jobSnap = await jobRef.get();
    if (!jobSnap.exists) {
      throw new HttpsError("not-found", "Job not found.");
    }

    const jobData = jobSnap.data()!;

    // Check quality score is within complaint window
    const scoreRef = db.collection(GS_COLLECTIONS.JOB_QUALITY_SCORES).doc(jobId);
    const scoreSnap = await scoreRef.get();

    if (scoreSnap.exists) {
      const scoreData = scoreSnap.data()!;
      if (scoreData.scoreLocked) {
        throw new HttpsError(
          "failed-precondition",
          "The complaint window for this job has closed."
        );
      }

      // Deduct points from quality score
      await scoreRef.update({
        customerComplaint: true,
        complaintDetails: description,
        complaintPhotos: photoUrls || [],
        // Reduce completion score by 50% on complaint
        completionScore: Math.max(0, (scoreData.completionScore || 0) * 0.5),
      });
    }

    // Hold any pending completion payout
    try {
      await holdCompletionPayout(jobId);
    } catch (err) {
      console.error(`holdCompletionPayout failed for job ${jobId}:`, err);
    }

    // Update job with dispute flag
    await jobRef.update({
      status: "DISPUTED",
      disputeDescription: description,
      disputeAt: FieldValue.serverTimestamp(),
    });

    // Notify admins
    const adminTokens = await getAdminTokens("complaints");
    if (adminTokens.length > 0) {
      await sendExpoPush(
        adminTokens,
        "Customer Complaint",
        `Complaint filed for "${jobData.title}" — review needed`,
        { screen: "admin-jobs", jobId }
      );
    }

    console.log(`Complaint submitted for job ${jobId}`);
    return { ok: true };
  }
);

// ═══════════════════════════════════════════════════════════════
// 10. CALLABLE: Send push notification (admin utility)
// ═══════════════════════════════════════════════════════════════
export const gsSendPush = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }

  // Check admin
  const profileSnap = await db.collection(GS_COLLECTIONS.PROFILES).doc(request.auth.uid).get();
  if (!profileSnap.exists || profileSnap.data()?.role !== "admin") {
    throw new HttpsError("permission-denied", "Admin role required.");
  }

  const { targetUids, title, body, data } = request.data as {
    targetUids?: string[];
    title?: string;
    body?: string;
    data?: Record<string, string>;
  };

  if (!title || !body || !targetUids || targetUids.length === 0) {
    throw new HttpsError("invalid-argument", "targetUids, title, and body are required.");
  }

  const tokens: string[] = [];
  for (const uid of targetUids) {
    const t = await getPushToken(uid);
    if (t) tokens.push(t);
  }

  await sendExpoPush(tokens, title, body, data);
  return { ok: true, sent: tokens.length };
});
