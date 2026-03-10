import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Alert,
  Platform,
} from "react-native";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  updateDoc,
  doc,
  getDoc,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { Ionicons } from "@expo/vector-icons";
import { db, functions } from "../../src/lib/firebase";
import { COLLECTIONS } from "../../src/constants/collections";
import { useResponsive } from "../../src/lib/responsive";
import { downloadCSV } from "../../src/lib/csvExport";
import AdminPageWrapper from "../../src/components/AdminPageWrapper";
import FormInput from "../../src/components/FormInput";
import FormSelect from "../../src/components/FormSelect";
import FormButton from "../../src/components/FormButton";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Payout = {
  id: string;
  jobId: string;
  scholarId: string;
  scholarName: string;
  scholarEmail: string;
  amount: number;
  status: string;
  createdAt: string;
  paidAt?: string;
  paymentMethod?: string;
  transactionNote?: string;
  approvedBy?: string;
};

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function SkeletonBlock({ width, height, style }: { width: number | string; height: number; style?: any }) {
  return (
    <View
      style={[
        {
          width: width as any,
          height,
          backgroundColor: "#1a2332",
          borderRadius: 8,
        },
        style,
      ]}
    />
  );
}

function PayoutsSkeleton() {
  return (
    <AdminPageWrapper>
      {/* Header skeleton */}
      <View style={skeletonStyles.headerRow}>
        <View style={{ gap: 8 }}>
          <SkeletonBlock width={180} height={22} />
          <SkeletonBlock width={240} height={14} />
        </View>
        <SkeletonBlock width={130} height={40} />
      </View>

      {/* Summary card skeletons */}
      <View style={skeletonStyles.summaryRow}>
        {[1, 2, 3].map((i) => (
          <View key={i} style={skeletonStyles.summaryCard}>
            <SkeletonBlock width={80} height={12} />
            <SkeletonBlock width={100} height={26} style={{ marginTop: 8 }} />
          </View>
        ))}
      </View>

      {/* List item skeletons */}
      {[1, 2, 3, 4].map((i) => (
        <View key={i} style={skeletonStyles.listCard}>
          <View style={skeletonStyles.listRow}>
            <SkeletonBlock width={80} height={14} />
            <SkeletonBlock width={60} height={22} />
          </View>
          <SkeletonBlock width={140} height={14} style={{ marginTop: 8 }} />
          <View style={[skeletonStyles.listRow, { marginTop: 8 }]}>
            <SkeletonBlock width={70} height={14} />
            <SkeletonBlock width={90} height={30} />
          </View>
        </View>
      ))}
    </AdminPageWrapper>
  );
}

const skeletonStyles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  summaryRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 20,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: "#1a2332",
    borderRadius: 12,
    padding: 14,
  },
  listCard: {
    backgroundColor: "#1a2332",
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  listRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
});

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    pending: { bg: "#f59e0b20", text: "#f59e0b" },
    paid: { bg: "#10b98120", text: "#10b981" },
    failed: { bg: "#ef444420", text: "#ef4444" },
  };
  const c = colors[status] || colors.pending;
  return (
    <View style={[badgeStyles.badge, { backgroundColor: c.bg }]}>
      <Text style={[badgeStyles.text, { color: c.text }]}>
        {status.toUpperCase()}
      </Text>
    </View>
  );
}

const badgeStyles = StyleSheet.create({
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  text: { fontSize: 11, fontWeight: "700" },
});

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

const PAYMENT_METHODS = [
  { label: "ACH (Mercury)", value: "ACH" },
  { label: "Cash", value: "Cash" },
  { label: "Check", value: "Check" },
];

