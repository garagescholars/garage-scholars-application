/**
 * ARProductScene — ViroReact AR scene for placing products in a garage.
 *
 * Detects horizontal (floor/ceiling) and vertical (wall) planes.
 * Scholar taps a surface → selected product snaps to that plane.
 * Products are draggable after placement.
 */

import React, { useRef, useState, useCallback } from "react";
import {
  ViroARScene,
  ViroAmbientLight,
  ViroDirectionalLight,
  ViroNode,
  Viro3DObject,
  ViroARPlaneSelector,
} from "@reactvision/react-viro";
import { getModelSource, type ARProduct } from "../../constants/arProducts";

export type PlacedProduct = {
  id: string;
  product: ARProduct;
  position: [number, number, number];
  rotation: [number, number, number];
};

type Props = {
  selectedProduct: ARProduct | null;
  placedProducts: PlacedProduct[];
  onProductPlaced: (placed: PlacedProduct) => void;
  onClearSelection: () => void;
};

let placementCounter = 0;

export default function ARProductScene({
  selectedProduct,
  placedProducts,
  onProductPlaced,
  onClearSelection,
}: Props) {
  const selectorRef = useRef<any>(null);

  const handlePlaneSelected = useCallback(
    (anchor: any) => {
      if (!selectedProduct) return;

      const pos = anchor.position || [0, 0, -1];

      // Adjust Y position based on surface type
      let finalPos: [number, number, number] = [pos[0], pos[1], pos[2]];
      if (selectedProduct.surface === "ceiling") {
        // Hang below the ceiling plane
        finalPos[1] = pos[1] - selectedProduct.dims.h;
      } else if (selectedProduct.surface === "wall") {
        // Center on wall at reasonable height (~1.5m up from detected plane)
        finalPos[1] = pos[1] + 1.5;
      }

      const placed: PlacedProduct = {
        id: `placed_${++placementCounter}`,
        product: selectedProduct,
        position: finalPos,
        rotation: [0, 0, 0],
      };

      onProductPlaced(placed);
      onClearSelection();
    },
    [selectedProduct, onProductPlaced, onClearSelection]
  );

  return (
    <ViroARScene
      anchorDetectionTypes={["PlanesHorizontal", "PlanesVertical"]}
      onAnchorFound={(anchor: any) =>
        selectorRef.current?.handleAnchorFound?.(anchor)
      }
      onAnchorUpdated={(anchor: any) =>
        selectorRef.current?.handleAnchorUpdated?.(anchor)
      }
      onAnchorRemoved={(anchor: any) =>
        anchor && selectorRef.current?.handleAnchorRemoved?.(anchor)
      }
    >
      {/* Lighting */}
      <ViroAmbientLight color="#ffffff" intensity={300} />
      <ViroDirectionalLight
        color="#ffffff"
        direction={[0, -1, -0.5]}
        intensity={800}
        castsShadow={true}
        shadowOpacity={0.4}
        shadowMapSize={2048}
        shadowNearZ={0.1}
        shadowFarZ={6}
      />

      {/* Plane selector — active when a product is selected */}
      {selectedProduct && (
        <ViroARPlaneSelector
          ref={selectorRef}
          alignment={
            selectedProduct.surface === "wall" ? "Vertical" : "Horizontal"
          }
          onPlaneSelected={handlePlaneSelected}
        />
      )}

      {/* Already-placed products */}
      {placedProducts.map((p) => {
        const modelSource = getModelSource(p.product.id);
        if (!modelSource) return null;

        return (
          <ViroNode key={p.id} position={p.position} rotation={p.rotation}>
            <Viro3DObject
              source={modelSource}
              type="GLB"
              position={[0, 0, 0]}
              scale={[1, 1, 1]}
              onDrag={() => {}}
            />
          </ViroNode>
        );
      })}
    </ViroARScene>
  );
}
