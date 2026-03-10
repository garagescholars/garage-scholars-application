import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  TouchableOpacity,
} from "react-native";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import QRCode from "react-native-qrcode-svg";
import { auth, db } from "../../src/lib/firebase";
import { COLLECTIONS } from "../../src/constants/collections";
import AdminPageWrapper from "../../src/components/AdminPageWrapper";
import FormInput from "../../src/components/FormInput";
import FormSelect from "../../src/components/FormSelect";
import FormButton from "../../src/components/FormButton";

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function SkeletonBlock({
  width,
  height,
  style,
}: {
  width: number | string;
  height: number;
  style?: any;
}) {
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

function SettingsSkeleton() {
  return (
    <AdminPageWrapper>
      {/* Header skeleton */}
      <View style={{ marginBottom: 24, gap: 8 }}>
        <SkeletonBlock width={200} height={24} />
        <SkeletonBlock width={260} height={14} />
      </View>

      {/* Form card skeleton */}
      <View style={skeletonStyles.card}>
        <View style={skeletonStyles.infoBox}>
          <SkeletonBlock width={40} height={40} style={{ borderRadius: 20 }} />
          <View style={{ flex: 1, gap: 6 }}>
            <SkeletonBlock width={160} height={16} />
            <SkeletonBlock width="100%" height={14} />
          </View>
        </View>
        {[1, 2, 3, 4].map((i) => (
          <View key={i} style={{ marginBottom: 14 }}>
            <SkeletonBlock width={80} height={12} style={{ marginBottom: 6 }} />
            <SkeletonBlock width="100%" height={48} style={{ borderRadius: 10 }} />
          </View>
        ))}
        <SkeletonBlock width="100%" height={52} style={{ borderRadius: 12, marginTop: 8 }} />
      </View>

      {/* Info card skeleton */}
      <View style={[skeletonStyles.card, { marginTop: 16 }]}>
        {[1, 2, 3, 4].map((i) => (
          <SkeletonBlock
            key={i}
            width="90%"
            height={14}
            style={{ marginBottom: 10 }}
          />
        ))}
      </View>
    </AdminPageWrapper>
  );
}

const skeletonStyles = StyleSheet.create({
  card: {
    backgroundColor: "#1a2332",
    borderRadius: 14,
    padding: 18,
    marginBottom: 8,
  },
  infoBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 20,
    backgroundColor: "#0a0f1a",
    borderRadius: 10,
    padding: 14,
  },
});

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ROLE_OPTIONS = [
  { label: "Scholar", value: "scholar" },
  { label: "Admin", value: "admin" },
];

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function SettingsScreen() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("scholar");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleCreateUser = async () => {
    setError(null);
    setSuccess(null);

    if (!auth || !db) {
      setError("Firebase not initialized.");
      return;
    }

    if (!name.trim() || !email.trim() || !password.trim()) {
      setError("All fields are required.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();

    setLoading(true);
    try {
      // Create the user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        normalizedEmail,
        password
      );
      const userId = userCredential.user.uid;

      // Create user document in gs_profiles
      await setDoc(doc(db, COLLECTIONS.PROFILES, userId), {
        email: normalizedEmail,
        fullName: name.trim(),
        phone: "",
        role: role,
        isActive: true,
        createdAt: serverTimestamp(),
        createdBy: "admin",
      });

      // If scholar, also create gs_scholarProfiles doc
      if (role === "scholar") {
        await setDoc(doc(db, COLLECTIONS.SCHOLAR_PROFILES, userId), {
          scholarId: userId,
          scholarName: name.trim(),
          monthlyJobGoal: 10,
          monthlyMoneyGoal: 3000,
          totalJobsCompleted: 0,
          totalEarnings: 0,
          payScore: 5.0,
          cancellationRate: 0,
          acceptanceRate: 100,
          tier: "new",
          showOnLeaderboard: true,
          createdAt: serverTimestamp(),
        });
      }

      setSuccess(
        `User ${name.trim()} (${normalizedEmail}) created successfully as ${role}.`
      );
      setName("");
      setEmail("");
      setPassword("");
      setRole("scholar");
    } catch (err) {
      console.error("Error creating user:", err);
      const message =
        err instanceof Error ? err.message : "Failed to create user.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const router = useRouter();
  const QR_REDIRECT_URL = "https://garage-scholars-scheduling.web.app/go.html";

  return (
    <AdminPageWrapper>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        {/* Header */}
        <View style={styles.headerSection}>
          <Text style={styles.headerTitle}>Admin Settings</Text>
          <Text style={styles.headerSubtitle}>
            Manage users and system access.
          </Text>
        </View>

        {/* My Profile Link */}
        <TouchableOpacity
          style={styles.profileCard}
          activeOpacity={0.7}
          onPress={() => router.push("/(admin)/admin-profile" as any)}
        >
          <View style={styles.profileCardContent}>
            <View style={styles.profileIcon}>
              <Ionicons name="person-circle" size={28} color="#14b8a6" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.profileCardTitle}>My Profile</Text>
              <Text style={styles.profileCardDesc}>
                Update your info, enable push notifications, and set alert preferences.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#14b8a6" />
          </View>
        </TouchableOpacity>

        {/* Share App QR Card */}
        <TouchableOpacity
          style={styles.qrCard}
          activeOpacity={0.7}
          onPress={() => router.push("/(admin)/share-app" as any)}
        >
          <View style={styles.qrCardContent}>
            <View style={styles.qrCardLeft}>
              <View style={styles.qrMini}>
                <QRCode
                  value={QR_REDIRECT_URL}
                  size={100}
                  backgroundColor="#ffffff"
                  color="#0a0f1a"
                />
              </View>
            </View>
            <View style={styles.qrCardRight}>
              <Text style={styles.qrCardTitle}>Share with Scholars</Text>
              <Text style={styles.qrCardDesc}>
                Tap to open the full QR code screen for onboarding new team members.
              </Text>
              <View style={styles.qrCardArrow}>
                <Text style={styles.qrCardLink}>Open Share App</Text>
                <Ionicons name="chevron-forward" size={14} color="#14b8a6" />
              </View>
            </View>
          </View>
        </TouchableOpacity>

        {/* Create User Card */}
        <View style={styles.formCard}>
          {/* Info banner */}
          <View style={styles.infoBanner}>
            <View style={styles.infoBannerIcon}>
              <Ionicons name="person-add" size={20} color="#14b8a6" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.infoBannerTitle}>Add User Directly</Text>
              <Text style={styles.infoBannerDesc}>
                Create a new user account with a username and password you
                choose. The user will be able to log in immediately.
              </Text>
            </View>
          </View>

          {/* Error message */}
          {error ? (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={16} color="#ef4444" />
              <Text style={styles.errorText}>{error}</Text>
              <TouchableClose onPress={() => setError(null)} />
            </View>
          ) : null}

          {/* Success message */}
          {success ? (
            <View style={styles.successBanner}>
              <Ionicons name="checkmark-circle" size={16} color="#10b981" />
              <Text style={styles.successText}>{success}</Text>
              <TouchableClose onPress={() => setSuccess(null)} />
            </View>
          ) : null}

          {/* Form fields */}
          <FormInput
            label="Full Name"
            value={name}
            onChangeText={setName}
            placeholder="John Doe"
            autoCapitalize="words"
          />

          <FormInput
            label="Email Address"
            value={email}
            onChangeText={setEmail}
            placeholder="john@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <FormInput
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="Minimum 6 characters"
            secureTextEntry
          />

          <FormSelect
            label="Role"
            value={role}
            onValueChange={setRole}
            options={ROLE_OPTIONS}
          />

          <FormButton
            title={loading ? "Creating User..." : "Add User"}
            onPress={handleCreateUser}
            loading={loading}
            disabled={loading}
            variant="primary"
            style={{ marginTop: 8 }}
          />
        </View>

        {/* Info section */}
        <View style={styles.infoCard}>
          <View style={styles.infoCardHeader}>
            <Ionicons
              name="information-circle"
              size={20}
              color="#60a5fa"
            />
            <Text style={styles.infoCardTitle}>User Management Notes</Text>
          </View>
          <View style={styles.infoList}>
            <InfoBullet>
              <Text style={styles.infoText}>
                <Text style={styles.infoTextBold}>Scholars</Text> can claim
                jobs, view their assigned work, and track earnings.
              </Text>
            </InfoBullet>
            <InfoBullet>
              <Text style={styles.infoText}>
                <Text style={styles.infoTextBold}>Admins</Text> can create
                jobs, manage all users, approve signups, and access all system
                features.
              </Text>
            </InfoBullet>
            <InfoBullet>
              <Text style={styles.infoText}>
                Users created here are immediately active and can log in with
                the credentials you provide.
              </Text>
            </InfoBullet>
            <InfoBullet>
              <Text style={styles.infoText}>
                Make sure to securely share the password with the new user.
              </Text>
            </InfoBullet>
          </View>
        </View>
      </KeyboardAvoidingView>
    </AdminPageWrapper>
  );
}

