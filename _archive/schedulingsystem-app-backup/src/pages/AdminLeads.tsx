import React, { useEffect, useState } from "react";
import { collection, onSnapshot, query, where, orderBy, updateDoc, doc, serverTimestamp } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { useNavigate } from "react-router-dom";
import { db, functions } from "../firebase";
import { Job, JobStatus, Task } from "../../types";
import { useAuth } from "../auth/AuthProvider";
import { COLLECTIONS } from "../collections";
import { ArrowLeft, Phone, Mail, MapPin, Loader2, AlertTriangle, CheckCircle, XCircle, ChevronDown, ChevronUp, Edit3, RotateCcw, Plus, Minus } from "lucide-react";

// ── Package tier descriptions (from pricing spreadsheet) ──
const PACKAGE_DESCRIPTIONS: { [key: string]: string } = {
  undergraduate: "The Undergrad ($1,197) — Surface Reset & De-Clutter. 2 Scholars, 4-5 hours. Up to 1 truck bed haul-away. Broad sorting (Keep/Donate/Trash). 1 zone / 1 shelf included. Sweep & blow clean.",
  graduate: "The Graduate ($2,197) — Full Organization Logic & Install. 2 Scholars, 6-8 hours. Up to 1 truck bed haul-away. Micro-sorting (Sports/Tools/Holiday). $300 credit towards storage & shelving. 8 standard bins included. Deep degrease & floor powerwash.",
  doctorate: "The Doctorate ($3,797) — White-Glove Detail. 3 Scholars, 1 full day. Up to 2 truck bed haul-away. $500 credit towards storage & shelving. 16 premium bins included. Deep degrease & floor powerwash. Seasonal swap (1 return visit)."
};

// ── Product Catalog (from garage_scholars_pricing_v2.xlsx) ──

const BOLD_SERIES_SETS = [
  { id: "bold-3pc-wall", name: "3-Pc Wall Cabinets", dims: '96"W x 20"H x 12"D', model: "50653", retail: 380 },
  { id: "bold-6pc-wall", name: "6-Pc Wall Cabinets", dims: '192"W x 19.58"H x 12"D', model: "50659", retail: 600 },
  { id: "bold-2pc-system", name: "2-Piece System", dims: '104"W x 77"H x 18"D', model: "50500", retail: 1400 },
  { id: "bold-3pc-system", name: "3-Piece System", dims: '108"W x 76.75"H x 18"D', model: "50670", retail: 1280 },
  { id: "bold-4pc-bamboo", name: "4-Pc Bamboo Top", dims: '92"W x 76.75"H x 18"D', model: "73501", retail: 1340 },
  { id: "bold-4pc-stainless", name: "4-Pc Stainless Top", dims: '92"W x 76.75"H x 18"D', model: "73505", retail: 1430 },
  { id: "bold-5pc-bamboo", name: "5-Pc Bamboo Top", dims: '120"W x 76.75"H x 18"D', model: "73509", retail: 1987 },
  { id: "bold-5pc-stainless", name: "5-Pc Stainless Top", dims: '120"W x 76.75"H x 18"D', model: "73513", retail: 2140 },
  { id: "bold-6pc-system", name: "6-Piece System", dims: '144"W x 76.75"H x 18"D', model: "50502", retail: 2150 },
  { id: "bold-7pc-system", name: "7-Piece System", dims: '108"W x 76.75"H x 18"D', model: "50421", retail: 1680 },
  { id: "bold-7pc-extended", name: "7-Piece Extended", dims: '174"W x 77"H x 18"D', model: "50506", retail: 2530 },
  { id: "bold-8pc-system-a", name: "8-Piece System (A)", dims: '132"W x 77"H x 18"D', model: "50405", retail: 1850 },
  { id: "bold-8pc-system-b", name: "8-Piece System (B)", dims: '132"W x 76.75"H x 18"D', model: "50462", retail: 2200 },
  { id: "bold-9pc-system", name: "9-Piece System", dims: '132"W x 77"H x 18"D', model: "50408", retail: 1950 },
  { id: "bold-9pc-platinum", name: "9-Piece Platinum", dims: '132"W x 76.75"H x 18"D', model: "54992", retail: 1950 },
];

const STANDARD_SHELVING = [
  { id: "shelf-5tier-48w", name: '5-Tier Metal Shelving', dims: '72"H x 48"W x 24"D', cost: 122 },
  { id: "shelf-4tier-60w", name: '4-Tier Metal Shelving', dims: '72"H x 60"W x 18"D', cost: 175 },
];

const OVERHEAD_STORAGE = [
  { id: "overhead-32d", name: 'Overhead Rack — 32"D', dims: '97.5"W x 43.75"H x 32"D', cost: 169 },
  { id: "overhead-48d", name: 'Overhead Rack — 48"D', dims: '97.5"W x 43.75"H x 48"D', cost: 219 },
  { id: "overhead-bin-rack", name: "Six Bin Rack (Ceiling Mounted)", dims: '3"W x 2"H x 26"D', cost: 168 },
];

