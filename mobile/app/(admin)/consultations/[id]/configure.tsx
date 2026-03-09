import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Switch,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { doc, onSnapshot, updateDoc, serverTimestamp } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../../../../src/lib/firebase";
import { COLLECTIONS } from "../../../../src/constants/collections";
import { colors } from "../../../../src/constants/theme";
import type { GsConsultation, ConsultationServiceType } from "../../../../src/types";

const PACKAGES = {
  garage_org: {
    tier1: { name: "The Undergraduate", price: "$1,197", desc: "Overhead racks + basic declutter" },
    tier2: { name: "The Graduate", price: "$2,197", desc: "Bins + shelving + overhead storage" },
    tier3: { name: "The Doctorate", price: "$3,697", desc: "Cabinets + pegboard + full premium" },
  },
  gym_install: {
    tier1: { name: "Warm Up", price: "$997", desc: "Dumbbells + pull-up bar + rubber floor" },
    tier2: { name: "Super Set", price: "$1,997", desc: "Power cage + bench + cable machine" },
    tier3: { name: "1 Rep Max", price: "$4,797", desc: "Full elite gym — rack, cables, mirrors" },
  },
} as const;

const GARAGE_FLOOR_COLORS = [
  { key: "gray", label: "Gray", color: "#9ca3af" },
  { key: "tan", label: "Tan", color: "#d4a76a" },
  { key: "charcoal", label: "Charcoal", color: "#4b5563" },
  { key: "blue", label: "Blue", color: "#3b82f6" },
];

const GYM_FLOOR_COLORS = [
  { key: "black", label: "Black", color: "#1f2937" },
  { key: "gray", label: "Gray", color: "#9ca3af" },
  { key: "blue", label: "Blue", color: "#3b82f6" },
];

export default function ConfigureConsultation() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [consultation, setConsultation] = useState<GsConsultation | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  // Garage addons state
  const [polyasparticFlooring, setPolyasparticFlooring] = useState(false);
  const [garageFloorColor, setGarageFloorColor] = useState<string | null>(null);
  const [overheadStorage, setOverheadStorage] = useState(false);
  const [extraShelving, setExtraShelving] = useState(false);

  // Gym addons state
  const [rubberFlooring, setRubberFlooring] = useState(false);
  const [gymFloorColor, setGymFloorColor] = useState<string | null>(null);
  const [mirrorWall, setMirrorWall] = useState(false);
  const [cableSystem, setCableSystem] = useState(false);
  const [pullUpRig, setPullUpRig] = useState(false);

  useEffect(() => {
    if (!id) return;
    const unsub = onSnapshot(doc(db, COLLECTIONS.CONSULTATIONS, id), (snap) => {
      if (snap.exists()) {
        const data = { id: snap.id, ...snap.data() } as GsConsultation;
        setConsultation(data);

        // Initialize addon state from doc
        if (data.garageAddons) {
          setPolyasparticFlooring(data.garageAddons.polyasparticFlooring);
          setGarageFloorColor(data.garageAddons.flooringColor);
          setOverheadStorage(data.garageAddons.overheadStorage);
          setExtraShelving(data.garageAddons.extraShelving);
        }
        if (data.gymAddons) {
          setRubberFlooring(data.gymAddons.rubberFlooring);
          setGymFloorColor(data.gymAddons.flooringColor);
          setMirrorWall(data.gymAddons.mirrorWall);
          setCableSystem(data.gymAddons.cableSystem);
          setPullUpRig(data.gymAddons.pullUpRig);
        }
      }
      setLoading(false);
    });
    return unsub;
  }, [id]);

  const handleGenerate = async () => {
    if (!id || !consultation) return;
    setGenerating(true);

    try {
      // Save addon choices to Firestore
      const consultRef = doc(db, COLLECTIONS.CONSULTATIONS, id);
      await updateDoc(consultRef, {
        garageAddons: {
          polyasparticFlooring,
          flooringColor: polyasparticFlooring ? garageFloorColor : null,
          overheadStorage,
          extraShelving,
        },
        gymAddons: {
          rubberFlooring,
          flooringColor: rubberFlooring ? gymFloorColor : null,
          mirrorWall,
          cableSystem,
          pullUpRig,
        },
        status: "generating",
        updatedAt: serverTimestamp(),
      });

      // Fire all 3 tiers in parallel
      const generateMockup = httpsCallable(functions, "gsGenerateConsultMockup");
      const tiers = ["tier1", "tier2", "tier3"] as const;
      tiers.forEach((tier) => {
        generateMockup({ consultationId: id, tier }).catch((err) => {
          console.error(`Failed to generate ${tier}:`, err);
        });
      });

      // Navigate immediately to mockups screen — live updates via onSnapshot
      router.replace(`/(admin)/consultations/${id}/mockups` as any);
    } catch (err: any) {
      console.error("Failed to start generation:", err);
      Alert.alert("Error", err.message || "Failed to start generation");
      setGenerating(false);
    }
  };

  if (loading || !consultation) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.brand.teal} />
      </View>
    );
  }

  const serviceType = consultation.serviceType;
  const pkgs = PACKAGES[serviceType];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      {/* Wide photo preview */}
      {consultation.spacePhotoUrls?.wide && (
        <Image
          source={{ uri: consultation.spacePhotoUrls.wide }}
          style={styles.previewPhoto}
          resizeMode="cover"
        />
      )}

      <Text style={styles.clientName}>{consultation.clientName}</Text>
      <Text style={styles.address}>{consultation.address}</Text>

      {/* Package tiers */}
      <Text style={styles.sectionLabel}>PACKAGES</Text>
      {(["tier1", "tier2", "tier3"] as const).map((tier) => {
        const pkg = pkgs[tier];
        return (
          <View key={tier} style={styles.packageCard}>
            <View style={styles.packageHeader}>
              <Text style={styles.packageName}>{pkg.name}</Text>
              <Text style={styles.packagePrice}>{pkg.price}</Text>
            </View>
            <Text style={styles.packageDesc}>{pkg.desc}</Text>
          </View>
        );
      })}

      {/* Addons */}
      <Text style={styles.sectionLabel}>ADD-ONS</Text>

      {serviceType === "garage_org" ? (
        <View style={styles.addonSection}>
          <AddonToggle
            label="Polyaspartic Flooring"
            value={polyasparticFlooring}
            onToggle={setPolyasparticFlooring}
          />
          {polyasparticFlooring && (
            <ColorPicker
              colors={GARAGE_FLOOR_COLORS}
              selected={garageFloorColor}
              onSelect={setGarageFloorColor}
            />
          )}
          <AddonToggle label="Overhead Storage" value={overheadStorage} onToggle={setOverheadStorage} />
          <AddonToggle label="Extra Shelving" value={extraShelving} onToggle={setExtraShelving} />
        </View>
      ) : (
        <View style={styles.addonSection}>
          <AddonToggle label="Rubber Flooring" value={rubberFlooring} onToggle={setRubberFlooring} />
          {rubberFlooring && (
            <ColorPicker
              colors={GYM_FLOOR_COLORS}
              selected={gymFloorColor}
              onSelect={setGymFloorColor}
            />
          )}
          <AddonToggle label="Mirror Wall" value={mirrorWall} onToggle={setMirrorWall} />
          <AddonToggle label="Cable System" value={cableSystem} onToggle={setCableSystem} />
          <AddonToggle label="Pull-Up Rig" value={pullUpRig} onToggle={setPullUpRig} />
        </View>
      )}

      {/* Generate Button */}
      <TouchableOpacity
        style={[styles.generateBtn, generating && styles.generateBtnDisabled]}
        onPress={handleGenerate}
        disabled={generating}
      >
        {generating ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Ionicons name="sparkles" size={22} color="#fff" />
        )}
        <Text style={styles.generateBtnText}>
          {generating ? "Starting..." : "Generate Mockups"}
        </Text>
      </TouchableOpacity>

      <Text style={styles.hint}>
        AI will generate 3 mockups — one per package tier. Takes ~10 seconds each.
      </Text>
    </ScrollView>
  );
}

