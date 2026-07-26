// Vegetable cut / prep variants and their yields, from the master Yield sheet
// (assets/Costing Master sheet - Yield.pdf). A vegetable used several ways
// (sliced, chopped, diced, rings…) has one entry per cut; each cut's yield %
// drives the yield-adjusted cost (full purchase cost ÷ usable portion). Keyed by
// the normalised parent-vegetable name.

export interface IngredientCut {
  /** Display label for the cut/prep — "Sliced", "Chopped", "Diced", … */
  cut: string;
  /** Usable portion as a % of the unprocessed weight (may exceed 100 for boiled). */
  yieldPct: number;
}

export const INGREDIENT_CUTS: Record<string, IngredientCut[]> = {
  onion: [
    { cut: "Sliced", yieldPct: 66.67 },
    { cut: "Diced", yieldPct: 40 },
    { cut: "Rings", yieldPct: 50 },
    { cut: "Slit", yieldPct: 42.86 },
  ],
  "spring onion": [
    { cut: "Chopped", yieldPct: 83.33 },
    { cut: "Whole", yieldPct: 50 },
    { cut: "Halved", yieldPct: 42.5 },
    { cut: "Thin Sliced", yieldPct: 40 },
  ],
  carrot: [
    { cut: "Chopped", yieldPct: 80 },
    { cut: "Sliced", yieldPct: 68.75 },
    { cut: "Cut", yieldPct: 50 },
  ],
  cucumber: [
    { cut: "Rings", yieldPct: 94.91 },
    { cut: "Sliced", yieldPct: 62.5 },
    { cut: "Chopped", yieldPct: 52.5 },
  ],
  zucchini: [
    { cut: "Sliced", yieldPct: 88.89 },
    { cut: "Cut", yieldPct: 33.33 },
  ],
  broccoli: [
    { cut: "Cut", yieldPct: 80 },
    { cut: "Processed", yieldPct: 58.82 },
  ],
  "bell pepper": [
    { cut: "Chopped", yieldPct: 65 },
    { cut: "Roasted", yieldPct: 60 },
    { cut: "Rings", yieldPct: 48.48 },
  ],
  mushroom: [
    { cut: "Whole", yieldPct: 78.95 },
    { cut: "Sliced", yieldPct: 62.5 },
  ],
  "chinese cabbage": [
    { cut: "Chopped", yieldPct: 80 },
    { cut: "Julienne", yieldPct: 80 },
  ],
  "indian cabbage": [
    { cut: "Chopped", yieldPct: 78 },
    { cut: "Julienne", yieldPct: 78 },
  ],
  "purple cabbage": [{ cut: "Sliced", yieldPct: 86.86 }],
  leeks: [
    { cut: "Processed", yieldPct: 51.31 },
    { cut: "Julienne", yieldPct: 24.34 },
  ],
  "green garlic": [
    { cut: "Chopped", yieldPct: 74.07 },
    { cut: "Processed", yieldPct: 46.15 },
  ],
  tomato: [
    { cut: "Chopped", yieldPct: 90 },
    { cut: "Canned (drained)", yieldPct: 93.33 },
  ],
  jalapeno: [
    { cut: "Sliced", yieldPct: 90.91 },
    { cut: "Canned (drained)", yieldPct: 55 },
  ],
  "lotus root": [{ cut: "Sliced", yieldPct: 78 }],
  "red paprika": [
    { cut: "Sliced", yieldPct: 50 },
    { cut: "Canned (drained)", yieldPct: 50 },
  ],
  parsley: [
    { cut: "Chopped", yieldPct: 75 },
    { cut: "Whole", yieldPct: 50 },
    { cut: "Processed", yieldPct: 50 },
  ],
  ginger: [{ cut: "Chopped", yieldPct: 80 }],
  "green chilli": [{ cut: "Chopped", yieldPct: 73.53 }],
  lemon: [
    { cut: "Juiced", yieldPct: 35.71 },
    { cut: "Dehydrated", yieldPct: 12 },
    { cut: "Zest", yieldPct: 5 },
  ],
  orange: [{ cut: "Zest", yieldPct: 6 }],
  watermelon: [{ cut: "Juiced", yieldPct: 46.67 }],
  grapefruit: [{ cut: "Diced", yieldPct: 48 }],
  "french beans": [{ cut: "Cut", yieldPct: 90.59 }],
  beetroot: [{ cut: "Paste", yieldPct: 72 }],
  basil: [{ cut: "Processed", yieldPct: 58.33 }],
  coriander: [{ cut: "Processed", yieldPct: 58.82 }],
  "dill leaves": [{ cut: "Processed", yieldPct: 83.33 }],
  iceberg: [{ cut: "Processed", yieldPct: 60.61 }],
  mint: [{ cut: "Processed", yieldPct: 47.62 }],
  mango: [{ cut: "Processed", yieldPct: 70.37 }],
  arugula: [{ cut: "Processed", yieldPct: 64.44 }],
  "brussels sprouts": [{ cut: "Processed", yieldPct: 80 }],
  "lollo rosso": [{ cut: "Processed", yieldPct: 67 }],
  pineapple: [{ cut: "Processed", yieldPct: 50 }],
  "bok choy": [{ cut: "Processed", yieldPct: 67 }],
  lemongrass: [{ cut: "Processed", yieldPct: 80 }],
  spinach: [{ cut: "Processed", yieldPct: 78 }],
  "baby corn": [{ cut: "Processed", yieldPct: 15 }],
  jamun: [{ cut: "Processed", yieldPct: 60 }],
  "shimeji mushroom": [{ cut: "Processed", yieldPct: 90 }],
  "red chilli": [{ cut: "Processed", yieldPct: 90 }],
  "thai red chilli": [{ cut: "Processed", yieldPct: 85 }],
};

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

