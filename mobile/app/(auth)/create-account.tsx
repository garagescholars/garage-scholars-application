import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../../src/lib/firebase";
import { COLLECTIONS } from "../../src/constants/collections";

type RoleOption = "scholar" | "customer";

export default function CreateAccountScreen() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState<RoleOption>("scholar");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const router = useRouter();

  // Track focus states
  const [nameFocused, setNameFocused] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [phoneFocused, setPhoneFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [confirmFocused, setConfirmFocused] = useState(false);

  const handleSubmit = async () => {
    setError(null);

    if (!fullName.trim()) {
      setError("Please enter your full name.");
      return;
    }
    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const normalizedEmail = email.trim().toLowerCase();

      await addDoc(collection(db, COLLECTIONS.SIGNUP_REQUESTS), {
        fullName: fullName.trim(),
        email: normalizedEmail,
        phone: phone.trim() || null,
        password,
        role,
        status: "pending",
        createdAt: serverTimestamp(),
      });

      // Send admin notification email
      await addDoc(collection(db, "mail"), {
        to: ["garagescholars@gmail.com", "admin@garagescholars.com"],
        message: {
          subject: `New Account Request — ${fullName.trim()} (${role})`,
          html:
            `<h2>New Account Request</h2>` +
            `<p><strong>Name:</strong> ${fullName.trim()}</p>` +
            `<p><strong>Email:</strong> ${normalizedEmail}</p>` +
            `<p><strong>Phone:</strong> ${phone.trim() || "Not provided"}</p>` +
            `<p><strong>Role:</strong> ${role}</p>` +
            `<hr>` +
            `<p>Log in to the admin app to approve or reject this request.</p>` +
            `<p style="color:#888;font-size:12px;">Sent from the Garage Scholars mobile app</p>`,
        },
      });

      router.replace("/(auth)/pending-approval");
    } catch (err) {
      console.error("Signup request error:", err);
      const message =
        err instanceof Error ? err.message : "Failed to submit request.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          {/* Back button */}
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="arrow-back" size={22} color="#14b8a6" />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconCircle}>
              <Ionicons name="person-add-outline" size={40} color="#14b8a6" />
            </View>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>
              Submit your request for admin approval
            </Text>
          </View>

          {/* Error message */}
          {error && (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={18} color="#f87171" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Form */}
          <View style={styles.form}>
            {/* Full Name */}
            <Text style={styles.label}>Full Name</Text>
            <View
              style={[
                styles.inputWrapper,
                nameFocused && styles.inputWrapperFocused,
              ]}
            >
              <Ionicons
                name="person-outline"
                size={20}
                color={nameFocused ? "#14b8a6" : "#5a6a80"}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                value={fullName}
                onChangeText={setFullName}
                placeholder="John Doe"
                placeholderTextColor="#5a6a80"
                autoCapitalize="words"
                autoCorrect={false}
                onFocus={() => setNameFocused(true)}
                onBlur={() => setNameFocused(false)}
                returnKeyType="next"
                editable={!loading}
              />
            </View>

            {/* Email */}
            <Text style={styles.label}>Email</Text>
            <View
              style={[
                styles.inputWrapper,
                emailFocused && styles.inputWrapperFocused,
              ]}
            >
              <Ionicons
                name="mail-outline"
                size={20}
                color={emailFocused ? "#14b8a6" : "#5a6a80"}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor="#5a6a80"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                onFocus={() => setEmailFocused(true)}
                onBlur={() => setEmailFocused(false)}
                returnKeyType="next"
                editable={!loading}
              />
            </View>

            {/* Phone Number */}
            <Text style={styles.label}>Phone Number</Text>
            <View
              style={[
                styles.inputWrapper,
                phoneFocused && styles.inputWrapperFocused,
              ]}
            >
              <Ionicons
                name="call-outline"
                size={20}
                color={phoneFocused ? "#14b8a6" : "#5a6a80"}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                placeholder="(555) 555-5555"
                placeholderTextColor="#5a6a80"
                keyboardType="phone-pad"
                autoCapitalize="none"
                autoCorrect={false}
                onFocus={() => setPhoneFocused(true)}
                onBlur={() => setPhoneFocused(false)}
                returnKeyType="next"
                editable={!loading}
              />
            </View>

            {/* Role Selector */}
            <Text style={styles.label}>I am a...</Text>
            <View style={styles.roleRow}>
              <TouchableOpacity
                style={[
                  styles.roleOption,
                  role === "scholar" && styles.roleOptionActive,
                ]}
                onPress={() => setRole("scholar")}
                disabled={loading}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="construct-outline"
                  size={22}
                  color={role === "scholar" ? "#14b8a6" : "#5a6a80"}
                />
                <Text
                  style={[
                    styles.roleText,
                    role === "scholar" && styles.roleTextActive,
                  ]}
                >
                  Scholar
                </Text>
                {role === "scholar" && (
                  <Ionicons
                    name="checkmark-circle"
                    size={18}
                    color="#14b8a6"
                    style={styles.roleCheck}
                  />
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.roleOption,
                  role === "customer" && styles.roleOptionActive,
                ]}
                onPress={() => setRole("customer")}
                disabled={loading}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="home-outline"
                  size={22}
                  color={role === "customer" ? "#14b8a6" : "#5a6a80"}
                />
                <Text
                  style={[
                    styles.roleText,
                    role === "customer" && styles.roleTextActive,
                  ]}
                >
                  Customer
                </Text>
                {role === "customer" && (
                  <Ionicons
                    name="checkmark-circle"
                    size={18}
                    color="#14b8a6"
                    style={styles.roleCheck}
                  />
                )}
              </TouchableOpacity>
            </View>

            {/* Password */}
            <Text style={styles.label}>Password</Text>
            <View
              style={[
                styles.inputWrapper,
                passwordFocused && styles.inputWrapperFocused,
              ]}
            >
              <Ionicons
                name="key-outline"
                size={20}
                color={passwordFocused ? "#14b8a6" : "#5a6a80"}
                style={styles.inputIcon}
              />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={password}
                onChangeText={setPassword}
                placeholder="At least 6 characters"
                placeholderTextColor="#5a6a80"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setPasswordFocused(false)}
                returnKeyType="next"
                editable={!loading}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeButton}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons
                  name={showPassword ? "eye-off-outline" : "eye-outline"}
                  size={20}
                  color="#5a6a80"
                />
              </TouchableOpacity>
            </View>

            {/* Confirm Password */}
            <Text style={styles.label}>Confirm Password</Text>
            <View
              style={[
                styles.inputWrapper,
                confirmFocused && styles.inputWrapperFocused,
              ]}
            >
              <Ionicons
                name="shield-checkmark-outline"
                size={20}
                color={confirmFocused ? "#14b8a6" : "#5a6a80"}
                style={styles.inputIcon}
              />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Re-enter your password"
                placeholderTextColor="#5a6a80"
                secureTextEntry={!showConfirmPassword}
                autoCapitalize="none"
                onFocus={() => setConfirmFocused(true)}
                onBlur={() => setConfirmFocused(false)}
                returnKeyType="go"
                onSubmitEditing={handleSubmit}
                editable={!loading}
              />
              <TouchableOpacity
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                style={styles.eyeButton}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons
                  name={showConfirmPassword ? "eye-off-outline" : "eye-outline"}
                  size={20}
                  color="#5a6a80"
                />
              </TouchableOpacity>
            </View>

            {/* Submit button */}
            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleSubmit}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <View style={styles.buttonContent}>
                  <ActivityIndicator size="small" color="#fff" />
                  <Text style={styles.buttonText}>Submitting...</Text>
                </View>
              ) : (
                <View style={styles.buttonContent}>
                  <Ionicons name="send-outline" size={20} color="#fff" />
                  <Text style={styles.buttonText}>Request Access</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Login link */}
          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => router.back()}
            disabled={loading}
          >
            <Text style={styles.linkText}>
              Already have an account?{" "}
              <Text style={styles.linkTextAccent}>Log in</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0f1a",
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 56,
    paddingBottom: 40,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 24,
  },
  backText: {
    color: "#14b8a6",
    fontSize: 16,
    fontWeight: "600",
  },
  header: {
    alignItems: "center",
    marginBottom: 28,
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "#1a2332",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#f1f5f9",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#8b9bb5",
    textAlign: "center",
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.25)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 20,
    gap: 10,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: "#f87171",
    lineHeight: 20,
  },
  form: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#cbd5e1",
    marginBottom: 8,
    marginLeft: 4,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1a2332",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2a3545",
    marginBottom: 16,
  },
  inputWrapperFocused: {
    borderColor: "#14b8a6",
  },
  inputIcon: {
    marginLeft: 14,
  },
  input: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 14,
    fontSize: 16,
    color: "#f1f5f9",
  },
  eyeButton: {
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  roleRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  roleOption: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1a2332",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2a3545",
    paddingVertical: 14,
    paddingHorizontal: 12,
    gap: 8,
  },
  roleOptionActive: {
    borderColor: "#14b8a6",
    backgroundColor: "rgba(20, 184, 166, 0.08)",
  },
  roleText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#5a6a80",
  },
  roleTextActive: {
    color: "#f1f5f9",
  },
  roleCheck: {
    marginLeft: 2,
  },
  button: {
    backgroundColor: "#14b8a6",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
  linkButton: {
    alignItems: "center",
    paddingVertical: 12,
  },
  linkText: {
    fontSize: 14,
    color: "#8b9bb5",
  },
  linkTextAccent: {
    color: "#14b8a6",
    fontWeight: "600",
  },
});