export default function PayoutsScreen() {
  const { isDesktop, isMobile } = useResponsive();
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Mark-as-paid modal state
  const [markPaidModal, setMarkPaidModal] = useState<Payout | null>(null);
  const [paymentMethod, setPaymentMethod] = useState("ACH");
  const [transactionNote, setTransactionNote] = useState("");

  // Send Bank Link / Save Payment Info modal state
  const [bankLinkModal, setBankLinkModal] = useState(false);
  const [blName, setBlName] = useState("");
  const [blEmail, setBlEmail] = useState("");
  const [blMessage, setBlMessage] = useState("");
  const [blSending, setBlSending] = useState(false);
  // Tabs: email request, save bank info
  const [blTab, setBlTab] = useState<"email" | "bank_info">("email");
  // Direct bank info entry
  const [blRouting, setBlRouting] = useState("");
  const [blAccount, setBlAccount] = useState("");
  const [blAccountType, setBlAccountType] = useState<"checking" | "savings">("checking");
  const [blBankSaving, setBlBankSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Mercury funding state
  const [mercuryReplenishment, setMercuryReplenishment] = useState<{
    amount: number;
    weekLabel: string;
    status: string;
    approvedBy?: string;
  } | null>(null);
  const [fundingMercury, setFundingMercury] = useState(false);

  // ---------- Mercury replenishment listener ----------
  useEffect(() => {
    if (!db) return;
    const unsub = onSnapshot(
      doc(db, "gs_platformConfig", "mercuryReplenishment"),
      (snap) => {
        if (snap.exists()) {
          const d = snap.data();
          setMercuryReplenishment({
            amount: d.amount || 0,
            weekLabel: d.weekLabel || "",
            status: d.status || "pending_approval",
            approvedBy: d.approvedBy || undefined,
          });
        }
      }
    );
    return () => unsub();
  }, []);

  const handleFundMercury = async () => {
    if (!mercuryReplenishment || mercuryReplenishment.amount <= 0) return;

    const confirmMsg = `Transfer $${mercuryReplenishment.amount.toFixed(2)} from Chase to Mercury?`;
    const proceed = await new Promise<boolean>((resolve) => {
      if (Platform.OS === "web") {
        resolve(confirm(confirmMsg));
      } else {
        Alert.alert("Confirm Transfer", confirmMsg, [
          { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
          { text: "Approve & Transfer", onPress: () => resolve(true) },
        ]);
      }
    });

    if (!proceed) return;

    setFundingMercury(true);
    try {
      const callable = httpsCallable(functions, "gsFundMercuryFromChase");
      await callable({ amount: mercuryReplenishment.amount });
      const msg = `Transfer of $${mercuryReplenishment.amount.toFixed(2)} initiated! ACH pull from Chase typically takes 1-2 business days.`;
      Platform.OS === "web" ? alert(msg) : Alert.alert("Transfer Initiated", msg);
    } catch (err: any) {
      const msg = err?.message || "Failed to initiate transfer.";
      Platform.OS === "web" ? alert(msg) : Alert.alert("Error", msg);
    } finally {
      setFundingMercury(false);
    }
  };

  // ---------- Real-time listener ----------
  useEffect(() => {
    if (!db) {
      setError("Firestore not initialized.");
      setLoading(false);
      return;
    }

    const payoutsQuery = query(
      collection(db, COLLECTIONS.PAYOUTS),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(
      payoutsQuery,
      (snapshot) => {
        const list = snapshot.docs.map((docSnap) => {
          const data = docSnap.data() as Record<string, any>;
          return {
            id: docSnap.id,
            jobId: data.jobId || "",
            scholarId: data.scholarId || "",
            scholarName: data.recipientName || data.scholarName || "Unknown",
            scholarEmail: data.scholarEmail || "",
            amount: data.amount || 0,
            status: data.status || "pending",
            createdAt: data.createdAt || "",
            paidAt: data.paidAt,
            paymentMethod: data.paymentMethod,
            transactionNote: data.notes || data.transactionNote,
            approvedBy: data.approvedBy,
          } as Payout;
        });
        setPayouts(list);
        setError(null);
        setLoading(false);
      },
      (err) => {
        setError(err.message || "Failed to load payouts.");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // ---------- Mark as Paid ----------
  const handleMarkAsPaid = useCallback(async () => {
    if (!markPaidModal || !db) return;

    setBusyId(markPaidModal.id);
    try {
      await updateDoc(doc(db, COLLECTIONS.PAYOUTS, markPaidModal.id), {
        status: "paid",
        paidAt: new Date().toISOString(),
        paymentMethod: `manual_${paymentMethod.toLowerCase()}`,
        notes: transactionNote,
      });
      setMarkPaidModal(null);
      setPaymentMethod("ACH");
      setTransactionNote("");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to mark as paid.";
      if (Platform.OS === "web") {
        setError(message);
      } else {
        Alert.alert("Error", message);
      }
    } finally {
      setBusyId(null);
    }
  }, [markPaidModal, paymentMethod, transactionNote]);

  // ---------- Export CSV ----------
  const handleExportCSV = useCallback(async () => {
    const currentYear = new Date().getFullYear();

    const yearPayouts = payouts.filter((p) => {
      const payoutYear = new Date(p.paidAt || p.createdAt).getFullYear();
      return payoutYear === currentYear && p.status === "paid";
    });

    // Group by scholar
    const scholarTotals = yearPayouts.reduce(
      (acc, payout) => {
        if (!acc[payout.scholarId]) {
          acc[payout.scholarId] = {
            name: payout.scholarName,
            email: payout.scholarEmail || "",
            total: 0,
          };
        }
        acc[payout.scholarId].total += payout.amount;
        return acc;
      },
      {} as Record<string, { name: string; email: string; total: number }>
    );

    // Filter scholars > $600 (1099 threshold)
    const rows = Object.values(scholarTotals)
      .filter((scholar) => scholar.total > 600)
      .map((scholar) =>
        [scholar.name, scholar.email, scholar.total.toFixed(2), ""].join(",")
      );

    const csv = [
      "Scholar Name,Scholar Email,Total Paid (Year-to-Date),Tax ID",
      ...rows,
    ].join("\n");

    await downloadCSV(csv, `1099-data-${currentYear}.csv`);
  }, [payouts]);

  // ---------- Send Bank Link ----------
  const handleSendBankLink = useCallback(async () => {
    if (!functions || !blName.trim() || !blEmail.trim()) return;

    setBlSending(true);
    try {
      const callable = httpsCallable(functions, "gsSendResalePaymentLink");
      const result = await callable({
        customerName: blName.trim(),
        customerEmail: blEmail.trim(),
        customMessage: blMessage.trim() || undefined,
      });

      const data = result.data as { success?: boolean; alreadyComplete?: boolean };
      const msg = data.alreadyComplete
        ? `Link sent to ${blEmail}. Note: this customer already completed onboarding previously.`
        : `Bank link emailed to ${blEmail} successfully!`;

      if (Platform.OS === "web") {
        alert(msg);
      } else {
        Alert.alert("Sent", msg);
      }

      setBankLinkModal(false);
      setBlName("");
      setBlEmail("");
      setBlMessage("");
    } catch (err: any) {
      const msg = err?.message || "Failed to send bank link.";
      if (Platform.OS === "web") {
        setError(msg);
      } else {
        Alert.alert("Error", msg);
      }
    } finally {
      setBlSending(false);
    }
  }, [blName, blEmail, blMessage]);

  // ---------- Save Bank Info (routing + account) ----------
  const handleSaveBankInfo = useCallback(async () => {
    if (!functions || !blEmail.trim() || !blName.trim() || !blRouting.trim() || !blAccount.trim()) return;

    if (!/^\d{9}$/.test(blRouting)) {
      setError("Routing number must be exactly 9 digits.");
      return;
    }

    setBlBankSaving(true);
    try {
      // Save bank info to the resale customer's record
      const callable = httpsCallable(functions, "gsSaveResaleBankInfo");
      await callable({
        customerEmail: blEmail.trim(),
        customerName: blName.trim(),
        routingNumber: blRouting.trim(),
        accountNumber: blAccount.trim(),
        accountType: blAccountType,
      });

      const msg = `Bank info saved for ${blName.trim()} (****${blAccount.slice(-4)}). Mercury ACH payouts are now active.`;
      if (Platform.OS === "web") {
        alert(msg);
      } else {
        Alert.alert("Saved", msg);
      }

      setBankLinkModal(false);
      setBlEmail("");
      setBlName("");
      setBlRouting("");
      setBlAccount("");
      setBlTab("email");
    } catch (err: any) {
      const msg = err?.message || "Failed to save bank info.";
      if (Platform.OS === "web") {
        setError(msg);
      } else {
        Alert.alert("Error", msg);
      }
    } finally {
      setBlBankSaving(false);
    }
  }, [blEmail, blName, blRouting, blAccount, blAccountType]);

  // ---------- Computed values ----------
  const pendingTotal = payouts
    .filter((p) => p.status === "pending")
    .reduce((sum, p) => sum + p.amount, 0);

  const paidTotal = payouts
    .filter((p) => p.status === "paid")
    .reduce((sum, p) => sum + p.amount, 0);

  // ---------- Loading ----------
  if (loading) {
    return <PayoutsSkeleton />;
  }

  // ---------- Render helpers ----------
  const renderSummaryCards = () => (
    <View style={[styles.summaryRow, isDesktop && styles.summaryRowDesktop, isMobile && { gap: 6, marginBottom: 10 }]}>
      <View style={[styles.summaryCard, isDesktop && styles.summaryCardDesktop, isMobile && { padding: 10 }]}>
        <Text style={[styles.summaryLabel, isMobile && { fontSize: 10 }]}>Pending</Text>
        <Text style={[styles.summaryValue, isMobile && { fontSize: 18 }, { color: "#f59e0b" }]}>
          ${pendingTotal.toFixed(2)}
        </Text>
      </View>
      <View style={[styles.summaryCard, isDesktop && styles.summaryCardDesktop, isMobile && { padding: 10 }]}>
        <Text style={[styles.summaryLabel, isMobile && { fontSize: 10 }]}>Paid (YTD)</Text>
        <Text style={[styles.summaryValue, isMobile && { fontSize: 18 }, { color: "#10b981" }]}>
          ${paidTotal.toFixed(2)}
        </Text>
      </View>
      <View style={[styles.summaryCard, isDesktop && styles.summaryCardDesktop, isMobile && { padding: 10 }]}>
        <Text style={[styles.summaryLabel, isMobile && { fontSize: 10 }]}>Total</Text>
        <Text style={[styles.summaryValue, isMobile && { fontSize: 18 }, { color: "#f1f5f9" }]}>
          {payouts.length}
        </Text>
      </View>
    </View>
  );

  // --- Desktop table row ---
  const renderDesktopRow = ({ item }: { item: Payout }) => (
    <View style={styles.tableRow}>
      <Text style={[styles.tableCell, styles.cellMono, { flex: 1.2 }]}>
        {item.id.slice(0, 8)}...
      </Text>
      <Text style={[styles.tableCell, styles.cellBold, { flex: 1.5 }]}>
        {item.scholarName}
      </Text>
      <Text style={[styles.tableCell, styles.cellMono, { flex: 1.2 }]}>
        {item.jobId ? `${item.jobId.slice(0, 8)}...` : "-"}
      </Text>
      <Text style={[styles.tableCell, styles.cellAmount, { flex: 1 }]}>
        ${item.amount.toFixed(2)}
      </Text>
      <View style={{ flex: 1, paddingHorizontal: 8 }}>
        <StatusBadge status={item.status} />
      </View>
      <View style={{ flex: 1.2, paddingHorizontal: 8 }}>
        {item.status === "pending" ? (
          <TouchableOpacity
            style={styles.markPaidBtnSmall}
            onPress={() => setMarkPaidModal(item)}
            activeOpacity={0.7}
          >
            <Ionicons name="checkmark-circle" size={14} color="#fff" />
            <Text style={styles.markPaidBtnSmallText}>Mark as Paid</Text>
          </TouchableOpacity>
        ) : item.status === "paid" ? (
          <View>
            {item.paymentMethod ? (
              <View style={styles.paidInfo}>
                <Ionicons name="checkmark-circle" size={12} color="#10b981" />
                <Text style={styles.paidInfoText}>{item.paymentMethod}</Text>
              </View>
            ) : null}
            {item.paidAt ? (
              <Text style={styles.paidDate}>
                {new Date(item.paidAt).toLocaleDateString()}
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );

  // --- Mobile card ---
  const renderMobileCard = ({ item }: { item: Payout }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardId}>{item.id.slice(0, 8)}...</Text>
        <StatusBadge status={item.status} />
      </View>
      <Text style={styles.cardScholar}>{item.scholarName}</Text>
      <View style={styles.cardDetailsRow}>
        <View style={styles.cardDetailItem}>
          <Text style={styles.cardDetailLabel}>Amount</Text>
          <Text style={styles.cardDetailAmount}>${item.amount.toFixed(2)}</Text>
        </View>
        <View style={styles.cardDetailItem}>
          <Text style={styles.cardDetailLabel}>Job ID</Text>
          <Text style={styles.cardDetailValue}>
            {item.jobId ? `${item.jobId.slice(0, 8)}...` : "-"}
          </Text>
        </View>
      </View>

      {item.status === "pending" ? (
        <TouchableOpacity
          style={styles.markPaidBtn}
          onPress={() => setMarkPaidModal(item)}
          activeOpacity={0.7}
        >
          <Ionicons name="checkmark-circle" size={16} color="#fff" />
          <Text style={styles.markPaidBtnText}>Mark as Paid</Text>
        </TouchableOpacity>
      ) : item.status === "paid" ? (
        <View style={styles.paidInfoRow}>
          {item.paymentMethod ? (
            <View style={styles.paidInfo}>
              <Ionicons name="checkmark-circle" size={12} color="#10b981" />
              <Text style={styles.paidInfoText}>{item.paymentMethod}</Text>
            </View>
          ) : null}
          {item.paidAt ? (
            <Text style={styles.paidDate}>
              {new Date(item.paidAt).toLocaleDateString()}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );

  // ---------- Empty state ----------
  const renderEmpty = () => (
    <View style={styles.empty}>
      <Ionicons name="cash-outline" size={48} color="#2a3545" />
      <Text style={styles.emptyTitle}>No payouts yet</Text>
      <Text style={styles.emptySubtitle}>
        Payouts will appear here when scholars complete jobs
      </Text>
    </View>
  );

  return (
    <AdminPageWrapper scrollable={false}>
      {/* Header */}
      <View style={[styles.header, isMobile && styles.headerMobile]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, isMobile && { fontSize: 18 }]}>Payouts</Text>
          {!isMobile && (
            <Text style={styles.headerSubtitle}>
              Track and manage scholar payments
            </Text>
          )}
        </View>
        <View style={[styles.headerActions, isMobile && styles.headerActionsMobile]}>
          <TouchableOpacity
            style={[styles.bankLinkBtn, isMobile && styles.actionBtnMobile]}
            onPress={() => setBankLinkModal(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="link-outline" size={isMobile ? 14 : 16} color="#fff" />
            <Text style={[styles.exportBtnText, isMobile && { fontSize: 11 }]}>Bank Link</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.exportBtn, isMobile && styles.actionBtnMobile]}
            onPress={handleExportCSV}
            activeOpacity={0.7}
          >
            <Ionicons name="download-outline" size={isMobile ? 14 : 16} color="#fff" />
            <Text style={[styles.exportBtnText, isMobile && { fontSize: 11 }]}>Export</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Error banner */}
      {error ? (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle" size={16} color="#ef4444" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => setError(null)}>
            <Ionicons name="close" size={16} color="#ef4444" />
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Mercury Funding Card */}
      <View style={[
        styles.mercuryCard,
        isMobile && styles.mercuryCardMobile,
        mercuryReplenishment?.status === "approved" && { borderColor: "#10b98140", backgroundColor: "#10b98110" },
        (!mercuryReplenishment || mercuryReplenishment.status === "idle") && { borderColor: "#3b82f640", backgroundColor: "#3b82f610" },
      ]}>
        <View style={[styles.mercuryHeader, isMobile && { gap: 10, marginBottom: 8 }]}>
          <View style={[
            styles.mercuryIconWrap,
            isMobile && { width: 36, height: 36, borderRadius: 18 },
            mercuryReplenishment?.status === "approved" && { backgroundColor: "#10b98120" },
            (!mercuryReplenishment || mercuryReplenishment.status === "idle") && { backgroundColor: "#3b82f620" },
          ]}>
            <Ionicons
              name={mercuryReplenishment?.status === "approved" ? "checkmark-circle" : mercuryReplenishment?.status === "pending_approval" ? "alert-circle" : "business-outline"}
              size={isMobile ? 18 : 24}
              color={mercuryReplenishment?.status === "approved" ? "#10b981" : mercuryReplenishment?.status === "pending_approval" ? "#f59e0b" : "#3b82f6"}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[
              styles.mercuryTitle,
              isMobile && { fontSize: 13 },
              mercuryReplenishment?.status === "approved" && { color: "#10b981" },
              (!mercuryReplenishment || mercuryReplenishment.status === "idle") && { color: "#3b82f6" },
            ]}>
              {mercuryReplenishment?.status === "approved"
                ? "Mercury Funded"
                : mercuryReplenishment?.status === "pending_approval"
                ? "Replenishment Needed"
                : "Mercury ACH Payouts"}
            </Text>
            <Text style={[styles.mercuryWeek, isMobile && { fontSize: 11 }]}>
              {mercuryReplenishment?.status === "approved"
                ? `$${mercuryReplenishment.amount.toFixed(2)} processing`
                : mercuryReplenishment?.status === "pending_approval"
                ? mercuryReplenishment.weekLabel
                : "Chase > Mercury > Scholar accounts"}
            </Text>
          </View>
        </View>

        {/* Show amount + approve button when pending */}
        {mercuryReplenishment?.status === "pending_approval" && mercuryReplenishment.amount > 0 && (
          <>
            <Text style={[styles.mercuryAmount, isMobile && { fontSize: 26, marginBottom: 4 }]}>
              ${mercuryReplenishment.amount.toFixed(2)}
            </Text>
            {!isMobile && (
              <Text style={styles.mercuryDesc}>
                Transfer this amount from Chase to Mercury to cover last week's ACH payouts.
              </Text>
            )}
            <TouchableOpacity
              style={[styles.mercuryBtn, isMobile && { paddingVertical: 10 }, fundingMercury && { opacity: 0.6 }]}
              onPress={handleFundMercury}
              disabled={fundingMercury}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-forward-circle" size={isMobile ? 16 : 20} color="#fff" />
              <Text style={[styles.mercuryBtnText, isMobile && { fontSize: 13 }]}>
                {fundingMercury ? "Initiating..." : "Approve & Fund"}
              </Text>
            </TouchableOpacity>
          </>
        )}

        {/* Show idle state info — compact on mobile */}
        {(!mercuryReplenishment || mercuryReplenishment.status === "idle") && (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
            <View style={styles.mercuryChip}>
              <Ionicons name="shield-checkmark-outline" size={12} color="#3b82f6" />
              <Text style={styles.mercuryChipText}>ACH Direct Deposit</Text>
            </View>
            {!isMobile && (
              <>
                <View style={styles.mercuryChip}>
                  <Ionicons name="time-outline" size={12} color="#3b82f6" />
                  <Text style={styles.mercuryChipText}>50% at check-in, 50% after review</Text>
                </View>
                <View style={styles.mercuryChip}>
                  <Ionicons name="notifications-outline" size={12} color="#3b82f6" />
                  <Text style={styles.mercuryChipText}>Weekly replenishment alerts</Text>
                </View>
              </>
            )}
          </View>
        )}
      </View>

      {/* Summary cards */}
      {renderSummaryCards()}

      {/* Desktop table header */}
      {isDesktop && payouts.length > 0 && (
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderCell, { flex: 1.2 }]}>Payout ID</Text>
          <Text style={[styles.tableHeaderCell, { flex: 1.5 }]}>Scholar</Text>
          <Text style={[styles.tableHeaderCell, { flex: 1.2 }]}>Job ID</Text>
          <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Amount</Text>
          <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Status</Text>
          <Text style={[styles.tableHeaderCell, { flex: 1.2 }]}>Action</Text>
        </View>
      )}

      {/* Payout list */}
      <FlatList
        data={payouts}
        keyExtractor={(item) => item.id}
        renderItem={isDesktop ? renderDesktopRow : renderMobileCard}
        contentContainerStyle={
          payouts.length === 0 ? { flexGrow: 1 } : undefined
        }
        ListEmptyComponent={renderEmpty}
        showsVerticalScrollIndicator={Platform.OS === "web"}
      />

      {/* Mark as Paid Modal */}
      <Modal
        visible={markPaidModal !== null}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setMarkPaidModal(null);
          setPaymentMethod("ACH");
          setTransactionNote("");
        }}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => {
            if (busyId) return;
            setMarkPaidModal(null);
            setPaymentMethod("ACH");
            setTransactionNote("");
          }}
        >
          <View
            style={[styles.modalContent, isDesktop && styles.modalContentDesktop]}
            // Prevent closing when tapping inside modal
            onStartShouldSetResponder={() => true}
          >
            <Text style={styles.modalTitle}>Confirm Payment</Text>

            {markPaidModal && (
              <Text style={styles.modalDescription}>
                Confirm payment of{" "}
                <Text style={{ fontWeight: "700", color: "#10b981" }}>
                  ${markPaidModal.amount.toFixed(2)}
                </Text>{" "}
                to{" "}
                <Text style={{ fontWeight: "700", color: "#f1f5f9" }}>
                  {markPaidModal.scholarName}
                </Text>
              </Text>
            )}

            <FormSelect
              label="Payment Method"
              value={paymentMethod}
              onValueChange={setPaymentMethod}
              options={PAYMENT_METHODS}
            />

            <FormInput
              label="Transaction ID / Note"
              value={transactionNote}
              onChangeText={setTransactionNote}
              placeholder="e.g., ACH confirmation # or note"
            />

            <View style={styles.modalActions}>
              <FormButton
                title="Cancel"
                variant="secondary"
                onPress={() => {
                  setMarkPaidModal(null);
                  setPaymentMethod("ACH");
                  setTransactionNote("");
                }}
                disabled={busyId === markPaidModal?.id}
                style={{ flex: 1 }}
              />
              <FormButton
                title={
                  busyId === markPaidModal?.id
                    ? "Processing..."
                    : "Confirm Payment"
                }
                variant="primary"
                onPress={handleMarkAsPaid}
                loading={busyId === markPaidModal?.id}
                disabled={
                  busyId === markPaidModal?.id || !transactionNote.trim()
                }
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Resale Customer Payment Info Modal */}
      <Modal
        visible={bankLinkModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!blSending && !blBankSaving) {
            setBankLinkModal(false);
            setBlName(""); setBlEmail(""); setBlMessage("");
            setBlRouting(""); setBlAccount("");
            setBlTab("email");
          }
        }}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => {
            if (blSending || blBankSaving) return;
            setBankLinkModal(false);
            setBlName(""); setBlEmail(""); setBlMessage("");
            setBlRouting(""); setBlAccount("");
            setBlTab("email");
          }}
        >
          <View
            style={[styles.modalContent, isDesktop && styles.modalContentDesktop]}
            onStartShouldSetResponder={() => true}
          >
            <Text style={styles.modalTitle}>Resale Customer Payment</Text>

            {/* Tab switcher */}
            <View style={styles.tabRow}>
              <TouchableOpacity
                style={[styles.tab, blTab === "email" && styles.tabActive]}
                onPress={() => setBlTab("email")}
                activeOpacity={0.7}
              >
                <Ionicons name="mail-outline" size={14} color={blTab === "email" ? "#fff" : "#8b9bb5"} />
                <Text style={[styles.tabText, blTab === "email" && styles.tabTextActive]}>
                  Request Info
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, blTab === "bank_info" && styles.tabActive]}
                onPress={() => setBlTab("bank_info")}
                activeOpacity={0.7}
              >
                <Ionicons name="card-outline" size={14} color={blTab === "bank_info" ? "#fff" : "#8b9bb5"} />
                <Text style={[styles.tabText, blTab === "bank_info" && styles.tabTextActive]}>
                  Bank Info
                </Text>
              </TouchableOpacity>
            </View>

            {/* Shared fields */}
            <FormInput
              label="Customer Email"
              value={blEmail}
              onChangeText={setBlEmail}
              placeholder="e.g., jane@email.com"
              keyboardType="email-address"
              autoCapitalize="none"
            />

            {blTab === "email" && (
              <>
                <Text style={styles.modalDescription}>
                  Emails the customer asking them to reply with bank details for
                  ACH direct deposit. Enter their info in the Bank Info tab when they reply.
                </Text>

                <FormInput
                  label="Customer Name"
                  value={blName}
                  onChangeText={setBlName}
                  placeholder="e.g., Jane Smith"
                />

                <FormInput
                  label="Custom Message (optional)"
                  value={blMessage}
                  onChangeText={setBlMessage}
                  placeholder="e.g., Thanks for consigning with us!"
                  multiline
                />

                <View style={styles.modalActions}>
                  <FormButton
                    title="Cancel"
                    variant="secondary"
                    onPress={() => { setBankLinkModal(false); setBlTab("email"); }}
                    disabled={blSending}
                    style={{ flex: 1 }}
                  />
                  <FormButton
                    title={blSending ? "Sending..." : "Send Email"}
                    variant="primary"
                    onPress={handleSendBankLink}
                    loading={blSending}
                    disabled={blSending || !blName.trim() || !blEmail.trim()}
                    style={{ flex: 1 }}
                  />
                </View>
              </>
            )}

            {blTab === "bank_info" && (
              <>
                <Text style={styles.modalDescription}>
                  Enter bank routing and account number for Mercury ACH direct
                  deposit. This is the fastest payout method.
                </Text>

                <FormInput
                  label="Customer Name"
                  value={blName}
                  onChangeText={setBlName}
                  placeholder="e.g., Jane Smith"
                />

                <FormSelect
                  label="Account Type"
                  value={blAccountType}
                  onValueChange={(v: string) => setBlAccountType(v as "checking" | "savings")}
                  options={[
                    { label: "Checking", value: "checking" },
                    { label: "Savings", value: "savings" },
                  ]}
                />

                <FormInput
                  label="Routing Number"
                  value={blRouting}
                  onChangeText={(text) => setBlRouting(text.replace(/\D/g, "").slice(0, 9))}
                  placeholder="9-digit routing number"
                  keyboardType="number-pad"
                />

                <FormInput
                  label="Account Number"
                  value={blAccount}
                  onChangeText={(text) => setBlAccount(text.replace(/\D/g, "").slice(0, 17))}
                  placeholder="Account number"
                  keyboardType="number-pad"
                />

                <View style={styles.modalActions}>
                  <FormButton
                    title="Cancel"
                    variant="secondary"
                    onPress={() => { setBankLinkModal(false); setBlTab("email"); }}
                    disabled={blBankSaving}
                    style={{ flex: 1 }}
                  />
                  <FormButton
                    title={blBankSaving ? "Saving..." : "Save Bank Info"}
                    variant="primary"
                    onPress={handleSaveBankInfo}
                    loading={blBankSaving}
                    disabled={blBankSaving || !blEmail.trim() || !blName.trim() || !blRouting.trim() || !blAccount.trim()}
                    style={{ flex: 1 }}
                  />
                </View>
              </>
            )}

          </View>
        </TouchableOpacity>
      </Modal>
    </AdminPageWrapper>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    gap: 12,
  },
  headerMobile: {
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#f1f5f9",
  },
  headerSubtitle: {
    fontSize: 13,
    color: "#8b9bb5",
    marginTop: 2,
  },
  headerActions: {
    flexDirection: "row",
    gap: 8,
  },
  headerActionsMobile: {
    gap: 6,
  },
  actionBtnMobile: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  // Mercury funding card
  mercuryCard: {
    backgroundColor: "#f59e0b10",
    borderWidth: 1,
    borderColor: "#f59e0b40",
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  mercuryCardMobile: {
    padding: 12,
    marginBottom: 10,
    borderRadius: 12,
  },
  mercuryHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  mercuryIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#f59e0b20",
    justifyContent: "center",
    alignItems: "center",
  },
  mercuryTitle: { fontSize: 15, fontWeight: "700", color: "#f59e0b" },
  mercuryWeek: { fontSize: 12, color: "#8b9bb5", marginTop: 2 },
  mercuryAmount: {
    fontSize: 32,
    fontWeight: "800",
    color: "#f1f5f9",
    textAlign: "center",
    marginBottom: 8,
  },
  mercuryDesc: { fontSize: 13, color: "#8b9bb5", textAlign: "center", marginBottom: 16, lineHeight: 19 },
  mercuryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#f59e0b",
    borderRadius: 12,
    paddingVertical: 14,
  },
  mercuryBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  mercuryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#3b82f610",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  mercuryChipText: { fontSize: 12, color: "#8b9bb5", fontWeight: "500" },
  bankLinkBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#3b82f6",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  exportBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#10b981",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  exportBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 13,
  },

  // Error
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#ef444420",
    borderWidth: 1,
    borderColor: "#ef444440",
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: "#ef4444",
    fontSize: 13,
    flex: 1,
  },

  // Summary cards
  summaryRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  summaryRowDesktop: {
    gap: 16,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: "#1a2332",
    borderRadius: 12,
    padding: 14,
  },
  summaryCardDesktop: {
    padding: 18,
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#8b9bb5",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: "800",
    marginTop: 6,
  },

  // Desktop table
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#1a2332",
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#2a3545",
  },
  tableHeaderCell: {
    fontSize: 11,
    fontWeight: "700",
    color: "#8b9bb5",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    paddingHorizontal: 8,
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1a2332",
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#0a0f1a",
  },
  tableCell: {
    fontSize: 13,
    color: "#8b9bb5",
    paddingHorizontal: 8,
  },
  cellMono: {
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    fontSize: 12,
  },
  cellBold: {
    fontWeight: "700",
    color: "#f1f5f9",
  },
  cellAmount: {
    fontWeight: "700",
    color: "#10b981",
  },

  // Mobile card
  card: {
    backgroundColor: "#1a2332",
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  cardId: {
    fontSize: 12,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    color: "#5a6a80",
  },
  cardScholar: {
    fontSize: 15,
    fontWeight: "700",
    color: "#f1f5f9",
    marginBottom: 10,
  },
  cardDetailsRow: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 12,
  },
  cardDetailItem: {
    gap: 2,
  },
  cardDetailLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#5a6a80",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  cardDetailAmount: {
    fontSize: 16,
    fontWeight: "800",
    color: "#10b981",
  },
  cardDetailValue: {
    fontSize: 13,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    color: "#8b9bb5",
  },

  // Buttons
  markPaidBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#10b981",
    paddingVertical: 10,
    borderRadius: 10,
  },
  markPaidBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },
  markPaidBtnSmall: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#10b981",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  markPaidBtnSmallText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 12,
  },

  // Paid info
  paidInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 4,
  },
  paidInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  paidInfoText: {
    fontSize: 12,
    color: "#8b9bb5",
  },
  paidDate: {
    fontSize: 11,
    color: "#5a6a80",
  },

  // Empty
  empty: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#8b9bb5",
  },
  emptySubtitle: {
    fontSize: 13,
    color: "#5a6a80",
    textAlign: "center",
    maxWidth: 260,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    padding: 24,
  },
  modalContent: {
    backgroundColor: "#1a2332",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#2a3545",
    maxWidth: 460,
    width: "100%",
    alignSelf: "center",
  },
  modalContentDesktop: {
    padding: 28,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#f1f5f9",
    marginBottom: 8,
  },
  modalDescription: {
    fontSize: 14,
    color: "#8b9bb5",
    marginBottom: 20,
    lineHeight: 20,
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },

  // Tabs
  tabRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#0f1724",
    borderWidth: 1,
    borderColor: "#2a3545",
  },
  tabActive: {
    backgroundColor: "#3b82f620",
    borderColor: "#3b82f6",
  },
  tabText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#8b9bb5",
  },
  tabTextActive: {
    color: "#fff",
  },
});
