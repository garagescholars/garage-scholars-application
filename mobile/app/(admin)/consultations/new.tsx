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
import type { ConsultationServiceType } from "../../../src/types";

const SPACE_ANGLES: PhotoAngle[] = [
  { key: "wide", label: "Full Space", instruction: "Stand at entrance, capture full interior — both walls visible", icon: "resize-outline" },
  { key: "left", label: "Left Wall", instruction: "Face left wall floor to ceiling", icon: "arrow-back-outline" },
  { key: "right", label: "Right Wall", instruction: "Face right wall floor to ceiling", icon: "arrow-forward-outline" },
  { key: "floor", label: "Floor Detail", instruction: "Camera pointing down at center of floor", icon: "scan-outline" },
];

type FormData = {
  clientName: string;
  clientPhone: string;
  address: string;
  serviceType: ConsultationServiceType;
};

export default function NewConsultation() {
  const router = useRouter();
  const { user } = useAuth();
  const [form, setForm] = useState<FormData>({
    clientName: "",
    clientPhone: "",
    address: "",
    serviceType: "garage_org",
  });
  const [showCapture, setShowCapture] = useState(false);
  const [uploading, setUploading] = useState(false);

  const isValid = form.clientName.trim() && form.address.trim();

  const handlePhotosComplete = async (photos: Record<string, string>) => {
    if (!photos.wide) {
      Alert.alert("Missing Photo", "The wide/full space photo is required.");
      return;
    }

    setShowCapture(false);
    setUploading(true);

    try {
      // Create the consultation doc first
      const docRef = await addDoc(collection(db, COLLECTIONS.CONSULTATIONS), {
        clientName: form.clientName.trim(),
        clientEmail: null,
        clientPhone: form.clientPhone.trim() || null,
        address: form.address.trim(),
        createdBy: user?.uid || "",
        createdAt: serverTimestamp(),
        jobId: null,
        serviceType: form.serviceType,
        spacePhotoUrls: {},
        garageAddons: {
          polyasparticFlooring: false,
          flooringColor: null,
          overheadStorage: false,
          extraShelving: false,
        },
        gymAddons: {
          rubberFlooring: false,
          flooringColor: null,
          mirrorWall: false,
          cableSystem: false,
          pullUpRig: false,
        },
        mockups: {
          tier1: { status: "idle", imageUrl: null },
          tier2: { status: "idle", imageUrl: null },
          tier3: { status: "idle", imageUrl: null },
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

      // Update doc with photo URLs and status
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

        {/* Capture Photos Button */}
        <TouchableOpacity
          style={[styles.captureBtn, !isValid && styles.captureBtnDisabled]}
          onPress={() => setShowCapture(true)}
          disabled={!isValid}
        >
          <Ionicons name="camera" size={22} color="#fff" />
          <Text style={styles.captureBtnText}>Take Space Photos</Text>
        </TouchableOpacity>

        <Text style={styles.hint}>
          You'll take 4 photos: full space, left wall, right wall, and floor detail.
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
