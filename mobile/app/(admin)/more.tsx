import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

type MenuItem = {
  label: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  path: string;
};

const MENU_ITEMS: MenuItem[] = [
  {
    label: "Dashboard",
    subtitle: "Approvals, job review, notifications",
    icon: "grid-outline",
    path: "/(admin)/dashboard",
  },
  {
    label: "Leads & SOPs",
    subtitle: "Lead management, SOP generation",
    icon: "document-text-outline",
    path: "/(admin)/leads",
  },
  {
    label: "Payouts",
    subtitle: "Track and manage payments",
    icon: "cash-outline",
    path: "/(admin)/payouts",
  },
  {
    label: "Social Media",
    subtitle: "Monitor automated posts, retry failures",
    icon: "megaphone-outline",
    path: "/(admin)/social-media",
  },
  {
    label: "Share App",
    subtitle: "QR code for scholars to download",
    icon: "qr-code-outline",
    path: "/(admin)/share-app",
  },
  {
    label: "Settings",
    subtitle: "Create users, manage accounts",
    icon: "settings-outline",
    path: "/(admin)/settings",
  },
  {
    label: "Business Dashboard",
    subtitle: "Unified overview of all operations",
    icon: "bar-chart-outline",
    path: "/(admin)/unified",
  },
];

export default function MoreScreen() {
  const router = useRouter();

  const handleViewAsScholar = () => {
    Alert.alert(
      "View as Scholar",
      "Switch to the scholar view to see what scholars see — available jobs, my jobs, goals, and profile.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Switch to Scholar View",
          onPress: () => router.push("/(scholar)/jobs"),
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      {/* Scholar View Button */}
      <TouchableOpacity
        style={styles.scholarViewBtn}
        onPress={handleViewAsScholar}
        activeOpacity={0.7}
      >
        <View style={styles.scholarViewIcon}>
          <Ionicons name="eye-outline" size={22} color="#fff" />
        </View>
        <View style={styles.textWrap}>
          <Text style={styles.scholarViewLabel}>View as Scholar</Text>
          <Text style={styles.scholarViewSubtitle}>
            Preview the scholar experience — jobs feed, check-in, goals
          </Text>
        </View>
        <Ionicons name="arrow-forward" size={18} color="#14b8a6" />
      </TouchableOpacity>

      <Text style={styles.heading}>Admin Tools</Text>
      {MENU_ITEMS.map((item) => (
        <TouchableOpacity
          key={item.path}
          style={styles.menuItem}
          onPress={() => router.push(item.path as any)}
          activeOpacity={0.7}
        >
          <View style={styles.iconWrap}>
            <Ionicons name={item.icon} size={22} color="#14b8a6" />
          </View>
          <View style={styles.textWrap}>
            <Text style={styles.menuLabel}>{item.label}</Text>
            <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#5a6a80" />
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0f1a" },
  scroll: { padding: 16, paddingBottom: 40 },
  heading: {
    fontSize: 14,
    fontWeight: "700",
    color: "#8b9bb5",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  scholarViewBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#14b8a615",
    borderWidth: 1,
    borderColor: "#14b8a640",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    gap: 14,
  },
  scholarViewIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "#14b8a6",
    justifyContent: "center",
    alignItems: "center",
  },
  scholarViewLabel: { fontSize: 15, fontWeight: "700", color: "#14b8a6" },
  scholarViewSubtitle: { fontSize: 12, color: "#8b9bb5", marginTop: 2 },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1a2332",
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    gap: 14,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "#14b8a610",
    justifyContent: "center",
    alignItems: "center",
  },
  textWrap: { flex: 1 },
  menuLabel: { fontSize: 15, fontWeight: "700", color: "#f1f5f9" },
  menuSubtitle: { fontSize: 12, color: "#8b9bb5", marginTop: 2 },
});
