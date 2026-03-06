import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Image,
  TextInput,
  ActivityIndicator,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  updateDoc,
  getDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";

import { db, functions } from "../../src/lib/firebase";
import { COLLECTIONS } from "../../src/constants/collections";
import { useResponsive } from "../../src/lib/responsive";
import { useAuth } from "../../src/hooks/useAuth";
import AdminPageWrapper from "../../src/components/AdminPageWrapper";
import FormInput from "../../src/components/FormInput";
import FormSelect from "../../src/components/FormSelect";
import FormButton from "../../src/components/FormButton";
import {
  BOLD_SERIES_SETS,
  STANDARD_SHELVING,
  OVERHEAD_STORAGE,
  FLOORING_OPTIONS,
  PACKAGE_DEFAULTS,
  PACKAGE_DESCRIPTIONS,
  PACKAGE_LABELS,
  SERVICE_TYPE_LABELS,
  EMPTY_SELECTIONS,
  GYM_EQUIPMENT_CATALOG,
  GYM_EQUIPMENT_CATEGORIES,
  type ProductSelections,
} from "../../src/constants/productCatalog";
import {
  parsePhaseSequenceToChecklist,
  parseSopSections,
  serializeSelections,
} from "../../src/lib/sopParser";

// ── Types ──

type LeadJob = {
  id: string;
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
  address?: string;
  zipcode?: string;
  description?: string;
  serviceType?: string;
  package?: string;
  garageSize?: string;
  intakeMediaPaths?: string[];
  intakeImageUrls?: string[];
  generatedSOP?: string;
  status: string;
  createdAt?: any;
  [key: string]: any;
};

type ConvertFormData = {
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  address: string;
  description: string;
  selectedPackage: string;
  estimatedHours: number;
  scholarPayout: number;
  clientPrice: number;
  scheduledDate: string;
  accessInstructions: string;
  resaleConcierge: "yes" | "no";
  donationOptIn: "yes" | "no";
};

type SopReviewData = {
  jobId: string;
  sopText: string;
  clientName: string;
  address: string;
  packageTier: string;
  date: string;
  intakeImageUrls: string[];
};

// ── Helpers ──

function formatDate(dateInput: any): string {
  try {
    const d = dateInput?.toDate ? dateInput.toDate() : new Date(dateInput);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "N/A";
  }
}

function getCreatedAtDate(lead: LeadJob): Date {
  try {
    return lead.createdAt?.toDate ? lead.createdAt.toDate() : new Date(lead.createdAt);
  } catch {
    return new Date(0);
  }
}

// ── Main Screen ──

