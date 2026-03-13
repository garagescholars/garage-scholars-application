/**
 * Product Editor — Static image product placement tool.
 *
 * Scholar loads a garage photo, drags architectural product overlays
 * onto it, resizes/repositions them, then captures the composite
 * and saves it to the consultation in Firestore.
 *
 * No AI, no AR, no native build required. Works on web + mobile.
 */

import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  Dimensions,
  PanResponder,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { doc, onSnapshot, updateDoc, arrayUnion, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import ViewShot from "react-native-view-shot";
import { db, storage } from "../../../../src/lib/firebase";
import { COLLECTIONS } from "../../../../src/constants/collections";
import { colors } from "../../../../src/constants/theme";
import {
  EDITOR_PRODUCTS,
  SURFACE_ORDER,
  SURFACE_LABELS,
  type EditorProduct,
  type EditorSurface,
} from "../../../../src/constants/editorProducts";

const { width: SCREEN_W } = Dimensions.get("window");
const CANVAS_W = SCREEN_W;
const CANVAS_H = SCREEN_W * 0.75; // 4:3 aspect

type PlacedItem = {
  id: string;
  product: EditorProduct;
  /** Position as fraction of canvas (0-1) */
  x: number;
  y: number;
  /** Width as fraction of canvas width (0-1) */
  widthPct: number;
  opacity: number;
};

let counter = 0;

export default function ProductEditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const viewShotRef = useRef<ViewShot>(null);

  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [placedItems, setPlacedItems] = useState<PlacedItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pickerExpanded, setPickerExpanded] = useState(true);
  const [surfaceFilter, setSurfaceFilter] = useState<EditorSurface | "all">("all");

  // Load consultation photo
  useEffect(() => {
    if (!id) return;
    const unsub = onSnapshot(doc(db, COLLECTIONS.CONSULTATIONS, id), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setPhotoUrl(data.spacePhotoUrls?.wide || null);
      }
      setLoading(false);
    });
    return unsub;
  }, [id]);

  const addProduct = useCallback((product: EditorProduct) => {
    const item: PlacedItem = {
      id: `item_${++counter}`,
      product,
      x: 0.35 + Math.random() * 0.1,
      y: product.surface === "ceiling" ? 0.1 : product.surface === "wall" ? 0.35 : 0.65,
      widthPct: product.defaultWidthPct,
      opacity: 0.85,
    };
    setPlacedItems((prev) => [...prev, item]);
    setSelectedId(item.id);
    setPickerExpanded(false);
  }, []);

  const updateItem = useCallback((itemId: string, updates: Partial<PlacedItem>) => {
    setPlacedItems((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, ...updates } : item))
    );
  }, []);

  const removeItem = useCallback((itemId: string) => {
    setPlacedItems((prev) => prev.filter((item) => item.id !== itemId));
    setSelectedId((prev) => (prev === itemId ? null : prev));
  }, []);

  const resizeItem = useCallback((itemId: string, delta: number) => {
    setPlacedItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        const newW = Math.max(0.05, Math.min(0.8, item.widthPct + delta));
        return { ...item, widthPct: newW };
      })
    );
  }, []);

  const handleSave = useCallback(async () => {
    if (!id || !viewShotRef.current || placedItems.length === 0) return;
    setSaving(true);

    try {
      // Deselect so no controls show in capture
      setSelectedId(null);

      // Small delay to ensure UI updates before capture
      await new Promise((r) => setTimeout(r, 100));

      const uri = await (viewShotRef.current as any).capture();

      // Upload to Firebase Storage
      const response = await fetch(uri);
      const blob = await response.blob();
      const storagePath = `gs_consultation_editor/${id}/product_mockup_${Date.now()}.png`;
      const storageRef = ref(storage, storagePath);
      await uploadBytes(storageRef, blob);
      const downloadUrl = await getDownloadURL(storageRef);

      // Save to consultation
      const consultRef = doc(db, COLLECTIONS.CONSULTATIONS, id);
      await updateDoc(consultRef, {
        productMockups: arrayUnion({
          imageUrl: downloadUrl,
          placedProducts: placedItems.map((item) => ({
            productId: item.product.id,
            name: item.product.name,
            surface: item.product.surface,
            x: item.x,
            y: item.y,
            widthPct: item.widthPct,
          })),
          capturedAt: new Date().toISOString(),
        }),
        updatedAt: serverTimestamp(),
      });

      Alert.alert(
        "Mockup Saved",
        `Product layout with ${placedItems.length} item${placedItems.length !== 1 ? "s" : ""} saved.`,
        [
          { text: "Edit More", style: "cancel" },
          {
            text: "View Mockups",
            onPress: () => router.replace(`/(admin)/consultations/${id}/mockups` as any),
          },
        ]
      );
    } catch (err: any) {
      console.error("Save failed:", err);
      Alert.alert("Save Failed", err.message || "Could not save the product mockup.");
    } finally {
      setSaving(false);
    }
  }, [id, placedItems, router]);

  const selected = placedItems.find((i) => i.id === selectedId);

  const filteredProducts =
    surfaceFilter === "all"
      ? EDITOR_PRODUCTS
      : EDITOR_PRODUCTS.filter((p) => p.surface === surfaceFilter);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.brand.teal} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Canvas area — capturable */}
      <ViewShot
        ref={viewShotRef}
        options={{ format: "png", quality: 1.0 }}
        style={styles.canvasWrapper}
      >
        <View style={styles.canvas}>
          {photoUrl ? (
            <Image source={{ uri: photoUrl }} style={styles.canvasImage} resizeMode="cover" />
          ) : (
            <View style={styles.canvasPlaceholder}>
              <Ionicons name="image-outline" size={48} color="#333" />
              <Text style={styles.canvasPlaceholderText}>No garage photo</Text>
            </View>
          )}

          {/* Placed product overlays */}
          {placedItems.map((item) => (
            <DraggableOverlay
              key={item.id}
              item={item}
              isSelected={item.id === selectedId}
              canvasW={CANVAS_W}
              canvasH={CANVAS_H}
              onSelect={() => setSelectedId(item.id)}
              onMove={(x, y) => updateItem(item.id, { x, y })}
            />
          ))}
        </View>
      </ViewShot>

      {/* Controls for selected item */}
      {selected && (
        <View style={styles.controlBar}>
          <Text style={styles.controlLabel} numberOfLines={1}>
            {selected.product.name}
          </Text>
          <View style={styles.controlActions}>
            <TouchableOpacity
              style={styles.controlBtn}
              onPress={() => resizeItem(selected.id, -0.03)}
            >
              <Ionicons name="remove-outline" size={18} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.controlSize}>
              {Math.round(selected.widthPct * 100)}%
            </Text>
            <TouchableOpacity
              style={styles.controlBtn}
              onPress={() => resizeItem(selected.id, 0.03)}
            >
              <Ionicons name="add-outline" size={18} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.controlBtn, styles.controlBtnDanger]}
              onPress={() => removeItem(selected.id)}
            >
              <Ionicons name="trash-outline" size={16} color="#ef4444" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Product picker */}
      <View style={styles.pickerContainer}>
        <TouchableOpacity
          style={styles.pickerHeader}
          onPress={() => setPickerExpanded(!pickerExpanded)}
        >
          <Text style={styles.pickerTitle}>Products</Text>
          <View style={styles.pickerHeaderRight}>
            <Text style={styles.pickerCount}>{placedItems.length} placed</Text>
            <Ionicons
              name={pickerExpanded ? "chevron-down" : "chevron-up"}
              size={18}
              color="#888"
            />
          </View>
        </TouchableOpacity>

        {pickerExpanded && (
          <>
            {/* Surface filter tabs */}
            <View style={styles.filterRow}>
              <TouchableOpacity
                style={[styles.filterTab, surfaceFilter === "all" && styles.filterTabActive]}
                onPress={() => setSurfaceFilter("all")}
              >
                <Text style={[styles.filterTabText, surfaceFilter === "all" && styles.filterTabTextActive]}>
                  All
                </Text>
              </TouchableOpacity>
              {SURFACE_ORDER.map((surface) => (
                <TouchableOpacity
                  key={surface}
                  style={[styles.filterTab, surfaceFilter === surface && styles.filterTabActive]}
                  onPress={() => setSurfaceFilter(surface)}
                >
                  <Text style={[styles.filterTabText, surfaceFilter === surface && styles.filterTabTextActive]}>
                    {SURFACE_LABELS[surface]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Product list */}
            <ScrollView
              style={styles.productList}
              contentContainerStyle={styles.productListContent}
              showsVerticalScrollIndicator={false}
            >
              {filteredProducts.map((product) => (
                <TouchableOpacity
                  key={product.id}
                  style={styles.productRow}
                  onPress={() => addProduct(product)}
                >
                  <View style={[styles.productIcon, { backgroundColor: product.color }]}>
                    <Ionicons name={product.icon as any} size={18} color="#ccc" />
                  </View>
                  <View style={styles.productInfo}>
                    <Text style={styles.productName}>{product.name}</Text>
                    <Text style={styles.productDims}>
                      {product.dimsLabel} · {SURFACE_LABELS[product.surface]}
                    </Text>
                  </View>
                  <Ionicons name="add-circle-outline" size={22} color={colors.brand.teal} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        )}
      </View>

      {/* Bottom action bar */}
      <View style={styles.actionBar}>
        <TouchableOpacity style={styles.cancelBtn} onPress={() => router.back()}>
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.saveBtn, (placedItems.length === 0 || saving) && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={placedItems.length === 0 || saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#000" />
          ) : (
            <Ionicons name="camera" size={20} color="#000" />
          )}
          <Text style={styles.saveBtnText}>
            {saving ? "Saving..." : "Save Mockup"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Draggable product overlay ──

function DraggableOverlay({
  item,
  isSelected,
  canvasW,
  canvasH,
  onSelect,
  onMove,
}: {
  item: PlacedItem;
  isSelected: boolean;
  canvasW: number;
  canvasH: number;
  onSelect: () => void;
  onMove: (x: number, y: number) => void;
}) {
  // Track the starting position at gesture begin to avoid stale closure issues
  const startPos = useRef({ x: item.x, y: item.y });

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 2 || Math.abs(g.dy) > 2,
      onPanResponderGrant: () => {
        onSelect();
        startPos.current = { x: item.x, y: item.y };
      },
      onPanResponderMove: (_, gesture) => {
        const dx = gesture.dx / canvasW;
        const dy = gesture.dy / canvasH;
        const newX = Math.max(0, Math.min(1, startPos.current.x + dx));
        const newY = Math.max(0, Math.min(1, startPos.current.y + dy));
        onMove(newX, newY);
      },
      onPanResponderRelease: () => {},
    })
  ).current;

  // Keep startPos in sync for the next gesture
  useEffect(() => {
    startPos.current = { x: item.x, y: item.y };
  }, [item.x, item.y]);

  const overlayW = item.widthPct * canvasW;
  const overlayH = overlayW / item.product.aspect;
  const left = item.x * canvasW - overlayW / 2;
  const top = item.y * canvasH - overlayH / 2;

  const surfaceColor =
    item.product.surface === "ceiling"
      ? "#f59e0b"
      : item.product.surface === "wall"
      ? "#3b82f6"
      : "#10b981";

  return (
    <View
      {...panResponder.panHandlers}
      style={[
        styles.overlay,
        {
          left,
          top,
          width: overlayW,
          height: overlayH,
          opacity: item.opacity,
          borderColor: isSelected ? "#fff" : surfaceColor,
          borderWidth: isSelected ? 2 : 1,
        },
      ]}
    >
      {/* Product fill */}
      <View
        style={[
          styles.overlayFill,
          { backgroundColor: item.product.color },
        ]}
      />

      {/* Surface color accent stripe */}
      <View style={[styles.overlayStripe, { backgroundColor: surfaceColor }]} />

      {/* Product info */}
      <View style={styles.overlayContent}>
        <Ionicons name={item.product.icon as any} size={14} color="#ddd" />
        <Text style={styles.overlayName} numberOfLines={1}>
          {item.product.shortName}
        </Text>
        <Text style={styles.overlayDims}>{item.product.dimsLabel}</Text>
      </View>

      {/* Selection handles */}
      {isSelected && (
        <>
          <View style={[styles.handle, styles.handleTL]} />
          <View style={[styles.handle, styles.handleTR]} />
          <View style={[styles.handle, styles.handleBL]} />
          <View style={[styles.handle, styles.handleBR]} />
        </>
      )}
    </View>
  );
}

// ── Styles ──

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.bg.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  // Canvas
  canvasWrapper: {
    width: CANVAS_W,
    height: CANVAS_H,
    backgroundColor: "#000",
  },
  canvas: {
    width: CANVAS_W,
    height: CANVAS_H,
    position: "relative",
    overflow: "hidden",
  },
  canvasImage: {
    width: "100%",
    height: "100%",
  },
  canvasPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  canvasPlaceholderText: {
    fontSize: 14,
    color: "#555",
  },
  // Overlays
  overlay: {
    position: "absolute",
    borderRadius: 4,
    overflow: "hidden",
    minWidth: 40,
    minHeight: 20,
  },
  overlayFill: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.7,
  },
  overlayStripe: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 3,
  },
  overlayContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 4,
    gap: 2,
  },
  overlayName: {
    fontSize: 10,
    fontWeight: "700",
    color: "#fff",
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  overlayDims: {
    fontSize: 8,
    fontWeight: "600",
    color: "rgba(255,255,255,0.7)",
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  // Selection handles
  handle: {
    position: "absolute",
    width: 10,
    height: 10,
    backgroundColor: "#fff",
    borderRadius: 2,
    borderWidth: 1,
    borderColor: "#333",
  },
  handleTL: { top: -4, left: -4 },
  handleTR: { top: -4, right: -4 },
  handleBL: { bottom: -4, left: -4 },
  handleBR: { bottom: -4, right: -4 },
  // Control bar
  controlBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.bg.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.divider,
  },
  controlLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.text.primary,
    flex: 1,
    marginRight: 8,
  },
  controlActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  controlBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.bg.elevated,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  controlBtnDanger: {
    borderColor: "rgba(239,68,68,0.3)",
    marginLeft: 6,
  },
  controlSize: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.text.secondary,
    minWidth: 36,
    textAlign: "center",
  },
  // Picker
  pickerContainer: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  pickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.divider,
  },
  pickerTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text.primary,
  },
  pickerHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  pickerCount: {
    fontSize: 12,
    color: colors.text.muted,
  },
  // Filter tabs
  filterRow: {
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.divider,
  },
  filterTab: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: colors.bg.card,
  },
  filterTabActive: {
    backgroundColor: `${colors.brand.teal}20`,
    borderWidth: 1,
    borderColor: colors.brand.teal,
  },
  filterTabText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.text.muted,
  },
  filterTabTextActive: {
    color: colors.brand.teal,
  },
  // Product list
  productList: {
    flex: 1,
  },
  productListContent: {
    paddingBottom: 8,
  },
  productRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.divider,
  },
  productIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#333",
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text.primary,
  },
  productDims: {
    fontSize: 12,
    color: colors.text.muted,
    marginTop: 1,
  },
  // Action bar
  actionBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    paddingBottom: Platform.OS === "ios" ? 28 : 12,
    borderTopWidth: 1,
    borderTopColor: colors.border.divider,
    backgroundColor: colors.bg.primary,
  },
  cancelBtn: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text.secondary,
  },
  saveBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.brand.teal,
    borderRadius: 12,
    paddingVertical: 14,
  },
  saveBtnDisabled: {
    opacity: 0.4,
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#000",
  },
});