// ---------------------------------------------------------------------------
// Helper components
// ---------------------------------------------------------------------------

function TouchableClose({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
      <Ionicons name="close" size={16} color="#8b9bb5" />
    </TouchableOpacity>
  );
}

function InfoBullet({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.bulletRow}>
      <View style={styles.bulletDot} />
      {children}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  // Header
  headerSection: {
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#f1f5f9",
  },
  headerSubtitle: {
    fontSize: 13,
    color: "#8b9bb5",
    marginTop: 4,
  },

  // Profile card
  profileCard: {
    backgroundColor: "#14b8a615",
    borderWidth: 1,
    borderColor: "#14b8a640",
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  profileCardContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  profileIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#14b8a620",
    justifyContent: "center",
    alignItems: "center",
  },
  profileCardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#14b8a6",
    marginBottom: 2,
  },
  profileCardDesc: {
    fontSize: 12,
    color: "#8b9bb5",
    lineHeight: 17,
  },

  // QR Card
  qrCard: {
    backgroundColor: "#1a2332",
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#14b8a625",
  },
  qrCardContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  qrCardLeft: {},
  qrMini: {
    backgroundColor: "#ffffff",
    borderRadius: 8,
    padding: 8,
  },
  qrCardRight: {
    flex: 1,
  },
  qrCardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#f1f5f9",
    marginBottom: 4,
  },
  qrCardDesc: {
    fontSize: 12,
    color: "#8b9bb5",
    lineHeight: 17,
    marginBottom: 8,
  },
  qrCardArrow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  qrCardLink: {
    fontSize: 13,
    fontWeight: "600",
    color: "#14b8a6",
  },

  // Form card
  formCard: {
    backgroundColor: "#1a2332",
    borderRadius: 14,
    padding: 18,
    marginBottom: 16,
  },

  // Info banner (inside card)
  infoBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: "#14b8a610",
    borderWidth: 1,
    borderColor: "#14b8a630",
    borderRadius: 10,
    padding: 14,
    marginBottom: 20,
  },
  infoBannerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#14b8a620",
    justifyContent: "center",
    alignItems: "center",
  },
  infoBannerTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#14b8a6",
    marginBottom: 4,
  },
  infoBannerDesc: {
    fontSize: 13,
    color: "#8b9bb5",
    lineHeight: 18,
  },

  // Error
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#ef444415",
    borderWidth: 1,
    borderColor: "#ef444430",
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  errorText: {
    color: "#ef4444",
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },

  // Success
  successBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#10b98115",
    borderWidth: 1,
    borderColor: "#10b98130",
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  successText: {
    color: "#10b981",
    fontSize: 13,
    flex: 1,
    fontWeight: "600",
    lineHeight: 18,
  },

  // Info card (bottom)
  infoCard: {
    backgroundColor: "#60a5fa10",
    borderWidth: 1,
    borderColor: "#60a5fa25",
    borderRadius: 14,
    padding: 18,
    marginBottom: 20,
  },
  infoCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
  },
  infoCardTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#60a5fa",
  },
  infoList: {
    gap: 10,
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  bulletDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#60a5fa",
    marginTop: 7,
  },
  infoText: {
    fontSize: 13,
    color: "#8b9bb5",
    lineHeight: 19,
    flex: 1,
  },
  infoTextBold: {
    fontWeight: "700",
    color: "#f1f5f9",
  },
});
