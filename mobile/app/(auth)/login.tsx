import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Pressable,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  FadeInDown,
} from "react-native-reanimated";
import PhoneAuthWebView from "../../src/components/PhoneAuthWebView";

function formatPhoneStatic(input: string) {
  const digits = input.replace(/\D/g, "");
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
}

export default function LoginScreen() {
  const { resendPhone } = useLocalSearchParams<{ resendPhone?: string }>();
  const [phone, setPhone] = useState(() => {
    if (resendPhone) return formatPhoneStatic(resendPhone);
    return "";
  });
  const [loading, setLoading] = useState(false);
  const [showRecaptcha, setShowRecaptcha] = useState(false);
  const [focused, setFocused] = useState(false);
  const router = useRouter();
  const buttonScale = useSharedValue(1);

  const formatPhone = formatPhoneStatic;

  const digits = phone.replace(/\D/g, "");
  const isValid = digits.length === 10;

  const handleSendCode = () => {
    if (!isValid) {
      Alert.alert("Invalid Phone", "Please enter a valid 10-digit US phone number.");
      return;
    }
    setLoading(true);
    setShowRecaptcha(true);
  };

  const handleVerificationId = (verificationId: string) => {
    setShowRecaptcha(false);
    setLoading(false);
    const fullPhone = `+1${digits}`;
    router.push({
      pathname: "/(auth)/verify",
      params: { phone: fullPhone, verificationId },
    });
  };

  const handleRecaptchaError = (message: string) => {
    setShowRecaptcha(false);
    setLoading(false);
    Alert.alert("Verification Error", message);
  };

  const handleRecaptchaCancel = () => {
    setShowRecaptcha(false);
    setLoading(false);
  };

  const buttonAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.content}>
        <Animated.View entering={FadeInDown.duration(500).springify()} style={styles.header}>
          <Text style={styles.emoji}>🔧</Text>
          <Text style={styles.title}>Garage Scholars</Text>
          <Text style={styles.subtitle}>Enter your phone number to get started</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(150).duration(500).springify()} style={styles.form}>
          <Text style={styles.label}>Phone Number</Text>
          <View style={[styles.phoneRow, focused && styles.phoneRowFocused]}>
            <View style={[styles.countryCode, focused && styles.countryCodeFocused]}>
              <Text style={[styles.countryCodeText, focused && { color: "#14b8a6" }]}>+1</Text>
            </View>
            <TextInput
              style={[styles.input, focused && styles.inputFocused]}
              value={phone}
              onChangeText={(t) => setPhone(formatPhone(t))}
              placeholder="(555) 123-4567"
              placeholderTextColor="#5a6a80"
              keyboardType="phone-pad"
              maxLength={14}
              autoFocus
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
            />
          </View>
          {digits.length > 0 && !isValid && (
            <Animated.Text
              entering={FadeInDown.duration(200)}
              style={styles.hint}
            >
              {10 - digits.length} more digit{10 - digits.length !== 1 ? 's' : ''} needed
            </Animated.Text>
          )}

          <Animated.View style={buttonAnimStyle}>
            <Pressable
              style={[styles.button, (!isValid || loading) && styles.buttonDisabled]}
              onPress={handleSendCode}
              disabled={loading || !isValid}
              onPressIn={() => { buttonScale.value = withSpring(0.96); }}
              onPressOut={() => { buttonScale.value = withSpring(1); }}
            >
              {loading ? (
                <View style={styles.buttonContent}>
                  <ActivityIndicator size="small" color="#fff" />
                  <Text style={styles.buttonText}>Sending...</Text>
                </View>
              ) : (
                <Text style={styles.buttonText}>Send Verification Code</Text>
              )}
            </Pressable>
          </Animated.View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(300).duration(500).springify()} style={styles.altLinks}>
          <Pressable onPress={() => router.push("/(auth)/email-login")}>
            <Text style={styles.altLinkText}>
              Sign in with <Text style={styles.altLinkAccent}>email</Text> instead
            </Text>
          </Pressable>
          <Pressable onPress={() => router.push("/(auth)/create-account")}>
            <Text style={styles.altLinkText}>
              Don't have an account? <Text style={styles.altLinkAccent}>Create one</Text>
            </Text>
          </Pressable>
        </Animated.View>

        <Animated.Text
          entering={FadeInDown.delay(400).duration(500).springify()}
          style={styles.disclaimer}
        >
          By continuing, you agree to receive SMS messages for verification.
          Standard messaging rates may apply.
        </Animated.Text>
      </View>

      {/* reCAPTCHA WebView (invisible, handles Firebase phone auth) */}
      <PhoneAuthWebView
        visible={showRecaptcha}
        phoneNumber={`+1${digits}`}
        onVerificationId={handleVerificationId}
        onError={handleRecaptchaError}
        onCancel={handleRecaptchaCancel}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0f1a",
  },
  content: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  header: {
    alignItems: "center",
    marginBottom: 40,
  },
  emoji: {
    fontSize: 48,
    marginBottom: 16,
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
  form: {
    marginBottom: 32,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#cbd5e1",
    marginBottom: 8,
  },
  phoneRow: {
    flexDirection: "row",
    marginBottom: 6,
  },
  phoneRowFocused: {},
  countryCode: {
    backgroundColor: "#1a2332",
    borderRadius: 12,
    paddingHorizontal: 16,
    justifyContent: "center",
    marginRight: 8,
    borderWidth: 1,
    borderColor: "#2a3545",
  },
  countryCodeFocused: {
    borderColor: "#14b8a6",
  },
  countryCodeText: {
    color: "#cbd5e1",
    fontSize: 16,
    fontWeight: "600",
  },
  input: {
    flex: 1,
    backgroundColor: "#1a2332",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 18,
    color: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#2a3545",
    letterSpacing: 0.5,
  },
  inputFocused: {
    borderColor: "#14b8a6",
  },
  hint: {
    fontSize: 12,
    color: "#5a6a80",
    marginBottom: 14,
    marginLeft: 4,
  },
  button: {
    backgroundColor: "#14b8a6",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 14,
  },
  buttonDisabled: {
    backgroundColor: "#1a2332",
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
  altLinks: {
    alignItems: "center",
    gap: 14,
    marginBottom: 24,
  },
  altLinkText: {
    fontSize: 14,
    color: "#8b9bb5",
  },
  altLinkAccent: {
    color: "#14b8a6",
    fontWeight: "600",
  },
  disclaimer: {
    fontSize: 12,
    color: "#5a6a80",
    textAlign: "center",
    lineHeight: 18,
    paddingHorizontal: 16,
  },
});
