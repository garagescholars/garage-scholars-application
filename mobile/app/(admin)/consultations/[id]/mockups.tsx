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
import type { GsConsultation, ConsultationServiceType } from "../../../../src/types";

const PACKAGES: Record<ConsultationServiceType, Record<string, { name: string; price: string; features: string }>> = {
  garage_org: {
    tier1: { name: "The Undergraduate", price: "$1,197", features: "Overhead racks + basic declutter" },
    tier2: { name: "The Graduate", price: "$2,197", features: "Bins + shelving + overhead racks" },
    tier3: { name: "The Doctorate", price: "$3,697", features: "Cabinets + pegboard + full premium" },
  },
  gym_install: {
    tier1: { name: "Warm Up", price: "$997", features: "Dumbbells + pull-up bar + rubber floor" },
    tier2: { name: "Super Set", price: "$1,997", features: "Power cage + bench + cable machine" },
    tier3: { name: "1 Rep Max", price: "$4,797", features: "Full elite gym — rack, cables, mirrors" },
  },
};

const TIERS = ["tier1", "tier2", "tier3"] as const;
const { width: SCREEN_WIDTH } = Dimensions.get("window");

type ViewMode = "kontext" | "flux2" | "classic";

export default function MockupsPresentation() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [consultation, setConsultation] = useState<GsConsultation | null>(null);
  const [fullscreenTier, setFullscreenTier] = useState<string | null>(null);
  const [fullscreenMode, setFullscreenMode] = useState<ViewMode>("kontext");
  const [sharing, setSharing] = useState(false);
  const [activeMode, setActiveMode] = useState<ViewMode>("kontext");

  useEffect(() => {
    if (!id) return;
    const unsub = onSnapshot(doc(db, COLLECTIONS.CONSULTATIONS, id), (snap) => {
      if (snap.exists()) {
        setConsultation({ id: snap.id, ...snap.data() } as GsConsultation);
      }
    });
    return unsub;
  }, [id]);

  const handleShare = async (imageUrl: string, _tierName: string) => {
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
  const pkgs = PACKAGES[serviceType];
  const beforeUri = consultation.spacePhotoUrls?.wide;

  // Determine if dual-mode results exist
  const hasDualMode = TIERS.some((t) => {
    const m = consultation.mockups?.[t] as any;
    return m?.kontextStatus || m?.flux2Status;
  });

  // Helper to get the image URL and status for a tier based on active mode
  const getMockupData = (tier: string, mode: ViewMode) => {
    const m = consultation.mockups?.[tier as keyof typeof consultation.mockups] as any;
    if (!m) return { status: "idle" as const, imageUrl: null };

    if (mode === "kontext") {
      return {
        status: (m.kontextStatus || m.status || "idle") as string,
        imageUrl: m.kontextUrl || m.imageUrl || null,
      };
    } else if (mode === "flux2") {
      return {
        status: (m.flux2Status || "idle") as string,
        imageUrl: m.flux2Url || null,
      };
    }
    // classic
    return {
      status: (m.status || "idle") as string,
      imageUrl: m.imageUrl || null,
    };
  };

  // Count ready mockups per mode
  const countReady = (mode: ViewMode) =>
    TIERS.filter((t) => getMockupData(t, mode).status === "ready").length;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <Text style={styles.clientName}>{consultation.clientName}</Text>
        <Text style={styles.subtitle}>
          {serviceType === "garage_org" ? "Garage Organization" : "Home Gym Installation"} — {consultation.address}
        </Text>

        {/* Mode Toggle (only shown for dual-mode) */}
        {hasDualMode && (
          <View style={styles.modeToggleRow}>
            <TouchableOpacity
              style={[styles.modeTab, activeMode === "kontext" && styles.modeTabActive]}
              onPress={() => setActiveMode("kontext")}
            >
              <Text style={[styles.modeTabText, activeMode === "kontext" && styles.modeTabTextActive]}>
                Kontext 2-Pass
              </Text>
              <Text style={styles.modeReadyCount}>{countReady("kontext")}/3</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeTab, activeMode === "flux2" && styles.modeTabActive]}
              onPress={() => setActiveMode("flux2")}
            >
              <Text style={[styles.modeTabText, activeMode === "flux2" && styles.modeTabTextActive]}>
                FLUX.2 Pro Edit
              </Text>
              <Text style={styles.modeReadyCount}>{countReady("flux2")}/3</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Tier Cards */}
        {TIERS.map((tier) => {
          const pkg = pkgs[tier];
          const displayMode = hasDualMode ? activeMode : "classic";
          const { status, imageUrl } = getMockupData(tier, displayMode);

          return (
            <View key={tier} style={styles.tierCard}>
              <View style={styles.tierHeader}>
                <View>
                  <Text style={styles.tierName}>{pkg.name}</Text>
                  <Text style={styles.tierFeatures}>{pkg.features}</Text>
                </View>
                <Text style={styles.tierPrice}>{pkg.price}</Text>
              </View>

              {/* Mockup area */}
              {status === "generating" || status === "idle" ? (
                <View style={styles.shimmerContainer}>
                  <ShimmerSkeleton />
                  <Text style={styles.generatingText}>
                    {status === "idle" ? "Waiting..." : "Generating mockup..."}
                  </Text>
                </View>
              ) : status === "failed" ? (
                <View style={styles.failedContainer}>
                  <Ionicons name="warning-outline" size={24} color={colors.status.error} />
                  <Text style={styles.failedText}>Generation failed</Text>
                </View>
              ) : imageUrl && beforeUri ? (
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => {
                    setFullscreenTier(tier);
                    setFullscreenMode(displayMode);
                  }}
                >
                  <BeforeAfterSlider
                    beforeUri={beforeUri}
                    afterUri={imageUrl}
                    height={220}
                  />
                </TouchableOpacity>
              ) : null}

              {/* Mode comparison badges */}
              {hasDualMode && status === "ready" && (
                <View style={styles.modeBadgeRow}>
                  <View style={[styles.modeBadge, activeMode === "kontext" && styles.modeBadgeActive]}>
                    <View style={[styles.modeDot, { backgroundColor: "#6366f1" }]} />
                    <Text style={styles.modeBadgeText}>Kontext</Text>
                  </View>
                  <View style={[styles.modeBadge, activeMode === "flux2" && styles.modeBadgeActive]}>
                    <View style={[styles.modeDot, { backgroundColor: "#f59e0b" }]} />
                    <Text style={styles.modeBadgeText}>FLUX.2</Text>
                  </View>
                </View>
              )}

              {/* Share single tier */}
              {status === "ready" && imageUrl && (
                <TouchableOpacity
                  style={styles.shareOneBtn}
                  onPress={() => handleShare(imageUrl, pkg.name)}
                  disabled={sharing}
                >
                  <Ionicons name="share-outline" size={16} color={colors.brand.teal} />
                  <Text style={styles.shareOneText}>Share</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}
      </ScrollView>

      {/* Bottom bar */}
      <View style={styles.bottomBar}>
        <Text style={styles.bottomText}>Which setup fits your vision?</Text>
        <TouchableOpacity
          style={styles.shareAllBtn}
          onPress={() => {
            const displayMode = hasDualMode ? activeMode : "classic";
            const readyTier = TIERS.find(
              (t) => getMockupData(t, displayMode).status === "ready" && getMockupData(t, displayMode).imageUrl
            );
            if (readyTier) {
              const { imageUrl } = getMockupData(readyTier, displayMode);
              handleShare(imageUrl!, pkgs[readyTier].name);
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
      {fullscreenTier && beforeUri && (() => {
        const { imageUrl } = getMockupData(fullscreenTier, fullscreenMode);
        if (!imageUrl) return null;
        return (
          <Modal visible transparent animationType="fade">
            <View style={styles.fullscreenModal}>
              <TouchableOpacity
                style={styles.fullscreenClose}
                onPress={() => setFullscreenTier(null)}
              >
                <Ionicons name="close" size={28} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.fullscreenTitle}>
                {pkgs[fullscreenTier as keyof typeof pkgs].name} — {pkgs[fullscreenTier as keyof typeof pkgs].price}
              </Text>
              {hasDualMode && (
                <Text style={styles.fullscreenModeLabel}>
                  {fullscreenMode === "kontext" ? "Kontext 2-Pass" : "FLUX.2 Pro Edit"}
                </Text>
              )}
              <BeforeAfterSlider
                beforeUri={beforeUri}
                afterUri={imageUrl}
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
  subtitle: { fontSize: 14, color: colors.text.secondary, marginTop: 4, marginBottom: 12 },
  // Mode toggle
  modeToggleRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  modeTab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: colors.bg.card,
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  modeTabActive: {
    borderColor: colors.brand.teal,
    backgroundColor: `${colors.brand.teal}10`,
  },
  modeTabText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.text.muted,
  },
  modeTabTextActive: {
    color: colors.brand.teal,
  },
  modeReadyCount: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.text.muted,
  },
  // Tier cards
  tierCard: {
    backgroundColor: colors.bg.card,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: colors.brand.teal,
  },
  tierHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  tierName: { fontSize: 17, fontWeight: "700", color: colors.text.primary },
  tierFeatures: { fontSize: 13, color: colors.text.secondary, marginTop: 2, maxWidth: 220 },
  tierPrice: { fontSize: 18, fontWeight: "800", color: colors.brand.teal },
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
  // Mode comparison badges
  modeBadgeRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
    justifyContent: "center",
  },
  modeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: `${colors.text.muted}15`,
  },
  modeBadgeActive: {
    backgroundColor: `${colors.brand.teal}20`,
  },
  modeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  modeBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.text.secondary,
  },
  shareOneBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: `${colors.brand.teal}40`,
  },
  shareOneText: { fontSize: 13, fontWeight: "700", color: colors.brand.teal },
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
  fullscreenTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
    textAlign: "center",
    marginBottom: 6,
  },
  fullscreenModeLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.brand.teal,
    textAlign: "center",
    marginBottom: 16,
  },
});
