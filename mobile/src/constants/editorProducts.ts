/**
 * Product catalog for the static image editor.
 *
 * Each product has an icon representation, real-world dimensions,
 * and a surface type that hints where it belongs in the garage.
 * Products render as clean architectural overlays — not photorealistic fakes.
 */

import type { Ionicons } from "@expo/vector-icons";

export type EditorSurface = "ceiling" | "wall" | "floor";

export type EditorProduct = {
  id: string;
  name: string;
  shortName: string;
  surface: EditorSurface;
  /** Display dimensions string for the label */
  dimsLabel: string;
  /** Aspect ratio (width / height) for the overlay rectangle */
  aspect: number;
  /** Default overlay width as fraction of image width (0-1) */
  defaultWidthPct: number;
  /** Brand color for the overlay */
  color: string;
  /** Icon name from Ionicons */
  icon: keyof typeof Ionicons.glyphMap;
  /** Short description */
  description: string;
};

export const EDITOR_PRODUCTS: EditorProduct[] = [
  // ── Ceiling ──
  {
    id: "overhead_rack_4x4",
    name: "Overhead Rack 4×4",
    shortName: "4×4 Rack",
    surface: "ceiling",
    dimsLabel: "4' × 4'",
    aspect: 1.0,
    defaultWidthPct: 0.3,
    color: "#1a1a1a",
    icon: "grid-outline",
    description: "Husky ceiling-mounted storage",
  },
  {
    id: "overhead_rack_4x8",
    name: "Overhead Rack 4×8",
    shortName: "4×8 Rack",
    surface: "ceiling",
    dimsLabel: "4' × 8'",
    aspect: 2.0,
    defaultWidthPct: 0.5,
    color: "#1a1a1a",
    icon: "grid-outline",
    description: "Husky ceiling-mounted storage",
  },
  // ── Wall ──
  {
    id: "bike_hook_rail",
    name: "6-Bike Hook Rail",
    shortName: "Bike Hooks",
    surface: "wall",
    dimsLabel: "66\" × 6\"",
    aspect: 11.0,
    defaultWidthPct: 0.45,
    color: "#444444",
    icon: "bicycle-outline",
    description: "Monkey Bars wall-mounted",
  },
  {
    id: "wall_hook_rail",
    name: "Wall Hook Rail",
    shortName: "Hook Rail",
    surface: "wall",
    dimsLabel: "48\" × 4\"",
    aspect: 12.0,
    defaultWidthPct: 0.35,
    color: "#999999",
    icon: "construct-outline",
    description: "4ft horizontal tool hooks",
  },
  {
    id: "pegboard_4x4",
    name: "Pegboard Panel",
    shortName: "Pegboard",
    surface: "wall",
    dimsLabel: "4' × 4'",
    aspect: 1.0,
    defaultWidthPct: 0.3,
    color: "#666666",
    icon: "apps-outline",
    description: "Slatwall / pegboard panel",
  },
  // ── Floor ──
  {
    id: "cabinet_2dr",
    name: "Bold Cabinet 2-Door",
    shortName: "Cabinet 2D",
    surface: "floor",
    dimsLabel: "30\" × 77\"",
    aspect: 0.41,
    defaultWidthPct: 0.12,
    color: "#111111",
    icon: "file-tray-full-outline",
    description: "Bold Series steel cabinet",
  },
  {
    id: "cabinet_4dr",
    name: "Bold Cabinet 4-Door",
    shortName: "Cabinet 4D",
    surface: "floor",
    dimsLabel: "60\" × 77\"",
    aspect: 0.83,
    defaultWidthPct: 0.2,
    color: "#111111",
    icon: "file-tray-full-outline",
    description: "Bold Series wide cabinet",
  },
  {
    id: "shelf_48",
    name: "Metal Shelving 48\"",
    shortName: "Shelf 48\"",
    surface: "floor",
    dimsLabel: "48\" × 72\"",
    aspect: 0.67,
    defaultWidthPct: 0.18,
    color: "#333333",
    icon: "layers-outline",
    description: "4-tier welded steel shelving",
  },
  {
    id: "floor_tiles_6x6",
    name: "Gym Floor Tiles",
    shortName: "Floor Tiles",
    surface: "floor",
    dimsLabel: "6' × 6'",
    aspect: 1.0,
    defaultWidthPct: 0.4,
    color: "#222222",
    icon: "square-outline",
    description: "Interlocking rubber tiles",
  },
  {
    id: "workbench_6ft",
    name: "Workbench 6ft",
    shortName: "Workbench",
    surface: "floor",
    dimsLabel: "72\" × 36\"",
    aspect: 2.0,
    defaultWidthPct: 0.35,
    color: "#2a2a2a",
    icon: "hammer-outline",
    description: "Steel-top workbench",
  },
];

export const SURFACE_LABELS: Record<EditorSurface, string> = {
  ceiling: "Ceiling",
  wall: "Wall",
  floor: "Floor",
};

export const SURFACE_ORDER: EditorSurface[] = ["ceiling", "wall", "floor"];
