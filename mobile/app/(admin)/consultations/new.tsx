import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../../../src/lib/firebase";
import { useAuth } from "../../../src/hooks/useAuth";
import { COLLECTIONS } from "../../../src/constants/collections";
import { colors } from "../../../src/constants/theme";
import GuidedItemCapture, { PhotoAngle } from "../../../src/components/GuidedItemCapture";
import type {
  ConsultationServiceType,
  GarageSize,
  CeilingHeight,
  CurrentState,
  StylePreference,
} from "../../../src/types";

const SPACE_ANGLES: PhotoAngle[] = [
  { key: "wide", label: "Full Space", instruction: "Stand at entrance, capture full interior — both walls visible", icon: "resize-outline" },
  { key: "left", label: "Left Wall", instruction: "Face left wall floor to ceiling", icon: "arrow-back-outline" },
  { key: "right", label: "Right Wall", instruction: "Face right wall floor to ceiling", icon: "arrow-forward-outline" },
  { key: "floor", label: "Floor Detail", instruction: "Camera pointing down at center of floor", icon: "scan-outline" },
];

const GARAGE_SIZES: { key: GarageSize; label: string }[] = [
  { key: "1-car", label: "1-Car" },
  { key: "2-car", label: "2-Car" },
  { key: "3-car", label: "3-Car" },
  { key: "oversized", label: "Oversized" },
];

const CEILING_HEIGHTS: { key: CeilingHeight; label: string }[] = [
  { key: "8ft", label: "8 ft" },
  { key: "9ft", label: "9 ft" },
  { key: "10ft+", label: "10 ft+" },
  { key: "open-joists", label: "Open Joists" },
];

const CURRENT_STATES: { key: CurrentState; label: string }[] = [
  { key: "empty", label: "Empty" },
  { key: "cluttered", label: "Cluttered" },
  { key: "partial-storage", label: "Partial Storage" },
  { key: "cars-parked", label: "Cars Parked" },
];

const STYLE_OPTIONS: { key: StylePreference; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: "clean-modern", label: "Clean & Modern", icon: "sparkles-outline" },
  { key: "workshop", label: "Workshop", icon: "construct-outline" },
  { key: "minimalist", label: "Minimalist", icon: "remove-outline" },
];

type FormData = {
  clientName: string;
  clientPhone: string;
  address: string;
  serviceType: ConsultationServiceType;
  garageSize: GarageSize | null;
  ceilingHeight: CeilingHeight | null;
  currentState: CurrentState[];
  itemsToPreserve: string;
  stylePreference: StylePreference | null;
  dreamDescription: string;
};