const FLOORING_OPTIONS = [
  { id: "none", name: "None", price: 0 },
  { id: "click-in-1car", name: "Click-In Plate Flooring — 1-Car (~200 sq ft)", price: 1497 },
  { id: "click-in-2car", name: "Click-In Plate Flooring — 2-Car (~400 sq ft)", price: 2897 },
  { id: "click-in-3car", name: "Click-In Plate Flooring — 3-Car (~600 sq ft)", price: 4297 },
  { id: "polyaspartic-1car", name: "Polyaspartic Floor Coating — 1-Car (~200 sq ft)", price: 0 },
  { id: "polyaspartic-2car", name: "Polyaspartic Floor Coating — 2-Car (~400 sq ft)", price: 0 },
  { id: "polyaspartic-3car", name: "Polyaspartic Floor Coating — 3-Car (~600 sq ft)", price: 0 },
];

interface ProductSelections {
  boldSeriesId: string;
  standardShelving: { id: string; qty: number }[];
  overheadStorage: { id: string; qty: number }[];
  extraHaulAways: number;
  flooringId: string;
  extraBinPacks: number;
  notes: string;
}

const emptySelections: ProductSelections = {
  boldSeriesId: "",
  standardShelving: [],
  overheadStorage: [],
  extraHaulAways: 0,
  flooringId: "none",
  extraBinPacks: 0,
  notes: "",
};

/** Serialize structured selections into readable strings for Firestore / SOP prompt */
const serializeSelections = (sel: ProductSelections, packageTier: string) => {
  const parts: string[] = [];

  // Bold Series
  const bold = BOLD_SERIES_SETS.find((b) => b.id === sel.boldSeriesId);
  if (bold) {
    const credit = packageTier === "doctorate" ? 500 : packageTier === "graduate" ? 300 : 0;
    const clientPays = Math.max(0, bold.retail - credit);
    parts.push(`Bold Series ${bold.name} (${bold.dims}) — Retail $${bold.retail}${credit > 0 ? `, client pays $${clientPays} after $${credit} credit` : ""}`);
  }

  // Standard shelving
  sel.standardShelving.forEach((s) => {
    const item = STANDARD_SHELVING.find((x) => x.id === s.id);
    if (item) parts.push(`${s.qty}x ${item.name} (${item.dims})`);
  });

  // Overhead
  sel.overheadStorage.forEach((s) => {
    const item = OVERHEAD_STORAGE.find((x) => x.id === s.id);
    if (item) parts.push(`${s.qty}x ${item.name} (${item.dims})`);
  });

  const shelvingSelections = parts.length > 0 ? parts.join(" | ") : "None selected";

  // Add-ons
  const addOnParts: string[] = [];
  if (sel.extraHaulAways > 0) addOnParts.push(`${sel.extraHaulAways}x Extra Haul-Away ($${sel.extraHaulAways * 300})`);
  const flooring = FLOORING_OPTIONS.find((f) => f.id === sel.flooringId);
  if (flooring && flooring.id !== "none") {
    addOnParts.push(flooring.price > 0 ? `${flooring.name} ($${flooring.price})` : `${flooring.name} (Price TBD)`);
  }
  if (sel.extraBinPacks > 0) addOnParts.push(`${sel.extraBinPacks}x Extra Bin Pack (8 bins each)`);
  if (sel.notes.trim()) addOnParts.push(`Notes: ${sel.notes.trim()}`);

  const addOns = addOnParts.length > 0 ? addOnParts.join(" | ") : "None selected";

  return { shelvingSelections, addOns };
};

const packageLabels: { [key: string]: string } = {
  undergraduate: "Undergraduate",
  graduate: "Graduate",
  doctorate: "Doctorate"
};

// ── Package defaults from pricing spreadsheet ──
const PACKAGE_DEFAULTS: { [key: string]: { clientPrice: number; scholarPayout: number; estimatedHours: number } } = {
  undergraduate: { clientPrice: 1197, scholarPayout: 350, estimatedHours: 5 },
  graduate:      { clientPrice: 2197, scholarPayout: 600, estimatedHours: 7 },
  doctorate:     { clientPrice: 3797, scholarPayout: 875, estimatedHours: 8 },
};

const serviceTypeLabels: { [key: string]: string } = {
  "get-clean": "Get Clean",
  "get-organized": "Get Organized",
  "get-strong": "Get Strong",
  resale: "Resale Concierge"
};

