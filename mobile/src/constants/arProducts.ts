/**
 * AR Product Catalog — 3D models, real-world dimensions, surface types
 *
 * Each product has a GLB box proxy model at real-world scale (meters).
 * Surface type determines which AR plane alignment to snap to.
 */

export type ARSurface = "floor" | "wall" | "ceiling";

export type ARProduct = {
  id: string;
  name: string;
  surface: ARSurface;
  /** Real-world dimensions in meters */
  dims: { w: number; h: number; d: number };
  /** Display color for UI swatches */
  color: string;
  /** Short description for the scholar */
  description: string;
};

// All dimensions converted from feet/inches to meters
export const AR_PRODUCTS: ARProduct[] = [
  {
    id: "overhead_rack_4x4",
    name: 'Overhead Rack 4\u00d74',
    surface: "ceiling",
    dims: { w: 1.22, h: 0.10, d: 1.22 },
    color: "#1a1a1a",
    description: "Husky 4\u00d74 ceiling-mounted storage rack",
  },
  {
    id: "overhead_rack_4x8",
    name: 'Overhead Rack 4\u00d78',
    surface: "ceiling",
    dims: { w: 2.44, h: 0.10, d: 1.22 },
    color: "#1a1a1a",
    description: "Husky 4\u00d78 ceiling-mounted storage rack",
  },
  {
    id: "bike_hook_rail",
    name: "6-Bike Hook Rail",
    surface: "wall",
    dims: { w: 1.68, h: 0.15, d: 0.15 },
    color: "#444444",
    description: "Monkey Bars 6-bike wall-mounted hook rail",
  },
  {
    id: "cabinet_2dr",
    name: "Bold Cabinet 2-Door",
    surface: "floor",
    dims: { w: 0.76, h: 1.83, d: 0.46 },
    color: "#111111",
    description: "Bold Series 30\u2033 tall steel cabinet",
  },
  {
    id: "cabinet_4dr",
    name: "Bold Cabinet 4-Door",
    surface: "floor",
    dims: { w: 1.52, h: 1.83, d: 0.46 },
    color: "#111111",
    description: "Bold Series 60\u2033 wide steel cabinet",
  },
  {
    id: "shelf_48",
    name: 'Gladiator Shelf 48"',
    surface: "floor",
    dims: { w: 1.22, h: 1.83, d: 0.46 },
    color: "#333333",
    description: "4-tier welded steel shelving unit",
  },
  {
    id: "wall_hook_rail",
    name: "Wall Hook Rail",
    surface: "wall",
    dims: { w: 1.22, h: 0.10, d: 0.08 },
    color: "#999999",
    description: "4ft horizontal tool hook rail",
  },
  {
    id: "floor_tiles",
    name: "Gym Floor Tiles",
    surface: "floor",
    dims: { w: 1.83, h: 0.02, d: 1.83 },
    color: "#222222",
    description: "6\u00d76 ft interlocking rubber floor tiles",
  },
];

/** Get the GLB model source for a product */
export function getModelSource(productId: string) {
  const models: Record<string, any> = {
    overhead_rack_4x4: require("../../assets/models/overhead_rack_4x4.glb"),
    overhead_rack_4x8: require("../../assets/models/overhead_rack_4x8.glb"),
    bike_hook_rail: require("../../assets/models/bike_hook_rail.glb"),
    cabinet_2dr: require("../../assets/models/cabinet_2dr.glb"),
    cabinet_4dr: require("../../assets/models/cabinet_4dr.glb"),
    shelf_48: require("../../assets/models/shelf_48.glb"),
    wall_hook_rail: require("../../assets/models/wall_hook_rail.glb"),
    floor_tiles: require("../../assets/models/floor_tiles.glb"),
  };
  return models[productId];
}