export default function AdminLeadsScreen() {
  const { isMobile, isDesktop } = useResponsive();
  const { profile } = useAuth();

  // Data
  const [leads, setLeads] = useState<LeadJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Action states
  const [busyId, setBusyId] = useState<string | null>(null);

  // Detail modal
  const [selectedLead, setSelectedLead] = useState<LeadJob | null>(null);

  // Convert (Publish) modal
  const [convertingLead, setConvertingLead] = useState<LeadJob | null>(null);
  const [convertFormData, setConvertFormData] = useState<ConvertFormData>({
    clientName: "",
    clientEmail: "",
    clientPhone: "",
    address: "",
    description: "",
    selectedPackage: "graduate",
    estimatedHours: 7,
    scholarPayout: 600,
    clientPrice: 2197,
    scheduledDate: "",
    accessInstructions: "",
    resaleConcierge: "no",
    donationOptIn: "no",
  });
  const [productSelections, setProductSelections] = useState<ProductSelections>({
    ...EMPTY_SELECTIONS,
  });

  // SOP generation
  const [sopGenerating, setSopGenerating] = useState(false);
  const [sopError, setSopError] = useState<string | null>(null);

  // SOP review modal
  const [sopReviewData, setSopReviewData] = useState<SopReviewData | null>(null);
  const [sopEditMode, setSopEditMode] = useState(false);
  const [sopEditText, setSopEditText] = useState("");
  const [sopRegenerateNotes, setSopRegenerateNotes] = useState("");
  const [sopApproving, setSopApproving] = useState(false);
  const [sopRegenerating, setSopRegenerating] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<number>>(
    new Set([0, 1, 2, 3, 4, 5]),
  );

  // Disqualify confirmation
  const [disqualifyConfirmId, setDisqualifyConfirmId] = useState<string | null>(null);

  // Invoice
  const [invoiceSending, setInvoiceSending] = useState(false);

  // ══════════════════════════════════════════════════
  // Firestore subscription
  // ══════════════════════════════════════════════════

  useEffect(() => {
    if (!db) {
      setError("Firestore not initialized.");
      setLoading(false);
      return;
    }

    const leadsQuery = query(
      collection(db, COLLECTIONS.JOBS),
      where("status", "==", "LEAD"),
      orderBy("createdAt", "desc"),
    );

    const unsubscribe = onSnapshot(
      leadsQuery,
      (snapshot) => {
        const items: LeadJob[] = snapshot.docs.map((d) => ({
          ...(d.data() as Omit<LeadJob, "id">),
          id: d.id,
          status: (d.data().status as string) || "LEAD",
        }));
        setLeads(items);
        setError(null);
        setLoading(false);
      },
      (err) => {
        setError(err.message || "Failed to load leads.");
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, []);

  // ── Summary counts ──

  const summaryStats = useMemo(() => {
    const now = new Date();
    const todayStr = now.toDateString();
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    let newToday = 0;
    let thisWeek = 0;

    leads.forEach((l) => {
      const d = getCreatedAtDate(l);
      if (d.toDateString() === todayStr) newToday++;
      if (d >= weekAgo) thisWeek++;
    });

    return { total: leads.length, newToday, thisWeek };
  }, [leads]);

  // ══════════════════════════════════════════════════
  // Handlers
  // ══════════════════════════════════════════════════

  const handlePublishToScholars = useCallback((lead: LeadJob) => {
    setError(null);
    setSopError(null);
    setConvertingLead(lead);
    const pkg = lead.package || "graduate";
    const defaults = PACKAGE_DEFAULTS[pkg] || PACKAGE_DEFAULTS.graduate;
    setConvertFormData({
      clientName: lead.clientName || "",
      clientEmail: lead.clientEmail || "",
      clientPhone: lead.clientPhone || "",
      address: lead.address || lead.zipcode || "",
      description: lead.description || "",
      selectedPackage: pkg,
      estimatedHours: defaults.estimatedHours,
      scholarPayout: defaults.scholarPayout,
      clientPrice: defaults.clientPrice,
      scheduledDate: "",
      accessInstructions: "",
      resaleConcierge: "no",
      donationOptIn: "no",
    });
    setProductSelections({ ...EMPTY_SELECTIONS });
  }, []);

  const handlePackageChange = useCallback((pkg: string) => {
    const defaults = PACKAGE_DEFAULTS[pkg] || PACKAGE_DEFAULTS.graduate;
    setConvertFormData((prev) => ({
      ...prev,
      selectedPackage: pkg,
      clientPrice: defaults.clientPrice,
      scholarPayout: defaults.scholarPayout,
      estimatedHours: defaults.estimatedHours,
    }));
  }, []);

  const handleSendInvoice = useCallback(async () => {
    if (!convertingLead || !functions) return;

    const email = convertFormData.clientEmail.trim();
    const name = convertFormData.clientName.trim();
    const price = convertFormData.clientPrice;

    if (!email) {
      setError("Client email is required to send an invoice.");
      return;
    }
    if (!name) {
      setError("Client name is required to send an invoice.");
      return;
    }
    if (!price || price <= 0) {
      setError("Client price must be greater than $0.");
      return;
    }

    setInvoiceSending(true);
    setError(null);

    try {
      const callable = httpsCallable(functions, "gsCreateInvoice");
      const result = await callable({
        customerName: name,
        customerEmail: email,
        amount: price,
        description: `${PACKAGE_LABELS[convertFormData.selectedPackage] || convertFormData.selectedPackage} Package — ${convertFormData.address.trim() || "Garage Organization"}`,
        jobId: convertingLead.id,
        packageTier: convertFormData.selectedPackage,
      });

      const data = result.data as { invoiceId?: string; invoiceUrl?: string };
      if (Platform.OS === "web") {
        setError(null);
        setSopError(null);
        alert(`Invoice sent to ${email}!\n\nStripe Invoice: ${data.invoiceId}`);
      } else {
        Alert.alert("Invoice Sent", `Invoice emailed to ${email}.`);
      }
    } catch (err: any) {
      const msg = err?.message || "Failed to send invoice.";
      setError(msg);
    } finally {
      setInvoiceSending(false);
    }
  }, [convertingLead, convertFormData]);

  const handleConvertSubmit = useCallback(async () => {
    if (!db || !convertingLead || !functions) return;

    setError(null);
    setSopError(null);

    // Validation
    if (!convertFormData.clientName.trim() || !convertFormData.address.trim()) {
      setError("Client name and address are required.");
      return;
    }
    if (!convertFormData.clientPrice || convertFormData.clientPrice <= 0) {
      setError("Client price is required.");
      return;
    }
    if (!convertFormData.scholarPayout || convertFormData.scholarPayout <= 0) {
      setError("Scholar payout is required.");
      return;
    }
    if (!convertFormData.scheduledDate) {
      setError("Scheduled date is required.");
      return;
    }

    setBusyId(convertingLead.id);
    setSopGenerating(true);

    try {
      const scheduledDateTime = new Date(convertFormData.scheduledDate);
      const endDateTime = new Date(
        scheduledDateTime.getTime() + convertFormData.estimatedHours * 60 * 60 * 1000,
      );

      const { shelvingSelections, addOns } = serializeSelections(
        productSelections,
        convertFormData.selectedPackage,
      );

      // Step 1: Update job document
      await updateDoc(doc(db, COLLECTIONS.JOBS, convertingLead.id), {
        title: convertFormData.clientName.trim(),
        clientName: convertFormData.clientName.trim(),
        clientEmail: convertFormData.clientEmail.trim(),
        clientPhone: convertFormData.clientPhone.trim(),
        address: convertFormData.address.trim(),
        description: convertFormData.description.trim(),
        scheduledDate: scheduledDateTime.toISOString(),
        scheduledTimeStart: scheduledDateTime.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }),
        scheduledTimeEnd: endDateTime.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }),
        payout: convertFormData.scholarPayout,
        clientPrice: convertFormData.clientPrice,
        status: "SOP_NEEDS_REVIEW",
        lat: 0,
        lng: 0,
        urgencyLevel: "standard",
        rushBonus: 0,
        currentViewers: 0,
        viewerFloor: 0,
        totalViews: 0,
        reopenCount: 0,
        accessConstraints: convertFormData.accessInstructions.trim(),
        resaleConcierge: convertFormData.resaleConcierge === "yes",
        donationOptIn: convertFormData.donationOptIn === "yes",
        shelvingSelections,
        addOns,
        productSelections: productSelections,
        package: convertFormData.selectedPackage,
        packageTier: convertFormData.selectedPackage,
        inventoryExtracted: false,
        updatedAt: serverTimestamp(),
      });

      // Step 2: Call Cloud Function to generate SOP
      const callable = httpsCallable(functions, "generateSopForJob", { timeout: 300000 });
      const result = await callable({ jobId: convertingLead.id });
      const data = result.data as { ok?: boolean; generatedSOP?: string };

      if (!data.ok || !data.generatedSOP) {
        throw new Error("SOP generation returned empty result.");
      }

      // Step 3: Open SOP Review Modal
      const intakeUrls = convertingLead.intakeImageUrls || convertingLead.intakeMediaPaths || [];
      setSopReviewData({
        jobId: convertingLead.id,
        sopText: data.generatedSOP,
        clientName: convertFormData.clientName.trim(),
        address: convertFormData.address.trim(),
        packageTier: convertFormData.selectedPackage,
        date: scheduledDateTime.toISOString(),
        intakeImageUrls: intakeUrls,
      });
      setSopEditText(data.generatedSOP);
      setConvertingLead(null);
    } catch (err) {
      // The Cloud Function may have succeeded even though the browser lost connection
      // (e.g. ERR_NETWORK_CHANGED during the ~60s Claude API call).
      // Check Firestore before resetting to LEAD.
      if (db && convertingLead) {
        try {
          const jobSnap = await getDoc(doc(db, COLLECTIONS.JOBS, convertingLead.id));
          const jobData = jobSnap.data();
          if (jobData?.generatedSOP && jobData?.status === "SOP_NEEDS_REVIEW") {
            // Function succeeded server-side — show the review modal
            const intakeUrls = convertingLead.intakeImageUrls || convertingLead.intakeMediaPaths || [];
            setSopReviewData({
              jobId: convertingLead.id,
              sopText: jobData.generatedSOP,
              clientName: convertFormData.clientName.trim(),
              address: convertFormData.address.trim(),
              packageTier: convertFormData.selectedPackage,
              date: convertFormData.scheduledDate,
              intakeImageUrls: intakeUrls,
            });
            setSopEditText(jobData.generatedSOP);
            setConvertingLead(null);
            return; // SOP was generated — skip reset
          }
        } catch (_) {
          // Firestore check failed too — fall through to reset
        }

        // SOP was NOT generated — reset to LEAD
        const message = err instanceof Error ? err.message : "Failed to generate SOP.";
        setSopError(message);
        await updateDoc(doc(db, COLLECTIONS.JOBS, convertingLead.id), {
          status: "LEAD",
          updatedAt: serverTimestamp(),
        }).catch(() => {});
      } else {
        const message = err instanceof Error ? err.message : "Failed to generate SOP.";
        setSopError(message);
      }
    } finally {
      setBusyId(null);
      setSopGenerating(false);
    }
  }, [convertFormData, convertingLead, productSelections]);

  const handleSopApprove = useCallback(async () => {
    if (!db || !sopReviewData || !profile) return;
    setSopApproving(true);

    try {
      const finalSOP = sopEditMode ? sopEditText : sopReviewData.sopText;
      const checklist = parsePhaseSequenceToChecklist(finalSOP);

      // Flatten top-level phases + sub-items into a single checklist for Firestore
      const sourceItems =
        checklist.length > 0
          ? checklist
          : [
              {
                id: "check-in",
                text: "Check in with photo of property exterior",
                isCompleted: false,
                status: "approved" as const,
              },
              {
                id: "check-out",
                text: "Take final photos and check out",
                isCompleted: false,
                status: "approved" as const,
              },
            ];

      const gsChecklist: Array<{
        id: string;
        text: string;
        completed: boolean;
        approvalStatus: string;
        isSubItem?: boolean;
        parentId?: string;
      }> = [];

      for (const item of sourceItems) {
        gsChecklist.push({
          id: item.id,
          text: item.text,
          completed: false,
          approvalStatus: (item.status || "approved").toLowerCase(),
        });
        // Include sub-steps as indented checklist items
        if (item.subItems && item.subItems.length > 0) {
          for (const sub of item.subItems) {
            gsChecklist.push({
              id: sub.id,
              text: sub.text,
              completed: false,
              approvalStatus: (sub.status || "approved").toLowerCase(),
              isSubItem: true,
              parentId: item.id,
            });
          }
        }
      }

      await updateDoc(doc(db, COLLECTIONS.JOBS, sopReviewData.jobId), {
        sopContent: finalSOP,
        generatedSOP: finalSOP,
        sopApprovedBy: profile.uid,
        sopApprovedAt: new Date().toISOString(),
        status: "APPROVED_FOR_POSTING",
        checklist: gsChecklist,
        updatedAt: serverTimestamp(),
      });

      setSopReviewData(null);
      setSopEditMode(false);
      setSopEditText("");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to approve SOP.";
      setError(message);
    } finally {
      setSopApproving(false);
    }
  }, [sopReviewData, sopEditMode, sopEditText, profile]);

  const handleSopRegenerate = useCallback(async () => {
    if (!functions || !sopReviewData) return;
    setSopRegenerating(true);

    try {
      const callable = httpsCallable(functions, "generateSopForJob", { timeout: 300000 });
      const result = await callable({
        jobId: sopReviewData.jobId,
        adminNotes: sopRegenerateNotes || undefined,
      });
      const data = result.data as { ok?: boolean; generatedSOP?: string };

      if (!data.ok || !data.generatedSOP) {
        throw new Error("Regeneration returned empty result.");
      }

      setSopReviewData({ ...sopReviewData, sopText: data.generatedSOP });
      setSopEditText(data.generatedSOP);
      setSopRegenerateNotes("");
      setSopEditMode(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to regenerate SOP.";
      setError(message);
    } finally {
      setSopRegenerating(false);
    }
  }, [sopReviewData, sopRegenerateNotes]);

  const handleSopCancel = useCallback(async () => {
    if (!db || !sopReviewData) return;

    try {
      await updateDoc(doc(db, COLLECTIONS.JOBS, sopReviewData.jobId), {
        status: "LEAD",
        generatedSOP: null,
        updatedAt: serverTimestamp(),
      });
    } catch {
      // Silently fail
    }

    setSopReviewData(null);
    setSopEditMode(false);
    setSopEditText("");
    setSopRegenerateNotes("");
  }, [sopReviewData]);

  const handleDisqualify = useCallback(
    async (leadId: string) => {
      if (!db) return;
      setBusyId(leadId);
      try {
        await updateDoc(doc(db, COLLECTIONS.JOBS, leadId), {
          status: "CANCELLED",
          cancellationReason: "Lead disqualified",
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to disqualify lead.";
        setError(message);
      } finally {
        setBusyId(null);
        setDisqualifyConfirmId(null);
      }
    },
    [],
  );

  const toggleSection = useCallback((idx: number) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }, []);

  // Quantity helpers for product selectors
  const updateShelvingQty = useCallback(
    (id: string, delta: number) => {
      setProductSelections((prev) => {
        const existing = prev.standardShelving.find((s) => s.id === id);
        const currentQty = existing?.qty || 0;
        const newQty = Math.max(0, currentQty + delta);
        const filtered = prev.standardShelving.filter((s) => s.id !== id);
        if (newQty > 0) filtered.push({ id, qty: newQty });
        return { ...prev, standardShelving: filtered };
      });
    },
    [],
  );

  const updateOverheadQty = useCallback(
    (id: string, delta: number) => {
      setProductSelections((prev) => {
        const existing = prev.overheadStorage.find((s) => s.id === id);
        const currentQty = existing?.qty || 0;
        const newQty = Math.max(0, currentQty + delta);
        const filtered = prev.overheadStorage.filter((s) => s.id !== id);
        if (newQty > 0) filtered.push({ id, qty: newQty });
        return { ...prev, overheadStorage: filtered };
      });
    },
    [],
  );

  // Gym equipment quantity helper
  const updateGymEquipmentQty = useCallback(
    (id: string, delta: number) => {
      setProductSelections((prev) => {
        const existing = prev.gymEquipment.find((g) => g.id === id);
        const currentQty = existing?.qty || 0;
        const newQty = Math.max(0, currentQty + delta);
        const filtered = prev.gymEquipment.filter((g) => g.id !== id);
        if (newQty > 0) filtered.push({ id, qty: newQty, customName: existing?.customName });
        return { ...prev, gymEquipment: filtered };
      });
    },
    [],
  );

  // Add custom equipment entry
  const [customEquipmentName, setCustomEquipmentName] = useState("");
  const addCustomEquipment = useCallback(() => {
    if (!customEquipmentName.trim()) return;
    setProductSelections((prev) => {
      const customId = `custom-${Date.now()}`;
      return {
        ...prev,
        gymEquipment: [
          ...prev.gymEquipment,
          { id: customId, qty: 1, customName: customEquipmentName.trim() },
        ],
      };
    });
    setCustomEquipmentName("");
  }, [customEquipmentName]);

  // Remove custom equipment
  const removeCustomEquipment = useCallback((id: string) => {
    setProductSelections((prev) => ({
      ...prev,
      gymEquipment: prev.gymEquipment.filter((g) => g.id !== id),
    }));
  }, []);

  // Check if gym section should show (gym-related service or package)
  const showGymSection = useMemo(() => {
    const gymPackages = ["warmup", "superset", "1repmax", "deans-list", "valedictorian"];
    const gymServices = ["get-strong", "gym", "full"];
    const pkg = convertFormData.selectedPackage?.toLowerCase() || "";
    const svc = selectedLead?.serviceType?.toLowerCase() || "";
    return gymPackages.includes(pkg) || gymServices.includes(svc) || productSelections.gymEquipment.length > 0;
  }, [convertFormData.selectedPackage, selectedLead?.serviceType, productSelections.gymEquipment.length]);

  // ── Bold series select options ──
  const boldSeriesOptions = useMemo(() => {
    const credit =
      convertFormData.selectedPackage === "doctorate"
        ? 500
        : convertFormData.selectedPackage === "graduate"
          ? 300
          : 0;
    return [
      { label: "None", value: "" },
      ...BOLD_SERIES_SETS.map((b) => {
        const clientPays = Math.max(0, b.retail - credit);
        return {
          label: `${b.name} (${b.dims}) - $${b.retail}${credit > 0 ? ` -> $${clientPays}` : ""}`,
          value: b.id,
        };
      }),
    ];
  }, [convertFormData.selectedPackage]);

  const flooringOptions = useMemo(
    () =>
      FLOORING_OPTIONS.map((f) => ({
        label: `${f.name}${f.price > 0 ? ` - $${f.price}` : f.id !== "none" ? " - Price TBD" : ""}`,
        value: f.id,
      })),
    [],
  );

  // ══════════════════════════════════════════════════
  // Skeleton loading
  // ══════════════════════════════════════════════════

  if (loading) {
    return (
      <AdminPageWrapper>
        <View style={styles.headerRow}>
          <View>
            <View style={[styles.skeleton, { width: 180, height: 22 }]} />
            <View style={[styles.skeleton, { width: 240, height: 14, marginTop: 6 }]} />
          </View>
        </View>
        <View style={[styles.summaryRow, isDesktop && styles.summaryRowDesktop]}>
          {[1, 2, 3].map((i) => (
            <View key={i} style={[styles.summaryCard, isDesktop && styles.summaryCardDesktop]}>
              <View style={[styles.skeleton, { width: 80, height: 12 }]} />
              <View style={[styles.skeleton, { width: 40, height: 24, marginTop: 8 }]} />
            </View>
          ))}
        </View>
        {[1, 2, 3].map((i) => (
          <View key={i} style={styles.leadCard}>
            <View style={[styles.skeleton, { width: "60%" as any, height: 16 }]} />
            <View style={[styles.skeleton, { width: "40%" as any, height: 14, marginTop: 8 }]} />
            <View style={[styles.skeleton, { width: "30%" as any, height: 14, marginTop: 6 }]} />
            <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
              <View style={[styles.skeleton, { width: 60, height: 30, borderRadius: 8 }]} />
              <View style={[styles.skeleton, { width: 70, height: 30, borderRadius: 8 }]} />
              <View style={[styles.skeleton, { width: 80, height: 30, borderRadius: 8 }]} />
            </View>
          </View>
        ))}
      </AdminPageWrapper>
    );
  }

  // ══════════════════════════════════════════════════
  // Render helpers
  // ══════════════════════════════════════════════════

  const renderLeadItem = ({ item: lead }: { item: LeadJob }) => (
    <View style={[styles.leadCard, isDesktop && styles.leadCardDesktop]}>
      {/* Row 1: Name + Date */}
      <View style={styles.leadCardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.leadName}>{lead.clientName || "Unknown"}</Text>
          <View style={styles.inlineRow}>
            <Ionicons name="location-outline" size={13} color="#5a6a80" />
            <Text style={styles.leadMeta}>{lead.zipcode || lead.address || "N/A"}</Text>
          </View>
        </View>
        <Text style={styles.leadDate}>{formatDate(lead.createdAt)}</Text>
      </View>

      {/* Row 2: Contact */}
      <View style={styles.contactRow}>
        {lead.clientEmail ? (
          <View style={styles.inlineRow}>
            <Ionicons name="mail-outline" size={13} color="#5a6a80" />
            <Text style={styles.leadMeta} numberOfLines={1}>
              {lead.clientEmail}
            </Text>
          </View>
        ) : null}
        {lead.clientPhone ? (
          <View style={styles.inlineRow}>
            <Ionicons name="call-outline" size={13} color="#5a6a80" />
            <Text style={styles.leadMeta}>{lead.clientPhone}</Text>
          </View>
        ) : null}
      </View>

      {/* Row 3: Service / Package */}
      <View style={styles.serviceRow}>
        <Text style={styles.serviceType}>
          {lead.serviceType ? SERVICE_TYPE_LABELS[lead.serviceType] || lead.serviceType : "N/A"}
        </Text>
        {lead.package ? (
          <View style={styles.packageBadge}>
            <Text style={styles.packageBadgeText}>
              {PACKAGE_LABELS[lead.package] || lead.package}
            </Text>
          </View>
        ) : (
          <Text style={styles.noPackageText}>No package set</Text>
        )}
      </View>

      {lead.garageSize ? (
        <Text style={styles.leadMetaSmall}>Size: {lead.garageSize}</Text>
      ) : null}

      {/* Actions */}
      <View style={styles.actionRow}>
        <TouchableOpacity
          style={styles.btnView}
          onPress={() => setSelectedLead(lead)}
          activeOpacity={0.7}
        >
          <Ionicons name="eye-outline" size={14} color="#e2e8f0" />
          <Text style={styles.btnViewText}>View</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btnPublish, busyId === lead.id && styles.btnDisabled]}
          onPress={() => handlePublishToScholars(lead)}
          disabled={busyId === lead.id}
          activeOpacity={0.7}
        >
          {busyId === lead.id ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="rocket-outline" size={14} color="#fff" />
              <Text style={styles.btnPublishText}>Publish</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btnDisqualify, busyId === lead.id && styles.btnDisabled]}
          onPress={() => setDisqualifyConfirmId(lead.id)}
          disabled={busyId === lead.id}
          activeOpacity={0.7}
        >
          <Ionicons name="close-circle-outline" size={14} color="#8b9bb5" />
          <Text style={styles.btnDisqualifyText}>Disqualify</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // ══════════════════════════════════════════════════
  // Main render
  // ══════════════════════════════════════════════════

  return (
    <AdminPageWrapper>
      {/* Header */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.pageTitle}>Leads Management</Text>
          <Text style={styles.pageSubtitle}>Quote requests from website visitors</Text>
        </View>
      </View>

      {/* Error banner */}
      {error ? (
        <View style={styles.errorBanner}>
          <Ionicons name="warning-outline" size={16} color="#fca5a5" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {/* Summary Cards */}
      <View style={[styles.summaryRow, isDesktop && styles.summaryRowDesktop]}>
        <View style={[styles.summaryCard, isDesktop && styles.summaryCardDesktop]}>
          <Text style={styles.summaryLabel}>TOTAL LEADS</Text>
          <Text style={[styles.summaryValue, { color: "#60a5fa" }]}>{summaryStats.total}</Text>
        </View>
        <View style={[styles.summaryCard, isDesktop && styles.summaryCardDesktop]}>
          <Text style={styles.summaryLabel}>NEW TODAY</Text>
          <Text style={[styles.summaryValue, { color: "#34d399" }]}>
            {summaryStats.newToday}
          </Text>
        </View>
        <View style={[styles.summaryCard, isDesktop && styles.summaryCardDesktop]}>
          <Text style={styles.summaryLabel}>THIS WEEK</Text>
          <Text style={[styles.summaryValue, { color: "#f1f5f9" }]}>
            {summaryStats.thisWeek}
          </Text>
        </View>
      </View>

      {/* Leads List */}
      <FlatList
        data={leads}
        keyExtractor={(item) => item.id}
        renderItem={renderLeadItem}
        scrollEnabled={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="mail-outline" size={40} color="#2a3545" />
            <Text style={styles.emptyTitle}>No leads yet</Text>
            <Text style={styles.emptySubtitle}>
              New quote requests from the website will appear here
            </Text>
          </View>
        }
      />

      {/* ══════════════════════════════════════════════════ */}
      {/* Lead Detail Modal                                  */}
      {/* ══════════════════════════════════════════════════ */}

      <Modal
        visible={!!selectedLead}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedLead(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, isDesktop && styles.modalContentDesktop]}>
            <ScrollView showsVerticalScrollIndicator={Platform.OS === "web"}>
              {/* Header */}
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Lead Details</Text>
                <TouchableOpacity onPress={() => setSelectedLead(null)}>
                  <Ionicons name="close" size={24} color="#8b9bb5" />
                </TouchableOpacity>
              </View>

              {selectedLead ? (
                <View style={styles.modalBody}>
                  {/* Contact Info */}
                  <Text style={styles.sectionHeader}>CONTACT INFORMATION</Text>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Name</Text>
                    <Text style={styles.detailValue}>{selectedLead.clientName || "N/A"}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Email</Text>
                    <Text style={styles.detailValue}>{selectedLead.clientEmail || "N/A"}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Phone</Text>
                    <Text style={styles.detailValue}>{selectedLead.clientPhone || "N/A"}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>ZIP Code</Text>
                    <Text style={styles.detailValue}>{selectedLead.zipcode || "N/A"}</Text>
                  </View>

                  {/* Service Details */}
                  <Text style={[styles.sectionHeader, { marginTop: 20 }]}>SERVICE DETAILS</Text>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Service</Text>
                    <Text style={styles.detailValue}>
                      {selectedLead.serviceType
                        ? SERVICE_TYPE_LABELS[selectedLead.serviceType] || selectedLead.serviceType
                        : "N/A"}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Package</Text>
                    <Text style={styles.detailValue}>
                      {selectedLead.package
                        ? PACKAGE_LABELS[selectedLead.package] || selectedLead.package
                        : "N/A"}
                    </Text>
                  </View>
                  {selectedLead.garageSize ? (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Garage Size</Text>
                      <Text style={styles.detailValue}>{selectedLead.garageSize}</Text>
                    </View>
                  ) : null}

                  {/* Description */}
                  {selectedLead.description ? (
                    <>
                      <Text style={[styles.sectionHeader, { marginTop: 20 }]}>
                        PROJECT DESCRIPTION
                      </Text>
                      <Text style={styles.descriptionText}>{selectedLead.description}</Text>
                    </>
                  ) : null}

                  {/* Photos */}
                  {(selectedLead.intakeImageUrls || selectedLead.intakeMediaPaths)?.length ? (
                    <>
                      <Text style={[styles.sectionHeader, { marginTop: 20 }]}>
                        PHOTOS ({(selectedLead.intakeImageUrls || selectedLead.intakeMediaPaths)!.length})
                      </Text>
                      <View style={styles.photoGrid}>
                        {(selectedLead.intakeImageUrls || selectedLead.intakeMediaPaths)!.map((url, idx) => (
                          <Image
                            key={idx}
                            source={{ uri: url }}
                            style={styles.photoThumb}
                            resizeMode="cover"
                          />
                        ))}
                      </View>
                    </>
                  ) : null}
                </View>
              ) : null}
            </ScrollView>

            {/* Footer */}
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.footerBtnSecondary}
                onPress={() => setSelectedLead(null)}
                activeOpacity={0.7}
              >
                <Text style={styles.footerBtnSecondaryText}>Close</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.footerBtnPrimary}
                onPress={() => {
                  if (selectedLead) handlePublishToScholars(selectedLead);
                  setSelectedLead(null);
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="rocket-outline" size={16} color="#fff" />
                <Text style={styles.footerBtnPrimaryText}>Publish to Scholars</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ══════════════════════════════════════════════════ */}
      {/* Publish to Scholars Modal (Convert + Schedule)     */}
      {/* ══════════════════════════════════════════════════ */}

      <Modal
        visible={!!convertingLead}
        animationType="slide"
        transparent
        onRequestClose={() => {
          setConvertingLead(null);
          setSopError(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, isDesktop && styles.modalContentDesktop]}>
            <ScrollView showsVerticalScrollIndicator={Platform.OS === "web"}>
              {/* Header */}
              <View style={styles.modalHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalTitle}>Publish to Scholars</Text>
                  <Text style={styles.modalSubtitle}>
                    Complete job details, then SOP will be auto-generated
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    setConvertingLead(null);
                    setSopError(null);
                  }}
                >
                  <Ionicons name="close" size={24} color="#8b9bb5" />
                </TouchableOpacity>
              </View>

              <View style={styles.modalBody}>
                {/* Error */}
                {(error || sopError) ? (
                  <View style={styles.errorBanner}>
                    <Ionicons name="warning-outline" size={14} color="#fca5a5" />
                    <Text style={styles.errorText}>{sopError || error}</Text>
                  </View>
                ) : null}

                {/* No photos warning */}
                {convertingLead &&
                (!convertingLead.intakeImageUrls?.length &&
                  !convertingLead.intakeMediaPaths?.length) ? (
                  <View style={styles.warningBanner}>
                    <Ionicons name="camera-outline" size={14} color="#fbbf24" />
                    <Text style={styles.warningText}>
                      No intake photos attached. SOP will generate without photo analysis.
                    </Text>
                  </View>
                ) : null}

                {/* ── Package Tier ── */}
                <Text style={styles.formSectionTitle}>Package Tier</Text>

                <FormSelect
                  label="Selected Package"
                  value={convertFormData.selectedPackage}
                  onValueChange={handlePackageChange}
                  options={[
                    { label: "Undergraduate - $1,197", value: "undergraduate" },
                    { label: "Graduate - $2,197", value: "graduate" },
                    { label: "Doctorate - $3,797", value: "doctorate" },
                  ]}
                />
                <Text style={styles.packageHint}>
                  {PACKAGE_DESCRIPTIONS[convertFormData.selectedPackage]?.split("--")[1]?.trim() || ""}
                </Text>

                {/* ── Client Information ── */}
                <Text style={styles.formSectionTitle}>Client Information</Text>

                <FormInput
                  label="Client Name *"
                  value={convertFormData.clientName}
                  onChangeText={(t) => setConvertFormData((p) => ({ ...p, clientName: t }))}
                  placeholder="Full name"
                />
                <FormInput
                  label="Client Email"
                  value={convertFormData.clientEmail}
                  onChangeText={(t) => setConvertFormData((p) => ({ ...p, clientEmail: t }))}
                  placeholder="email@example.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                <FormInput
                  label="Client Phone"
                  value={convertFormData.clientPhone}
                  onChangeText={(t) => setConvertFormData((p) => ({ ...p, clientPhone: t }))}
                  placeholder="(555) 123-4567"
                  keyboardType="phone-pad"
                />
                <FormInput
                  label="Property Address *"
                  value={convertFormData.address}
                  onChangeText={(t) => setConvertFormData((p) => ({ ...p, address: t }))}
                  placeholder="123 Main St, Denver, CO 80202"
                />

                {/* ── Job Details ── */}
                <Text style={styles.formSectionTitle}>Job Details</Text>

                <FormInput
                  label="Job Description"
                  value={convertFormData.description}
                  onChangeText={(t) =>
                    setConvertFormData((p) => ({ ...p, description: t.slice(0, 500) }))
                  }
                  placeholder="Describe the job scope..."
                  multiline
                  numberOfLines={4}
                />
                <Text style={styles.charCount}>
                  {convertFormData.description.length}/500 characters
                </Text>

                <View style={[styles.rowFields, isDesktop && styles.rowFieldsDesktop]}>
                  <View style={styles.fieldHalf}>
                    <FormInput
                      label="Estimated Hours"
                      value={String(convertFormData.estimatedHours)}
                      onChangeText={(t) =>
                        setConvertFormData((p) => ({
                          ...p,
                          estimatedHours: parseFloat(t) || 0,
                        }))
                      }
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={styles.fieldHalf}>
                    <FormInput
                      label="Scholar Payout ($) *"
                      value={convertFormData.scholarPayout ? String(convertFormData.scholarPayout) : ""}
                      onChangeText={(t) =>
                        setConvertFormData((p) => ({
                          ...p,
                          scholarPayout: parseFloat(t) || 0,
                        }))
                      }
                      keyboardType="numeric"
                    />
                  </View>
                </View>

                <FormInput
                  label="Client Price ($) *"
                  value={convertFormData.clientPrice ? String(convertFormData.clientPrice) : ""}
                  onChangeText={(t) =>
                    setConvertFormData((p) => ({
                      ...p,
                      clientPrice: parseFloat(t) || 0,
                    }))
                  }
                  keyboardType="numeric"
                />

                <FormInput
                  label="Scheduled Date & Time *"
                  value={convertFormData.scheduledDate}
                  onChangeText={(t) => setConvertFormData((p) => ({ ...p, scheduledDate: t }))}
                  placeholder={Platform.OS === "web" ? "" : "YYYY-MM-DDTHH:mm"}
                  keyboardType={Platform.OS === "web" ? "default" : "default"}
                />
                {Platform.OS === "web" ? (
                  <View style={{ marginBottom: 14, marginTop: -8 }}>
                    <input
                      type="datetime-local"
                      value={convertFormData.scheduledDate}
                      onChange={(e: any) =>
                        setConvertFormData((p) => ({ ...p, scheduledDate: e.target.value }))
                      }
                      style={{
                        backgroundColor: "#1a2332",
                        color: "#f1f5f9",
                        border: "1px solid #2a3545",
                        borderRadius: 10,
                        padding: 14,
                        fontSize: 15,
                        width: "100%",
                        outline: "none",
                      }}
                    />
                  </View>
                ) : null}

                {/* ── Shelving & Storage ── */}
                <Text style={styles.formSectionTitle}>Shelving & Storage</Text>

                <FormSelect
                  label="Bold Series Cabinet System"
                  value={productSelections.boldSeriesId}
                  onValueChange={(v) =>
                    setProductSelections((p) => ({ ...p, boldSeriesId: v }))
                  }
                  options={boldSeriesOptions}
                />

                {/* Standard Shelving with +/- */}
                <Text style={styles.subSectionLabel}>Standard Shelving</Text>
                {STANDARD_SHELVING.map((shelf) => {
                  const existing = productSelections.standardShelving.find(
                    (s) => s.id === shelf.id,
                  );
                  const qty = existing?.qty || 0;
                  return (
                    <View key={shelf.id} style={styles.qtyRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.qtyItemName}>{shelf.name}</Text>
                        <Text style={styles.qtyItemDims}>
                          {shelf.dims} - ${shelf.cost}
                        </Text>
                      </View>
                      <View style={styles.qtyControls}>
                        <TouchableOpacity
                          style={styles.qtyBtnMinus}
                          onPress={() => updateShelvingQty(shelf.id, -1)}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="remove" size={16} color="#8b9bb5" />
                        </TouchableOpacity>
                        <Text style={styles.qtyValue}>{qty}</Text>
                        <TouchableOpacity
                          style={styles.qtyBtnPlus}
                          onPress={() => updateShelvingQty(shelf.id, 1)}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="add" size={16} color="#14b8a6" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}

                {/* Overhead Storage with +/- */}
                <Text style={styles.subSectionLabel}>Overhead Storage</Text>
                {OVERHEAD_STORAGE.map((item) => {
                  const existing = productSelections.overheadStorage.find(
                    (s) => s.id === item.id,
                  );
                  const qty = existing?.qty || 0;
                  return (
                    <View key={item.id} style={styles.qtyRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.qtyItemName}>{item.name}</Text>
                        <Text style={styles.qtyItemDims}>
                          {item.dims} - ${item.cost}
                        </Text>
                      </View>
                      <View style={styles.qtyControls}>
                        <TouchableOpacity
                          style={styles.qtyBtnMinus}
                          onPress={() => updateOverheadQty(item.id, -1)}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="remove" size={16} color="#8b9bb5" />
                        </TouchableOpacity>
                        <Text style={styles.qtyValue}>{qty}</Text>
                        <TouchableOpacity
                          style={styles.qtyBtnPlus}
                          onPress={() => updateOverheadQty(item.id, 1)}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="add" size={16} color="#14b8a6" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}

                {/* ── Add-Ons ── */}
                <Text style={styles.formSectionTitle}>Add-Ons</Text>

                {/* Extra Haul-Aways */}
                <Text style={styles.subSectionLabel}>Extra Haul-Aways</Text>
                <Text style={styles.hintText}>$300 per additional truck bed</Text>
                <View style={styles.qtyRow}>
                  <View style={styles.qtyControls}>
                    <TouchableOpacity
                      style={styles.qtyBtnMinus}
                      onPress={() =>
                        setProductSelections((p) => ({
                          ...p,
                          extraHaulAways: Math.max(0, p.extraHaulAways - 1),
                        }))
                      }
                      activeOpacity={0.7}
                    >
                      <Ionicons name="remove" size={16} color="#8b9bb5" />
                    </TouchableOpacity>
                    <Text style={styles.qtyValue}>{productSelections.extraHaulAways}</Text>
                    <TouchableOpacity
                      style={styles.qtyBtnPlus}
                      onPress={() =>
                        setProductSelections((p) => ({
                          ...p,
                          extraHaulAways: p.extraHaulAways + 1,
                        }))
                      }
                      activeOpacity={0.7}
                    >
                      <Ionicons name="add" size={16} color="#14b8a6" />
                    </TouchableOpacity>
                    {productSelections.extraHaulAways > 0 ? (
                      <Text style={styles.qtyItemDims}>
                        = ${productSelections.extraHaulAways * 300}
                      </Text>
                    ) : null}
                  </View>
                </View>

                {/* Flooring */}
                <FormSelect
                  label="Flooring"
                  value={productSelections.flooringId}
                  onValueChange={(v) =>
                    setProductSelections((p) => ({ ...p, flooringId: v }))
                  }
                  options={flooringOptions}
                />

                {/* Extra Bin Packs */}
                <Text style={styles.subSectionLabel}>Extra Bin Packs</Text>
                <Text style={styles.hintText}>Greenmade 27-Gallon 8-Pack</Text>
                <View style={styles.qtyRow}>
                  <View style={styles.qtyControls}>
                    <TouchableOpacity
                      style={styles.qtyBtnMinus}
                      onPress={() =>
                        setProductSelections((p) => ({
                          ...p,
                          extraBinPacks: Math.max(0, p.extraBinPacks - 1),
                        }))
                      }
                      activeOpacity={0.7}
                    >
                      <Ionicons name="remove" size={16} color="#8b9bb5" />
                    </TouchableOpacity>
                    <Text style={styles.qtyValue}>{productSelections.extraBinPacks}</Text>
                    <TouchableOpacity
                      style={styles.qtyBtnPlus}
                      onPress={() =>
                        setProductSelections((p) => ({
                          ...p,
                          extraBinPacks: p.extraBinPacks + 1,
                        }))
                      }
                      activeOpacity={0.7}
                    >
                      <Ionicons name="add" size={16} color="#14b8a6" />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Additional Notes */}
                <FormInput
                  label="Additional Notes"
                  value={productSelections.notes}
                  onChangeText={(t) =>
                    setProductSelections((p) => ({ ...p, notes: t.slice(0, 300) }))
                  }
                  placeholder="Extra details about products or install preferences..."
                  multiline
                  numberOfLines={3}
                />

                {/* ── Gym Equipment ── */}
                {showGymSection && (
                  <>
                    <Text style={styles.formSectionTitle}>Gym Equipment</Text>
                    <Text style={styles.hintText}>
                      Select equipment for assembly. Cable systems (ARES, Athena, Slinger) include detailed routing instructions in the SOP.
                    </Text>

                    {/* Catalog equipment with qty controls */}
                    {GYM_EQUIPMENT_CATEGORIES.map((cat) => {
                      const items = GYM_EQUIPMENT_CATALOG.filter(
                        (e) => e.category === cat.value && e.id !== "gym-custom",
                      );
                      if (items.length === 0) return null;
                      return (
                        <View key={cat.value}>
                          <Text style={styles.subSectionLabel}>{cat.label}</Text>
                          {items.map((equip) => {
                            const existing = productSelections.gymEquipment.find(
                              (g) => g.id === equip.id,
                            );
                            const qty = existing?.qty || 0;
                            return (
                              <View key={equip.id} style={styles.qtyRow}>
                                <View style={{ flex: 1 }}>
                                  <Text style={styles.qtyItemName}>
                                    {equip.name}
                                    {equip.brand !== "other" ? ` (${equip.brand === "rep" ? "Rep" : "Rogue"})` : ""}
                                  </Text>
                                  <Text style={styles.qtyItemDims}>
                                    {equip.dims} — {equip.assemblyTime}
                                  </Text>
                                </View>
                                <View style={styles.qtyControls}>
                                  <TouchableOpacity
                                    style={styles.qtyBtnMinus}
                                    onPress={() => updateGymEquipmentQty(equip.id, -1)}
                                    activeOpacity={0.7}
                                  >
                                    <Ionicons name="remove" size={16} color="#8b9bb5" />
                                  </TouchableOpacity>
                                  <Text style={styles.qtyValue}>{qty}</Text>
                                  <TouchableOpacity
                                    style={styles.qtyBtnPlus}
                                    onPress={() => updateGymEquipmentQty(equip.id, 1)}
                                    activeOpacity={0.7}
                                  >
                                    <Ionicons name="add" size={16} color="#14b8a6" />
                                  </TouchableOpacity>
                                </View>
                              </View>
                            );
                          })}
                        </View>
                      );
                    })}

                    {/* Custom equipment entries */}
                    {productSelections.gymEquipment
                      .filter((g) => g.id.startsWith("custom-"))
                      .map((g) => (
                        <View key={g.id} style={styles.qtyRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.qtyItemName}>{g.customName || "Custom"}</Text>
                            <Text style={styles.qtyItemDims}>Customer-supplied — qty: {g.qty}</Text>
                          </View>
                          <TouchableOpacity
                            onPress={() => removeCustomEquipment(g.id)}
                            activeOpacity={0.7}
                          >
                            <Ionicons name="close-circle" size={22} color="#ef4444" />
                          </TouchableOpacity>
                        </View>
                      ))}

                    {/* Add custom equipment */}
                    <Text style={styles.subSectionLabel}>Add Custom Equipment</Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
                      <View style={{ flex: 1 }}>
                        <FormInput
                          label=""
                          value={customEquipmentName}
                          onChangeText={setCustomEquipmentName}
                          placeholder="e.g. Customer's Peloton Bike"
                        />
                      </View>
                      <TouchableOpacity
                        onPress={addCustomEquipment}
                        style={{
                          backgroundColor: customEquipmentName.trim() ? "#14b8a6" : "#2a3545",
                          paddingHorizontal: 12,
                          paddingVertical: 10,
                          borderRadius: 8,
                        }}
                        activeOpacity={0.7}
                        disabled={!customEquipmentName.trim()}
                      >
                        <Ionicons name="add" size={18} color="#fff" />
                      </TouchableOpacity>
                    </View>

                    {/* Gym Flooring */}
                    <FormSelect
                      label="Gym Flooring Type"
                      value={productSelections.gymFlooringType}
                      onValueChange={(v) =>
                        setProductSelections((p) => ({
                          ...p,
                          gymFlooringType: v as ProductSelections["gymFlooringType"],
                        }))
                      }
                      options={[
                        { label: "None", value: "none" },
                        { label: "Rubber Stall Mats (3/4\")", value: "stall-mats" },
                        { label: "Click-In Plate Flooring", value: "click-in" },
                        { label: "Polyaspartic Floor Coating", value: "polyaspartic" },
                      ]}
                    />

                    {/* Gym Notes */}
                    <FormInput
                      label="Gym Notes"
                      value={productSelections.gymNotes}
                      onChangeText={(t) =>
                        setProductSelections((p) => ({ ...p, gymNotes: t.slice(0, 500) }))
                      }
                      placeholder="e.g. Customer already has barbell, needs Olympic platform, wall-mount storage for bands..."
                      multiline
                      numberOfLines={3}
                    />
                  </>
                )}

                {/* ── Additional Information ── */}
                <Text style={styles.formSectionTitle}>Additional Information</Text>

                <FormInput
                  label="Access Instructions"
                  value={convertFormData.accessInstructions}
                  onChangeText={(t) =>
                    setConvertFormData((p) => ({ ...p, accessInstructions: t }))
                  }
                  placeholder="Gate code: 1234, Key under mat, Client will be home"
                  multiline
                  numberOfLines={3}
                />

                <FormSelect
                  label="Resale Concierge?"
                  value={convertFormData.resaleConcierge}
                  onValueChange={(v) =>
                    setConvertFormData((p) => ({
                      ...p,
                      resaleConcierge: v as "yes" | "no",
                    }))
                  }
                  options={[
                    { label: "No", value: "no" },
                    { label: "Yes", value: "yes" },
                  ]}
                />
                <Text style={styles.hintText}>
                  50/50 split + listing management -- included in all tiers
                </Text>

                <FormSelect
                  label="Donation Items?"
                  value={convertFormData.donationOptIn}
                  onValueChange={(v) =>
                    setConvertFormData((p) => ({
                      ...p,
                      donationOptIn: v as "yes" | "no",
                    }))
                  }
                  options={[
                    { label: "No", value: "no" },
                    { label: "Yes", value: "yes" },
                  ]}
                />
                <Text style={styles.hintText}>
                  Drop-off at donation center -- no extra charge
                </Text>
              </View>
            </ScrollView>

            {/* Submit Buttons */}
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.footerBtnSecondary, { flex: 1 }]}
                onPress={() => {
                  setConvertingLead(null);
                  setSopError(null);
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.footerBtnSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.footerBtnInvoice,
                  { flex: 1 },
                  (invoiceSending || sopGenerating) && styles.btnDisabled,
                ]}
                onPress={handleSendInvoice}
                disabled={invoiceSending || sopGenerating}
                activeOpacity={0.7}
              >
                {invoiceSending ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <ActivityIndicator size="small" color="#fff" />
                    <Text style={styles.footerBtnInvoiceText}>Sending...</Text>
                  </View>
                ) : (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Ionicons name="receipt-outline" size={16} color="#fff" />
                    <Text style={styles.footerBtnInvoiceText}>Send Invoice</Text>
                  </View>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.footerBtnPrimary,
                  { flex: 1 },
                  (sopGenerating || busyId === convertingLead?.id) && styles.btnDisabled,
                ]}
                onPress={handleConvertSubmit}
                disabled={sopGenerating || busyId === convertingLead?.id}
                activeOpacity={0.7}
              >
                {sopGenerating ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <ActivityIndicator size="small" color="#fff" />
                    <Text style={styles.footerBtnPrimaryText}>Generating SOP...</Text>
                  </View>
                ) : (
                  <Text style={styles.footerBtnPrimaryText}>Generate SOP & Review</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ══════════════════════════════════════════════════ */}
      {/* SOP Review Modal                                   */}
      {/* ══════════════════════════════════════════════════ */}

      <Modal
        visible={!!sopReviewData}
        animationType="slide"
        transparent
        onRequestClose={handleSopCancel}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, isDesktop && styles.modalContentDesktop]}>
            <ScrollView showsVerticalScrollIndicator={Platform.OS === "web"}>
              {sopReviewData ? (
                <>
                  {/* SOP Header */}
                  <View style={styles.sopHeader}>
                    <View style={styles.sopHeaderTop}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.sopHeaderTitle}>SOP Review</Text>
                        <Text style={styles.sopHeaderSubtitle}>
                          Approve before publishing to scholars
                        </Text>
                      </View>
                      <TouchableOpacity onPress={handleSopCancel}>
                        <Ionicons name="close" size={24} color="#8b9bb5" />
                      </TouchableOpacity>
                    </View>

                    {/* Meta grid */}
                    <View style={styles.sopMetaGrid}>
                      <View style={styles.sopMetaItem}>
                        <Text style={styles.sopMetaLabel}>CLIENT</Text>
                        <Text style={styles.sopMetaValue} numberOfLines={1}>
                          {sopReviewData.clientName}
                        </Text>
                      </View>
                      <View style={styles.sopMetaItem}>
                        <Text style={styles.sopMetaLabel}>ADDRESS</Text>
                        <Text style={styles.sopMetaValue} numberOfLines={1}>
                          {sopReviewData.address}
                        </Text>
                      </View>
                      <View style={styles.sopMetaItem}>
                        <Text style={styles.sopMetaLabel}>PACKAGE</Text>
                        <Text style={styles.sopMetaValue}>
                          {PACKAGE_LABELS[sopReviewData.packageTier] || sopReviewData.packageTier}
                        </Text>
                      </View>
                      <View style={styles.sopMetaItem}>
                        <Text style={styles.sopMetaLabel}>DATE</Text>
                        <Text style={styles.sopMetaValue}>
                          {new Date(sopReviewData.date).toLocaleDateString()}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.modalBody}>
                    {/* Intake Photos Thumbnails */}
                    {sopReviewData.intakeImageUrls.length > 0 ? (
                      <View style={{ marginBottom: 16 }}>
                        <Text style={styles.subSectionLabel}>Intake Photos Used</Text>
                        <ScrollView
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          style={{ marginTop: 8 }}
                        >
                          {sopReviewData.intakeImageUrls.map((url, i) => (
                            <Image
                              key={i}
                              source={{ uri: url }}
                              style={styles.sopIntakeThumb}
                              resizeMode="cover"
                            />
                          ))}
                        </ScrollView>
                      </View>
                    ) : null}

                    {/* Edit toggle */}
                    <View style={styles.sopEditToggleRow}>
                      <Text style={styles.sopBodyTitle}>Generated SOP</Text>
                      <TouchableOpacity
                        onPress={() => {
                          if (!sopEditMode) setSopEditText(sopReviewData.sopText);
                          setSopEditMode(!sopEditMode);
                        }}
                        style={styles.sopEditToggleBtn}
                        activeOpacity={0.7}
                      >
                        <Ionicons
                          name={sopEditMode ? "eye-outline" : "create-outline"}
                          size={14}
                          color="#60a5fa"
                        />
                        <Text style={styles.sopEditToggleText}>
                          {sopEditMode ? "Preview Mode" : "Edit Mode"}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {sopEditMode ? (
                      <TextInput
                        style={styles.sopTextEditor}
                        value={sopEditText}
                        onChangeText={setSopEditText}
                        multiline
                        textAlignVertical="top"
                      />
                    ) : (
                      <View>
                        {parseSopSections(sopReviewData.sopText).length > 0 ? (
                          parseSopSections(sopReviewData.sopText).map((section, idx) => (
                            <View key={idx} style={styles.sopAccordion}>
                              <TouchableOpacity
                                style={styles.sopAccordionHeader}
                                onPress={() => toggleSection(idx)}
                                activeOpacity={0.7}
                              >
                                <Text style={styles.sopAccordionTitle}>{section.title}</Text>
                                <Ionicons
                                  name={
                                    expandedSections.has(idx) ? "chevron-up" : "chevron-down"
                                  }
                                  size={16}
                                  color="#8b9bb5"
                                />
                              </TouchableOpacity>
                              {expandedSections.has(idx) ? (
                                <View style={styles.sopAccordionBody}>
                                  <Text style={styles.sopAccordionText}>{section.body}</Text>
                                </View>
                              ) : null}
                            </View>
                          ))
                        ) : (
                          <View style={styles.sopFallback}>
                            <Text style={styles.sopFallbackText}>
                              {sopReviewData.sopText}
                            </Text>
                          </View>
                        )}
                      </View>
                    )}

                    {/* Regenerate with notes */}
                    <View style={styles.sopRegenerateSection}>
                      <Text style={styles.subSectionLabel}>
                        Admin Notes for Regeneration (optional)
                      </Text>
                      <TextInput
                        style={styles.sopRegenerateInput}
                        value={sopRegenerateNotes}
                        onChangeText={setSopRegenerateNotes}
                        placeholder="e.g. Emphasize wall-mounted storage, skip floor coating details"
                        placeholderTextColor="#475569"
                        multiline
                        numberOfLines={2}
                      />
                    </View>
                  </View>
                </>
              ) : null}
            </ScrollView>

            {/* Footer Actions */}
            <View style={styles.sopFooter}>
              <TouchableOpacity
                style={styles.sopFooterBtnCancel}
                onPress={handleSopCancel}
                activeOpacity={0.7}
              >
                <Ionicons name="close-circle-outline" size={16} color="#8b9bb5" />
                <Text style={styles.sopFooterBtnCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.sopFooterBtnRegen, sopRegenerating && styles.btnDisabled]}
                onPress={handleSopRegenerate}
                disabled={sopRegenerating}
                activeOpacity={0.7}
              >
                {sopRegenerating ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="refresh-outline" size={16} color="#fff" />
                )}
                <Text style={styles.sopFooterBtnRegenText}>
                  {sopRegenerating ? "Regenerating..." : "Edit & Regenerate"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.sopFooterBtnApprove, sopApproving && styles.btnDisabled]}
                onPress={handleSopApprove}
                disabled={sopApproving}
                activeOpacity={0.7}
              >
                {sopApproving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="checkmark-circle-outline" size={16} color="#fff" />
                )}
                <Text style={styles.sopFooterBtnApproveText}>
                  {sopApproving ? "Publishing..." : "Approve & Publish"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ══════════════════════════════════════════════════ */}
      {/* Disqualify Confirmation Modal                      */}
      {/* ══════════════════════════════════════════════════ */}

      <Modal
        visible={!!disqualifyConfirmId}
        animationType="fade"
        transparent
        onRequestClose={() => setDisqualifyConfirmId(null)}
      >
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>Disqualify Lead?</Text>
            <Text style={styles.confirmMessage}>
              This will mark the lead as cancelled. This action cannot be undone.
            </Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={styles.confirmBtnCancel}
                onPress={() => setDisqualifyConfirmId(null)}
                activeOpacity={0.7}
              >
                <Text style={styles.confirmBtnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmBtnDanger}
                onPress={() => {
                  if (disqualifyConfirmId) handleDisqualify(disqualifyConfirmId);
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.confirmBtnDangerText}>Disqualify</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </AdminPageWrapper>
  );
}

