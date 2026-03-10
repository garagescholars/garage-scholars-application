/**
 * Benjamin Moore Color Palette for Consultation Mockups
 *
 * Curated selection of popular BM colors organized by family.
 * Used in the configure screen for flooring color selection.
 * Only { code, name } is stored on Firestore docs.
 */

export type BMColor = {
  code: string;     // e.g. "HC-170"
  name: string;     // e.g. "Stonington Gray"
  fullName: string; // e.g. "Stonington Gray HC-170"
  hex: string;      // for UI swatch preview
  family: BMFamily;
};

export type BMFamily = "gray" | "blue" | "tan" | "white" | "charcoal";

export const BM_COLORS: BMColor[] = [
  // ── Grays ──
  { code: "HC-170", name: "Stonington Gray",  fullName: "Stonington Gray HC-170",  hex: "#9A9E9A", family: "gray" },
  { code: "HC-169", name: "Coventry Gray",    fullName: "Coventry Gray HC-169",    hex: "#A7A9A5", family: "gray" },
  { code: "HC-168", name: "Chelsea Gray",     fullName: "Chelsea Gray HC-168",     hex: "#8A8C8A", family: "gray" },
  { code: "HC-166", name: "Kendall Charcoal", fullName: "Kendall Charcoal HC-166", hex: "#5B5B58", family: "gray" },
  { code: "HC-172", name: "Revere Pewter",    fullName: "Revere Pewter HC-172",    hex: "#C2B9A7", family: "gray" },
  { code: "OC-52",  name: "Gray Owl",         fullName: "Gray Owl OC-52",          hex: "#C1C0B8", family: "gray" },
  { code: "OC-23",  name: "Classic Gray",     fullName: "Classic Gray OC-23",      hex: "#E3DFD5", family: "gray" },

  // ── Blues ──
  { code: "HC-154", name: "Hale Navy",        fullName: "Hale Navy HC-154",        hex: "#3C4A5E", family: "blue" },
  { code: "HC-155", name: "Newburyport Blue", fullName: "Newburyport Blue HC-155", hex: "#3E5068", family: "blue" },
  { code: "HC-156", name: "Van Deusen Blue",  fullName: "Van Deusen Blue HC-156",  hex: "#41607A", family: "blue" },
  { code: "HC-144", name: "Palladian Blue",   fullName: "Palladian Blue HC-144",   hex: "#B9CFC7", family: "blue" },

  // ── Tans / Beiges ──
  { code: "HC-81",  name: "Manchester Tan",   fullName: "Manchester Tan HC-81",    hex: "#C7B899", family: "tan" },
  { code: "HC-45",  name: "Shaker Beige",     fullName: "Shaker Beige HC-45",      hex: "#C8B99A", family: "tan" },
  { code: "HC-173", name: "Edgecomb Gray",    fullName: "Edgecomb Gray HC-173",    hex: "#C9BFA8", family: "tan" },

  // ── Whites ──
  { code: "OC-117", name: "Simply White",     fullName: "Simply White OC-117",     hex: "#F2EDE3", family: "white" },
  { code: "OC-65",  name: "Chantilly Lace",   fullName: "Chantilly Lace OC-65",    hex: "#F5F0E7", family: "white" },
  { code: "OC-17",  name: "White Dove",       fullName: "White Dove OC-17",        hex: "#EDE8DA", family: "white" },

  // ── Charcoals ──
  { code: "2124-10", name: "Wrought Iron",    fullName: "Wrought Iron 2124-10",    hex: "#3A3A38", family: "charcoal" },
  { code: "2128-10", name: "Black Beauty",    fullName: "Black Beauty 2128-10",    hex: "#2B2B2B", family: "charcoal" },
];

export const BM_FAMILIES: BMFamily[] = ["gray", "blue", "tan", "white", "charcoal"];

export const BM_FAMILY_LABELS: Record<BMFamily, string> = {
  gray: "Gray",
  blue: "Blue",
  tan: "Tan / Beige",
  white: "White",
  charcoal: "Charcoal",
};

export function getColorsByFamily(family: BMFamily): BMColor[] {
  return BM_COLORS.filter((c) => c.family === family);
}
