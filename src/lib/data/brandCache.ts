// A tiny module-level cache of the loaded brands, primed once at AppLayout from
// the brands repo. It lets non-React code (PDF export) and one-off label lookups
// resolve a brand id → display label / accent without threading the list through.
// Reactive lists (dropdowns, filters) use the useBrands() query directly instead.

import { type BrandRecord } from "./types";

let cache: BrandRecord[] = [];

export function primeBrandCache(brands: BrandRecord[]): void {
  cache = brands;
}

/** All brand records currently loaded (empty until the app primes the cache). */
export function cachedBrands(): BrandRecord[] {
  return cache;
}

/** All loaded brand ids (used as the "all brands" fallback for non-React lookups). */
export function allBrandIds(): string[] {
  return cache.map((b) => b.id);
}

/** Display label for a brand id — the loaded brand record, else the raw id. */
export function brandLabel(id: string | null | undefined): string {
  if (!id) return "—";
  const hit = cache.find((b) => b.id === id);
  if (hit) return hit.display_name || hit.name;
  return id;
}

/** A stable, distinct accent colour derived from a brand id — the fallback so a
 *  brand created without a chosen colour still themes distinctly (not the neutral
 *  blue). Deterministic: the same brand always maps to the same hue. */
export function deriveBrandAccent(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360;
  return hslToHex(h, 62, 45); // vivid but readable as a chip background with white text
}

function hslToHex(h: number, s: number, l: number): string {
  const sN = s / 100;
  const lN = l / 100;
  const a = sN * Math.min(lN, 1 - lN);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = lN - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
    return Math.round(255 * c).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/** Accent colour (hex) for a brand id: its chosen colour, else a stable derived
 *  one so every brand is themed distinctly. Null only for a missing id. */
export function brandAccentHex(id: string | null | undefined): string | null {
  if (!id) return null;
  const stored = cache.find((b) => b.id === id)?.accent_color;
  return stored || deriveBrandAccent(id);
}
