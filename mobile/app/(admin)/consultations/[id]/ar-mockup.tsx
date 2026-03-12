/**
 * AR Mockup Screen — ViroReact augmented reality product placement.
 *
 * Scholar points camera at the garage, selects products from the catalog,
 * taps surfaces to place them. Capture button takes a screenshot and
 * saves it to the consultation in Firestore.
 */

import React, { useState, useRef, useCallback } from "react";
import {
  View,
  StyleSheet,
  Platform,
  Text,
  TouchableOpacity,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ViroARSceneNavigator } from "@reactvision/react-viro";
import { doc, updateDoc, arrayUnion, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../../../../src/lib/firebase";
import { COLLECTIONS } from "../../../../src/constants/collections";
import ARProductScene, {
  type PlacedProduct,
} from "../../../../src/components/ar/ARProductScene";
import ARProductPicker from "../../../../src/components/ar/ARProductPicker";
import type { ARProduct } from "../../../../src/constants/arProducts";

export default function ARMockupScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const arNavigatorRef = useRef<any>(null);

  const [selectedProduct, setSelectedProduct] = useState<ARProduct | null>(null);
  const [placedProducts, setPlacedProducts] = useState<PlacedProduct[]>([]);
  const [capturing, setCapturing] = useState(false);

  const handleProductPlaced = useCallback((placed: PlacedProduct) => {
    setPlacedProducts((prev) => [...prev, placed]);
  }, []);

  const handleRemoveProduct = useCallback((placedId: string) => {
    setPlacedProducts((prev) => prev.filter((p) => p.id !== placedId));
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedProduct(null);
  }, []);

  const handleCapture = useCallback(async () => {
    if (!id || !arNavigatorRef.current) return;

    setCapturing(true);
    try {
      // Take AR screenshot
      const result = await arNavigatorRef.current.sceneNavigator.takeScreenshot(
        `ar_mockup_${Date.now()}`,
        false // saveToCameraRoll
      );

      if (!result.success || !result.url) {
        throw new Error("Screenshot failed");
      }

      // Read the screenshot file and upload to Firebase Storage
      const response = await fetch(
        Platform.OS === "ios" ? result.url : `file://${result.url}`
      );
      const blob = await response.blob();

      const storagePath = `gs_consultation_ar/${id}/ar_mockup_${Date.now()}.png`;
      const storageRef = ref(storage, storagePath);
      await uploadBytes(storageRef, blob);
      const downloadUrl = await getDownloadURL(storageRef);

      // Save to consultation document
      const consultRef = doc(db, COLLECTIONS.CONSULTATIONS, id);
      await updateDoc(consultRef, {
        arMockups: arrayUnion({
          imageUrl: downloadUrl,
          placedProducts: placedProducts.map((p) => ({
            productId: p.product.id,
            name: p.product.name,
            surface: p.product.surface,
            position: p.position,
          })),
          capturedAt: new Date().toISOString(),
        }),
        updatedAt: serverTimestamp(),
      });

      Alert.alert(
        "Mockup Saved",
        `AR mockup with ${placedProducts.length} product${placedProducts.length !== 1 ? "s" : ""} saved to this consultation.`,
        [
          { text: "Place More", style: "cancel" },
          {
            text: "View Mockups",
            onPress: () => router.replace(`/(admin)/consultations/${id}/mockups` as any),
          },
        ]
      );
    } catch (err: any) {
      console.error("AR capture failed:", err);
      Alert.alert("Capture Failed", err.message || "Could not save the AR mockup.");
    } finally {
      setCapturing(false);
    }
  }, [id, placedProducts, router]);

  // Web fallback — AR only works on native
  if (Platform.OS === "web") {
    return (
      <View style={styles.webFallback}>
        <Ionicons name="cube-outline" size={64} color="#555" />
        <Text style={styles.webFallbackTitle}>AR Not Available</Text>
        <Text style={styles.webFallbackText}>
          AR product placement requires the mobile app on a physical device with
          a camera. Open this consultation on your iPhone or iPad.
        </Text>
        <TouchableOpacity
          style={styles.webBackBtn}
          onPress={() => router.back()}
        >
          <Text style={styles.webBackBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* AR Scene */}
      <ViroARSceneNavigator
        ref={arNavigatorRef}
        initialScene={{
          scene: () => (
            <ARProductScene
              selectedProduct={selectedProduct}
              placedProducts={placedProducts}
              onProductPlaced={handleProductPlaced}
              onClearSelection={handleClearSelection}
            />
          ),
        }}
        style={styles.arScene}
      />

      {/* Top bar — back button + hint */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={styles.topHint}>
          <Text style={styles.topHintText}>
            {selectedProduct
              ? `Tap a ${selectedProduct.surface} to place`
              : placedProducts.length === 0
              ? "Select a product below"
              : `${placedProducts.length} placed`}
          </Text>
        </View>
      </View>

      {/* Product picker overlay */}
      <ARProductPicker
        selectedProduct={selectedProduct}
        placedProducts={placedProducts}
        onSelectProduct={setSelectedProduct}
        onRemoveProduct={handleRemoveProduct}
        onCapture={handleCapture}
        onClose={() => router.back()}
        capturing={capturing}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  arScene: {
    flex: 1,
  },
  // Top bar
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingTop: 56,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  topHint: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  topHintText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#fff",
    textAlign: "center",
  },
  // Web fallback
  webFallback: {
    flex: 1,
    backgroundColor: "#0a0f1a",
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 12,
  },
  webFallbackTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#eee",
  },
  webFallbackText: {
    fontSize: 14,
    color: "#888",
    textAlign: "center",
    lineHeight: 20,
    maxWidth: 300,
  },
  webBackBtn: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#333",
  },
  webBackBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#888",
  },
});
