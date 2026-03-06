import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { httpsCallable } from "firebase/functions";
import { Ionicons } from "@expo/vector-icons";
import * as Notifications from "expo-notifications";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import { db, storage, functions } from "../../src/lib/firebase";
import { useAuth } from "../../src/hooks/useAuth";
import { COLLECTIONS } from "../../src/constants/collections";

const TOTAL_STEPS = 5;

export default function OnboardingScreen() {
  const { user, profile } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [fullName, setFullName] = useState(profile?.name || "");
  const [submitting, setSubmitting] = useState(false);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);

  // Questionnaire state
  const [careerGoal, setCareerGoal] = useState("");
  const [whyGarageScholars, setWhyGarageScholars] = useState("");
  const [funFact, setFunFact] = useState("");
  const [skills, setSkills] = useState("");
  const [bioGenerating, setBioGenerating] = useState(false);

  // Permission states
  const [notifGranted, setNotifGranted] = useState<boolean | null>(null);
  const [locationGranted, setLocationGranted] = useState<boolean | null>(null);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Needed", "Please allow access to your photo library to choose a profile picture.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      setAvatarUri(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Needed", "Please allow camera access to take a profile picture.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      setAvatarUri(result.assets[0].uri);
    }
  };

  const uploadAvatar = async (): Promise<string | null> => {
    if (!avatarUri || !user) return null;
    try {
      setAvatarUploading(true);
      const response = await fetch(avatarUri);
      const blob = await response.blob();
      const avatarRef = ref(storage, `gs_avatars/${user.uid}.jpg`);
      await uploadBytes(avatarRef, blob);
      const downloadUrl = await getDownloadURL(avatarRef);
      return downloadUrl;
    } catch (err: any) {
      console.error("[Onboarding] Avatar upload error:", err);
      return null;
    } finally {
      setAvatarUploading(false);
    }
  };

  const goNext = () => {
    if (step < TOTAL_STEPS) {
      setStep(step + 1);
    }
  };

  const goBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const requestNotifications = async () => {
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      const granted = status === "granted";
      setNotifGranted(granted);
      if (!granted) {
        Alert.alert(
          "Notifications Disabled",
          "You can enable notifications later in your device settings."
        );
      }
    } catch {
      setNotifGranted(false);
    }
    goNext();
  };

  const requestLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      const granted = status === "granted";
      setLocationGranted(granted);
      if (!granted) {
        Alert.alert(
          "Location Disabled",
          "Location is needed for job check-ins. You can enable it later in settings."
        );
      }
    } catch {
      setLocationGranted(false);
    }
    // Don't goNext here -- we finalize onboarding
    await completeOnboarding();
  };

  const completeOnboarding = async () => {
    if (!user) return;
    setSubmitting(true);

    try {
      const trimmedName = fullName.trim() || "Scholar";

      // Upload avatar if one was selected
      const avatarUrl = await uploadAvatar();

      // Update gs_profiles with the name (and avatar if uploaded)
      const profileUpdate: Record<string, any> = {
        fullName: trimmedName,
        updatedAt: serverTimestamp(),
      };
      if (avatarUrl) profileUpdate.avatarUrl = avatarUrl;

      await updateDoc(doc(db, COLLECTIONS.PROFILES, user.uid), profileUpdate);

      // Update gs_scholarProfiles with onboardingComplete and name
      const scholarUpdate: Record<string, any> = {
        onboardingComplete: true,
        scholarName: trimmedName,
        updatedAt: serverTimestamp(),
      };
      if (avatarUrl) scholarUpdate.avatarUrl = avatarUrl;

      await updateDoc(doc(db, COLLECTIONS.SCHOLAR_PROFILES, user.uid), scholarUpdate);

      router.replace("/(scholar)/jobs");
    } catch (err: any) {
      Alert.alert("Error", err.message || "Could not complete onboarding.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Step renderers ──

  const renderStepName = () => (
    <View style={styles.stepContent}>
      <View style={styles.iconCircle}>
        <Ionicons name="person-outline" size={40} color="#14b8a6" />
      </View>
      <Text style={styles.stepTitle}>What's your name?</Text>
      <Text style={styles.stepSubtitle}>
        This will be shown to customers and other scholars.
      </Text>
      <TextInput
        style={styles.input}
        value={fullName}
        onChangeText={setFullName}
        placeholder="Full Name"
        placeholderTextColor="#5a6a80"
        autoFocus
        autoCapitalize="words"
        returnKeyType="next"
        onSubmitEditing={goNext}
      />
      <TouchableOpacity
        style={[styles.primaryBtn, !fullName.trim() && styles.btnDisabled]}
        onPress={goNext}
        disabled={!fullName.trim()}
      >
        <Text style={styles.primaryBtnText}>Continue</Text>
        <Ionicons name="arrow-forward" size={18} color="#fff" />
      </TouchableOpacity>
    </View>
  );

  const renderStepAvatar = () => (
    <View style={styles.stepContent}>
      {avatarUri ? (
        <Image source={{ uri: avatarUri }} style={styles.avatarPreview} />
      ) : (
        <View style={styles.avatarPlaceholder}>
          <Ionicons name="person-circle-outline" size={96} color="#2a3545" />
        </View>
      )}
      <Text style={styles.stepTitle}>Profile Picture</Text>
      <Text style={styles.stepSubtitle}>
        Add a profile picture so customers and scholars can recognize you.
      </Text>
      <TouchableOpacity style={styles.secondaryBtn} onPress={pickImage}>
        <Ionicons name="images-outline" size={20} color="#14b8a6" />
        <Text style={[styles.secondaryBtnText, { color: "#14b8a6" }]}>
          {avatarUri ? "Change Photo" : "Choose from Library"}
        </Text>
      </TouchableOpacity>
      {Platform.OS !== "web" && (
        <TouchableOpacity style={styles.secondaryBtn} onPress={takePhoto}>
          <Ionicons name="camera-outline" size={20} color="#14b8a6" />
          <Text style={[styles.secondaryBtnText, { color: "#14b8a6" }]}>Take a Photo</Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity style={styles.primaryBtn} onPress={goNext}>
        <Text style={styles.primaryBtnText}>{avatarUri ? "Continue" : "Skip for Now"}</Text>
        <Ionicons name="arrow-forward" size={18} color="#fff" />
      </TouchableOpacity>
    </View>
  );

  const handleBioGeneration = async () => {
    if (!careerGoal.trim()) {
      Alert.alert("Required", "Please tell us about your career goals.");
      return;
    }
    setBioGenerating(true);
    try {
      const generateBio = httpsCallable(functions, "generateScholarBio");
      await generateBio({
        answers: {
          careerGoal: careerGoal.trim(),
          whyGarageScholars: whyGarageScholars.trim(),
          funFact: funFact.trim(),
          skills: skills.trim(),
        },
      });
      goNext();
    } catch (err: any) {
      console.error("[Onboarding] Bio generation error:", err);
      // Still proceed — bio can be regenerated later
      Alert.alert(
        "Bio Saved",
        "We saved your answers but couldn't generate the bio right now. It will be generated later.",
        [{ text: "Continue", onPress: goNext }]
      );
    } finally {
      setBioGenerating(false);
    }
  };

  const renderStepQuestionnaire = () => (
    <ScrollView
      style={{ flex: 1, width: "100%" }}
      contentContainerStyle={{ alignItems: "center", paddingBottom: 40 }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.iconCircle}>
        <Ionicons name="school-outline" size={40} color="#14b8a6" />
      </View>
      <Text style={styles.stepTitle}>Tell Us About You</Text>
      <Text style={styles.stepSubtitle}>
        We'll use your answers to create a short bio that gets sent to clients before their appointment.
      </Text>

      <TextInput
        style={styles.questionInput}
        value={careerGoal}
        onChangeText={setCareerGoal}
        placeholder="What are your career goals? *"
        placeholderTextColor="#5a6a80"
        multiline
        textAlignVertical="top"
      />
      <TextInput
        style={styles.questionInput}
        value={whyGarageScholars}
        onChangeText={setWhyGarageScholars}
        placeholder="Why did you join Garage Scholars?"
        placeholderTextColor="#5a6a80"
        multiline
        textAlignVertical="top"
      />
      <TextInput
        style={styles.questionInput}
        value={skills}
        onChangeText={setSkills}
        placeholder="Skills or experience you bring"
        placeholderTextColor="#5a6a80"
        multiline
        textAlignVertical="top"
      />
      <TextInput
        style={styles.questionInput}
        value={funFact}
        onChangeText={setFunFact}
        placeholder="A fun fact about you"
        placeholderTextColor="#5a6a80"
        multiline
        textAlignVertical="top"
      />

      <TouchableOpacity
        style={[styles.primaryBtn, (!careerGoal.trim() || bioGenerating) && styles.btnDisabled]}
        onPress={handleBioGeneration}
        disabled={!careerGoal.trim() || bioGenerating}
      >
        {bioGenerating ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <ActivityIndicator size="small" color="#fff" />
            <Text style={styles.primaryBtnText}>Generating your bio...</Text>
          </View>
        ) : (
          <>
            <Text style={styles.primaryBtnText}>Continue</Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </>
        )}
      </TouchableOpacity>
    </ScrollView>
  );

  const renderStepNotifications = () => (
    <View style={styles.stepContent}>
      <View style={styles.iconCircle}>
        <Ionicons name="notifications-outline" size={40} color="#14b8a6" />
      </View>
      <Text style={styles.stepTitle}>Stay in the Loop</Text>
      <Text style={styles.stepSubtitle}>
        Get notified when new jobs are posted, when you receive transfers, and
        when your goals are reached.
      </Text>
      {notifGranted === true ? (
        <View style={styles.grantedRow}>
          <Ionicons name="checkmark-circle" size={24} color="#10b981" />
          <Text style={styles.grantedText}>Notifications enabled</Text>
        </View>
      ) : null}
      <TouchableOpacity
        style={styles.primaryBtn}
        onPress={requestNotifications}
      >
        <Ionicons name="notifications" size={18} color="#fff" />
        <Text style={styles.primaryBtnText}>
          {notifGranted === null ? "Enable Notifications" : "Continue"}
        </Text>
      </TouchableOpacity>
      {notifGranted === null && (
        <TouchableOpacity style={styles.skipBtn} onPress={goNext}>
          <Text style={styles.skipBtnText}>Skip</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderStepLocation = () => (
    <View style={styles.stepContent}>
      <View style={styles.iconCircle}>
        <Ionicons name="location-outline" size={40} color="#14b8a6" />
      </View>
      <Text style={styles.stepTitle}>Location Access</Text>
      <Text style={styles.stepSubtitle}>
        Location is required to verify you're at the job site when checking in.
        This ensures accurate attendance tracking.
      </Text>
      {locationGranted === true ? (
        <View style={styles.grantedRow}>
          <Ionicons name="checkmark-circle" size={24} color="#10b981" />
          <Text style={styles.grantedText}>Location enabled</Text>
        </View>
      ) : null}
      <TouchableOpacity
        style={styles.primaryBtn}
        onPress={requestLocation}
        disabled={submitting}
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Ionicons name="location" size={18} color="#fff" />
            <Text style={styles.primaryBtnText}>
              {locationGranted === null
                ? "Enable Location"
                : "Complete Setup"}
            </Text>
          </>
        )}
      </TouchableOpacity>
      {locationGranted === null && !submitting && (
        <TouchableOpacity
          style={styles.skipBtn}
          onPress={completeOnboarding}
        >
          <Text style={styles.skipBtnText}>Skip & Finish</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderStep = () => {
    switch (step) {
      case 1:
        return renderStepName();
      case 2:
        return renderStepAvatar();
      case 3:
        return renderStepQuestionnaire();
      case 4:
        return renderStepNotifications();
      case 5:
        return renderStepLocation();
      default:
        return null;
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      {/* Step indicator dots */}
      <View style={styles.dotsRow}>
        {Array.from({ length: TOTAL_STEPS }, (_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              i + 1 === step && styles.dotActive,
              i + 1 < step && styles.dotComplete,
            ]}
          />
        ))}
      </View>

      {/* Step counter */}
      <Text style={styles.stepCounter}>
        Step {step} of {TOTAL_STEPS}
      </Text>

      {/* Back button */}
      {step > 1 && (
        <TouchableOpacity style={styles.backBtn} onPress={goBack}>
          <Ionicons name="arrow-back" size={22} color="#8b9bb5" />
        </TouchableOpacity>
      )}

      {/* Step content */}
      {renderStep()}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0f1a",
    paddingHorizontal: 24,
    paddingTop: 80,
  },
  dotsRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#2a3545",
  },
  dotActive: {
    backgroundColor: "#14b8a6",
    width: 28,
    borderRadius: 5,
  },
  dotComplete: {
    backgroundColor: "#10b981",
  },
  stepCounter: {
    textAlign: "center",
    color: "#5a6a80",
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 24,
  },
  backBtn: {
    position: "absolute",
    top: 48,
    left: 16,
    padding: 8,
    zIndex: 10,
  },
  stepContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingBottom: 80,
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "#1a2332",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  avatarPlaceholder: {
    marginBottom: 24,
  },
  avatarPreview: {
    width: 96,
    height: 96,
    borderRadius: 48,
    marginBottom: 24,
    borderWidth: 3,
    borderColor: "#14b8a6",
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#f1f5f9",
    textAlign: "center",
    marginBottom: 8,
  },
  stepSubtitle: {
    fontSize: 15,
    color: "#8b9bb5",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 32,
    paddingHorizontal: 8,
  },
  input: {
    width: "100%",
    backgroundColor: "#1a2332",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 18,
    color: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#2a3545",
    marginBottom: 20,
    textAlign: "center",
  },
  questionInput: {
    width: "100%",
    backgroundColor: "#1a2332",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#2a3545",
    marginBottom: 12,
    minHeight: 56,
  },
  primaryBtn: {
    width: "100%",
    backgroundColor: "#14b8a6",
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  primaryBtnText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
  },
  secondaryBtn: {
    width: "100%",
    backgroundColor: "#1a2332",
    borderRadius: 14,
    paddingVertical: 14,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "#2a3545",
    marginBottom: 12,
  },
  secondaryBtnText: {
    color: "#5a6a80",
    fontSize: 15,
    fontWeight: "600",
  },
  skipBtn: {
    marginTop: 16,
    paddingVertical: 10,
  },
  skipBtnText: {
    color: "#5a6a80",
    fontSize: 15,
    fontWeight: "600",
  },
  grantedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 20,
    backgroundColor: "#1a2332",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  grantedText: {
    color: "#10b981",
    fontSize: 15,
    fontWeight: "600",
  },
});
