import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { httpsCallable } from "firebase/functions";
import { useAuth } from "../../../src/hooks/useAuth";
import { useBankStatus } from "../../../src/hooks/usePayouts";
import { functions } from "../../../src/lib/firebase";
import FormInput from "../../../src/components/FormInput";
import FormSelect from "../../../src/components/FormSelect";

const ACCOUNT_TYPES = [
  { label: "Checking", value: "checking" },
  { label: "Savings", value: "savings" },
];

export default function PaymentSetupScreen() {
  const { profile } = useAuth();
  const router = useRouter();
  const { bankLinked, bankLast4, bankAccountType, loading } = useBankStatus(profile?.uid);

  // Form state
  const [accountHolderName, setAccountHolderName] = useState(profile?.name || "");
  const [routingNumber, setRoutingNumber] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [confirmAccountNumber, setConfirmAccountNumber] = useState("");
  const [accountType, setAccountType] = useState<"checking" | "savings">("checking");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setError(null);

    if (!accountHolderName.trim()) {
      setError("Name on account is required.");
      return;
    }
    if (!/^\d{9}$/.test(routingNumber)) {
      setError("Routing number must be exactly 9 digits.");
      return;
    }
    if (!/^\d{4,17}$/.test(accountNumber)) {
      setError("Account number must be 4-17 digits.");
      return;
    }
    if (accountNumber !== confirmAccountNumber) {
      setError("Account numbers don't match.");
      return;
    }

    setSaving(true);
    try {
      const callable = httpsCallable(functions, "gsSaveScholarBankInfo");
      const result = await callable({
        routingNumber,
        accountNumber,
        accountType,
        accountHolderName: accountHolderName.trim(),
      });

      const data = result.data as { success?: boolean; bankLast4?: string };

      const msg = `Bank account linked (****${data.bankLast4}). You'll receive direct deposits when you complete jobs.`;
      if (Platform.OS === "web") {
        alert(msg);
      } else {
        Alert.alert("Bank Linked", msg);
      }

      // Clear sensitive fields
      setRoutingNumber("");
      setAccountNumber("");
      setConfirmAccountNumber("");
    } catch (err: any) {
      setError(err?.message || "Failed to save bank info.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#14b8a6" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={24} color="#f1f5f9" />
      </TouchableOpacity>

      <Text style={styles.title}>Direct Deposit Setup</Text>
      <Text style={styles.subtitle}>
        Enter your bank details to receive payouts via direct deposit (ACH).
        Transfers typically arrive in 1-2 business days.
      </Text>

      {/* Current Status */}
      <View style={styles.statusCard}>
        <View style={styles.statusRow}>
          <Ionicons
            name={bankLinked ? "checkmark-circle" : "ellipse-outline"}
            size={24}
            color={bankLinked ? "#10b981" : "#5a6a80"}
          />
          <View style={styles.statusInfo}>
            <Text style={styles.statusLabel}>Bank Account</Text>
            <Text style={styles.statusValue}>
              {bankLinked
                ? `Connected — ${bankAccountType || "checking"} ****${bankLast4}`
                : "Not connected"}
            </Text>
          </View>
        </View>
      </View>

      {bankLinked && (
        <View style={styles.successBanner}>
          <Ionicons name="checkmark-circle" size={24} color="#10b981" />
          <Text style={styles.successText}>
            Your bank account is connected. Payouts are sent via direct deposit
            when you complete jobs. You can update your info below.
          </Text>
        </View>
      )}

      {/* Bank Info Form */}
      <View style={styles.formCard}>
        <Text style={styles.formTitle}>
          {bankLinked ? "Update Bank Info" : "Link Bank Account"}
        </Text>

        {error && (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle" size={16} color="#ef4444" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <FormInput
          label="Name on Account"
          value={accountHolderName}
          onChangeText={setAccountHolderName}
          placeholder="e.g., John Smith"
          autoCapitalize="words"
        />

        <FormSelect
          label="Account Type"
          value={accountType}
          onValueChange={(v: string) => setAccountType(v as "checking" | "savings")}
          options={ACCOUNT_TYPES}
        />

        <FormInput
          label="Routing Number"
          value={routingNumber}
          onChangeText={(text) => setRoutingNumber(text.replace(/\D/g, "").slice(0, 9))}
          placeholder="9-digit routing number"
          keyboardType="number-pad"
        />

        <FormInput
          label="Account Number"
          value={accountNumber}
          onChangeText={(text) => setAccountNumber(text.replace(/\D/g, "").slice(0, 17))}
          placeholder="Account number"
          keyboardType="number-pad"
          secureTextEntry
        />

        <FormInput
          label="Confirm Account Number"
          value={confirmAccountNumber}
          onChangeText={(text) => setConfirmAccountNumber(text.replace(/\D/g, "").slice(0, 17))}
          placeholder="Re-enter account number"
          keyboardType="number-pad"
          secureTextEntry
          error={
            confirmAccountNumber.length > 0 && confirmAccountNumber !== accountNumber
              ? "Account numbers don't match"
              : undefined
          }
        />

        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.7}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="lock-closed" size={18} color="#fff" />
              <Text style={styles.saveBtnText}>
                {bankLinked ? "Update Bank Info" : "Link Bank Account"}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Info */}
      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>How Payouts Work</Text>
        <InfoRow icon="cash-outline" text="50% is paid when you check in to a job" />
        <InfoRow icon="time-outline" text="The other 50% is released 72 hours after checkout if no complaints" />
        <InfoRow icon="shield-checkmark-outline" text="Your quality score must be 2.0+ for automatic release" />
        <InfoRow icon="wallet-outline" text="Direct deposits typically arrive in 1-2 business days" />
      </View>

      <View style={styles.securityNote}>
        <Ionicons name="lock-closed" size={14} color="#5a6a80" />
        <Text style={styles.securityNoteText}>
          Your bank info is stored securely and only used for direct deposit payouts.
        </Text>
      </View>

      {!bankLinked && (
        <Text style={styles.fallbackNote}>
          Without a linked bank account, payouts will be processed manually by
          an admin via cash or check.
        </Text>
      )}
    </ScrollView>
  );
}

function InfoRow({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={infoStyles.row}>
      <Ionicons name={icon as any} size={18} color="#14b8a6" />
      <Text style={infoStyles.text}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0f1a" },
  scroll: { padding: 16, paddingBottom: 40 },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#0a0f1a",
    justifyContent: "center",
    alignItems: "center",
  },
  backBtn: { marginBottom: 16 },
  title: { fontSize: 24, fontWeight: "800", color: "#f1f5f9", marginBottom: 4 },
  subtitle: { fontSize: 14, color: "#8b9bb5", marginBottom: 20, lineHeight: 20 },
  statusCard: {
    backgroundColor: "#1a2332",
    borderRadius: 12,
    padding: 16,
    gap: 16,
    marginBottom: 16,
  },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  statusInfo: { flex: 1 },
  statusLabel: { fontSize: 14, fontWeight: "700", color: "#f1f5f9" },
  statusValue: { fontSize: 12, color: "#8b9bb5", marginTop: 2 },
  successBanner: {
    backgroundColor: "#10b98120",
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#10b98140",
  },
  successText: { flex: 1, color: "#10b981", fontSize: 13, lineHeight: 19 },
  formCard: {
    backgroundColor: "#1a2332",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  formTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#f1f5f9",
    marginBottom: 16,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#ef444420",
    borderWidth: 1,
    borderColor: "#ef444440",
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  errorText: { color: "#ef4444", fontSize: 13, flex: 1 },
  saveBtn: {
    backgroundColor: "#14b8a6",
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  infoCard: {
    backgroundColor: "#1a2332",
    borderRadius: 12,
    padding: 16,
    gap: 14,
    marginBottom: 16,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#8b9bb5",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  securityNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  securityNoteText: {
    flex: 1,
    color: "#5a6a80",
    fontSize: 12,
    lineHeight: 18,
  },
  fallbackNote: {
    color: "#5a6a80",
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
  },
});

const infoStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  text: { flex: 1, color: "#cbd5e1", fontSize: 13, lineHeight: 19 },
});