/** Known cut words, longest first so "Thin Sliced" wins over "Sliced". */
const CUT_WORDS = [
  "thin sliced", "finely chopped", "canned drained", "canned", "processed", "chopped",
  "sliced", "julienne", "diced", "rings", "ring", "roasted", "boiled", "dehydrated",
  "juiced", "juice", "zest", "paste", "whole", "slit", "cut",
].sort((a, b) => b.length - a.length);

/**
 * Resolve a raw-material name to its parent vegetable (a key in INGREDIENT_CUTS)
 * and, if the name encodes one, the cut. STRICT to avoid false positives: matches
 * only a plain vegetable ("Onion") or exactly "{cut} {parent}" / "{parent} {cut}"
 * where the cut is a real cut for that parent ("Sliced Onion", "Onion Rings",
 * "Chopped Spring Onion"). Prepared/qualified names ("Roasted bell pepper paste",
 * "Onion powder", "Fried onion") do NOT resolve — they aren't raw cut vegetables.
 */
export function resolveParentAndCut(name: string): { parent: string | null; cut: string | null } {
  const n = norm(name);
  if (INGREDIENT_CUTS[n]) return { parent: n, cut: null };

  for (const cw of CUT_WORDS) {
    let rest: string | null = null;
    if (n.startsWith(cw + " ")) rest = n.slice(cw.length + 1).trim();
    else if (n.endsWith(" " + cw)) rest = n.slice(0, -(cw.length + 1)).trim();
    // Remainder must be EXACTLY a parent, and the cut must be valid for that parent.
    if (rest && INGREDIENT_CUTS[rest]) {
      const match = INGREDIENT_CUTS[rest].find((c) => norm(c.cut).startsWith(cw) || cw.startsWith(norm(c.cut)));
      if (match) return { parent: rest, cut: match.cut };
    }
  }
  return { parent: null, cut: null };
}

/** Cuts available for a material name (empty if it isn't a cut-bearing vegetable). */
export function cutsForName(name: string): IngredientCut[] {
  const { parent } = resolveParentAndCut(name);
  return parent ? INGREDIENT_CUTS[parent] : [];
}

/** The yield % for a named cut of a parent vegetable, or null if unknown. */
export function cutYieldPct(parent: string, cut: string): number | null {
  const list = INGREDIENT_CUTS[norm(parent)];
  if (!list) return null;
  const found = list.find((c) => norm(c.cut) === norm(cut));
  return found ? found.yieldPct : null;
}
