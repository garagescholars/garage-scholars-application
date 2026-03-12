/**
 * ARProductPicker — Bottom sheet overlay for selecting products to place in AR.
 *
 * Shows product catalog grouped by surface type. Tapping a product activates
 * plane detection for that surface type. Placed products show as chips with
 * an X to remove.
 */

import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AR_PRODUCTS, type ARProduct, type ARSurface } from "../../constants/arProducts";
import type { PlacedProduct } from "./ARProductScene";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

type Props = {
  selectedProduct: ARProduct | null;
  placedProducts: PlacedProduct[];
  onSelectProduct: (product: ARProduct) => void;
  onRemoveProduct: (placedId: string) => void;
  onCapture: () => void;
  onClose: () => void;
  capturing: boolean;
};

const SURFACE_ICONS: Record<ARSurface, keyof typeof Ionicons.glyphMap> = {
  ceiling: "arrow-up-outline",
  wall: "tablet-landscape-outline",
  floor: "grid-outline",
};

const SURFACE_LABELS: Record<ARSurface, string> = {
  ceiling: "Ceiling",
  wall: "Wall",
  floor: "Floor",
};

const SURFACE_ORDER: ARSurface[] = ["ceiling", "wall", "floor"];

export default function ARProductPicker({
  selectedProduct,
  placedProducts,
  onSelectProduct,
  onRemoveProduct,
  onCapture,
  onClose,
  capturing,
}: Props) {
  const [expanded, setExpanded] = useState(true);

  return (
    <View style={styles.container}>
      {/* Placed products chips */}
      {placedProducts.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.placedRow}
          contentContainerStyle={styles.placedContent}
        >
          {placedProducts.map((p) => (
            <View key={p.id} style={styles.placedChip}>
              <View style={[styles.placedDot, { backgroundColor: p.product.color }]} />
              <Text style={styles.placedText} numberOfLines={1}>
                {p.product.name}
              </Text>
              <TouchableOpacity
                onPress={() => onRemoveProduct(p.id)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close-circle" size={16} color="#ef4444" />
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Active selection indicator */}
      {selectedProduct && (
        <View style={styles.activeBar}>
          <Ionicons name="scan-outline" size={18} color="#f59e0b" />
          <Text style={styles.activeText}>
            Tap a {selectedProduct.surface === "wall" ? "wall" : "surface"} to place{" "}
            <Text style={styles.activeBold}>{selectedProduct.name}</Text>
          </Text>
        </View>
      )}

      {/* Toggle / collapse header */}
      <TouchableOpacity
        style={styles.header}
        onPress={() => setExpanded(!expanded)}
      >
        <Text style={styles.headerTitle}>Products</Text>
        <View style={styles.headerRight}>
          <Text style={styles.headerCount}>{placedProducts.length} placed</Text>
          <Ionicons
            name={expanded ? "chevron-down" : "chevron-up"}
            size={18}
            color="#888"
          />
        </View>
      </TouchableOpacity>

      {/* Product catalog */}
      {expanded && (
        <ScrollView
          style={styles.catalog}
          contentContainerStyle={styles.catalogContent}
          showsVerticalScrollIndicator={false}
        >
          {SURFACE_ORDER.map((surface) => {
            const products = AR_PRODUCTS.filter((p) => p.surface === surface);
            if (products.length === 0) return null;

            return (
              <View key={surface}>
                <View style={styles.groupHeader}>
                  <Ionicons name={SURFACE_ICONS[surface]} size={14} color="#666" />
                  <Text style={styles.groupLabel}>{SURFACE_LABELS[surface]}</Text>
                </View>
                {products.map((product) => {
                  const isSelected = selectedProduct?.id === product.id;
                  return (
                    <TouchableOpacity
                      key={product.id}
                      style={[styles.productRow, isSelected && styles.productRowActive]}
                      onPress={() => onSelectProduct(product)}
                    >
                      <View style={[styles.productSwatch, { backgroundColor: product.color }]} />
                      <View style={styles.productInfo}>
                        <Text style={[styles.productName, isSelected && styles.productNameActive]}>
                          {product.name}
                        </Text>
                        <Text style={styles.productDesc}>{product.description}</Text>
                      </View>
                      {isSelected ? (
                        <Ionicons name="radio-button-on" size={20} color="#f59e0b" />
                      ) : (
                        <Ionicons name="add-circle-outline" size={20} color="#555" />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Bottom action bar */}
      <View style={styles.actionBar}>
        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
          <Text style={styles.closeBtnText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.captureBtn, placedProducts.length === 0 && styles.captureBtnDisabled]}
          onPress={onCapture}
          disabled={placedProducts.length === 0 || capturing}
        >
          <Ionicons name="camera" size={20} color="#000" />
          <Text style={styles.captureBtnText}>
            {capturing ? "Saving..." : "Capture Mockup"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(10, 10, 10, 0.95)",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: "55%",
  },
  // Placed products horizontal scroll
  placedRow: {
    maxHeight: 44,
    borderBottomWidth: 1,
    borderBottomColor: "#222",
  },
  placedContent: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    flexDirection: "row",
  },
  placedChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#1a1a1a",
    borderRadius: 16,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "#333",
  },
  placedDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: "#444",
  },
  placedText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#ccc",
    maxWidth: 100,
  },
  // Active selection bar
  activeBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "rgba(245, 158, 11, 0.1)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(245, 158, 11, 0.2)",
  },
  activeText: {
    fontSize: 13,
    color: "#f59e0b",
  },
  activeBold: {
    fontWeight: "700",
  },
  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#222",
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#eee",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerCount: {
    fontSize: 12,
    color: "#666",
  },
  // Catalog
  catalog: {
    maxHeight: 240,
  },
  catalogContent: {
    paddingBottom: 8,
  },
  groupHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  groupLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#555",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  productRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#1a1a1a",
  },
  productRowActive: {
    backgroundColor: "rgba(245, 158, 11, 0.08)",
  },
  productSwatch: {
    width: 28,
    height: 28,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#333",
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 13,
    fontWeight: "600",
    color: "#ccc",
  },
  productNameActive: {
    color: "#f59e0b",
  },
  productDesc: {
    fontSize: 11,
    color: "#555",
    marginTop: 1,
  },
  // Action bar
  actionBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    paddingBottom: 28,
    borderTopWidth: 1,
    borderTopColor: "#222",
  },
  closeBtn: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#333",
  },
  closeBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#888",
  },
  captureBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#f59e0b",
    borderRadius: 10,
    paddingVertical: 14,
  },
  captureBtnDisabled: {
    opacity: 0.4,
  },
  captureBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#000",
  },
});
