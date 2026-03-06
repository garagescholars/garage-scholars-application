import { useRef, useEffect } from "react";
import { Modal, View, StyleSheet, ActivityIndicator, Text, TouchableOpacity, Platform } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";

type Props = {
  visible: boolean;
  phoneNumber: string; // E.164 format, e.g. +15551234567
  onVerificationId: (id: string) => void;
  onError: (msg: string) => void;
  onCancel: () => void;
};

// Hosted on Firebase Hosting — runs reCAPTCHA on an authorized domain
const AUTH_PAGE_BASE = "https://garage-scholars-scheduling.web.app/phone-auth.html";

export default function PhoneAuthWebView({ visible, phoneNumber, onVerificationId, onError, onCancel }: Props) {
  const webViewRef = useRef<WebView>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-timeout after 20 seconds if reCAPTCHA doesn't resolve
  useEffect(() => {
    if (visible) {
      timeoutRef.current = setTimeout(() => {
        onError("Verification timed out. Please try again or use email login instead.");
      }, 60000);
    }
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [visible]);

  const handleMessage = (event: WebViewMessageEvent) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === "verificationId") {
        onVerificationId(data.verificationId);
      } else if (data.type === "error") {
        onError(data.message);
      }
    } catch {
      onError("Unexpected error during verification.");
    }
  };

  // On web, we can't use WebView — skip this component
  if (Platform.OS === "web") {
    return null;
  }

  const uri = `${AUTH_PAGE_BASE}?phone=${encodeURIComponent(phoneNumber)}`;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.header}>
            <ActivityIndicator size="small" color="#14b8a6" />
            <Text style={styles.headerText}>Verify you're human</Text>
          </View>
          <Text style={styles.subText}>
            Tap the reCAPTCHA checkbox below, then we'll send your verification code.
          </Text>

          {visible && (
            <View style={styles.webviewContainer}>
              <WebView
                ref={webViewRef}
                source={{ uri }}
                onMessage={handleMessage}
                onError={() => onError("Failed to load verification page. Check your internet connection.")}
                onHttpError={() => onError("Verification page returned an error.")}
                style={styles.webview}
                javaScriptEnabled
                domStorageEnabled
                thirdPartyCookiesEnabled
                sharedCookiesEnabled
                mixedContentMode="compatibility"
                originWhitelist={["*"]}
              />
            </View>
          )}

          <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    backgroundColor: "#1e293b",
    borderRadius: 16,
    padding: 24,
    width: "85%",
    maxWidth: 360,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  headerText: {
    color: "#f8fafc",
    fontSize: 16,
    fontWeight: "700",
  },
  subText: {
    color: "#94a3b8",
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 12,
  },
  webviewContainer: {
    height: 200,
    width: "100%",
    overflow: "hidden",
    borderRadius: 8,
    backgroundColor: "#0f1b2d",
  },
  webview: {
    flex: 1,
    backgroundColor: "#0f1b2d",
  },
  cancelBtn: {
    alignItems: "center",
    paddingVertical: 12,
    marginTop: 8,
  },
  cancelText: {
    color: "#64748b",
    fontSize: 14,
    fontWeight: "600",
  },
});
