import { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
  Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, onSnapshot, collection, query, where, getDocs, updateDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { Ionicons } from "@expo/vector-icons";
import { db, functions } from "../../../src/lib/firebase";
import { COLLECTIONS } from "../../../src/constants/collections";
import { updateJobStatus } from "../../../src/hooks/useJobs";
import UrgencyBadge from "../../../src/components/UrgencyBadge";
import type { ServiceJob, JobStatus } from "../../../src/types";

const STATUS_ACTIONS: Record<string, { label: string; next: JobStatus; color: string }[]> = {
  APPROVED_FOR_POSTING: [{ label: "Cancel Job", next: "CANCELLED", color: "#ef4444" }],
  UPCOMING: [
    { label: "Mark In Progress", next: "IN_PROGRESS", color: "#3b82f6" },
    { label: "Cancel Job", next: "CANCELLED", color: "#ef4444" },
  ],
  IN_PROGRESS: [
    { label: "Mark Review Pending", next: "REVIEW_PENDING", color: "#f59e0b" },
  ],
  REVIEW_PENDING: [
    { label: "Dispute", next: "DISPUTED", color: "#ef4444" },
  ],
  DISPUTED: [
    { label: "Resolve & Complete", next: "COMPLETED", color: "#10b981" },
    { label: "Reopen Job", next: "REOPENED", color: "#f59e0b" },
  ],
};

type QualityScores = {
  photoQualityScore: number;
  completionScore: number;
  timelinessScore: number;
  aiPhotoScorePending: boolean;
  aiPhotoScoreNote: string;
  aiPhotoScoreDetail: {
    clarity: number;
    lighting: number;
    angles: number;
    transformation: number;
    professionalism: number;
  } | null;
  scoreLocked: boolean;
  customerComplaint: boolean;
};

export default function AdminJobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [job, setJob] = useState<ServiceJob | null>(null);
  const [beforePhotos, setBeforePhotos] = useState<string[]>([]);
  const [afterPhotos, setAfterPhotos] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Scoring state
  const [scores, setScores] = useState<QualityScores | null>(null);
  const [editPhoto, setEditPhoto] = useState<number | null>(null);
  const [editCompletion, setEditCompletion] = useState<number | null>(null);
  const [editTimeliness, setEditTimeliness] = useState<number | null>(null);
  const [savingScores, setSavingScores] = useState(false);
  const [rerunningAi, setRerunningAi] = useState(false);
  const [approving, setApproving] = useState(false);

  useEffect(() => {
    if (!id) return;
    const unsub = onSnapshot(doc(db, COLLECTIONS.JOBS, id), async (snap) => {
      if (snap.exists()) {
        const jobData = { id: snap.id, ...snap.data() } as ServiceJob;
        setJob(jobData);
        if (jobData.claimedBy) {
          const checkinSnap = await getDocs(
            query(collection(db, COLLECTIONS.JOB_CHECKINS), where("jobId", "==", id))
          );
          if (!checkinSnap.empty) {
            const checkinData = checkinSnap.docs[0].data();
            setBeforePhotos(checkinData.beforePhotos || []);
            setAfterPhotos(checkinData.afterPhotos || []);
          }
        }
      }
      setLoading(false);
    });
    return () => unsub();
  }, [id]);

  // Listen to quality scores
  useEffect(() => {
    if (!id) return;
    const unsub = onSnapshot(doc(db, "gs_jobQualityScores", id), (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        setScores({
          photoQualityScore: d.photoQualityScore || 0,
          completionScore: d.completionScore || 0,
          timelinessScore: d.timelinessScore || 0,
          aiPhotoScorePending: d.aiPhotoScorePending || false,
          aiPhotoScoreNote: d.aiPhotoScoreNote || "",
          aiPhotoScoreDetail: d.aiPhotoScoreDetail || null,
          scoreLocked: d.scoreLocked || false,
          customerComplaint: d.customerComplaint || false,
        });
        // Initialize edit values from auto-scores
        if (editPhoto === null) setEditPhoto(d.photoQualityScore || 0);
        if (editCompletion === null) setEditCompletion(d.completionScore || 0);
        if (editTimeliness === null) setEditTimeliness(d.timelinessScore || 0);
      }
    });
    return () => unsub();
  }, [id]);

  const handleStatusChange = (label: string, next: JobStatus) => {
    if (!job || !id) return;
    Alert.alert(label, `Change status to ${next.replace(/_/g, " ")}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Confirm",
        onPress: async () => {
          try {
            const extra: Record<string, unknown> = {};
            if (next === "REOPENED") {
              extra.reopenCount = (job.reopenCount || 0) + 1;
              extra.reopenedAt = new Date();
              extra.claimedBy = null;
              extra.claimedByName = null;
            }
            await updateJobStatus(id, next, extra);
          } catch (err: any) {
            Alert.alert("Error", err.message || "Failed to update status");
          }
        },
      },
    ]);
  };

  const handleSaveScores = async () => {
    if (!id) return;
    setSavingScores(true);
    try {
      const callable = httpsCallable(functions, "gsScoreJob");
      await callable({
        jobId: id,
        photoQualityScore: editPhoto,
        completionScore: editCompletion,
        timelinessScore: editTimeliness,
      });
      const msg = "Scores saved!";
      Platform.OS === "web" ? alert(msg) : Alert.alert("Saved", msg);
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Failed to save scores");
    } finally {
      setSavingScores(false);
    }
  };

  const handleRerunAi = async () => {
    if (!id) return;
    setRerunningAi(true);
    try {
      const callable = httpsCallable(functions, "gsScoreJob");
      const result = await callable({ jobId: id, rerunAi: true });
      const data = result.data as any;
      if (data.scores) {
        setEditPhoto(data.scores.photoQualityScore);
      }
    } catch (err: any) {
      Alert.alert("Error", err?.message || "AI scoring failed");
    } finally {
      setRerunningAi(false);
    }
  };

  const handleApproveAndComplete = async () => {
    if (!id || !job) return;

    const photoScore = editPhoto ?? scores?.photoQualityScore ?? 0;
    if (photoScore === 0) {
      Alert.alert("Score Required", "Photo quality score must be set before approving. Wait for AI scoring or set it manually.");
      return;
    }

    const confirmMsg = `Approve & Complete this job?\n\nScores:\n  Photo: ${(editPhoto ?? 0).toFixed(1)}\n  Completion: ${(editCompletion ?? 0).toFixed(1)}\n  Timeliness: ${(editTimeliness ?? 0).toFixed(1)}`;

    const proceed = await new Promise<boolean>((resolve) => {
      if (Platform.OS === "web") {
        resolve(confirm(confirmMsg));
      } else {
        Alert.alert("Approve & Complete", confirmMsg, [
          { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
          { text: "Approve", onPress: () => resolve(true) },
        ]);
      }
    });

    if (!proceed) return;

    setApproving(true);
    try {
      // Save final scores first
      const callable = httpsCallable(functions, "gsScoreJob");
      await callable({
        jobId: id,
        photoQualityScore: editPhoto,
        completionScore: editCompletion,
        timelinessScore: editTimeliness,
      });

      // Then update job status to COMPLETED
      await updateJobStatus(id, "COMPLETED");
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Failed to approve job");
    } finally {
      setApproving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#14b8a6" />
      </View>
    );
  }

  if (!job) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Job not found</Text>
      </View>
    );
  }

  const actions = STATUS_ACTIONS[job.status] || [];
  const isReviewPending = job.status === "REVIEW_PENDING";
  const weightedScore = scores
    ? (scores.photoQualityScore * 0.4 + scores.completionScore * 0.3 + scores.timelinessScore * 0.3)
    : 0;
  const editWeightedScore =
    ((editPhoto ?? 0) * 0.4) + ((editCompletion ?? 0) * 0.3) + ((editTimeliness ?? 0) * 0.3);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      {/* Header */}
      <View style={styles.header}>
        <UrgencyBadge level={job.urgencyLevel || "standard"} reopened={(job.reopenCount || 0) > 0} />
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>{job.status.replace(/_/g, " ")}</Text>
        </View>
      </View>

      <Text style={styles.title}>{job.title}</Text>
      <Text style={styles.payout}>
        ${((job.payout || 0) + (job.rushBonus || 0)).toFixed(0)}
        {job.rushBonus ? ` (+$${job.rushBonus} rush)` : ""}
      </Text>

      {/* Details */}
      <Section title="Details">
        <DetailRow icon="location" text={job.address} />
        <DetailRow
          icon="calendar"
          text={`${job.scheduledDate} at ${job.scheduledTimeStart}${job.scheduledTimeEnd ? ` - ${job.scheduledTimeEnd}` : ""}`}
        />
        {job.clientName && <DetailRow icon="business" text={job.clientName} />}
        {job.customerName && <DetailRow icon="person" text={job.customerName} />}
        {job.customerPhone && <DetailRow icon="call" text={job.customerPhone} />}
      </Section>

      {/* Scholar */}
      {job.claimedByName && (
        <Section title="Assigned Scholar">
          <DetailRow icon="person-circle" text={job.claimedByName} />
        </Section>
      )}

      {/* Description */}
      {job.description && (
        <Section title="Description">
          <Text style={styles.desc}>{job.description}</Text>
        </Section>
      )}

      {/* Customer Notes */}
      {job.customerNotes && (
        <Section title="Customer Notes">
          <Text style={styles.desc}>{job.customerNotes}</Text>
        </Section>
      )}

      {/* Before Photos */}
      {beforePhotos.length > 0 && (
        <Section title="Before Photos">
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {beforePhotos.map((url: string, i: number) => (
              <Image key={i} source={{ uri: url }} style={styles.photo} />
            ))}
          </ScrollView>
        </Section>
      )}

      {/* After Photos */}
      {afterPhotos.length > 0 && (
        <Section title="After Photos">
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {afterPhotos.map((url: string, i: number) => (
              <Image key={i} source={{ uri: url }} style={styles.photo} />
            ))}
          </ScrollView>
        </Section>
      )}

      {/* Checklist */}
      {job.checklist && job.checklist.length > 0 && (
        <Section title="Checklist">
          {job.checklist.map((item: any) => (
            <View key={item.id} style={[styles.checkItem, item.isSubItem && { marginLeft: 24 }]}>
              <Ionicons
                name={item.completed ? "checkbox" : "square-outline"}
                size={item.isSubItem ? 16 : 18}
                color={item.completed ? "#10b981" : "#5a6a80"}
              />
              <Text style={[styles.checkText, item.isSubItem && { fontSize: 13, color: "#8b9bb5" }]}>{item.text}</Text>
            </View>
          ))}
        </Section>
      )}

      {/* ═══════ QUALITY SCORING PANEL ═══════ */}
      {scores && (isReviewPending || job.status === "COMPLETED" || job.status === "DISPUTED") && (
        <View style={scoreStyles.panel}>
          <View style={scoreStyles.panelHeader}>
            <Ionicons name="star" size={20} color="#f59e0b" />
            <Text style={scoreStyles.panelTitle}>Quality Scores</Text>
            {scores.customerComplaint && (
              <View style={scoreStyles.complaintBadge}>
                <Text style={scoreStyles.complaintText}>COMPLAINT</Text>
              </View>
            )}
          </View>

          {/* AI Photo Score Status */}
          {scores.aiPhotoScorePending && (
            <View style={scoreStyles.aiPending}>
              <ActivityIndicator size="small" color="#f59e0b" />
              <Text style={scoreStyles.aiPendingText}>AI is analyzing photos...</Text>
            </View>
          )}

          {scores.aiPhotoScoreNote && !scores.aiPhotoScorePending && (
            <View style={scoreStyles.aiNote}>
              <Ionicons name="sparkles" size={14} color="#8b9bb5" />
              <Text style={scoreStyles.aiNoteText}>AI: {scores.aiPhotoScoreNote}</Text>
            </View>
          )}

          {/* AI Detail Breakdown */}
          {scores.aiPhotoScoreDetail && !scores.aiPhotoScorePending && (
            <View style={scoreStyles.aiDetailRow}>
              <MiniScore label="Clarity" value={scores.aiPhotoScoreDetail.clarity} />
              <MiniScore label="Light" value={scores.aiPhotoScoreDetail.lighting} />
              <MiniScore label="Angles" value={scores.aiPhotoScoreDetail.angles} />
              <MiniScore label="Transform" value={scores.aiPhotoScoreDetail.transformation} />
              <MiniScore label="Pro" value={scores.aiPhotoScoreDetail.professionalism} />
            </View>
          )}

          {/* Score Rows */}
          <ScoreRow
            label="Photo Quality"
            weight="40%"
            icon="camera"
            value={editPhoto ?? scores.photoQualityScore}
            onChange={!scores.scoreLocked && isReviewPending ? setEditPhoto : undefined}
          />
          <ScoreRow
            label="Completion"
            weight="30%"
            icon="checkmark-done"
            value={editCompletion ?? scores.completionScore}
            onChange={!scores.scoreLocked && isReviewPending ? setEditCompletion : undefined}
          />
          <ScoreRow
            label="Timeliness"
            weight="30%"
            icon="time"
            value={editTimeliness ?? scores.timelinessScore}
            onChange={!scores.scoreLocked && isReviewPending ? setEditTimeliness : undefined}
          />

          {/* Weighted Final Score */}
          <View style={scoreStyles.finalRow}>
            <Text style={scoreStyles.finalLabel}>Final Score</Text>
            <Text style={[
              scoreStyles.finalValue,
              { color: editWeightedScore >= 4 ? "#10b981" : editWeightedScore >= 2 ? "#f59e0b" : "#ef4444" },
            ]}>
              {editWeightedScore.toFixed(1)} / 5.0
            </Text>
          </View>

          {/* Actions */}
          {isReviewPending && !scores.scoreLocked && (
            <View style={scoreStyles.actions}>
              <TouchableOpacity
                style={scoreStyles.rerunBtn}
                onPress={handleRerunAi}
                disabled={rerunningAi}
              >
                {rerunningAi ? (
                  <ActivityIndicator size="small" color="#14b8a6" />
                ) : (
                  <>
                    <Ionicons name="sparkles" size={16} color="#14b8a6" />
                    <Text style={scoreStyles.rerunText}>Re-run AI</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={scoreStyles.saveBtn}
                onPress={handleSaveScores}
                disabled={savingScores}
              >
                {savingScores ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={scoreStyles.saveBtnText}>Save Scores</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {scores.scoreLocked && (
            <View style={scoreStyles.lockedBanner}>
              <Ionicons name="lock-closed" size={14} color="#5a6a80" />
              <Text style={scoreStyles.lockedText}>Score locked — complaint window closed</Text>
            </View>
          )}
        </View>
      )}

      {/* ═══════ APPROVE & COMPLETE (separate from other actions for REVIEW_PENDING) ═══════ */}
      {isReviewPending && (
        <TouchableOpacity
          style={[styles.approveBtn, approving && { opacity: 0.6 }]}
          onPress={handleApproveAndComplete}
          disabled={approving}
          activeOpacity={0.7}
        >
          {approving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={22} color="#fff" />
              <Text style={styles.approveBtnText}>Approve & Complete</Text>
            </>
          )}
        </TouchableOpacity>
      )}

      {/* Other Status Actions */}
      {actions.length > 0 && (
        <View style={styles.actions}>
          {actions.map((action) => (
            <TouchableOpacity
              key={action.next}
              style={[styles.actionBtn, { backgroundColor: action.color }]}
              onPress={() => handleStatusChange(action.label, action.next)}
            >
              <Text style={styles.actionText}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// ── Score Row Component ──

function ScoreRow({
  label,
  weight,
  icon,
  value,
  onChange,
}: {
  label: string;
  weight: string;
  icon: string;
  value: number;
  onChange?: (v: number) => void;
}) {
  const scoreColor = value >= 4 ? "#10b981" : value >= 2.5 ? "#f59e0b" : value > 0 ? "#ef4444" : "#5a6a80";

  return (
    <View style={scoreStyles.row}>
      <View style={scoreStyles.rowLeft}>
        <Ionicons name={icon as any} size={18} color="#14b8a6" />
        <View>
          <Text style={scoreStyles.rowLabel}>{label}</Text>
          <Text style={scoreStyles.rowWeight}>{weight} weight</Text>
        </View>
      </View>
      {onChange ? (
        <View style={scoreStyles.scoreButtons}>
          {[1, 2, 3, 4, 5].map((n) => (
            <TouchableOpacity
              key={n}
              style={[
                scoreStyles.scoreBtn,
                value >= n && { backgroundColor: scoreColor },
              ]}
              onPress={() => onChange(n === value ? n - 0.5 : n)}
            >
              <Text style={[
                scoreStyles.scoreBtnText,
                value >= n && { color: "#fff" },
              ]}>
                {n}
              </Text>
            </TouchableOpacity>
          ))}
          <Text style={[scoreStyles.scoreValue, { color: scoreColor }]}>
            {value.toFixed(1)}
          </Text>
        </View>
      ) : (
        <Text style={[scoreStyles.scoreValue, { color: scoreColor }]}>
          {value.toFixed(1)}
        </Text>
      )}
    </View>
  );
}

function MiniScore({ label, value }: { label: string; value: number }) {
  return (
    <View style={scoreStyles.miniScore}>
      <Text style={scoreStyles.miniLabel}>{label}</Text>
      <Text style={scoreStyles.miniValue}>{value}/5</Text>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function DetailRow({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={styles.detailRow}>
      <Ionicons name={icon as any} size={18} color="#14b8a6" />
      <Text style={styles.detailText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0f1a" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  errorText: { color: "#ef4444", fontSize: 16 },
  scroll: { padding: 16 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  statusBadge: {
    backgroundColor: "#1a2332",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: { color: "#8b9bb5", fontSize: 12, fontWeight: "700" },
  title: { fontSize: 22, fontWeight: "800", color: "#f1f5f9", marginBottom: 4 },
  payout: { fontSize: 24, fontWeight: "800", color: "#10b981", marginBottom: 16 },
  section: {
    backgroundColor: "#1a2332",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#5a6a80",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  detailRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  detailText: { fontSize: 14, color: "#cbd5e1", flex: 1 },
  desc: { fontSize: 14, color: "#cbd5e1", lineHeight: 20 },
  photo: {
    width: 120,
    height: 120,
    borderRadius: 8,
    marginRight: 8,
    backgroundColor: "#2a3545",
  },
  checkItem: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  checkText: { fontSize: 14, color: "#cbd5e1", flex: 1 },
  actions: { gap: 8, marginTop: 4 },
  actionBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  actionText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  approveBtn: {
    backgroundColor: "#10b981",
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginBottom: 8,
  },
  approveBtnText: { color: "#fff", fontWeight: "800", fontSize: 16 },
});

const scoreStyles = StyleSheet.create({
  panel: {
    backgroundColor: "#1a2332",
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#f59e0b30",
  },
  panelHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
  },
  panelTitle: { fontSize: 16, fontWeight: "800", color: "#f1f5f9", flex: 1 },
  complaintBadge: {
    backgroundColor: "#ef444430",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  complaintText: { fontSize: 10, fontWeight: "800", color: "#ef4444", letterSpacing: 0.5 },

  // AI status
  aiPending: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#f59e0b10",
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  aiPendingText: { color: "#f59e0b", fontSize: 13, fontWeight: "600" },
  aiNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 12,
  },
  aiNoteText: { color: "#8b9bb5", fontSize: 12, fontStyle: "italic", flex: 1 },
  aiDetailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 14,
    backgroundColor: "#0a0f1a",
    borderRadius: 8,
    padding: 10,
  },
  miniScore: { alignItems: "center", gap: 2 },
  miniLabel: { fontSize: 10, color: "#5a6a80", fontWeight: "600" },
  miniValue: { fontSize: 12, color: "#cbd5e1", fontWeight: "700" },

  // Score rows
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#0a0f1a",
  },
  rowLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  rowLabel: { fontSize: 14, fontWeight: "700", color: "#f1f5f9" },
  rowWeight: { fontSize: 11, color: "#5a6a80" },
  scoreButtons: { flexDirection: "row", alignItems: "center", gap: 4 },
  scoreBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#2a3545",
    justifyContent: "center",
    alignItems: "center",
  },
  scoreBtnText: { fontSize: 13, fontWeight: "700", color: "#5a6a80" },
  scoreValue: { fontSize: 16, fontWeight: "800", marginLeft: 8, minWidth: 35, textAlign: "right" },

  // Final score
  finalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    marginTop: 4,
  },
  finalLabel: { fontSize: 16, fontWeight: "800", color: "#f1f5f9" },
  finalValue: { fontSize: 22, fontWeight: "800" },

  // Actions
  actions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  rerunBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#14b8a640",
  },
  rerunText: { color: "#14b8a6", fontSize: 13, fontWeight: "700" },
  saveBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#3b82f6",
  },
  saveBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },

  // Locked
  lockedBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 12,
    paddingVertical: 8,
  },
  lockedText: { color: "#5a6a80", fontSize: 12, fontStyle: "italic" },
});
