import { useEffect } from "react";
import { Tabs, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Platform, View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "../../src/hooks/useAuth";
import { useAchievementUnlock } from "../../src/hooks/useAchievementUnlock";
import AchievementUnlockOverlay from "../../src/components/AchievementUnlockOverlay";
import { ADMIN_EMAILS } from "../../src/constants/config";
import { colors, layout } from "../../src/constants/theme";

export default function ScholarLayout() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { newAchievement, dismiss } = useAchievementUnlock(user?.uid);

  const isAdmin = user?.email ? ADMIN_EMAILS.includes(user.email.toLowerCase()) : false;

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/(auth)/email-login");
    }
  }, [user, loading]);

  if (loading || !user) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.bg.primary }}>
        <ActivityIndicator size="large" color={colors.brand.teal} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {/* Admin preview banner */}
      {isAdmin && (
        <TouchableOpacity
          style={{
            backgroundColor: "#14b8a6",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            paddingVertical: 8,
            paddingTop: Platform.OS === "ios" ? 50 : 8,
            gap: 8,
          }}
          onPress={() => router.replace("/(admin)/jobs")}
        >
          <Ionicons name="arrow-back" size={16} color="#fff" />
          <Text style={{ color: "#fff", fontSize: 13, fontWeight: "700" }}>
            Back to Admin View
          </Text>
          <View style={{
            backgroundColor: "#ffffff30",
            paddingHorizontal: 8,
            paddingVertical: 2,
            borderRadius: 4,
            marginLeft: 4,
          }}>
            <Text style={{ color: "#fff", fontSize: 11, fontWeight: "600" }}>PREVIEW MODE</Text>
          </View>
        </TouchableOpacity>
      )}
      <Tabs
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg.primary },
          headerTintColor: colors.text.primary,
          headerTitleStyle: { fontWeight: "700", letterSpacing: -0.2 },
          tabBarStyle: {
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
          tabBarIcon: ({ focused, color, size }) => {
            // Add gradient indicator bar for active tabs
            if (focused) {
              return (
                <View style={{ alignItems: "center" }}>
                  <LinearGradient
                    colors={colors.brand.gradient as unknown as [string, string]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={{ width: 24, height: 3, borderRadius: 2, marginBottom: 4 }}
                  />
                </View>
              );
            }
            return null;
          },
        }}
      >
        <Tabs.Screen
          name="jobs/index"
          options={{
            title: "Jobs",
            headerTitle: "Available Jobs",
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
          name="my-jobs/index"
          options={{
            title: "My Jobs",
            headerTitle: "My Jobs",
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
                <Ionicons name={focused ? "calendar" : "calendar-outline"} size={size} color={color} />
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="goals/index"
          options={{
            title: "Goals",
            headerTitle: "Goals & Leaderboard",
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
                <Ionicons name={focused ? "trophy" : "trophy-outline"} size={size} color={color} />
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="profile/index"
          options={{
            title: "Profile",
            headerTitle: "My Profile",
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
                <Ionicons name={focused ? "person" : "person-outline"} size={size} color={color} />
              </View>
            ),
          }}
        />
        {/* Hide non-tab screens from tab bar */}
        <Tabs.Screen name="jobs/[id]" options={{ href: null, headerTitle: "Job Details" }} />
        <Tabs.Screen name="my-jobs/[id]/checkin" options={{ href: null, headerTitle: "Check In" }} />
        <Tabs.Screen name="my-jobs/[id]/checkout" options={{ href: null, headerTitle: "Check Out" }} />
        <Tabs.Screen name="my-jobs/[id]/transfer" options={{ href: null, headerTitle: "Transfer Job" }} />
        <Tabs.Screen name="my-jobs/[id]/reschedule" options={{ href: null, headerTitle: "Reschedule Job" }} />
        <Tabs.Screen name="goals/set-goal" options={{ href: null, headerTitle: "Set Goal" }} />
        <Tabs.Screen name="profile/score-history" options={{ href: null, headerTitle: "Score History" }} />
        <Tabs.Screen name="profile/payments" options={{ href: null, headerTitle: "Payment History" }} />
        <Tabs.Screen name="profile/payment-setup" options={{ href: null, headerTitle: "Bank Setup" }} />
        <Tabs.Screen name="my-jobs/[id]/escalate" options={{ href: null, headerTitle: "Report Issue" }} />
        <Tabs.Screen name="my-jobs/[id]/escalations" options={{ href: null, headerTitle: "Escalations" }} />
        <Tabs.Screen name="my-jobs/[id]/prep" options={{ href: null, headerTitle: "Video Homework" }} />
        <Tabs.Screen name="my-jobs/[id]/donation-receipt" options={{ href: null, headerTitle: "Donation Receipt" }} />
      </Tabs>

      {newAchievement && (
        <AchievementUnlockOverlay
          achievement={newAchievement}
          onDismiss={dismiss}
        />
      )}
    </View>
  );
}
