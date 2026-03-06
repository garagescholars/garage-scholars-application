import { useEffect } from "react";
import { Tabs, useRouter, usePathname } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  Platform,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "../../src/hooks/useAuth";
import { colors, layout } from "../../src/constants/theme";
import { ADMIN_EMAILS } from "../../src/constants/config";

type NavItem = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  path: string;
  group?: string;
};

const NAV_ITEMS: NavItem[] = [
  { label: "Jobs", icon: "briefcase-outline", path: "/(admin)/jobs", group: "Operations" },
  { label: "Scholars", icon: "people-outline", path: "/(admin)/scholars", group: "Operations" },
  { label: "Dashboard", icon: "grid-outline", path: "/(admin)/dashboard", group: "Operations" },
  { label: "Leads & SOPs", icon: "document-text-outline", path: "/(admin)/leads", group: "Operations" },
  { label: "Payouts", icon: "cash-outline", path: "/(admin)/payouts", group: "Finance" },
  { label: "Transfers", icon: "swap-horizontal-outline", path: "/(admin)/transfers", group: "Finance" },
  { label: "Analytics", icon: "stats-chart-outline", path: "/(admin)/analytics", group: "Insights" },
  { label: "Social Media", icon: "megaphone-outline", path: "/(admin)/social-media", group: "Insights" },
  { label: "Share App", icon: "qr-code-outline", path: "/(admin)/share-app", group: "Settings" },
  { label: "Settings", icon: "settings-outline", path: "/(admin)/settings", group: "Settings" },
];

function WebSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  let lastGroup = "";

  return (
    <View style={sidebarStyles.container}>
      <View style={sidebarStyles.header}>
        <Ionicons name="construct" size={22} color={colors.brand.teal} />
        <Text style={sidebarStyles.headerText}>Garage Scholars</Text>
      </View>
      <ScrollView style={sidebarStyles.nav} showsVerticalScrollIndicator={false}>
        {/* View as Scholar button */}
        <TouchableOpacity
          style={sidebarStyles.scholarViewBtn}
          onPress={() => router.push("/(scholar)/jobs" as any)}
        >
          <Ionicons name="eye-outline" size={16} color="#fff" />
          <Text style={sidebarStyles.scholarViewText}>View as Scholar</Text>
        </TouchableOpacity>

        {NAV_ITEMS.map((item) => {
          const isActive = pathname.startsWith(item.path.replace("/(admin)", ""));
          const showGroupLabel = item.group && item.group !== lastGroup;
          if (item.group) lastGroup = item.group;

          return (
            <View key={item.path}>
              {showGroupLabel && (
                <Text style={sidebarStyles.groupLabel}>{item.group}</Text>
              )}
              <TouchableOpacity
                style={[sidebarStyles.navItem, isActive && sidebarStyles.navItemActive]}
                onPress={() => router.push(item.path as any)}
              >
                {isActive && <View style={sidebarStyles.activeIndicator} />}
                <Ionicons
                  name={item.icon}
                  size={18}
                  color={isActive ? colors.brand.teal : colors.text.secondary}
                />
                <Text
                  style={[sidebarStyles.navLabel, isActive && sidebarStyles.navLabelActive]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

export default function AdminLayout() {
  const { width } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === "web" && width >= 1024;
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/(auth)/email-login");
    } else if (profile && profile.role !== "admin") {
      router.replace("/(scholar)/jobs");
    }
  }, [user, profile, loading]);

  if (loading || !user) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.bg.primary }}>
        <ActivityIndicator size="large" color={colors.brand.teal} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, flexDirection: "row" }}>
      {isDesktopWeb && <WebSidebar />}
      <View style={{ flex: 1 }}>
        <Tabs
          screenOptions={{
            headerStyle: { backgroundColor: colors.bg.primary },
            headerTintColor: colors.text.primary,
            headerTitleStyle: { fontWeight: "700", letterSpacing: -0.2 },
            tabBarStyle: isDesktopWeb
              ? { display: "none" }
              : {
                  backgroundColor: colors.bg.primary,
                  borderTopColor: colors.border.divider,
                  borderTopWidth: 1,
                  paddingBottom: Platform.OS === "ios" ? 20 : 4,
                  height: Platform.OS === "ios" ? layout.tabBarHeight.ios : layout.tabBarHeight.android,
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: -2 },
                  shadowOpacity: 0.12,
                  shadowRadius: 8,
                  elevation: 6,
                },
            tabBarActiveTintColor: colors.brand.teal,
            tabBarInactiveTintColor: colors.text.muted,
            tabBarLabelStyle: { fontSize: 11, fontWeight: "600", letterSpacing: 0.2 },
          }}
        >
          <Tabs.Screen
            name="jobs/index"
            options={{
              title: "Jobs",
              headerTitle: "All Jobs",
              tabBarIcon: ({ color, size, focused }) => (
                <View style={{ alignItems: "center" }}>
                  {focused && (
                    <LinearGradient
                      colors={colors.brand.gradient as unknown as [string, string]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={{ width: 24, height: 3, borderRadius: 2, marginBottom: 4 }}
                    />
                  )}
                  <Ionicons name={focused ? "briefcase" : "briefcase-outline"} size={size} color={color} />
                </View>
              ),
            }}
          />
          <Tabs.Screen
            name="scholars/index"
            options={{
              title: "Scholars",
              headerTitle: "Scholar Management",
              tabBarIcon: ({ color, size, focused }) => (
                <View style={{ alignItems: "center" }}>
                  {focused && (
                    <LinearGradient
                      colors={colors.brand.gradient as unknown as [string, string]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={{ width: 24, height: 3, borderRadius: 2, marginBottom: 4 }}
                    />
                  )}
                  <Ionicons name={focused ? "people" : "people-outline"} size={size} color={color} />
                </View>
              ),
            }}
          />
          <Tabs.Screen
            name="transfers"
            options={{
              title: "Transfers",
              headerTitle: "Transfers & Reschedules",
              tabBarIcon: ({ color, size, focused }) => (
                <View style={{ alignItems: "center" }}>
                  {focused && (
                    <LinearGradient
                      colors={colors.brand.gradient as unknown as [string, string]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={{ width: 24, height: 3, borderRadius: 2, marginBottom: 4 }}
                    />
                  )}
                  <Ionicons name={focused ? "swap-horizontal" : "swap-horizontal-outline"} size={size} color={color} />
                </View>
              ),
            }}
          />
          <Tabs.Screen
            name="analytics"
            options={{
              title: "Analytics",
              headerTitle: "Analytics",
              tabBarIcon: ({ color, size, focused }) => (
                <View style={{ alignItems: "center" }}>
                  {focused && (
                    <LinearGradient
                      colors={colors.brand.gradient as unknown as [string, string]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={{ width: 24, height: 3, borderRadius: 2, marginBottom: 4 }}
                    />
                  )}
                  <Ionicons name={focused ? "stats-chart" : "stats-chart-outline"} size={size} color={color} />
                </View>
              ),
            }}
          />
          <Tabs.Screen
            name="more"
            options={{
              title: "More",
              headerTitle: "More",
              href: isDesktopWeb ? null : undefined,
              tabBarIcon: ({ color, size, focused }) => (
                <View style={{ alignItems: "center" }}>
                  {focused && (
                    <LinearGradient
                      colors={colors.brand.gradient as unknown as [string, string]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={{ width: 24, height: 3, borderRadius: 2, marginBottom: 4 }}
                    />
                  )}
                  <Ionicons name="ellipsis-horizontal" size={size} color={color} />
                </View>
              ),
            }}
          />
          {/* Hide non-tab screens */}
          <Tabs.Screen name="jobs/create" options={{ href: null, headerTitle: "Create Job" }} />
          <Tabs.Screen name="jobs/[id]" options={{ href: null, headerTitle: "Job Details" }} />
          <Tabs.Screen name="scholars/[id]" options={{ href: null, headerTitle: "Scholar Details" }} />
          <Tabs.Screen name="dashboard" options={{ href: null, headerTitle: "Dashboard" }} />
          <Tabs.Screen name="leads" options={{ href: null, headerTitle: "Leads & SOPs" }} />
          <Tabs.Screen name="payouts" options={{ href: null, headerTitle: "Payouts" }} />
          <Tabs.Screen name="settings" options={{ href: null, headerTitle: "Settings" }} />
          <Tabs.Screen name="unified" options={{ href: null, headerTitle: "Business Dashboard" }} />
          <Tabs.Screen name="social-media" options={{ href: null, headerTitle: "Social Media" }} />
          <Tabs.Screen name="share-app" options={{ href: null, headerTitle: "Share App" }} />
        </Tabs>
      </View>
    </View>
  );
}

const sidebarStyles = StyleSheet.create({
  container: {
    width: layout.sidebarWidth,
    backgroundColor: colors.bg.primary,
    borderRightWidth: 1,
    borderRightColor: colors.border.divider,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 24,
    paddingVertical: 22,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.divider,
  },
  headerText: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.text.heading,
    letterSpacing: -0.2,
  },
  nav: {
    flex: 1,
    paddingTop: 8,
  },
  groupLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.text.muted,
    letterSpacing: 1.0,
    textTransform: "uppercase",
    paddingHorizontal: 24,
    paddingTop: 18,
    paddingBottom: 6,
  },
  navItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 11,
    paddingHorizontal: 24,
    paddingLeft: 24,
    marginHorizontal: 8,
    borderRadius: 10,
    position: "relative",
  },
  navItemActive: {
    backgroundColor: `${colors.brand.teal}10`,
  },
  activeIndicator: {
    position: "absolute",
    left: 0,
    top: 8,
    bottom: 8,
    width: 3,
    borderRadius: 2,
    backgroundColor: colors.brand.teal,
  },
  navLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.text.secondary,
  },
  navLabelActive: {
    color: colors.brand.teal,
    fontWeight: "600",
  },
  scholarViewBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 12,
    marginBottom: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: colors.brand.teal,
  },
  scholarViewText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#fff",
  },
});
