import { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  TextInput,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useOpenJobs } from "../../../src/hooks/useJobs";
import { useAuth } from "../../../src/hooks/useAuth";
import JobCard from "../../../src/components/JobCard";
import RecentClaimsBanner from "../../../src/components/RecentClaimsBanner";
import FeedStatsBar from "../../../src/components/FeedStatsBar";
import HotJobsCarousel from "../../../src/components/HotJobsCarousel";
import { StaggeredItem, SkeletonBox, FadeInView } from "../../../src/components/AnimatedComponents";
import { colors, spacing, radius, typography, layout } from "../../../src/constants/theme";

export default function JobFeedScreen() {
  const { jobs, loading } = useOpenJobs();
  const { profile } = useAuth();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const firstName = (profile?.name || "").split(" ")[0];

  const filtered = search.trim()
    ? jobs.filter(
        (j) =>
          j.title.toLowerCase().includes(search.toLowerCase()) ||
          j.address.toLowerCase().includes(search.toLowerCase())
      )
    : jobs;

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  }, []);

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.searchRow}>
          <SkeletonBox width="100%" height={18} />
        </View>
        {[0, 1, 2].map((i) => (
          <FadeInView key={i} delay={i * 100} style={{ paddingHorizontal: layout.screenPadding, paddingTop: 8 }}>
            <View style={{ backgroundColor: colors.bg.card, borderRadius: radius.lg, padding: spacing.lg, borderLeftWidth: 4, borderLeftColor: colors.category.default }}>
              <SkeletonBox width={80} height={20} style={{ marginBottom: 10 }} />
              <SkeletonBox width="70%" height={17} style={{ marginBottom: 8 }} />
              <SkeletonBox width="90%" height={13} style={{ marginBottom: 4 }} />
              <SkeletonBox width="60%" height={13} />
            </View>
          </FadeInView>
        ))}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Personal greeting */}
      {firstName ? (
        <View style={styles.greetingRow}>
          <Text style={styles.greeting}>Hey {firstName}!</Text>
          <Text style={styles.greetingSub}>
            {jobs.length} job{jobs.length !== 1 ? "s" : ""} available today
          </Text>
        </View>
      ) : null}

      <View style={styles.searchRow}>
        <Ionicons name="search" size={18} color={colors.text.muted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search jobs..."
          placeholderTextColor={colors.text.muted}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {filtered.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="briefcase-outline" size={48} color={colors.border.default} />
          <Text style={styles.emptyText}>
            {search ? "No matching jobs" : "No open jobs right now"}
          </Text>
          <Text style={styles.emptySubtext}>
            {search
              ? "Try a different search"
              : "Check back soon — new jobs post daily"}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={
            <>
              <FeedStatsBar jobs={jobs} />
              <HotJobsCarousel
                jobs={jobs}
                onJobPress={(jobId) => router.push(`/(scholar)/jobs/${jobId}` as any)}
              />
              <RecentClaimsBanner />
            </>
          }
          renderItem={({ item, index }) => (
            <StaggeredItem index={index}>
              <JobCard
                job={item}
                onPress={() =>
                  router.push(`/(scholar)/jobs/${item.id}` as any)
                }
              />
            </StaggeredItem>
          )}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.brand.teal}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  greetingRow: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xs,
  },
  greeting: {
    ...typography.heading1,
    color: colors.text.heading,
    marginBottom: 2,
  },
  greetingSub: {
    ...typography.body,
    color: colors.text.secondary,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xxl,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.bg.input,
    marginHorizontal: layout.screenPadding,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    color: colors.text.primary,
    ...typography.body,
  },
  list: {
    padding: layout.screenPadding,
    paddingTop: spacing.sm,
  },
  emptyText: {
    ...typography.heading3,
    color: colors.text.primary,
    marginTop: spacing.lg,
  },
  emptySubtext: {
    ...typography.body,
    color: colors.text.muted,
    marginTop: spacing.xs + 2,
    textAlign: "center",
  },
});
