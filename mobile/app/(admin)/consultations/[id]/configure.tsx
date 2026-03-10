import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
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
import {
  BM_COLORS,
  BM_FAMILIES,
  BM_FAMILY_LABELS,
  getColorsByFamily,
  type BMColor,
  type BMFamily,
} from "../../../../src/constants/benjaminMooreColors";
import type {
  GsConsultation,
  ShelvingOption,
  OverheadOption,
  CabinetOption,
  WallOrgOption,
  GarageFlooringType,
  GymFlooringType,
  RackOption,
  BenchOption,
  CableOption,
  GymAccessory,
  BMColorRef,
} from "../../../../src/types";

const PACKAGES = {
  garage_org: {
    tier1: { name: "The Undergraduate", price: "$1,197", desc: "Surface reset, sort & declutter, 1 zone/1 shelf, sweep & blow clean" },
    tier2: { name: "The Graduate", price: "$2,197", desc: "Haul-away, micro-sorting, 8 bins, $300 storage credit, degrease & powerwash" },
    tier3: { name: "The Doctorate", price: "$3,797", desc: "2 haul-aways, 16 premium bins, $500 storage credit, seasonal swap, white-glove" },
  },
  gym_install: {
    tier1: { name: "Warm Up", price: "$997", desc: "Up to 2 equipment pieces, basic positioning, 2 scholars" },
    tier2: { name: "Super Set", price: "$1,997", desc: "Up to 3 pieces, DPT-designed layout, 2 scholars" },
    tier3: { name: "1 Rep Max", price: "$4,797", desc: "Up to 5 pieces, full flooring, DPT layout, wall storage, deadlift platform" },
  },
} as const;

// Garage addon option configs
const SHELVING_OPTIONS: { key: ShelvingOption; label: string }[] = [
  { key: "none", label: "None" },
  { key: "1-unit", label: "1 Unit" },
  { key: "2-units", label: "2 Units" },
  { key: "3-units", label: "3 Units" },
];

const OVERHEAD_OPTIONS: { key: OverheadOption; label: string }[] = [
  { key: "none", label: "None" },
  { key: "2-racks", label: "2 Racks" },
  { key: "4-racks", label: "4 Racks" },
];

const CABINET_OPTIONS: { key: CabinetOption; label: string }[] = [
  { key: "none", label: "None" },
  { key: "basic-wire", label: "Basic Wire" },
  { key: "premium-newage", label: "Premium NewAge" },
];

const WALL_ORG_OPTIONS: { key: WallOrgOption; label: string }[] = [
  { key: "none", label: "None" },
  { key: "pegboard", label: "Pegboard" },
  { key: "slatwall", label: "Slatwall" },
];

const GARAGE_FLOORING_OPTIONS: { key: GarageFlooringType; label: string }[] = [
  { key: "none", label: "None" },
  { key: "polyaspartic", label: "Polyaspartic Coating" },
  { key: "click-in-plate", label: "Click-In Plate" },
];

const GYM_FLOORING_OPTIONS: { key: GymFlooringType; label: string }[] = [
  { key: "none", label: "None" },
  { key: "stall-mats", label: "Rubber Stall Mats" },
  { key: "rubber-tiles", label: "Rubber Tiles" },
];

// Gym addon option configs
const RACK_OPTIONS: { key: RackOption; label: string }[] = [
  { key: "none", label: "None" },
  { key: "wall-mount", label: "Wall Mount" },
  { key: "half-rack", label: "Half Rack" },
  { key: "full-power-cage", label: "Full Cage" },
];

const BENCH_OPTIONS: { key: BenchOption; label: string }[] = [
  { key: "none", label: "None" },
  { key: "flat", label: "Flat" },
  { key: "adjustable-fid", label: "Adjustable FID" },
];

const CABLE_OPTIONS: { key: CableOption; label: string }[] = [
  { key: "none", label: "None" },
  { key: "single-stack", label: "Single Stack" },
  { key: "functional-trainer", label: "Functional Trainer" },
  { key: "crossover", label: "Crossover" },
];

const ACCESSORY_OPTIONS: { key: GymAccessory; label: string }[] = [
  { key: "mirrors", label: "Mirrors" },
  { key: "pull-up-rig", label: "Pull-Up Rig" },
  { key: "dumbbell-rack", label: "Dumbbell Rack" },
  { key: "kettlebells", label: "Kettlebells" },
];

