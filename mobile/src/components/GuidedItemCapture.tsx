import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  ScrollView,
  Modal,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";

export type PhotoAngle = {
  key: string;
  label: string;
  instruction: string;
  icon: keyof typeof Ionicons.glyphMap;
};

type Props = {
  angles: PhotoAngle[];
  onComplete: (photos: Record<string, string>) => void;
  onCancel: () => void;
  title?: string;
  allowExtra?: boolean;
};

export const RESALE_ANGLES: PhotoAngle[] = [
  {
    key: "front",
    label: "Front View",
    instruction:
      "Take a straight-on photo of the front of the item. Make sure the entire item is visible and well-lit.",
    icon: "phone-portrait-outline",
  },
  {
    key: "side",
    label: "Side View",
    instruction:
      "Turn the item 90° and capture the side profile. Show the depth and any side details.",
    icon: "phone-landscape-outline",
  },
  {
    key: "back",
    label: "Back View",
    instruction:
      "Show the back of the item. Capture any labels, serial numbers, or brand markings.",
    icon: "barcode-outline",
  },
  {
    key: "full",
    label: "Full Shot",
    instruction:
      "Step back and capture the entire item from a slight angle. Show the item in context with its full size visible.",
    icon: "expand-outline",
  },
];

export const DONATION_ANGLES: PhotoAngle[] = [
  {
    key: "items",
    label: "Item Photo",
    instruction:
      "Take a clear photo showing all donation items grouped together. Make sure everything is visible.",
    icon: "cube-outline",
  },
  {
    key: "detail",
    label: "Detail Shot",
    instruction:
      "Take a closer photo showing condition and any brand labels on the items.",
    icon: "search-outline",
  },
];

export const GYM_INSTALL_ANGLES: PhotoAngle[] = [
  {
    key: "wide",
    label: "Wide Shot",
    instruction:
      "Step back and capture the full gym setup in the space. Show the entire room or area.",
    icon: "resize-outline",
  },
  {
    key: "equipment",
    label: "Equipment Close-up",
    instruction:
      "Get a close-up of the main equipment piece showing it is fully assembled and ready to use.",
    icon: "barbell-outline",
  },
  {
    key: "detail",
    label: "Detail / Anchoring",
    instruction:
      "Show any wall mounts, floor anchoring, cable routing, or safety features installed.",
    icon: "construct-outline",
  },
];