// ══════════════════════════════════════════════════
// Styles
// ══════════════════════════════════════════════════

const styles = StyleSheet.create({
  // ── Header ──
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#f1f5f9",
  },
  pageSubtitle: {
    fontSize: 13,
    color: "#5a6a80",
    marginTop: 2,
  },

  // ── Error / Warning ──
  errorBanner: {
    backgroundColor: "#1c1017",
    borderWidth: 1,
    borderColor: "#7f1d1d",
    borderRadius: 10,
    padding: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 13,
    color: "#fca5a5",
    flex: 1,
  },
  warningBanner: {
    backgroundColor: "#1a1708",
    borderWidth: 1,
    borderColor: "#854d0e",
    borderRadius: 10,
    padding: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 12,
  },
  warningText: {
    fontSize: 13,
    color: "#fbbf24",
    flex: 1,
  },

  // ── Summary Cards ──
  summaryRow: {
    flexDirection: "column",
    gap: 10,
    marginBottom: 20,
  },
  summaryRowDesktop: {
    flexDirection: "row",
  },
  summaryCard: {
    backgroundColor: "#1a2332",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#2a3545",
  },
  summaryCardDesktop: {
    flex: 1,
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#5a6a80",
    letterSpacing: 0.8,
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: "800",
    marginTop: 6,
    color: "#f1f5f9",
  },

  // ── Lead Cards ──
  leadCard: {
    backgroundColor: "#1a2332",
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#2a3545",
  },
  leadCardDesktop: {
    padding: 20,
  },
  leadCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  leadName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#f1f5f9",
  },
  leadDate: {
    fontSize: 11,
    color: "#5a6a80",
  },
  leadMeta: {
    fontSize: 12,
    color: "#8b9bb5",
    marginLeft: 4,
  },
  leadMetaSmall: {
    fontSize: 11,
    color: "#5a6a80",
    marginTop: 4,
  },
  inlineRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  contactRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 8,
  },
  serviceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  serviceType: {
    fontSize: 13,
    fontWeight: "600",
    color: "#cbd5e1",
  },
  packageBadge: {
    backgroundColor: "#14b8a620",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  packageBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#14b8a6",
  },
  noPackageText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#f59e0b",
  },

  // ── Action Buttons ──
  actionRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#253448",
  },
  btnView: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: "#2a3545",
    borderRadius: 8,
  },
  btnViewText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#e2e8f0",
  },
  btnPublish: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: "#059669",
    borderRadius: 8,
  },
  btnPublishText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#fff",
  },
  btnDisqualify: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: "#1a2332",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#2a3545",
  },
  btnDisqualifyText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#8b9bb5",
  },
  btnDisabled: {
    opacity: 0.5,
  },

  // ── Empty State ──
  emptyState: {
    alignItems: "center",
    paddingVertical: 48,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#5a6a80",
  },
  emptySubtitle: {
    fontSize: 13,
    color: "#475569",
    textAlign: "center",
  },

  // ── Skeleton ──
  skeleton: {
    backgroundColor: "#253448",
    borderRadius: 6,
  },

  // ══════════════════════════════════════════════════
  // Modals (shared)
  // ══════════════════════════════════════════════════
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalContent: {
    backgroundColor: "#0a0f1a",
    borderRadius: 16,
    width: "100%",
    maxHeight: "95%",
    borderWidth: 1,
    borderColor: "#2a3545",
    overflow: "hidden",
  },
  modalContentDesktop: {
    maxWidth: 800,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#1a2332",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#f1f5f9",
  },
  modalSubtitle: {
    fontSize: 13,
    color: "#5a6a80",
    marginTop: 4,
  },
  modalBody: {
    padding: 20,
  },
  modalFooter: {
    flexDirection: "row",
    gap: 10,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#1a2332",
  },

  footerBtnSecondary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
    paddingHorizontal: 20,
    backgroundColor: "#1a2332",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2a3545",
  },
  footerBtnSecondaryText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#f1f5f9",
  },
  footerBtnInvoice: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: "#6366f1",
    borderRadius: 12,
  },
  footerBtnInvoiceText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
  },
  footerBtnPrimary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
    paddingHorizontal: 20,
    backgroundColor: "#059669",
    borderRadius: 12,
  },
  footerBtnPrimaryText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
  },

  // ── Detail Modal Specifics ──
  sectionHeader: {
    fontSize: 11,
    fontWeight: "800",
    color: "#5a6a80",
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#1a2332",
  },
  detailLabel: {
    fontSize: 14,
    color: "#8b9bb5",
    fontWeight: "600",
  },
  detailValue: {
    fontSize: 14,
    color: "#f1f5f9",
    fontWeight: "500",
    maxWidth: "60%",
    textAlign: "right",
  } as any,
  descriptionText: {
    fontSize: 14,
    color: "#cbd5e1",
    lineHeight: 20,
  },
  photoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 8,
  },
  photoThumb: {
    width: 140,
    height: 100,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#2a3545",
  },

  // ── Convert Form Specifics ──
  formSectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#f1f5f9",
    marginTop: 20,
    marginBottom: 14,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#253448",
  },
  subSectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#8b9bb5",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: 10,
  },
  packageHint: {
    fontSize: 12,
    color: "#475569",
    marginTop: -8,
    marginBottom: 8,
  },
  charCount: {
    fontSize: 11,
    color: "#475569",
    textAlign: "right",
    marginTop: -10,
    marginBottom: 8,
  },
  hintText: {
    fontSize: 11,
    color: "#475569",
    marginTop: -4,
    marginBottom: 8,
  },
  rowFields: {
    flexDirection: "column",
    gap: 0,
  },
  rowFieldsDesktop: {
    flexDirection: "row",
    gap: 12,
  },
  fieldHalf: {
    flex: 1,
  },

  // ── Quantity controls ──
  qtyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#162032",
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#253448",
  },
  qtyItemName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#e2e8f0",
  },
  qtyItemDims: {
    fontSize: 11,
    color: "#5a6a80",
    marginTop: 2,
  },
  qtyControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  qtyBtnMinus: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#253448",
    alignItems: "center",
    justifyContent: "center",
  },
  qtyBtnPlus: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#14b8a620",
    alignItems: "center",
    justifyContent: "center",
  },
  qtyValue: {
    width: 28,
    textAlign: "center",
    fontSize: 16,
    fontWeight: "800",
    color: "#f1f5f9",
  },

  // ══════════════════════════════════════════════════
  // SOP Review Modal
  // ══════════════════════════════════════════════════
  sopHeader: {
    backgroundColor: "#1a2332",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#2a3545",
  },
  sopHeaderTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  sopHeaderTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#f1f5f9",
  },
  sopHeaderSubtitle: {
    fontSize: 13,
    color: "#8b9bb5",
    marginTop: 4,
  },
  sopMetaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  sopMetaItem: {
    minWidth: 100,
    flex: 1,
  },
  sopMetaLabel: {
    fontSize: 9,
    fontWeight: "800",
    color: "#5a6a80",
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  sopMetaValue: {
    fontSize: 13,
    fontWeight: "700",
    color: "#f1f5f9",
  },
  sopIntakeThumb: {
    width: 96,
    height: 64,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#2a3545",
    marginRight: 8,
  },

  // ── Edit toggle ──
  sopEditToggleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sopBodyTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#f1f5f9",
  },
  sopEditToggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  sopEditToggleText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#60a5fa",
  },

  // ── SOP text editor ──
  sopTextEditor: {
    backgroundColor: "#162032",
    borderWidth: 1,
    borderColor: "#2a3545",
    borderRadius: 10,
    padding: 16,
    color: "#e2e8f0",
    fontSize: 13,
    fontFamily: Platform.OS === "web" ? "monospace" : undefined,
    minHeight: 400,
    textAlignVertical: "top",
  },

  // ── Accordion sections ──
  sopAccordion: {
    borderWidth: 1,
    borderColor: "#253448",
    borderRadius: 10,
    marginBottom: 8,
    overflow: "hidden",
  },
  sopAccordionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 14,
    backgroundColor: "#162032",
  },
  sopAccordionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#e2e8f0",
    flex: 1,
  },
  sopAccordionBody: {
    padding: 14,
    paddingTop: 0,
    backgroundColor: "#0a0f1a",
  },
  sopAccordionText: {
    fontSize: 13,
    color: "#8b9bb5",
    lineHeight: 20,
  },
  sopFallback: {
    backgroundColor: "#162032",
    borderRadius: 10,
    padding: 14,
  },
  sopFallbackText: {
    fontSize: 13,
    color: "#8b9bb5",
    lineHeight: 20,
  },

  // ── Regenerate section ──
  sopRegenerateSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#253448",
  },
  sopRegenerateInput: {
    backgroundColor: "#162032",
    borderWidth: 1,
    borderColor: "#2a3545",
    borderRadius: 10,
    padding: 12,
    color: "#e2e8f0",
    fontSize: 13,
    minHeight: 60,
    marginTop: 8,
    textAlignVertical: "top",
  },

  // ── SOP Footer ──
  sopFooter: {
    flexDirection: "row",
    gap: 8,
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: "#1a2332",
    backgroundColor: "#0a0f1a",
  },
  sopFooterBtnCancel: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: "#1a2332",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2a3545",
  },
  sopFooterBtnCancelText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#8b9bb5",
  },
  sopFooterBtnRegen: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: "#d97706",
    borderRadius: 12,
  },
  sopFooterBtnRegenText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#fff",
  },
  sopFooterBtnApprove: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: "#059669",
    borderRadius: 12,
  },
  sopFooterBtnApproveText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#fff",
  },

  // ══════════════════════════════════════════════════
  // Disqualify Confirmation
  // ══════════════════════════════════════════════════
  confirmOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  confirmCard: {
    backgroundColor: "#1a2332",
    borderRadius: 16,
    padding: 24,
    width: "100%",
    maxWidth: 360,
    borderWidth: 1,
    borderColor: "#2a3545",
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#f1f5f9",
    marginBottom: 8,
  },
  confirmMessage: {
    fontSize: 14,
    color: "#8b9bb5",
    lineHeight: 20,
    marginBottom: 24,
  },
  confirmActions: {
    flexDirection: "row",
    gap: 10,
  },
  confirmBtnCancel: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    backgroundColor: "#253448",
    borderRadius: 12,
  },
  confirmBtnCancelText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#f1f5f9",
  },
  confirmBtnDanger: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    backgroundColor: "#dc2626",
    borderRadius: 12,
  },
  confirmBtnDangerText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#fff",
  },
});
