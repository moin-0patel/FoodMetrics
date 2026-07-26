import { create } from "zustand";
import { persist } from "zustand/middleware";
import { brandAccentHex, cachedBrands } from "@/lib/data/brandCache";
import type { BrandSelection } from "./BrandFilter";

// Shared brand selection. Drives the app-wide accent theme (CSS color variables)
// AND the soft page tint, so every section matches the active brand — like the
// dashboard. Persisted so the chosen brand theme sticks across reloads.
interface BrandState {
  brand: BrandSelection;
  setBrand: (brand: BrandSelection) => void;
}

export const useDashboardBrand = create<BrandState>()(
  persist(
    (set) => ({
      brand: "all",
      setBrand: (brand) => set({ brand }),
    }),
    { name: "rcms.brand" },
  ),
);

// "all" (no brand filter) is the only selection with a hand-tuned CSS theme
// (index.css). Every real brand is themed from its own stored accent colour.
const CLASS_BRANDS = new Set(["all"]);

/** Convert a #hex colour to the "H S% L%" triple the CSS custom properties expect. */
function hexToHsl(hex: string | null): string | null {
  if (!hex) return null;
  let h = hex.trim().replace(/^#/, "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (h.length !== 6 || /[^0-9a-fA-F]/.test(h)) return null;
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let hue = 0;
  if (d !== 0) {
    if (max === r) hue = ((g - b) / d) % 6;
    else if (max === g) hue = (b - r) / d + 2;
    else hue = (r - g) / d + 4;
    hue = hue * 60;
    if (hue < 0) hue += 360;
  }
  return `${Math.round(hue)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

/**
 * Apply the brand accent theme app-wide. "all" uses the neutral `brand-all` class
 * (see index.css). A brand sets the accent CSS vars directly from its stored
 * accent colour on that neutral base.
 */
export function applyBrand(brand: BrandSelection) {
  const el = document.documentElement;
  el.classList.remove("brand-all");
  for (const v of ["--primary", "--accent", "--ring"]) el.style.removeProperty(v);
  if (CLASS_BRANDS.has(brand)) {
    el.classList.add(`brand-${brand}`);
    return;
  }
  el.classList.add("brand-all"); // neutral base for an unknown/new brand
  const hsl = hexToHsl(brandAccentHex(brand));
  if (hsl) {
    el.style.setProperty("--primary", hsl);
    el.style.setProperty("--accent", hsl);
    el.style.setProperty("--ring", hsl);
  }
}

/** Soft brand-tinted page background (light mode). A brand uses a soft tint of
 *  its own accent (via the --primary var applyBrand set). */
export function brandBgClass(brand: BrandSelection): string {
  if (brand === "all") return "bg-[#eff6ff]"; // neutral app blue
  return "bg-primary/5"; // soft tint of the brand's accent
}

/** Brand accent text colour (logos, headings, links). A brand follows its accent
 *  via the --primary var (set by applyBrand). */
export function brandAccentText(brand: BrandSelection): string {
  if (brand === "all") return "text-[#1b35a8]"; // neutral app blue
  return "text-primary";
}

/** Wordmark for the active brand selection (header chip + watermark). */
export function brandWordmark(brand: BrandSelection): string {
  if (brand === "all") return "ALL BRANDS";
  const name = cachedBrands().find((b) => b.id === brand)?.name;
  return (name ?? brand).toUpperCase();
}