export default function GuidedItemCapture({
  angles,
  onComplete,
  onCancel,
  title = "Capture Photos",
  allowExtra = false,
}: Props) {
  const [currentStep, setCurrentStep] = useState(0);
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const [extraPhotos, setExtraPhotos] = useState<string[]>([]);
  const [showReview, setShowReview] = useState(false);

  const isAllCaptured = angles.every((a) => photos[a.key]);
  const currentAngle = angles[currentStep];

  const handlePhotoCaptured = (uri: string) => {
    setPhotos((prev) => ({ ...prev, [currentAngle.key]: uri }));
    if (currentStep < angles.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      setShowReview(true);
    }
  };

  const capturePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Needed", "Camera access is required to take photos.");
      return;
    }

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        quality: 0.8,
        allowsEditing: false,
      });

      if (!result.canceled && result.assets[0]) {
        handlePhotoCaptured(result.assets[0].uri);
      }
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to take photo");
    }
  };

  const chooseFromLibrary = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Needed", "Photo library access is required.");
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.8,
        allowsEditing: false,
      });

      if (!result.canceled && result.assets[0]) {
        handlePhotoCaptured(result.assets[0].uri);
      }
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to pick photo");
    }
  };

  const retakePhoto = (key: string) => {
    const idx = angles.findIndex((a) => a.key === key);
    if (idx < 0) return;

    const doRetake = (source: "camera" | "library") => {
      setPhotos((prev) => {
        const updated = { ...prev };
        delete updated[key];
        return updated;
      });
      setCurrentStep(idx);
      setShowReview(false);
      // After state update, launch picker on next render via the capture buttons
    };

    Alert.alert("Retake Photo", `Retake "${angles[idx].label}"`, [
      { text: "Camera", onPress: () => doRetake("camera") },
      { text: "Photo Library", onPress: () => doRetake("library") },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const addExtraPhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") return;

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        setExtraPhotos((prev) => [...prev, result.assets[0].uri]);
      }
    } catch {}
  };

  const handleSubmit = () => {
    const allPhotos = { ...photos };
    extraPhotos.forEach((uri, i) => {
      allPhotos[`extra_${i}`] = uri;
    });
    onComplete(allPhotos);
  };

  // Review screen — show all captured photos
  if (showReview) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Review Photos</Text>
        <Text style={styles.subtitle}>
          Make sure all photos are clear and well-lit before submitting.
        </Text>

        <ScrollView style={styles.reviewScroll} showsVerticalScrollIndicator={false}>
          {angles.map((angle) => (
            <View key={angle.key} style={styles.reviewItem}>
              <View style={styles.reviewHeader}>
                <Ionicons name={angle.icon} size={18} color="#14b8a6" />
                <Text style={styles.reviewLabel}>{angle.label}</Text>
              </View>
              {photos[angle.key] ? (
                <View>
                  <Image source={{ uri: photos[angle.key] }} style={styles.reviewPhoto} />
                  <TouchableOpacity
                    style={styles.retakeBtn}
                    onPress={() => retakePhoto(angle.key)}
                  >
                    <Ionicons name="camera-reverse-outline" size={16} color="#f59e0b" />
                    <Text style={styles.retakeText}>Retake</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.missingPhoto}>
                  <Text style={styles.missingText}>Not captured</Text>
                </View>
              )}
            </View>
          ))}

          {allowExtra && (
            <View style={styles.extraSection}>
              {extraPhotos.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {extraPhotos.map((uri, i) => (
                    <Image key={i} source={{ uri }} style={styles.extraThumb} />
                  ))}
                </ScrollView>
              )}
              <TouchableOpacity style={styles.extraBtn} onPress={addExtraPhoto}>
                <Ionicons name="add-circle-outline" size={20} color="#14b8a6" />
                <Text style={styles.extraBtnText}>Add Extra Photo</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>

        <View style={styles.btnRow}>
          <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.submitBtn, !isAllCaptured && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={!isAllCaptured}
          >
            <Ionicons name="checkmark-circle" size={20} color="#fff" />
            <Text style={styles.submitText}>Submit Photos</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Capture screen — one angle at a time
  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={onCancel}>
          <Ionicons name="close" size={28} color="#94a3b8" />
        </TouchableOpacity>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.stepIndicator}>
          {currentStep + 1} / {angles.length}
        </Text>
      </View>

      {/* Progress dots */}
      <View style={styles.progressRow}>
        {angles.map((a, i) => (
          <View
            key={a.key}
            style={[
              styles.progressDot,
              photos[a.key] ? styles.progressDotDone : null,
              i === currentStep ? styles.progressDotActive : null,
            ]}
          />
        ))}
      </View>

      {/* Current angle info */}
      <View style={styles.angleCard}>
        <View style={styles.angleHeader}>
          <Ionicons name={currentAngle.icon} size={24} color="#14b8a6" />
          <Text style={styles.angleLabel}>{currentAngle.label}</Text>
        </View>
        <Text style={styles.angleInstruction}>{currentAngle.instruction}</Text>
      </View>

      {/* Preview if already captured */}
      {photos[currentAngle.key] && (
        <Image source={{ uri: photos[currentAngle.key] }} style={styles.previewPhoto} />
      )}

      {/* Action buttons */}
      <View style={styles.actionRow}>
        {currentStep > 0 && (
          <TouchableOpacity
            style={styles.navBtn}
            onPress={() => setCurrentStep(currentStep - 1)}
          >
            <Ionicons name="arrow-back" size={20} color="#94a3b8" />
            <Text style={styles.navText}>Back</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.captureBtn} onPress={capturePhoto}>
          <Ionicons name="camera" size={24} color="#fff" />
          <Text style={styles.captureText}>
            {photos[currentAngle.key] ? "Retake" : "Take Photo"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.libraryBtn} onPress={chooseFromLibrary}>
          <Ionicons name="images-outline" size={22} color="#14b8a6" />
          <Text style={styles.libraryText}>Library</Text>
        </TouchableOpacity>

        {photos[currentAngle.key] && currentStep < angles.length - 1 && (
          <TouchableOpacity
            style={styles.navBtn}
            onPress={() => setCurrentStep(currentStep + 1)}
          >
            <Text style={styles.navText}>Next</Text>
            <Ionicons name="arrow-forward" size={20} color="#14b8a6" />
          </TouchableOpacity>
        )}

        {photos[currentAngle.key] && currentStep === angles.length - 1 && (
          <TouchableOpacity
            style={styles.navBtn}
            onPress={() => setShowReview(true)}
          >
            <Text style={[styles.navText, { color: "#14b8a6" }]}>Review</Text>
            <Ionicons name="checkmark" size={20} color="#14b8a6" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f1b2d",
    padding: 16,
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#f8fafc",
  },
  subtitle: {
    fontSize: 14,
    color: "#94a3b8",
    marginBottom: 16,
  },
  stepIndicator: {
    fontSize: 14,
    fontWeight: "700",
    color: "#14b8a6",
  },
  progressRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginBottom: 20,
  },
  progressDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#334155",
  },
  progressDotActive: {
    backgroundColor: "#14b8a6",
    width: 24,
    borderRadius: 5,
  },
  progressDotDone: {
    backgroundColor: "#10b981",
  },
  angleCard: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: "#14b8a6",
  },
  angleHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  angleLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: "#f8fafc",
  },
  angleInstruction: {
    fontSize: 14,
    color: "#cbd5e1",
    lineHeight: 20,
  },
  previewPhoto: {
    width: "100%",
    height: 200,
    borderRadius: 12,
    marginBottom: 16,
    backgroundColor: "#1e293b",
  },
  actionRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    marginTop: "auto",
  },
  captureBtn: {
    backgroundColor: "#14b8a6",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 28,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  captureText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  libraryBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1.5,
    borderColor: "#14b8a6",
    backgroundColor: "transparent",
  },
  libraryText: {
    color: "#14b8a6",
    fontSize: 14,
    fontWeight: "700",
  },
  navBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  navText: {
    color: "#94a3b8",
    fontSize: 14,
    fontWeight: "600",
  },
  // Review screen
  reviewScroll: {
    flex: 1,
    marginBottom: 16,
  },
  reviewItem: {
    marginBottom: 16,
  },
  reviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  reviewLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#f8fafc",
  },
  reviewPhoto: {
    width: "100%",
    height: 180,
    borderRadius: 10,
    backgroundColor: "#1e293b",
  },
  retakeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
    alignSelf: "flex-end",
  },
  retakeText: {
    color: "#f59e0b",
    fontSize: 13,
    fontWeight: "700",
  },
  missingPhoto: {
    height: 100,
    borderRadius: 10,
    backgroundColor: "#1e293b",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ef4444",
    borderStyle: "dashed",
  },
  missingText: {
    color: "#ef4444",
    fontSize: 13,
    fontWeight: "600",
  },
  extraSection: {
    marginTop: 8,
    gap: 10,
  },
  extraThumb: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 8,
    backgroundColor: "#1e293b",
  },
  extraBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#1e293b",
    borderRadius: 10,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#334155",
    borderStyle: "dashed",
  },
  extraBtnText: {
    color: "#14b8a6",
    fontWeight: "700",
    fontSize: 14,
  },
  btnRow: {
    flexDirection: "row",
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#1e293b",
    alignItems: "center",
  },
  cancelText: {
    color: "#94a3b8",
    fontSize: 15,
    fontWeight: "700",
  },
  submitBtn: {
    flex: 2,
    flexDirection: "row",
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#14b8a6",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
});