export default function NewConsultation() {
  const router = useRouter();
  const { user } = useAuth();
  const [form, setForm] = useState<FormData>({
    clientName: "",
    clientPhone: "",
    address: "",
    serviceType: "garage_org",
    garageSize: null,
    ceilingHeight: null,
    currentState: [],
    itemsToPreserve: "",
    stylePreference: null,
    dreamDescription: "",
  });
  const [showCapture, setShowCapture] = useState(false);
  const [uploading, setUploading] = useState(false);

  const isValid = form.clientName.trim() && form.address.trim();

  const toggleCurrentState = (state: CurrentState) => {
    setForm((p) => ({
      ...p,
      currentState: p.currentState.includes(state)
        ? p.currentState.filter((s) => s !== state)
        : [...p.currentState, state],
    }));
  };

  const handlePhotosComplete = async (photos: Record<string, string>) => {
    if (!photos.wide) {
      Alert.alert("Missing Photo", "The wide/full space photo is required.");
      return;
    }

    setShowCapture(false);
    setUploading(true);

    try {
      const docRef = await addDoc(collection(db, COLLECTIONS.CONSULTATIONS), {
        clientName: form.clientName.trim(),
        clientEmail: null,
        clientPhone: form.clientPhone.trim() || null,
        address: form.address.trim(),
        createdBy: user?.uid || "",
        createdAt: serverTimestamp(),
        jobId: null,
        serviceType: form.serviceType,
        // Space context
        garageSize: form.garageSize,
        ceilingHeight: form.ceilingHeight,
        currentState: form.currentState,
        itemsToPreserve: form.itemsToPreserve.trim() || null,
        stylePreference: form.stylePreference,
        dreamDescription: form.dreamDescription.trim() || null,
        spacePhotoUrls: {},
        garageAddons: {
          shelving: "none",
          overheadStorage: "none",
          cabinets: "none",
          wallOrg: "none",
          flooringType: "none",
          flooringColor: null,
        },
        gymAddons: {
          flooringType: "none",
          flooringColor: null,
          rackSystem: "none",
          bench: "none",
          cableMachine: "none",
          accessories: [],
        },
        mockups: {
          shade1: { status: "idle", imageUrl: null, bmCode: "HC-169", bmName: "Coventry Gray", hex: "#A7A9A5" },
          shade2: { status: "idle", imageUrl: null, bmCode: "HC-170", bmName: "Stonington Gray", hex: "#9A9E9A" },
          shade3: { status: "idle", imageUrl: null, bmCode: "HC-168", bmName: "Chelsea Gray", hex: "#8A8C8A" },
        },
        status: "draft",
        updatedAt: serverTimestamp(),
      });

      // Upload photos to Firebase Storage
      const spacePhotoUrls: Record<string, string> = {};

      for (const [angle, uri] of Object.entries(photos)) {
        if (angle.startsWith("extra_")) continue;
        const timestamp = Date.now();
        const storagePath = `gs_consultation_photos/${docRef.id}/${angle}_${timestamp}.jpg`;
        const storageRef = ref(storage, storagePath);

        const resp = await fetch(uri);
        const blob = await resp.blob();
        await uploadBytes(storageRef, blob);
        const downloadUrl = await getDownloadURL(storageRef);
        spacePhotoUrls[angle] = downloadUrl;
      }

      const { doc: firestoreDoc, updateDoc } = await import("firebase/firestore");
      const consultRef = firestoreDoc(db, COLLECTIONS.CONSULTATIONS, docRef.id);
      await updateDoc(consultRef, {
        spacePhotoUrls,
        status: "photos_captured",
        updatedAt: serverTimestamp(),
      });

      router.replace(`/(admin)/consultations/${docRef.id}/configure` as any);
    } catch (err: any) {
      console.error("Failed to create consultation:", err);
      Alert.alert("Error", err.message || "Failed to create consultation");
    } finally {
      setUploading(false);
    }
  };

  if (showCapture) {
    return (
      <GuidedItemCapture
        angles={SPACE_ANGLES}
        onComplete={handlePhotosComplete}
        onCancel={() => setShowCapture(false)}
        title="Capture Space Photos"
      />
    );
  }

  if (uploading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.brand.teal} />
        <Text style={styles.loadingText}>Uploading photos...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
        {/* Service Type Toggle */}
        <Text style={styles.sectionLabel}>SERVICE TYPE</Text>
        <View style={styles.serviceRow}>
          <TouchableOpacity
            style={[
              styles.serviceCard,
              form.serviceType === "garage_org" && styles.serviceCardActive,
            ]}
            onPress={() => setForm((p) => ({ ...p, serviceType: "garage_org" }))}
          >
            <Ionicons
              name="cube"
              size={28}
              color={form.serviceType === "garage_org" ? colors.brand.teal : colors.text.muted}
            />
            <Text
              style={[
                styles.serviceLabel,
                form.serviceType === "garage_org" && styles.serviceLabelActive,
              ]}
            >
              Garage Organization
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.serviceCard,
              form.serviceType === "gym_install" && styles.serviceCardActive,
            ]}
            onPress={() => setForm((p) => ({ ...p, serviceType: "gym_install" }))}
          >
            <Ionicons
              name="barbell"
              size={28}
              color={form.serviceType === "gym_install" ? colors.brand.teal : colors.text.muted}
            />
            <Text
              style={[
                styles.serviceLabel,
                form.serviceType === "gym_install" && styles.serviceLabelActive,
              ]}
            >
              Home Gym Install
            </Text>
          </TouchableOpacity>
        </View>

        {/* Client Info */}
        <Text style={styles.sectionLabel}>CLIENT INFO</Text>

        <Text style={styles.inputLabel}>Name *</Text>
        <TextInput
          style={styles.input}
          placeholder="Client name"
          placeholderTextColor={colors.text.muted}
          value={form.clientName}
          onChangeText={(v) => setForm((p) => ({ ...p, clientName: v }))}
        />

        <Text style={styles.inputLabel}>Phone</Text>
        <TextInput
          style={styles.input}
          placeholder="(555) 555-5555"
          placeholderTextColor={colors.text.muted}
          value={form.clientPhone}
          onChangeText={(v) => setForm((p) => ({ ...p, clientPhone: v }))}
          keyboardType="phone-pad"
        />

        <Text style={styles.inputLabel}>Address *</Text>
        <TextInput
          style={styles.input}
          placeholder="123 Main St, Denver CO"
          placeholderTextColor={colors.text.muted}
          value={form.address}
          onChangeText={(v) => setForm((p) => ({ ...p, address: v }))}
        />

        {/* Space Details */}
        <Text style={styles.sectionLabel}>SPACE DETAILS</Text>

        <Text style={styles.inputLabel}>Garage Size</Text>
        <View style={styles.chipRow}>
          {GARAGE_SIZES.map((opt) => (
            <TouchableOpacity
              key={opt.key}
              style={[styles.chip, form.garageSize === opt.key && styles.chipActive]}
              onPress={() => setForm((p) => ({ ...p, garageSize: p.garageSize === opt.key ? null : opt.key }))}
            >
              <Text style={[styles.chipText, form.garageSize === opt.key && styles.chipTextActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.inputLabel}>Ceiling Height</Text>
        <View style={styles.chipRow}>
          {CEILING_HEIGHTS.map((opt) => (
            <TouchableOpacity
              key={opt.key}
              style={[styles.chip, form.ceilingHeight === opt.key && styles.chipActive]}
              onPress={() => setForm((p) => ({ ...p, ceilingHeight: p.ceilingHeight === opt.key ? null : opt.key }))}
            >
              <Text style={[styles.chipText, form.ceilingHeight === opt.key && styles.chipTextActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.inputLabel}>Current State</Text>
        <View style={styles.chipRow}>
          {CURRENT_STATES.map((opt) => (
            <TouchableOpacity
              key={opt.key}
              style={[styles.chip, form.currentState.includes(opt.key) && styles.chipActive]}
              onPress={() => toggleCurrentState(opt.key)}
            >
              <Text style={[styles.chipText, form.currentState.includes(opt.key) && styles.chipTextActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Preferences */}
        <Text style={styles.sectionLabel}>PREFERENCES</Text>

        <Text style={styles.inputLabel}>Style</Text>
        <View style={styles.chipRow}>
          {STYLE_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.key}
              style={[styles.styleCard, form.stylePreference === opt.key && styles.styleCardActive]}
              onPress={() => setForm((p) => ({ ...p, stylePreference: p.stylePreference === opt.key ? null : opt.key }))}
            >
              <Ionicons
                name={opt.icon}
                size={20}
                color={form.stylePreference === opt.key ? colors.brand.teal : colors.text.muted}
              />
              <Text style={[styles.chipText, form.stylePreference === opt.key && styles.chipTextActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.inputLabel}>Items to Preserve</Text>
        <TextInput
          style={[styles.input, { minHeight: 60, textAlignVertical: "top" }]}
          placeholder="e.g., Keep workbench on right wall, keep fridge in corner..."
          placeholderTextColor={colors.text.muted}
          value={form.itemsToPreserve}
          onChangeText={(v) => setForm((p) => ({ ...p, itemsToPreserve: v }))}
          multiline
          numberOfLines={2}
        />

        <Text style={styles.inputLabel}>Dream Garage / Gym Description</Text>
        <TextInput
          style={[styles.input, { minHeight: 80, textAlignVertical: "top" }]}
          placeholder="Describe your dream space — workshop, organized storage, home gym..."
          placeholderTextColor={colors.text.muted}
          value={form.dreamDescription}
          onChangeText={(v) => setForm((p) => ({ ...p, dreamDescription: v }))}
          multiline
          numberOfLines={3}
        />

        {/* Capture Photos Button */}
        <TouchableOpacity
          style={[styles.captureBtn, !isValid && styles.captureBtnDisabled]}
          onPress={() => setShowCapture(true)}
          disabled={!isValid}
        >
          <Ionicons name="camera" size={22} color="#fff" />
          <Text style={styles.captureBtnText}>Capture Space Photos</Text>
        </TouchableOpacity>

        <Text style={styles.hint}>
          Take or upload 4 photos: full space, left wall, right wall, and floor detail.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
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
    gap: 12,
  },
  loadingText: { color: colors.text.secondary, fontSize: 15, fontWeight: "600" },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.text.muted,
    letterSpacing: 1,
    marginBottom: 10,
    marginTop: 20,
  },
  serviceRow: { flexDirection: "row", gap: 12 },
  serviceCard: {
    flex: 1,
    backgroundColor: colors.bg.card,
    borderRadius: 12,
    padding: 20,
    alignItems: "center",
    gap: 8,
    borderWidth: 2,
    borderColor: "transparent",
  },
  serviceCardActive: {
    borderColor: colors.brand.teal,
    backgroundColor: `${colors.brand.teal}10`,
  },
  serviceLabel: { fontSize: 13, fontWeight: "700", color: colors.text.secondary, textAlign: "center" },
  serviceLabelActive: { color: colors.brand.teal },
  inputLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text.secondary,
    marginBottom: 6,
    marginTop: 14,
  },
  input: {
    backgroundColor: colors.bg.input,
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    color: colors.text.primary,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    backgroundColor: colors.bg.card,
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  chipActive: {
    borderColor: colors.brand.teal,
    backgroundColor: `${colors.brand.teal}15`,
  },
  chipText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.text.secondary,
  },
  chipTextActive: {
    color: colors.brand.teal,
  },
  styleCard: {
    flex: 1,
    backgroundColor: colors.bg.card,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: "center",
    gap: 6,
    borderWidth: 1.5,
    borderColor: "transparent",
    minWidth: 90,
  },
  styleCardActive: {
    borderColor: colors.brand.teal,
    backgroundColor: `${colors.brand.teal}15`,
  },
  captureBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.brand.teal,
    borderRadius: 12,
    paddingVertical: 16,
    marginTop: 28,
  },
  captureBtnDisabled: { opacity: 0.4 },
  captureBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  hint: {
    fontSize: 13,
    color: colors.text.muted,
    textAlign: "center",
    marginTop: 10,
  },
});