export default function ConfigureConsultation() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [consultation, setConsultation] = useState<GsConsultation | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  // Garage addons state
  const [garageShelving, setGarageShelving] = useState<ShelvingOption>("none");
  const [garageOverhead, setGarageOverhead] = useState<OverheadOption>("none");
  const [garageCabinets, setGarageCabinets] = useState<CabinetOption>("none");
  const [garageWallOrg, setGarageWallOrg] = useState<WallOrgOption>("none");
  const [garageFlooringType, setGarageFlooringType] = useState<GarageFlooringType>("none");
  const [garageFloorColor, setGarageFloorColor] = useState<BMColorRef>(null);
  const [garageColorFamily, setGarageColorFamily] = useState<BMFamily>("gray");

  // Gym addons state
  const [gymFlooringType, setGymFlooringType] = useState<GymFlooringType>("none");
  const [gymFloorColor, setGymFloorColor] = useState<BMColorRef>(null);
  const [gymColorFamily, setGymColorFamily] = useState<BMFamily>("charcoal");
  const [gymRack, setGymRack] = useState<RackOption>("none");
  const [gymBench, setGymBench] = useState<BenchOption>("none");
  const [gymCable, setGymCable] = useState<CableOption>("none");
  const [gymAccessories, setGymAccessories] = useState<GymAccessory[]>([]);

  useEffect(() => {
    if (!id) return;
    const unsub = onSnapshot(doc(db, COLLECTIONS.CONSULTATIONS, id), (snap) => {
      if (snap.exists()) {
        const data = { id: snap.id, ...snap.data() } as GsConsultation;
        setConsultation(data);

        // Initialize from doc — handle both old (boolean) and new (string) shapes
        const ga = data.garageAddons as any;
        if (ga) {
          if (typeof ga.overheadStorage === "boolean" || typeof ga.polyasparticFlooring === "boolean") {
            // Old shape — map booleans to new values
            setGarageOverhead(ga.overheadStorage ? "2-racks" : "none");
            setGarageShelving(ga.extraShelving ? "1-unit" : "none");
            setGarageFlooringType(ga.polyasparticFlooring ? "polyaspartic" : "none");
            setGarageFloorColor(
              ga.flooringColor && typeof ga.flooringColor === "string"
                ? { code: "", name: ga.flooringColor }
                : null
            );
          } else {
            // New shape
            setGarageShelving(ga.shelving || "none");
            setGarageOverhead(ga.overheadStorage || "none");
            setGarageCabinets(ga.cabinets || "none");
            setGarageWallOrg(ga.wallOrg || "none");
            setGarageFlooringType(ga.flooringType || (ga.flooring ? "polyaspartic" : "none"));
            setGarageFloorColor(ga.flooringColor || null);
          }
        }

        const gy = data.gymAddons as any;
        if (gy) {
          if (typeof gy.rubberFlooring === "boolean" || typeof gy.cableSystem === "boolean") {
            // Old shape
            setGymFlooringType(gy.rubberFlooring ? "rubber-tiles" : "none");
            setGymFloorColor(
              gy.flooringColor && typeof gy.flooringColor === "string"
                ? { code: "", name: gy.flooringColor }
                : null
            );
            setGymRack("none");
            setGymBench("none");
            setGymCable(gy.cableSystem ? "single-stack" : "none");
            const acc: GymAccessory[] = [];
            if (gy.mirrorWall) acc.push("mirrors");
            if (gy.pullUpRig) acc.push("pull-up-rig");
            setGymAccessories(acc);
          } else {
            // New shape
            setGymFlooringType(gy.flooringType || (gy.flooring ? "rubber-tiles" : "none"));
            setGymFloorColor(gy.flooringColor || null);
            setGymRack(gy.rackSystem || "none");
            setGymBench(gy.bench || "none");
            setGymCable(gy.cableMachine || "none");
            setGymAccessories(gy.accessories || []);
          }
        }
      }
      setLoading(false);
    });
    return unsub;
  }, [id]);

  const toggleAccessory = (acc: GymAccessory) => {
    setGymAccessories((prev) =>
      prev.includes(acc) ? prev.filter((a) => a !== acc) : [...prev, acc]
    );
  };

  const handleGenerate = async () => {
    if (!id || !consultation) return;
    setGenerating(true);

    try {
      const consultRef = doc(db, COLLECTIONS.CONSULTATIONS, id);
      await updateDoc(consultRef, {
        garageAddons: {
          shelving: garageShelving,
          overheadStorage: garageOverhead,
          cabinets: garageCabinets,
          wallOrg: garageWallOrg,
          flooringType: garageFlooringType,
          flooringColor: garageFlooringType !== "none" ? garageFloorColor : null,
        },
        gymAddons: {
          flooringType: gymFlooringType,
          flooringColor: gymFlooringType !== "none" ? gymFloorColor : null,
          rackSystem: gymRack,
          bench: gymBench,
          cableMachine: gymCable,
          accessories: gymAccessories,
        },
        status: "generating",
        updatedAt: serverTimestamp(),
      });

      const generateMockup = httpsCallable(functions, "gsGenerateConsultMockup");
      const tiers = ["tier1", "tier2", "tier3"] as const;
      tiers.forEach((tier) => {
        generateMockup({ consultationId: id, tier }).catch((err) => {
          console.error(`Failed to generate ${tier}:`, err);
        });
      });

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

      {/* Space context summary */}
      {(consultation.garageSize || consultation.ceilingHeight || consultation.stylePreference) && (
        <View style={styles.contextRow}>
          {consultation.garageSize && (
            <View style={styles.contextChip}>
              <Text style={styles.contextText}>{consultation.garageSize}</Text>
            </View>
          )}
          {consultation.ceilingHeight && (
            <View style={styles.contextChip}>
              <Text style={styles.contextText}>{consultation.ceilingHeight} ceiling</Text>
            </View>
          )}
          {consultation.stylePreference && (
            <View style={styles.contextChip}>
              <Text style={styles.contextText}>{consultation.stylePreference.replace("-", " & ")}</Text>
            </View>
          )}
        </View>
      )}

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
      <Text style={styles.sectionLabel}>CUSTOMIZE ADD-ONS</Text>

      {serviceType === "garage_org" ? (
        <View style={styles.addonSection}>
          <OptionPicker label="Shelving" options={SHELVING_OPTIONS} selected={garageShelving} onSelect={setGarageShelving} />
          <OptionPicker label="Overhead Storage" options={OVERHEAD_OPTIONS} selected={garageOverhead} onSelect={setGarageOverhead} />
          <OptionPicker label="Cabinets" options={CABINET_OPTIONS} selected={garageCabinets} onSelect={setGarageCabinets} />
          <OptionPicker label="Wall Organization" options={WALL_ORG_OPTIONS} selected={garageWallOrg} onSelect={setGarageWallOrg} />
          <OptionPicker label="Flooring" options={GARAGE_FLOORING_OPTIONS} selected={garageFlooringType} onSelect={setGarageFlooringType} />
          {garageFlooringType !== "none" && (
            <BMColorPicker
              selectedFamily={garageColorFamily}
              onSelectFamily={setGarageColorFamily}
              selectedColor={garageFloorColor}
              onSelectColor={setGarageFloorColor}
            />
          )}
        </View>
      ) : (
        <View style={styles.addonSection}>
          <OptionPicker label="Flooring" options={GYM_FLOORING_OPTIONS} selected={gymFlooringType} onSelect={setGymFlooringType} />
          {gymFlooringType !== "none" && (
            <BMColorPicker
              selectedFamily={gymColorFamily}
              onSelectFamily={setGymColorFamily}
              selectedColor={gymFloorColor}
              onSelectColor={setGymFloorColor}
            />
          )}

          <OptionPicker label="Rack System" options={RACK_OPTIONS} selected={gymRack} onSelect={setGymRack} />
          <OptionPicker label="Bench" options={BENCH_OPTIONS} selected={gymBench} onSelect={setGymBench} />
          <OptionPicker label="Cable Machine" options={CABLE_OPTIONS} selected={gymCable} onSelect={setGymCable} />

          <Text style={styles.addonLabel}>Accessories</Text>
          <View style={styles.chipRow}>
            {ACCESSORY_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.key}
                style={[styles.accessoryChip, gymAccessories.includes(opt.key) && styles.accessoryChipActive]}
                onPress={() => toggleAccessory(opt.key)}
              >
                {gymAccessories.includes(opt.key) && (
                  <Ionicons name="checkmark" size={14} color={colors.brand.teal} />
                )}
                <Text style={[styles.accessoryText, gymAccessories.includes(opt.key) && styles.accessoryTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
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
        AI will generate 3 mockups — one per package tier. Takes ~15-30 seconds each.
      </Text>
    </ScrollView>
  );
}

// ── Sub-components ──

function OptionPicker<T extends string>({
  label,
  options,
  selected,
  onSelect,
}: {
  label: string;
  options: { key: T; label: string }[];
  selected: T;
  onSelect: (v: T) => void;
}) {
  return (
    <View style={styles.optionPickerContainer}>
      <Text style={styles.addonLabel}>{label}</Text>
      <View style={styles.chipRow}>
        {options.map((opt) => (
          <TouchableOpacity
            key={opt.key}
            style={[styles.optionChip, selected === opt.key && styles.optionChipActive]}
            onPress={() => onSelect(opt.key)}
          >
            <Text style={[styles.optionChipText, selected === opt.key && styles.optionChipTextActive]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

function BMColorPicker({
  selectedFamily,
  onSelectFamily,
  selectedColor,
  onSelectColor,
}: {
  selectedFamily: BMFamily;
  onSelectFamily: (f: BMFamily) => void;
  selectedColor: BMColorRef;
  onSelectColor: (c: BMColorRef) => void;
}) {
  const familyColors = getColorsByFamily(selectedFamily);

  return (
    <View style={styles.bmContainer}>
      {/* Family selector */}
      <View style={styles.chipRow}>
        {BM_FAMILIES.map((fam) => (
          <TouchableOpacity
            key={fam}
            style={[styles.familyChip, selectedFamily === fam && styles.familyChipActive]}
            onPress={() => onSelectFamily(fam)}
          >
            <Text style={[styles.familyChipText, selectedFamily === fam && styles.familyChipTextActive]}>
              {BM_FAMILY_LABELS[fam]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Color swatches */}
      <View style={styles.swatchRow}>
        {familyColors.map((c) => {
          const isSelected = selectedColor?.code === c.code;
          return (
            <TouchableOpacity
              key={c.code}
              style={styles.swatchItem}
              onPress={() => onSelectColor({ code: c.code, name: c.name })}
            >
              <View
                style={[
                  styles.swatchCircle,
                  { backgroundColor: c.hex },
                  isSelected && styles.swatchCircleSelected,
                ]}
              >
                {isSelected && <Ionicons name="checkmark" size={16} color="#fff" />}
              </View>
              <Text style={[styles.swatchName, isSelected && styles.swatchNameActive]} numberOfLines={2}>
                {c.name}
              </Text>
              <Text style={styles.swatchCode}>{c.code}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
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
  contextRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 10,
  },
  contextChip: {
    backgroundColor: `${colors.brand.teal}20`,
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  contextText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.brand.teal,
    textTransform: "capitalize",
  },
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
  addonSection: { gap: 12 },
  addonLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text.primary,
    marginBottom: 6,
  },
  // Option picker
  optionPickerContainer: {
    gap: 4,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  optionChip: {
    backgroundColor: colors.bg.card,
    borderRadius: 20,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  optionChipActive: {
    borderColor: colors.brand.teal,
    backgroundColor: `${colors.brand.teal}15`,
  },
  optionChipText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.text.muted,
  },
  optionChipTextActive: {
    color: colors.brand.teal,
  },
  // Accessory chips (multi-select)
  accessoryChip: {
    backgroundColor: colors.bg.card,
    borderRadius: 20,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    borderColor: "transparent",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  accessoryChipActive: {
    borderColor: colors.brand.teal,
    backgroundColor: `${colors.brand.teal}15`,
  },
  accessoryText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.text.muted,
  },
  accessoryTextActive: {
    color: colors.brand.teal,
  },
  // BM Color picker
  bmContainer: {
    backgroundColor: colors.bg.card,
    borderRadius: 12,
    padding: 12,
    gap: 12,
  },
  familyChip: {
    backgroundColor: colors.bg.primary,
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "transparent",
  },
  familyChipActive: {
    borderColor: colors.brand.teal,
    backgroundColor: `${colors.brand.teal}15`,
  },
  familyChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.text.muted,
  },
  familyChipTextActive: {
    color: colors.brand.teal,
  },
  swatchRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  swatchItem: {
    alignItems: "center",
    width: 70,
    gap: 4,
  },
  swatchCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  swatchCircleSelected: {
    borderColor: colors.brand.teal,
    borderWidth: 3,
  },
  swatchName: {
    fontSize: 10,
    fontWeight: "600",
    color: colors.text.secondary,
    textAlign: "center",
  },
  swatchNameActive: {
    color: colors.brand.teal,
  },
  swatchCode: {
    fontSize: 9,
    color: colors.text.muted,
    textAlign: "center",
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