// ── Parse Phase Sequence section into checklist items ──
const parsePhaseSequenceToChecklist = (sopText: string): Task[] => {
  const phaseMatch = sopText.match(/## 3\. PHASE SEQUENCE[\s\S]*?(?=## \d|$)/i);
  if (!phaseMatch) return [];
  const lines = phaseMatch[0].split("\n").filter((l) => /^\d+\.\s/.test(l.trim()));
  return lines.map((line, i) => ({
    id: `sop-phase-${i + 1}`,
    text: line.replace(/^\d+\.\s*/, "").trim(),
    isCompleted: false,
    status: "APPROVED" as const
  }));
};

const AdminLeads: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [leads, setLeads] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLead, setSelectedLead] = useState<Job | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Convert / Publish flow
  const [convertingLead, setConvertingLead] = useState<Job | null>(null);
  const [convertFormData, setConvertFormData] = useState({
    clientName: "",
    clientEmail: "",
    clientPhone: "",
    address: "",
    description: "",
    selectedPackage: "graduate" as string,
    estimatedHours: 7,
    scholarPayout: 600,
    clientPrice: 2197,
    scheduledDate: "",
    accessInstructions: "",
    resaleConcierge: "no" as "yes" | "no",
    donationOptIn: "no" as "yes" | "no",
  });
  const [productSelections, setProductSelections] = useState<ProductSelections>({ ...emptySelections });

  // SOP generation state
  const [sopGenerating, setSopGenerating] = useState(false);
  const [sopError, setSopError] = useState<string | null>(null);

  // SOP review modal state
  const [sopReviewData, setSopReviewData] = useState<{
    jobId: string;
    sopText: string;
    clientName: string;
    address: string;
    packageTier: string;
    date: string;
    intakeImageUrls: string[];
  } | null>(null);
  const [sopEditMode, setSopEditMode] = useState(false);
  const [sopEditText, setSopEditText] = useState("");
  const [sopRegenerateNotes, setSopRegenerateNotes] = useState("");
  const [sopApproving, setSopApproving] = useState(false);
  const [sopRegenerating, setSopRegenerating] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set([0, 1, 2, 3, 4, 5]));

  // ── Firestore subscription ──
  useEffect(() => {
    if (!db) {
      setError("Firestore not initialized.");
      setLoading(false);
      return;
    }

    const leadsQuery = query(
      collection(db, COLLECTIONS.JOBS),
      where("status", "==", JobStatus.LEAD),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(
      leadsQuery,
      (snapshot) => {
        const leadsList = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<Job, "id">)
        }));
        setLeads(leadsList);
        setError(null);
        setLoading(false);
      },
      (err) => {
        setError(err.message || "Failed to load leads.");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // ── Handlers ──

  const handlePublishToScholars = (lead: Job) => {
    setError(null);
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
    setProductSelections({ ...emptySelections });
  };

  const handleConvertFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setConvertFormData((prev) => ({
      ...prev,
      [name]: name === "estimatedHours" || name === "scholarPayout" || name === "clientPrice" ? parseFloat(value) || 0 : value
    }));
  };

  const handleConvertSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
      const endDateTime = new Date(scheduledDateTime.getTime() + convertFormData.estimatedHours * 60 * 60 * 1000);

      // Serialize structured product selections
      const { shelvingSelections, addOns } = serializeSelections(productSelections, convertFormData.selectedPackage);

      // Step 1: Update job document with form data + set status to SOP_NEEDS_REVIEW
      await updateDoc(doc(db, COLLECTIONS.JOBS, convertingLead.id), {
        title: convertFormData.clientName.trim(),
        clientName: convertFormData.clientName.trim(),
        clientEmail: convertFormData.clientEmail.trim(),
        clientPhone: convertFormData.clientPhone.trim(),
        address: convertFormData.address.trim(),
        description: convertFormData.description.trim(),
        scheduledDate: scheduledDateTime.toISOString(),
        scheduledTimeStart: scheduledDateTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
        scheduledTimeEnd: endDateTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
        payout: convertFormData.scholarPayout,
        clientPrice: convertFormData.clientPrice,
        status: JobStatus.SOP_NEEDS_REVIEW,
        lat: 0,
        lng: 0,
        urgencyLevel: 'standard',
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
        updatedAt: serverTimestamp()
      });

      // Step 2: Call Cloud Function to generate SOP
      const callable = httpsCallable(functions, "generateSopForJob", { timeout: 300000 });
      const result = await callable({ jobId: convertingLead.id });
      const data = result.data as { ok?: boolean; generatedSOP?: string };

      if (!data.ok || !data.generatedSOP) {
        throw new Error("SOP generation returned empty result.");
      }

      // Step 3: Open SOP Review Modal
      const intakeUrls = convertingLead.intakeMediaPaths || [];
      setSopReviewData({
        jobId: convertingLead.id,
        sopText: data.generatedSOP,
        clientName: convertFormData.clientName.trim(),
        address: convertFormData.address.trim(),
        packageTier: convertFormData.selectedPackage,
        date: scheduledDateTime.toISOString(),
        intakeImageUrls: intakeUrls
      });
      setSopEditText(data.generatedSOP);
      setConvertingLead(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to generate SOP.";
      setSopError(message);

      // Reset status back to LEAD on failure
      if (db && convertingLead) {
        await updateDoc(doc(db, COLLECTIONS.JOBS, convertingLead.id), {
          status: JobStatus.LEAD,
          updatedAt: serverTimestamp()
        }).catch(() => {});
      }
    } finally {
      setBusyId(null);
      setSopGenerating(false);
    }
  };

  const handleSopApprove = async () => {
    if (!db || !sopReviewData || !profile) return;
    setSopApproving(true);

    try {
      const finalSOP = sopEditMode ? sopEditText : sopReviewData.sopText;
      const checklist = parsePhaseSequenceToChecklist(finalSOP);

      // Map checklist to gs_jobs format
      const gsChecklist = (checklist.length > 0 ? checklist : [
        { id: "check-in", text: "Check in with photo of property exterior", isCompleted: false, status: "APPROVED" },
        { id: "check-out", text: "Take final photos and check out", isCompleted: false, status: "APPROVED" }
      ]).map(item => ({
        id: item.id,
        text: item.text,
        completed: false,
        approvalStatus: (item.status || 'APPROVED').toLowerCase()
      }));

      await updateDoc(doc(db, COLLECTIONS.JOBS, sopReviewData.jobId), {
        sopContent: finalSOP,
        generatedSOP: finalSOP,
        sopApprovedBy: profile.uid,
        sopApprovedAt: new Date().toISOString(),
        status: JobStatus.APPROVED_FOR_POSTING,
        checklist: gsChecklist,
        updatedAt: serverTimestamp()
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
  };

  const handleSopRegenerate = async () => {
    if (!functions || !sopReviewData) return;
    setSopRegenerating(true);

    try {
      const callable = httpsCallable(functions, "generateSopForJob", { timeout: 300000 });
      const result = await callable({
        jobId: sopReviewData.jobId,
        adminNotes: sopRegenerateNotes || undefined
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
  };

  const handleSopCancel = async () => {
    if (!db || !sopReviewData) return;

    try {
      await updateDoc(doc(db, COLLECTIONS.JOBS, sopReviewData.jobId), {
        status: JobStatus.LEAD,
        generatedSOP: null,
        updatedAt: serverTimestamp()
      });
    } catch {
      // Silently fail — worst case, admin can retry
    }

    setSopReviewData(null);
    setSopEditMode(false);
    setSopEditText("");
    setSopRegenerateNotes("");
  };

  const handleDisqualifyLead = async (leadId: string) => {
    if (!db || !confirm("Are you sure you want to disqualify this lead?")) return;
    setBusyId(leadId);
    try {
      await updateDoc(doc(db, COLLECTIONS.JOBS, leadId), {
        status: JobStatus.CANCELLED,
        cancellationReason: "Lead disqualified"
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to disqualify lead.";
      setError(message);
    } finally {
      setBusyId(null);
    }
  };

  const toggleSection = (idx: number) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  // ── Parse SOP markdown into sections ──
  const parseSopSections = (text: string): { title: string; body: string }[] => {
    const parts = text.split(/^(## \d+\..+)$/m);
    const sections: { title: string; body: string }[] = [];
    for (let i = 1; i < parts.length; i += 2) {
      sections.push({
        title: parts[i].replace(/^## /, "").trim(),
        body: (parts[i + 1] || "").trim()
      });
    }
    return sections;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-sm text-slate-500">Loading leads...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 page-enter">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-200 rounded-full">
              <ArrowLeft size={20} className="text-slate-600" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Leads Management</h1>
              <p className="text-sm text-slate-500">Quote requests from website visitors</p>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-lg p-4 flex items-start gap-2">
            <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="text-xs font-semibold text-slate-500 uppercase mb-1">Total Leads</div>
            <div className="text-2xl font-bold text-blue-600">{leads.length}</div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="text-xs font-semibold text-slate-500 uppercase mb-1">New Today</div>
            <div className="text-2xl font-bold text-emerald-600">
              {leads.filter((l) => {
                const createdAt = l.createdAt?.toDate ? l.createdAt.toDate() : new Date(l.createdAt);
                const today = new Date();
                return createdAt.toDateString() === today.toDateString();
              }).length}
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="text-xs font-semibold text-slate-500 uppercase mb-1">This Week</div>
            <div className="text-2xl font-bold text-slate-800">
              {leads.filter((l) => {
                const createdAt = l.createdAt?.toDate ? l.createdAt.toDate() : new Date(l.createdAt);
                const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
                return createdAt >= weekAgo;
              }).length}
            </div>
          </div>
        </div>

        {/* Leads Table */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Lead Info</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Contact</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Service Details</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Submitted</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {leads.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">
                      No leads found. New quote requests will appear here.
                    </td>
                  </tr>
                ) : (
                  leads.map((lead) => (
                    <tr key={lead.id} className="hover:bg-slate-50">
                      <td className="px-4 py-4">
                        <div className="space-y-1">
                          <div className="font-semibold text-slate-800">{lead.clientName}</div>
                          <div className="text-xs text-slate-500 flex items-center gap-1">
                            <MapPin size={12} />
                            {lead.zipcode || lead.address}
                          </div>
                          {lead.garageSize && <div className="text-xs text-slate-500">Size: {lead.garageSize}</div>}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="space-y-1 text-sm">
                          {lead.clientEmail && (
                            <div className="flex items-center gap-2 text-slate-600">
                              <Mail size={14} />
                              <a href={`mailto:${lead.clientEmail}`} className="hover:text-blue-600">{lead.clientEmail}</a>
                            </div>
                          )}
                          {lead.clientPhone && (
                            <div className="flex items-center gap-2 text-slate-600">
                              <Phone size={14} />
                              <a href={`tel:${lead.clientPhone}`} className="hover:text-blue-600">{lead.clientPhone}</a>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="space-y-1">
                          <div className="text-sm font-medium text-slate-700">
                            {lead.serviceType ? serviceTypeLabels[lead.serviceType] || lead.serviceType : "N/A"}
                          </div>
                          <div className="text-xs text-slate-500">
                            Package: {lead.package ? packageLabels[lead.package] || lead.package : "N/A"}
                          </div>
                          {!lead.package && (
                            <div className="text-xs text-amber-600 font-medium">No package set</div>
                          )}
                          {lead.description && (
                            <div className="text-xs text-slate-500 mt-2 max-w-xs truncate">{lead.description}</div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-sm text-slate-600">
                          {lead.createdAt ? formatDate(lead.createdAt.toDate ? lead.createdAt.toDate().toISOString() : lead.createdAt) : "N/A"}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex gap-2">
                          <button
                            onClick={() => setSelectedLead(lead)}
                            className="text-sm px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                          >
                            View
                          </button>
                          <button
                            onClick={() => handlePublishToScholars(lead)}
                            disabled={busyId === lead.id}
                            className="text-sm px-3 py-1 bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50"
                          >
                            {busyId === lead.id ? "..." : "Publish"}
                          </button>
                          <button
                            onClick={() => handleDisqualifyLead(lead.id)}
                            disabled={busyId === lead.id}
                            className="text-sm px-3 py-1 bg-slate-200 text-slate-700 rounded hover:bg-slate-300 disabled:opacity-50"
                          >
                            Disqualify
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════ */}
      {/* Lead Detail Modal                                  */}
      {/* ══════════════════════════════════════════════════ */}
      {selectedLead && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-slate-800">Lead Details</h2>
                <button onClick={() => setSelectedLead(null)} className="text-slate-400 hover:text-slate-600">
                  ✕
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-500 uppercase mb-2">Contact Information</h3>
                <div className="space-y-2 text-slate-800">
                  <div><span className="font-medium text-slate-900">Name:</span> {selectedLead.clientName}</div>
                  <div><span className="font-medium text-slate-900">Email:</span> {selectedLead.clientEmail}</div>
                  <div><span className="font-medium text-slate-900">Phone:</span> {selectedLead.clientPhone}</div>
                  <div><span className="font-medium text-slate-900">ZIP Code:</span> {selectedLead.zipcode}</div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-slate-500 uppercase mb-2">Service Details</h3>
                <div className="space-y-2 text-slate-800">
                  <div><span className="font-medium text-slate-900">Service:</span> {selectedLead.serviceType ? serviceTypeLabels[selectedLead.serviceType] || selectedLead.serviceType : "N/A"}</div>
                  <div><span className="font-medium text-slate-900">Package:</span> {selectedLead.package ? packageLabels[selectedLead.package] || selectedLead.package : "N/A"}</div>
                  {selectedLead.garageSize && <div><span className="font-medium text-slate-900">Garage Size:</span> {selectedLead.garageSize}</div>}
                </div>
              </div>

              {selectedLead.description && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-500 uppercase mb-2">Project Description</h3>
                  <p className="text-slate-700">{selectedLead.description}</p>
                </div>
              )}

              {selectedLead.intakeMediaPaths && selectedLead.intakeMediaPaths.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-500 uppercase mb-2">Photos ({selectedLead.intakeMediaPaths.length})</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {selectedLead.intakeMediaPaths.map((url, idx) => (
                      <a key={idx} href={url} target="_blank" rel="noopener noreferrer">
                        <img src={url} alt={`Photo ${idx + 1}`} className="w-full h-48 object-cover rounded border" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t flex gap-3 justify-end">
              <button onClick={() => setSelectedLead(null)} className="px-4 py-2 bg-slate-200 text-slate-700 rounded hover:bg-slate-300">
                Close
              </button>
              <button
                onClick={() => {
                  handlePublishToScholars(selectedLead);
                  setSelectedLead(null);
                }}
                className="px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700"
              >
                Publish to Scholars
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════ */}
      {/* Publish to Scholars Modal (Convert + Schedule)     */}
      {/* ══════════════════════════════════════════════════ */}
      {convertingLead && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-bold text-slate-800">Publish to Scholars</h2>
                  <p className="text-sm text-slate-500 mt-1">
                    Complete job details, then SOP will be auto-generated for your review
                  </p>
                </div>
                <button onClick={() => { setConvertingLead(null); setSopError(null); }} className="text-slate-400 hover:text-slate-600">
                  ✕
                </button>
              </div>
            </div>

            <form onSubmit={handleConvertSubmit} className="p-6 space-y-6">
              {(error || sopError) && (
                <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-3 flex items-start gap-2">
                  <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
                  <span>{sopError || error}</span>
                </div>
              )}

              {/* Warn if no intake photos */}
              {(!convertingLead.intakeMediaPaths || convertingLead.intakeMediaPaths.length === 0) && (
                <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
                  No intake photos attached to this lead. SOP will generate without photo analysis.
                </div>
              )}

              {/* Package Tier */}
              <div className="space-y-4">
                <h3 className="font-bold text-slate-800 text-lg border-b pb-2">Package Tier</h3>
                <div>
                  <label className="text-sm font-medium text-slate-600">Selected Package <span className="text-rose-500">*</span></label>
                  <select
                    name="selectedPackage"
                    value={convertFormData.selectedPackage}
                    onChange={(e) => {
                      const pkg = e.target.value;
                      const defaults = PACKAGE_DEFAULTS[pkg] || PACKAGE_DEFAULTS.graduate;
                      setConvertFormData((prev) => ({
                        ...prev,
                        selectedPackage: pkg,
                        clientPrice: defaults.clientPrice,
                        scholarPayout: defaults.scholarPayout,
                        estimatedHours: defaults.estimatedHours,
                      }));
                    }}
                    className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-slate-900"
                  >
                    <option value="undergraduate">Undergraduate — $1,197</option>
                    <option value="graduate">Graduate — $2,197</option>
                    <option value="doctorate">Doctorate — $3,797</option>
                  </select>
                  <p className="text-xs text-slate-400 mt-1">
                    {PACKAGE_DESCRIPTIONS[convertFormData.selectedPackage]?.split("—")[1]?.trim() || ""}
                  </p>
                </div>
              </div>

              {/* Client Information */}
              <div className="space-y-4">
                <h3 className="font-bold text-slate-800 text-lg border-b pb-2">Client Information</h3>
                <div>
                  <label className="text-sm font-medium text-slate-600">Client Name <span className="text-rose-500">*</span></label>
                  <input type="text" name="clientName" value={convertFormData.clientName} onChange={handleConvertFormChange} className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-slate-900" required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-slate-600">Client Email</label>
                    <input type="email" name="clientEmail" value={convertFormData.clientEmail} onChange={handleConvertFormChange} className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-slate-900" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-600">Client Phone</label>
                    <input type="tel" name="clientPhone" value={convertFormData.clientPhone} onChange={handleConvertFormChange} className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-slate-900" />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-600">Property Address <span className="text-rose-500">*</span></label>
                  <input type="text" name="address" value={convertFormData.address} onChange={handleConvertFormChange} className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-slate-900" placeholder="123 Main St, Denver, CO 80202" required />
                </div>
              </div>

              {/* Job Details */}
              <div className="space-y-4">
                <h3 className="font-bold text-slate-800 text-lg border-b pb-2">Job Details</h3>
                <div>
                  <label className="text-sm font-medium text-slate-600">Job Description</label>
                  <textarea name="description" value={convertFormData.description} onChange={handleConvertFormChange} className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 min-h-[100px] text-slate-900" maxLength={500} />
                  <p className="text-xs text-slate-400 mt-1">{convertFormData.description.length}/500 characters</p>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-medium text-slate-600">Estimated Hours</label>
                    <input type="number" name="estimatedHours" value={convertFormData.estimatedHours} onChange={handleConvertFormChange} className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-slate-900" min="1" max="12" step="0.5" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-600">Scholar Payout <span className="text-rose-500">*</span></label>
                    <div className="relative mt-1">
                      <span className="absolute left-3 top-2 text-slate-500">$</span>
                      <input type="number" name="scholarPayout" value={convertFormData.scholarPayout || ""} onChange={handleConvertFormChange} className="w-full border border-slate-200 rounded-lg pl-7 pr-3 py-2 text-slate-900" step="10" required />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-600">Client Price <span className="text-rose-500">*</span></label>
                    <div className="relative mt-1">
                      <span className="absolute left-3 top-2 text-slate-500">$</span>
                      <input type="number" name="clientPrice" value={convertFormData.clientPrice || ""} onChange={handleConvertFormChange} className="w-full border border-slate-200 rounded-lg pl-7 pr-3 py-2 text-slate-900" step="10" required />
                    </div>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-600">Scheduled Date & Time <span className="text-rose-500">*</span></label>
                  <input type="datetime-local" name="scheduledDate" value={convertFormData.scheduledDate} onChange={handleConvertFormChange} className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-slate-900" required />
                </div>
              </div>

              {/* Shelving & Storage */}
              <div className="space-y-5">
                <h3 className="font-bold text-slate-800 text-lg border-b pb-2">Shelving & Storage</h3>

                {/* Bold Series Cabinet System */}
                <div>
                  <label className="text-sm font-medium text-slate-600">Bold Series Cabinet System</label>
                  <select
                    value={productSelections.boldSeriesId}
                    onChange={(e) => setProductSelections((prev) => ({ ...prev, boldSeriesId: e.target.value }))}
                    className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-slate-900"
                  >
                    <option value="">None</option>
                    {BOLD_SERIES_SETS.map((b) => {
                      const credit = convertingLead?.package === "doctorate" ? 500 : convertingLead?.package === "graduate" ? 300 : 0;
                      const clientPays = Math.max(0, b.retail - credit);
                      return (
                        <option key={b.id} value={b.id}>
                          {b.name} ({b.dims}) — ${b.retail}{credit > 0 ? ` → $${clientPays} after credit` : ""}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Standard Shelving */}
                <div>
                  <label className="text-sm font-medium text-slate-600">Standard Shelving</label>
                  {STANDARD_SHELVING.map((shelf) => {
                    const existing = productSelections.standardShelving.find((s) => s.id === shelf.id);
                    const qty = existing?.qty || 0;
                    return (
                      <div key={shelf.id} className="flex items-center justify-between mt-2 bg-slate-50 rounded-lg px-3 py-2">
                        <div>
                          <span className="text-sm text-slate-800 font-medium">{shelf.name}</span>
                          <span className="text-xs text-slate-500 ml-2">({shelf.dims})</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setProductSelections((prev) => {
                              const updated = prev.standardShelving.filter((s) => s.id !== shelf.id);
                              if (qty > 1) updated.push({ id: shelf.id, qty: qty - 1 });
                              return { ...prev, standardShelving: updated };
                            })}
                            className="w-7 h-7 rounded-full bg-slate-200 hover:bg-slate-300 flex items-center justify-center text-slate-600"
                          >
                            <Minus size={14} />
                          </button>
                          <span className="w-6 text-center text-sm font-bold text-slate-800">{qty}</span>
                          <button
                            type="button"
                            onClick={() => setProductSelections((prev) => {
                              const updated = prev.standardShelving.filter((s) => s.id !== shelf.id);
                              updated.push({ id: shelf.id, qty: qty + 1 });
                              return { ...prev, standardShelving: updated };
                            })}
                            className="w-7 h-7 rounded-full bg-blue-100 hover:bg-blue-200 flex items-center justify-center text-blue-700"
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Overhead Storage */}
                <div>
                  <label className="text-sm font-medium text-slate-600">Overhead Storage</label>
                  {OVERHEAD_STORAGE.map((item) => {
                    const existing = productSelections.overheadStorage.find((s) => s.id === item.id);
                    const qty = existing?.qty || 0;
                    return (
                      <div key={item.id} className="flex items-center justify-between mt-2 bg-slate-50 rounded-lg px-3 py-2">
                        <div>
                          <span className="text-sm text-slate-800 font-medium">{item.name}</span>
                          <span className="text-xs text-slate-500 ml-2">({item.dims})</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setProductSelections((prev) => {
                              const updated = prev.overheadStorage.filter((s) => s.id !== item.id);
                              if (qty > 1) updated.push({ id: item.id, qty: qty - 1 });
                              return { ...prev, overheadStorage: updated };
                            })}
                            className="w-7 h-7 rounded-full bg-slate-200 hover:bg-slate-300 flex items-center justify-center text-slate-600"
                          >
                            <Minus size={14} />
                          </button>
                          <span className="w-6 text-center text-sm font-bold text-slate-800">{qty}</span>
                          <button
                            type="button"
                            onClick={() => setProductSelections((prev) => {
                              const updated = prev.overheadStorage.filter((s) => s.id !== item.id);
                              updated.push({ id: item.id, qty: qty + 1 });
                              return { ...prev, overheadStorage: updated };
                            })}
                            className="w-7 h-7 rounded-full bg-blue-100 hover:bg-blue-200 flex items-center justify-center text-blue-700"
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Add-Ons */}
              <div className="space-y-5">
                <h3 className="font-bold text-slate-800 text-lg border-b pb-2">Add-Ons</h3>

                {/* Extra Haul-Aways */}
                <div>
                  <label className="text-sm font-medium text-slate-600">Extra Haul-Aways</label>
                  <p className="text-xs text-slate-400 mb-1">$300 per additional truck bed</p>
                  <div className="flex items-center gap-3 mt-1">
                    <button
                      type="button"
                      onClick={() => setProductSelections((prev) => ({ ...prev, extraHaulAways: Math.max(0, prev.extraHaulAways - 1) }))}
                      className="w-8 h-8 rounded-full bg-slate-200 hover:bg-slate-300 flex items-center justify-center text-slate-600"
                    >
                      <Minus size={14} />
                    </button>
                    <span className="w-8 text-center text-lg font-bold text-slate-800">{productSelections.extraHaulAways}</span>
                    <button
                      type="button"
                      onClick={() => setProductSelections((prev) => ({ ...prev, extraHaulAways: prev.extraHaulAways + 1 }))}
                      className="w-8 h-8 rounded-full bg-blue-100 hover:bg-blue-200 flex items-center justify-center text-blue-700"
                    >
                      <Plus size={14} />
                    </button>
                    {productSelections.extraHaulAways > 0 && (
                      <span className="text-sm text-slate-500 ml-2">= ${productSelections.extraHaulAways * 300}</span>
                    )}
                  </div>
                </div>

                {/* Flooring */}
                <div>
                  <label className="text-sm font-medium text-slate-600">Flooring</label>
                  <select
                    value={productSelections.flooringId}
                    onChange={(e) => setProductSelections((prev) => ({ ...prev, flooringId: e.target.value }))}
                    className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-slate-900"
                  >
                    {FLOORING_OPTIONS.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}{f.price > 0 ? ` — $${f.price}` : f.id !== "none" ? " — Price TBD" : ""}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Extra Bin Packs */}
                <div>
                  <label className="text-sm font-medium text-slate-600">Extra Bin Packs</label>
                  <p className="text-xs text-slate-400 mb-1">Greenmade 27-Gallon 8-Pack</p>
                  <div className="flex items-center gap-3 mt-1">
                    <button
                      type="button"
                      onClick={() => setProductSelections((prev) => ({ ...prev, extraBinPacks: Math.max(0, prev.extraBinPacks - 1) }))}
                      className="w-8 h-8 rounded-full bg-slate-200 hover:bg-slate-300 flex items-center justify-center text-slate-600"
                    >
                      <Minus size={14} />
                    </button>
                    <span className="w-8 text-center text-lg font-bold text-slate-800">{productSelections.extraBinPacks}</span>
                    <button
                      type="button"
                      onClick={() => setProductSelections((prev) => ({ ...prev, extraBinPacks: prev.extraBinPacks + 1 }))}
                      className="w-8 h-8 rounded-full bg-blue-100 hover:bg-blue-200 flex items-center justify-center text-blue-700"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>

                {/* Additional Notes */}
                <div>
                  <label className="text-sm font-medium text-slate-600">Additional Notes</label>
                  <textarea
                    value={productSelections.notes}
                    onChange={(e) => setProductSelections((prev) => ({ ...prev, notes: e.target.value }))}
                    className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 min-h-[60px] text-slate-900"
                    placeholder="Any extra details about products or install preferences..."
                    maxLength={300}
                  />
                </div>
              </div>

              {/* Additional Information */}
              <div className="space-y-4">
                <h3 className="font-bold text-slate-800 text-lg border-b pb-2">Additional Information</h3>
                <div>
                  <label className="text-sm font-medium text-slate-600">Access Instructions</label>
                  <textarea name="accessInstructions" value={convertFormData.accessInstructions} onChange={handleConvertFormChange} className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 min-h-[80px] text-slate-900" placeholder="Gate code: 1234, Key under mat, Client will be home" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-slate-600">Does the client want resale concierge?</label>
                    <select name="resaleConcierge" value={convertFormData.resaleConcierge} onChange={handleConvertFormChange} className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-slate-900">
                      <option value="no">No</option>
                      <option value="yes">Yes</option>
                    </select>
                    <p className="text-xs text-slate-400 mt-1">50/50 split + listing management — included in all tiers</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-600">Does the client have donation items?</label>
                    <select name="donationOptIn" value={convertFormData.donationOptIn} onChange={handleConvertFormChange} className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-slate-900">
                      <option value="no">No</option>
                      <option value="yes">Yes</option>
                    </select>
                    <p className="text-xs text-slate-400 mt-1">Drop-off at donation center — no extra charge</p>
                  </div>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex gap-3 pt-4 border-t">
                <button type="button" onClick={() => { setConvertingLead(null); setSopError(null); }} className="flex-1 bg-slate-200 text-slate-700 font-semibold py-3 rounded-xl hover:bg-slate-300">
                  Cancel
                </button>
                <button type="submit" disabled={sopGenerating || busyId === convertingLead.id} className="flex-1 bg-emerald-600 text-white font-semibold py-3 rounded-xl hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2">
                  {sopGenerating ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Generating SOP...
                    </>
                  ) : (
                    "Generate SOP & Review"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════ */}
      {/* SOP Review Modal                                   */}
      {/* ══════════════════════════════════════════════════ */}
      {sopReviewData && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[95vh] overflow-y-auto shadow-2xl">
            {/* Header */}
            <div className="sticky top-0 bg-slate-800 text-white p-6 rounded-t-2xl z-10">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-xl font-bold">SOP Review</h2>
                  <p className="text-slate-300 text-sm mt-1">Approve before publishing to scholars</p>
                </div>
                <button onClick={handleSopCancel} className="text-slate-400 hover:text-white p-1">
                  ✕
                </button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                <div>
                  <div className="text-[10px] uppercase text-slate-400 font-bold">Client</div>
                  <div className="text-sm font-semibold">{sopReviewData.clientName}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase text-slate-400 font-bold">Address</div>
                  <div className="text-sm font-semibold truncate">{sopReviewData.address}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase text-slate-400 font-bold">Package</div>
                  <div className="text-sm font-semibold">{packageLabels[sopReviewData.packageTier] || sopReviewData.packageTier}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase text-slate-400 font-bold">Date</div>
                  <div className="text-sm font-semibold">{new Date(sopReviewData.date).toLocaleDateString()}</div>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              {/* Intake Photos Thumbnails */}
              {sopReviewData.intakeImageUrls.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Intake Photos Used</h4>
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {sopReviewData.intakeImageUrls.map((url, i) => (
                      <img key={i} src={url} alt={`Intake ${i + 1}`} className="h-16 w-24 object-cover rounded border flex-shrink-0" />
                    ))}
                  </div>
                </div>
              )}

              {/* Edit toggle */}
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-800">Generated SOP</h3>
                <button
                  onClick={() => {
                    if (!sopEditMode) setSopEditText(sopReviewData.sopText);
                    setSopEditMode(!sopEditMode);
                  }}
                  className="text-xs font-bold text-blue-600 flex items-center gap-1"
                >
                  <Edit3 size={12} />
                  {sopEditMode ? "Preview Mode" : "Edit Mode"}
                </button>
              </div>

              {sopEditMode ? (
                <textarea
                  value={sopEditText}
                  onChange={(e) => setSopEditText(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg p-4 font-mono text-sm min-h-[500px] text-slate-800"
                />
              ) : (
                <div className="space-y-3">
                  {parseSopSections(sopReviewData.sopText).map((section, idx) => (
                    <div key={idx} className="border border-slate-200 rounded-lg overflow-hidden">
                      <button
                        onClick={() => toggleSection(idx)}
                        className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 text-left"
                      >
                        <span className="font-semibold text-sm text-slate-800">{section.title}</span>
                        {expandedSections.has(idx) ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                      {expandedSections.has(idx) && (
                        <div className="p-4 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                          {section.body}
                        </div>
                      )}
                    </div>
                  ))}
                  {parseSopSections(sopReviewData.sopText).length === 0 && (
                    <div className="bg-slate-50 rounded-lg p-4 text-sm text-slate-700 whitespace-pre-wrap">
                      {sopReviewData.sopText}
                    </div>
                  )}
                </div>
              )}

              {/* Regenerate with notes */}
              <div className="border-t pt-4">
                <label className="text-xs font-bold text-slate-500 uppercase">Admin Notes for Regeneration (optional)</label>
                <textarea
                  value={sopRegenerateNotes}
                  onChange={(e) => setSopRegenerateNotes(e.target.value)}
                  className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800"
                  placeholder="e.g. Emphasize wall-mounted storage, skip floor coating details"
                  rows={2}
                />
              </div>
            </div>

            {/* Footer Actions */}
            <div className="sticky bottom-0 bg-white border-t p-4 flex gap-3 rounded-b-2xl">
              <button
                onClick={handleSopCancel}
                className="px-5 py-3 bg-slate-200 text-slate-700 font-semibold rounded-xl hover:bg-slate-300 flex items-center gap-2"
              >
                <XCircle size={16} />
                Cancel
              </button>
              <button
                onClick={handleSopRegenerate}
                disabled={sopRegenerating}
                className="px-5 py-3 bg-amber-500 text-white font-semibold rounded-xl hover:bg-amber-600 disabled:opacity-50 flex items-center gap-2"
              >
                {sopRegenerating ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={16} />}
                {sopRegenerating ? "Regenerating..." : "Edit & Regenerate"}
              </button>
              <button
                onClick={handleSopApprove}
                disabled={sopApproving}
                className="flex-1 px-5 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {sopApproving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                {sopApproving ? "Publishing..." : "Approve & Publish"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminLeads;
