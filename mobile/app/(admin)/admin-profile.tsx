import { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  Switch,
} from "react-native";
import { useRouter } from "expo-router";
import { doc, updateDoc, serverTimestamp, onSnapshot } from "firebase/firestore";
import { Ionicons } from "@expo/vector-icons";
import { db } from "../../src/lib/firebase";
import { COLLECTIONS } from "../../src/constants/collections";
import { useAuth } from "../../src/hooks/useAuth";
import { registerForPushNotifications } from "../../src/lib/notifications";
import FormInput from "../../src/components/FormInput";
import FormButton from "../../src/components/FormButton";

type NotificationPrefs = {
  jobReviews: boolean;
  payoutAlerts: boolean;
  complaints: boolean;
  weeklyReport: boolean;
  mercuryAlerts: boolean;
  scholarCheckins: boolean;
};

const DEFAULT_PREFS: NotificationPrefs = {
  jobReviews: true,
  payoutAlerts: true,
  complaints: true,
  weeklyReport: true,
  mercuryAlerts: true,
  scholarCheckins: true,
};

export default function AdminProfileScreen() {
  const { user, profile } = useAuth();
  const router = useRouter();

  // Profile fields
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  // Push notification state
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [enablingPush, setEnablingPush] = useState(false);
  const [testingPush, setTestingPush] = useState(false);

  // Notification preferences
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);

  // UI state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Load current profile from Firestore (real-time)
  useEffect(() => {
    if (!user?.uid) return;
    const unsub = onSnapshot(doc(db, COLLECTIONS.PROFILES, user.uid), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setFullName(data.fullName || data.name || "");
        setEmail(data.email || "");
        setPhone(data.phone || "");
        setPushToken(data.pushToken || null);
        setPushEnabled(!!data.pushToken);
        if (data.notificationPrefs) {
          setPrefs({ ...DEFAULT_PREFS, ...data.notificationPrefs });
        }
      }
      setLoading(false);
    });
    return () => unsub();
  }, [user?.uid]);

  const handleEnablePush = async () => {
    if (!user?.uid) return;
    setEnablingPush(true);
    try {
      const token = await registerForPushNotifications(user.uid);
      if (token) {
        setPushToken(token);
        setPushEnabled(true);
        const msg = "Push notifications enabled! You'll get alerts for job reviews, payouts, and more.";
        Platform.OS === "web" ? alert(msg) : Alert.alert("Enabled", msg);
      } else {
        const msg = "Could not enable push notifications. Make sure you're on a physical device and have granted permission.";
        Platform.OS === "web" ? alert(msg) : Alert.alert("Error", msg);
      }
    } catch (err: any) {
      const msg = err?.message || "Failed to enable push notifications.";
      Platform.OS === "web" ? alert(msg) : Alert.alert("Error", msg);
    } finally {
      setEnablingPush(false);
    }
  };

  const handleTestPush = async () => {
    if (!pushToken) return;
    setTestingPush(true);
    try {
      const res = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: pushToken,
          title: "Test Notification",
          body: "Push notifications are working! You'll receive alerts here.",
          data: { screen: "admin-profile" },
        }),
      });
      if (res.ok) {
        const msg = "Test notification sent! Check your notifications.";
        Platform.OS === "web" ? alert(msg) : Alert.alert("Sent", msg);
      }
    } catch {
      const msg = "Failed to send test notification.";
      Platform.OS === "web" ? alert(msg) : Alert.alert("Error", msg);
    } finally {
      setTestingPush(false);
    }
  };

  const handleSave = async () => {
    if (!user?.uid) return;
    setError(null);
    setSaved(false);

    if (!fullName.trim()) {
      setError("Full name is required.");
      return;
    }
    if (!email.trim()) {
      setError("Email is required.");
      return;
    }

    setSaving(true);
    try {
      await updateDoc(doc(db, COLLECTIONS.PROFILES, user.uid), {
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        notificationPrefs: prefs,
        onboardingComplete: true,
        updatedAt: serverTimestamp(),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      setError(err?.message || "Failed to save profile.");
    } finally {
      setSaving(false);
    }
  };

  const togglePref = (key: keyof NotificationPrefs) => {
    setPrefs((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#14b8a6" />
      </View>
    );
  }

  const isOnboarded = pushEnabled && fullName.trim() && email.trim();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={24} color="#f1f5f9" />
      </TouchableOpacity>

      <Text style={styles.title}>Admin Profile</Text>
      <Text style={styles.subtitle}>
        Keep your info up to date so you get alerts for job reviews, payouts, and Mercury transfers.
      </Text>

      {/* Onboarding Status */}
      <View style={[styles.statusCard, isOnboarded ? styles.statusGood : styles.statusIncomplete]}>
        <Ionicons
          name={isOnboarded ? "checkmark-circle" : "alert-circle"}
          size={24}
          color={isOnboarded ? "#10b981" : "#f59e0b"}
        />
        <View style={{ flex: 1 }}>
          <Text style={[styles.statusTitle, isOnboarded ? styles.statusTitleGood : styles.statusTitleWarn]}>
            {isOnboarded ? "Profile Complete" : "Setup Incomplete"}
          </Text>
          <Text style={styles.statusDesc}>
            {isOnboarded
              ? "You're all set to receive alerts and notifications."
              : "Complete your profile below to make sure you get all admin alerts."}
          </Text>
        </View>
      </View>

      {/* Push Notifications Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Push Notifications</Text>
        <View style={styles.card}>
          <View style={styles.pushRow}>
            <View style={styles.pushInfo}>
              <Ionicons
                name={pushEnabled ? "notifications" : "notifications-off-outline"}
                size={24}
                color={pushEnabled ? "#10b981" : "#ef4444"}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.pushLabel}>
                  {pushEnabled ? "Push Enabled" : "Push Not Enabled"}
                </Text>
                <Text style={styles.pushDesc}>
                  {pushEnabled
                    ? "You'll receive real-time alerts on your device."
                    : "Enable push to get alerts for job reviews, payouts, and Mercury transfers."}
                </Text>
              </View>
            </View>
            {!pushEnabled && (
              <TouchableOpacity
                style={styles.enableBtn}
                onPress={handleEnablePush}
                disabled={enablingPush}
              >
                {enablingPush ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.enableBtnText}>Enable</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
          {pushEnabled && (
            <TouchableOpacity
              style={styles.testBtn}
              onPress={handleTestPush}
              disabled={testingPush}
            >
              {testingPush ? (
                <ActivityIndicator size="small" color="#14b8a6" />
              ) : (
                <>
                  <Ionicons name="paper-plane-outline" size={16} color="#14b8a6" />
                  <Text style={styles.testBtnText}>Send Test Notification</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Contact Info Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Contact Info</Text>
        <View style={styles.card}>
          {error && (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={16} color="#ef4444" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
          {saved && (
            <View style={styles.successBanner}>
              <Ionicons name="checkmark-circle" size={16} color="#10b981" />
              <Text style={styles.successText}>Profile saved!</Text>
            </View>
          )}

          <FormInput
            label="Full Name"
            value={fullName}
            onChangeText={setFullName}
            placeholder="Your full name"
            autoCapitalize="words"
          />
          <FormInput
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <FormInput
            label="Phone Number"
            value={phone}
            onChangeText={setPhone}
            placeholder="(555) 123-4567"
            keyboardType="phone-pad"
          />
        </View>
      </View>

      {/* Notification Preferences */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Alert Preferences</Text>
        <Text style={styles.sectionDesc}>Choose which alerts you want to receive.</Text>
        <View style={styles.card}>
          <PrefRow
            icon="briefcase-outline"
            label="Job Reviews"
            desc="When a scholar checks out and needs approval"
            value={prefs.jobReviews}
            onToggle={() => togglePref("jobReviews")}
          />
          <PrefRow
            icon="cash-outline"
            label="Payout Alerts"
            desc="When payouts are sent or fail"
            value={prefs.payoutAlerts}
            onToggle={() => togglePref("payoutAlerts")}
          />
          <PrefRow
            icon="warning-outline"
            label="Complaints"
            desc="When a customer or admin files a complaint"
            value={prefs.complaints}
            onToggle={() => togglePref("complaints")}
          />
          <PrefRow
            icon="calendar-outline"
            label="Weekly Mercury Report"
            desc="Monday alert to fund Mercury from Chase"
            value={prefs.weeklyReport}
            onToggle={() => togglePref("weeklyReport")}
          />
          <PrefRow
            icon="wallet-outline"
            label="Mercury Balance Alerts"
            desc="When Mercury balance is low"
            value={prefs.mercuryAlerts}
            onToggle={() => togglePref("mercuryAlerts")}
          />
          <PrefRow
            icon="enter-outline"
            label="Scholar Check-ins"
            desc="When a scholar checks in to a job"
            value={prefs.scholarCheckins}
            onToggle={() => togglePref("scholarCheckins")}
          />
        </View>
      </View>

      {/* Save Button */}
      <FormButton
        title={saving ? "Saving..." : "Save Profile"}
        onPress={handleSave}
        loading={saving}
        disabled={saving}
        variant="primary"
        style={{ marginTop: 4, marginBottom: 16 }}
      />

      {/* Info Card */}
      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>Why This Matters</Text>
        <InfoRow icon="notifications" text="Push notifications ensure you don't miss job reviews, payout alerts, or Mercury transfer reminders" />
        <InfoRow icon="mail" text="Your email is used for weekly replenishment reports and CPA summaries" />
        <InfoRow icon="call" text="Phone is optional — used as a backup contact method" />
      </View>
    </ScrollView>
  );
}

function PrefRow({
  icon,
  label,
  desc,
  value,
  onToggle,
}: {
  icon: string;
  label: string;
  desc: string;
  value: boolean;
  onToggle: () => void;
}) {
  return (
    <View style={prefStyles.row}>
      <Ionicons name={icon as any} size={20} color="#14b8a6" />
      <View style={prefStyles.info}>
        <Text style={prefStyles.label}>{label}</Text>
        <Text style={prefStyles.desc}>{desc}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: "#2a3545", true: "#14b8a660" }}
        thumbColor={value ? "#14b8a6" : "#5a6a80"}
      />
    </View>
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
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0a0f1a" },
  backBtn: { marginBottom: 16 },
  title: { fontSize: 24, fontWeight: "800", color: "#f1f5f9", marginBottom: 4 },
  subtitle: { fontSize: 14, color: "#8b9bb5", marginBottom: 20, lineHeight: 20 },

  // Status card
  statusCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
  },
  statusGood: { backgroundColor: "#10b98115", borderColor: "#10b98140" },
  statusIncomplete: { backgroundColor: "#f59e0b15", borderColor: "#f59e0b40" },
  statusTitle: { fontSize: 15, fontWeight: "700" },
  statusTitleGood: { color: "#10b981" },
  statusTitleWarn: { color: "#f59e0b" },
  statusDesc: { fontSize: 12, color: "#8b9bb5", marginTop: 2, lineHeight: 17 },

  // Sections
  section: { marginBottom: 20 },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#8b9bb5",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  sectionDesc: { fontSize: 12, color: "#5a6a80", marginBottom: 8 },
  card: { backgroundColor: "#1a2332", borderRadius: 12, padding: 16 },

  // Push
  pushRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  pushInfo: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  pushLabel: { fontSize: 15, fontWeight: "700", color: "#f1f5f9" },
  pushDesc: { fontSize: 12, color: "#8b9bb5", marginTop: 2, lineHeight: 17 },
  enableBtn: {
    backgroundColor: "#14b8a6",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  enableBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  testBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "#14b8a640",
    borderRadius: 8,
    paddingVertical: 10,
    marginTop: 12,
  },
  testBtnText: { color: "#14b8a6", fontWeight: "700", fontSize: 13 },

  // Error / Success
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
  successBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#10b98120",
    borderWidth: 1,
    borderColor: "#10b98140",
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  successText: { color: "#10b981", fontSize: 13, fontWeight: "600" },

  // Info card
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
});

const prefStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#0a0f1a",
  },
  info: { flex: 1 },
  label: { fontSize: 14, fontWeight: "700", color: "#f1f5f9" },
  desc: { fontSize: 11, color: "#5a6a80", marginTop: 2 },
});

const infoStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  text: { flex: 1, color: "#cbd5e1", fontSize: 13, lineHeight: 19 },
});