// ── Sub-components ──

function AddonToggle({
  label,
  value,
  onToggle,
}: {
  label: string;
  value: boolean;
  onToggle: (v: boolean) => void;
}) {
  return (
    <View style={styles.addonRow}>
      <Text style={styles.addonLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: "#334155", true: `${colors.brand.teal}60` }}
        thumbColor={value ? colors.brand.teal : "#64748b"}
      />
    </View>
  );
}

function ColorPicker({
  colors: colorOptions,
  selected,
  onSelect,
}: {
  colors: { key: string; label: string; color: string }[];
  selected: string | null;
  onSelect: (key: string) => void;
}) {
  return (
    <View style={styles.colorRow}>
      {colorOptions.map((c) => (
        <TouchableOpacity
          key={c.key}
          style={[
            styles.colorSwatch,
            { backgroundColor: c.color },
            selected === c.key && styles.colorSwatchSelected,
          ]}
          onPress={() => onSelect(c.key)}
        >
          {selected === c.key && (
            <Ionicons name="checkmark" size={16} color="#fff" />
          )}
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  scroll: { padding: 16, paddingBottom: 40 },
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.bg.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  previewPhoto: {
    width: "100%",
    height: 200,
    borderRadius: 12,
    backgroundColor: colors.bg.card,
    marginBottom: 16,
  },
  clientName: { fontSize: 20, fontWeight: "700", color: colors.text.primary },
  address: { fontSize: 14, color: colors.text.secondary, marginTop: 2 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.text.muted,
    letterSpacing: 1,
    marginTop: 24,
    marginBottom: 10,
  },
  packageCard: {
    backgroundColor: colors.bg.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: colors.brand.teal,
  },
  packageHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  packageName: { fontSize: 15, fontWeight: "700", color: colors.text.primary },
  packagePrice: { fontSize: 15, fontWeight: "700", color: colors.brand.teal },
  packageDesc: { fontSize: 13, color: colors.text.secondary, marginTop: 4 },
  addonSection: { gap: 4 },
  addonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.bg.card,
    borderRadius: 10,
    padding: 14,
    marginBottom: 6,
  },
  addonLabel: { fontSize: 15, fontWeight: "600", color: colors.text.primary },
  colorRow: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 14,
    paddingBottom: 10,
  },
  colorSwatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  colorSwatchSelected: {
    borderColor: colors.brand.teal,
    borderWidth: 3,
  },
  generateBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: colors.brand.teal,
    borderRadius: 14,
    paddingVertical: 16,
    marginTop: 28,
  },
  generateBtnDisabled: { opacity: 0.6 },
  generateBtnText: { color: "#fff", fontSize: 17, fontWeight: "700" },
  hint: {
    fontSize: 13,
    color: colors.text.muted,
    textAlign: "center",
    marginTop: 10,
  },
});
