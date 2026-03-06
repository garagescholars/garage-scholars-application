import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { Ionicons } from "@expo/vector-icons";
import { db } from "../../../src/lib/firebase";
import { COLLECTIONS } from "../../../src/constants/collections";

export default function CreateJobScreen() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [address, setAddress] = useState("");
  const [zipcode, setZipcode] = useState("");
  const [description, setDescription] = useState("");
  const [serviceType, setServiceType] = useState("get-organized");

  const SERVICE_TYPES = [
    { label: "Get Organized", value: "get-organized" },
    { label: "Get Strong", value: "get-strong" },
    { label: "Full Transformation", value: "full" },
    { label: "Donation Haul", value: "donation" },
  ];

  const handleCreate = async () => {
    if (!clientName.trim()) {
      Alert.alert("Missing Client Name", "Please enter the client's name.");
      return;
    }
    if (!address.trim() && !zipcode.trim()) {
      Alert.alert("Missing Location", "Please enter an address or ZIP code.");
      return;
    }

    setSaving(true);
    try {
      // Create a LEAD in gs_jobs — same collection the Leads screen watches.
      // This means the new lead immediately appears in Leads & SOPs,
      // where you can use the full sell workflow (package selection,
      // product catalog, SOP generation, QA review, publish to scholars).
      await addDoc(collection(db, COLLECTIONS.JOBS), {
        title: `${clientName.trim()} — ${SERVICE_TYPES.find(s => s.value === serviceType)?.label || serviceType}`,
        clientName: clientName.trim(),
        clientEmail: clientEmail.trim() || null,
        clientPhone: clientPhone.trim() || null,
        address: address.trim() || `ZIP: ${zipcode.trim()}`,
        zipcode: zipcode.trim() || null,
        description: description.trim() || "Manual lead entry",
        serviceType,
        status: "LEAD",
        source: "manual",
        package: null,
        garageSize: null,
        scheduledDate: "",
        scheduledTimeStart: "",
        scheduledTimeEnd: "",
        payout: 0,
        clientPrice: 0,
        lat: 0,
        lng: 0,
        urgencyLevel: "standard",
        rushBonus: 0,
        currentViewers: 0,
        viewerFloor: 0,
        totalViews: 0,
        reopenCount: 0,
        checklist: [],
        intakeMediaPaths: [],
        intakeImageUrls: [],
        claimedBy: null,
        claimedByName: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      Alert.alert(
        "Lead Created!",
        "The lead is now in your Leads & SOPs queue. Use the sell workflow there to configure the package, generate the SOP, and publish to scholars.",
        [{ text: "Go to Leads", onPress: () => router.replace("/(admin)/leads") }]
      );
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to create lead");
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Info banner */}
        <View style={styles.infoBanner}>
          <Ionicons name="information-circle" size={18} color="#14b8a6" />
          <Text style={styles.infoBannerText}>
            This creates a new lead. After creating, use the Leads & SOPs screen to select packages, generate the SOP, review for QA, and push to scholars.
          </Text>
        </View>

        <Field label="Client Name *" value={clientName} onChange={setClientName} placeholder="Homeowner name" />
        <Field label="Client Email" value={clientEmail} onChange={setClientEmail} placeholder="email@example.com" keyboard="email-address" />
        <Field label="Client Phone" value={clientPhone} onChange={setClientPhone} placeholder="(555) 555-5555" keyboard="phone-pad" />
        <Field label="Address" value={address} onChange={setAddress} placeholder="123 Main St, City, State" />
        <Field label="ZIP Code" value={zipcode} onChange={setZipcode} placeholder="80202" keyboard="numeric" />

        {/* Service Type */}
        <Text style={styles.fieldLabel}>Service Type</Text>
        <View style={styles.serviceRow}>
          {SERVICE_TYPES.map((svc) => (
            <TouchableOpacity
              key={svc.value}
              style={[
                styles.serviceBtn,
                serviceType === svc.value && styles.serviceBtnActive,
              ]}
              onPress={() => setServiceType(svc.value)}
            >
              <Text
                style={[
                  styles.serviceText,
                  serviceType === svc.value && styles.serviceTextActive,
                ]}
              >
                {svc.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Field
          label="Description / Notes"
          value={description}
          onChange={setDescription}
          placeholder="Any details about the project..."
          multiline
        />

        {/* Submit */}
        <TouchableOpacity
          style={[styles.submitBtn, saving && styles.submitDisabled]}
          onPress={handleCreate}
          disabled={saving}
        >
          <Ionicons name="add-circle" size={20} color="#fff" />
          <Text style={styles.submitText}>
            {saving ? "Creating..." : "Create Lead"}
          </Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  multiline,
  keyboard,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  multiline?: boolean;
  keyboard?: "numeric" | "phone-pad" | "email-address";
}) {
  return (
    <View style={fieldStyles.container}>
      <Text style={fieldStyles.label}>{label}</Text>
      <TextInput
        style={[fieldStyles.input, multiline && fieldStyles.multiline]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#475569"
        multiline={multiline}
        keyboardType={keyboard || "default"}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0f1a" },
  scroll: { padding: 16 },
  infoBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "#14b8a610",
    borderWidth: 1,
    borderColor: "#14b8a630",
    borderRadius: 10,
    padding: 12,
    marginBottom: 20,
  },
  infoBannerText: {
    flex: 1,
    fontSize: 13,
    color: "#94a3b8",
    lineHeight: 18,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#8b9bb5",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  serviceRow: { flexDirection: "row", gap: 8, marginBottom: 16, flexWrap: "wrap" },
  serviceBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: "#1a2332",
    borderWidth: 1,
    borderColor: "#2a3545",
  },
  serviceBtnActive: {
    backgroundColor: "#14b8a620",
    borderColor: "#14b8a6",
  },
  serviceText: { fontSize: 13, fontWeight: "700", color: "#5a6a80" },
  serviceTextActive: { color: "#14b8a6" },
  submitBtn: {
    backgroundColor: "#14b8a6",
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
  },
  submitDisabled: { opacity: 0.6 },
  submitText: { fontSize: 17, fontWeight: "800", color: "#fff" },
});

const fieldStyles = StyleSheet.create({
  container: { marginBottom: 14 },
  label: {
    fontSize: 13,
    fontWeight: "700",
    color: "#8b9bb5",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: "#1a2332",
    borderRadius: 10,
    padding: 14,
    color: "#f1f5f9",
    fontSize: 15,
    borderWidth: 1,
    borderColor: "#2a3545",
  },
  multiline: {
    minHeight: 80,
    textAlignVertical: "top",
  },
});
