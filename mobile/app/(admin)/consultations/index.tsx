import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "../../../src/lib/firebase";
import { COLLECTIONS } from "../../../src/constants/collections";
import { colors } from "../../../src/constants/theme";
import type { GsConsultation } from "../../../src/types";

const STATUS_COLORS: Record<string, string> = {
  draft: "#6b7280",
  photos_captured: "#f59e0b",
  generating: "#3b82f6",
  ready: "#10b981",
  shared: "#8b5cf6",
};

const PACKAGES: Record<string, Record<string, string>> = {
  garage_org: { tier1: "Undergraduate", tier2: "Graduate", tier3: "Doctorate" },
  gym_install: { tier1: "Warm Up", tier2: "Super Set", tier3: "1 Rep Max" },
};

export default function ConsultationsList() {
  const router = useRouter();
  const [consultations, setConsultations] = useState<(GsConsultation & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, COLLECTIONS.CONSULTATIONS),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(q, (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as GsConsultation & { id: string }));
      setConsultations(items);
      setLoading(false);
    });
    return unsub;
  }, []);

  const renderItem = ({ item }: { item: GsConsultation & { id: string } }) => {
    const statusColor = STATUS_COLORS[item.status] || "#6b7280";
    const serviceLabel = item.serviceType === "garage_org" ? "Garage Org" : "Home Gym";
    const readyCount = ["tier1", "tier2", "tier3"].filter(
      (t) => item.mockups?.[t as keyof typeof item.mockups]?.status === "ready"
    ).length;

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => {
          if (item.status === "draft") {
            router.push(`/(admin)/consultations/${item.id}/configure` as any);
          } else {
            router.push(`/(admin)/consultations/${item.id}/mockups` as any);
          }
        }}
      >
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.clientName}>{item.clientName}</Text>
            <Text style={styles.address} numberOfLines={1}>{item.address}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: `${statusColor}20` }]}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusText, { color: statusColor }]}>
              {item.status.replace("_", " ")}
            </Text>
          </View>
        </View>
        <View style={styles.cardMeta}>
          <View style={styles.metaChip}>
            <Ionicons
              name={item.serviceType === "garage_org" ? "cube-outline" : "barbell-outline"}
              size={14}
              color={colors.brand.teal}
            />
            <Text style={styles.metaText}>{serviceLabel}</Text>
          </View>
          {readyCount > 0 && (
            <View style={styles.metaChip}>
              <Ionicons name="image-outline" size={14} color="#10b981" />
              <Text style={[styles.metaText, { color: "#10b981" }]}>
                {readyCount}/3 mockups
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.newBtn}
        onPress={() => router.push("/(admin)/consultations/new" as any)}
      >
        <Ionicons name="add-circle" size={22} color="#fff" />
        <Text style={styles.newBtnText}>New Consultation</Text>
      </TouchableOpacity>

      {loading ? (
        <ActivityIndicator size="large" color={colors.brand.teal} style={{ marginTop: 40 }} />
      ) : consultations.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="image-outline" size={48} color={colors.text.muted} />
          <Text style={styles.emptyText}>No consultations yet</Text>
          <Text style={styles.emptySubtext}>
            Start a new consultation to generate AI mockups during a sales visit.
          </Text>
        </View>
      ) : (
        <FlatList
          data={consultations}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary, padding: 16 },
  newBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.brand.teal,
    borderRadius: 12,
    paddingVertical: 14,
    marginBottom: 16,
  },
  newBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  card: {
    backgroundColor: colors.bg.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: colors.brand.teal,
  },
  cardHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  clientName: { fontSize: 16, fontWeight: "700", color: colors.text.primary },
  address: { fontSize: 13, color: colors.text.secondary, marginTop: 2 },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 12, fontWeight: "700", textTransform: "capitalize" },
  cardMeta: { flexDirection: "row", gap: 12, marginTop: 10 },
  metaChip: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontSize: 12, fontWeight: "600", color: colors.text.secondary },
  empty: { alignItems: "center", marginTop: 60, gap: 8 },
  emptyText: { fontSize: 17, fontWeight: "700", color: colors.text.primary },
  emptySubtext: { fontSize: 14, color: colors.text.secondary, textAlign: "center", maxWidth: 280 },
});
