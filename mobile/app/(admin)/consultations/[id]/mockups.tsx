import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  Dimensions,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { doc, onSnapshot } from "firebase/firestore";
import * as Sharing from "expo-sharing";
import { Paths, File as ExpoFile } from "expo-file-system/next";
import { db } from "../../../../src/lib/firebase";
import { COLLECTIONS } from "../../../../src/constants/collections";
import { colors } from "../../../../src/constants/theme";
import BeforeAfterSlider from "../../../../src/components/BeforeAfterSlider";
import type { GsConsultation, ShadeKey } from "../../../../src/types";

const SHADE_KEYS: ShadeKey[] = ["shade1", "shade2", "shade3"];
const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function MockupsPresentation() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [consultation, setConsultation] = useState<GsConsultation | null>(null);
  const [activeShade, setActiveShade] = useState<ShadeKey>("shade1");
  const [fullscreenShade, setFullscreenShade] = useState<ShadeKey | null>(null);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    if (!id) return;
    const unsub = onSnapshot(doc(db, COLLECTIONS.CONSULTATIONS, id), (snap) => {
      if (snap.exists()) {
        setConsultation({ id: snap.id, ...snap.data() } as GsConsultation);
      }
    });
    return unsub;
  }, [id]);

  const handleShare = async (imageUrl: string) => {
    setSharing(true);
    try {
      const file = new ExpoFile(Paths.cache, `mockup_${Date.now()}.png`);
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const buffer = await blob.arrayBuffer();
      file.write(new Uint8Array(buffer));
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(file.uri);
      } else {
        Alert.alert("Sharing not available on this device");
      }
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to share image");
    } finally {
      setSharing(false);
    }
  };

  if (!consultation) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.brand.teal} />
      </View>
    );
  }

  const serviceType = consultation.serviceType;
  const beforeUri = consultation.spacePhotoUrls?.wide;
  const mockups = consultation.mockups as any;

  // Get shade data
  const getShadeData = (shade: ShadeKey) => {
    const m = mockups?.[shade];
    if (!m) return { status: "idle", imageUrl: null, bmName: "", bmCode: "", hex: "#888" };
    return {
      status: (m.status || "idle") as string,
      imageUrl: m.imageUrl || null,
      bmName: m.bmName || "",
      bmCode: m.bmCode || "",
      hex: m.hex || "#888",
    };
  };

  const activeData = getShadeData(activeShade);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <Text style={styles.clientName}>{consultation.clientName}</Text>
        <Text style={styles.subtitle}>
          {serviceType === "garage_org" ? "Garage Organization" : "Home Gym Installation"} — {consultation.address}
        </Text>

        {/* Shade Tabs */}
        <View style={styles.shadeTabRow}>
          {SHADE_KEYS.map((shade) => {
            const data = getShadeData(shade);
            const isActive = activeShade === shade;
            return (
              <TouchableOpacity
                key={shade}
                style={[styles.shadeTab, isActive && styles.shadeTabActive]}
                onPress={() => setActiveShade(shade)}
              >
                <View style={[styles.shadeTabSwatch, { backgroundColor: data.hex }]}>
                  {data.status === "ready" && (
                    <Ionicons name="checkmark" size={12} color="#fff" />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.shadeTabName, isActive && styles.shadeTabNameActive]} numberOfLines={1}>
                    {data.bmName || "—"}
                  </Text>
                  <Text style={styles.shadeTabCode}>{data.bmCode}</Text>
                </View>
                {data.status === "generating" && (
                  <ActivityIndicator size="small" color={colors.brand.teal} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Active Shade Mockup */}
        <View style={styles.mockupCard}>
          <View style={styles.mockupCardHeader}>
            <View style={[styles.headerSwatch, { backgroundColor: activeData.hex }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.mockupColorName}>{activeData.bmName}</Text>
              <Text style={styles.mockupColorCode}>{activeData.bmCode}</Text>
            </View>
          </View>

          {activeData.status === "generating" || activeData.status === "idle" ? (
            <View style={styles.shimmerContainer}>
              <ShimmerSkeleton />
              <Text style={styles.generatingText}>
                {activeData.status === "idle" ? "Waiting..." : "Generating mockup..."}
              </Text>
            </View>
          ) : activeData.status === "failed" ? (
            <View style={styles.failedContainer}>
              <Ionicons name="warning-outline" size={24} color={colors.status.error} />
              <Text style={styles.failedText}>Generation failed</Text>
            </View>
          ) : activeData.imageUrl && beforeUri ? (
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => setFullscreenShade(activeShade)}
            >
              <BeforeAfterSlider
                beforeUri={beforeUri}
                afterUri={activeData.imageUrl}
                height={260}
              />
            </TouchableOpacity>
          ) : null}

          {/* Share button */}
          {activeData.status === "ready" && activeData.imageUrl && (
            <TouchableOpacity
              style={styles.shareOneBtn}
              onPress={() => handleShare(activeData.imageUrl!)}
              disabled={sharing}
            >
              <Ionicons name="share-outline" size={16} color={colors.brand.teal} />
              <Text style={styles.shareOneText}>Share This Shade</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* All Shades Summary */}
        <Text style={styles.summaryLabel}>ALL SHADES</Text>
        {SHADE_KEYS.map((shade) => {
          const data = getShadeData(shade);
          return (
            <TouchableOpacity
              key={shade}
              style={[styles.summaryRow, activeShade === shade && styles.summaryRowActive]}
              onPress={() => setActiveShade(shade)}
            >
              <View style={[styles.summaryDot, { backgroundColor: data.hex }]} />
              <Text style={styles.summaryName}>{data.bmName || "—"}</Text>
              <View style={styles.summaryStatus}>
                {data.status === "ready" ? (
                  <Ionicons name="checkmark-circle" size={18} color="#10b981" />
                ) : data.status === "generating" ? (
                  <ActivityIndicator size="small" color={colors.brand.teal} />
                ) : data.status === "failed" ? (
                  <Ionicons name="close-circle" size={18} color={colors.status.error} />
                ) : (
                  <Ionicons name="ellipse-outline" size={18} color={colors.text.muted} />
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Bottom bar */}
      <View style={styles.bottomBar}>
        <Text style={styles.bottomText}>Which shade fits your vision?</Text>
        <TouchableOpacity
          style={styles.shareAllBtn}
          onPress={() => {
            const readyShade = SHADE_KEYS.find(
              (s) => getShadeData(s).status === "ready" && getShadeData(s).imageUrl
            );
            if (readyShade) {
              handleShare(getShadeData(readyShade).imageUrl!);
            } else {
              Alert.alert("No mockups ready", "Wait for at least one mockup to finish generating.");
            }
          }}
          disabled={sharing}
        >
          <Ionicons name="paper-plane" size={18} color="#fff" />
          <Text style={styles.shareAllText}>Share With Customer</Text>
        </TouchableOpacity>
      </View>

      {/* Fullscreen modal */}
      {fullscreenShade && beforeUri && (() => {
        const data = getShadeData(fullscreenShade);
        if (!data.imageUrl) return null;
        return (
          <Modal visible transparent animationType="fade">
            <View style={styles.fullscreenModal}>
              <TouchableOpacity
                style={styles.fullscreenClose}
                onPress={() => setFullscreenShade(null)}
              >
                <Ionicons name="close" size={28} color="#fff" />
              </TouchableOpacity>
              <View style={styles.fullscreenHeader}>
                <View style={[styles.fullscreenSwatch, { backgroundColor: data.hex }]} />
                <Text style={styles.fullscreenTitle}>{data.bmName}</Text>
                <Text style={styles.fullscreenCode}>{data.bmCode}</Text>
              </View>
              <BeforeAfterSlider
                beforeUri={beforeUri}
                afterUri={data.imageUrl}
                height={SCREEN_WIDTH * 0.75}
              />
            </View>
          </Modal>
        );
      })()}
    </View>
  );
}

// ── Shimmer skeleton ──

function ShimmerSkeleton() {
  return (
    <View style={styles.shimmer}>
      <View style={[styles.shimmerBar, { width: "80%" }]} />
      <View style={[styles.shimmerBar, { width: "60%", marginTop: 8 }]} />
      <View style={[styles.shimmerBar, { width: "90%", marginTop: 8, height: 120 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  scroll: { padding: 16, paddingBottom: 120 },
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.bg.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  clientName: { fontSize: 22, fontWeight: "700", color: colors.text.primary },
  subtitle: { fontSize: 14, color: colors.text.secondary, marginTop: 4, marginBottom: 16 },
  // Shade tabs
  shadeTabRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  shadeTab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: colors.bg.card,
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  shadeTabActive: {
    borderColor: colors.brand.teal,
    backgroundColor: `${colors.brand.teal}10`,
  },
  shadeTabSwatch: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  shadeTabName: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.text.muted,
  },
  shadeTabNameActive: {
    color: colors.brand.teal,
  },
  shadeTabCode: {
    fontSize: 9,
    color: colors.text.muted,
  },
  // Mockup card
  mockupCard: {
    backgroundColor: colors.bg.card,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  mockupCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },
  headerSwatch: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.1)",
  },
  mockupColorName: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text.primary,
  },
  mockupColorCode: {
    fontSize: 13,
    color: colors.text.secondary,
  },
  shimmerContainer: {
    alignItems: "center",
    paddingVertical: 20,
  },
  shimmer: { width: "100%", padding: 12 },
  shimmerBar: {
    height: 14,
    backgroundColor: `${colors.brand.teal}15`,
    borderRadius: 6,
  },
  generatingText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.brand.teal,
    marginTop: 12,
  },
  failedContainer: {
    alignItems: "center",
    paddingVertical: 20,
    gap: 6,
  },
  failedText: { fontSize: 13, fontWeight: "600", color: colors.status.error },
  shareOneBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: `${colors.brand.teal}40`,
  },
  shareOneText: { fontSize: 14, fontWeight: "700", color: colors.brand.teal },
  // Summary section
  summaryLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.text.muted,
    letterSpacing: 1,
    marginBottom: 8,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.bg.card,
    borderRadius: 10,
    padding: 12,
    marginBottom: 6,
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  summaryRowActive: {
    borderColor: colors.brand.teal,
    backgroundColor: `${colors.brand.teal}08`,
  },
  summaryDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  summaryName: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: colors.text.primary,
  },
  summaryStatus: {},
  // Bottom bar
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.bg.card,
    borderTopWidth: 1,
    borderTopColor: colors.border.divider,
    padding: 16,
    paddingBottom: 32,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  bottomText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: colors.text.secondary,
  },
  shareAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.brand.teal,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 10,
  },
  shareAllText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  // Fullscreen modal
  fullscreenModal: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.95)",
    justifyContent: "center",
    padding: 16,
  },
  fullscreenClose: {
    position: "absolute",
    top: 56,
    right: 20,
    zIndex: 10,
  },
  fullscreenHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginBottom: 16,
  },
  fullscreenSwatch: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  fullscreenTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
  },
  fullscreenCode: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.brand.teal,
  },
});
