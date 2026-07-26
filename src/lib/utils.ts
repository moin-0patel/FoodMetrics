import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format a number as INR currency. */
export function formatINR(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `₹${value.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Finished dish weight in grams → a human label ("500 g" / "1.25 kg"). Values
 *  under 1 kg show grams; 1 kg and over switch to kilograms. Zero/nullish → "—". */
export function formatWeight(grams: number | null | undefined): string {
  if (grams === null || grams === undefined || Number.isNaN(grams) || grams <= 0) return "—";
  if (grams >= 1000) {
    const kg = Math.round((grams / 1000) * 100) / 100;
    return `${kg.toLocaleString("en-IN", { maximumFractionDigits: 2 })} kg`;
  }
  return `${Math.round(grams * 100) / 100} g`;
}

/** Short, human-friendly label for a unit code (e.g. "KG" → "kg"). */
const UNIT_LABELS: Record<string, string> = {
  KG: "kg",
  Gram: "g",
  Litre: "L",
  ML: "ml",
  Piece: "pcs",
  Dozen: "dozen",
  Packet: "pack",
  Bottle: "bottle",
  Can: "can",
};
export function formatUnit(unit: string): string {
  return UNIT_LABELS[unit] ?? unit.toLowerCase();
}

/** Trim trailing zeros and group thousands (e.g. 5000 → "5,000", 1.5 → "1.5"). */
function formatNumber(n: number): string {
  return n.toLocaleString("en-IN", { maximumFractionDigits: 3 });
}

/**
 * Human-readable quantity + unit. Auto-scales base units up when the amount is a
 * clean multiple (1000 g → "1 kg", 2000 ml → "2 L") so lists read naturally.
 * Set `humanize: false` to keep the raw unit.
 */
export function formatQuantityWithUnit(
  qty: number | null | undefined,
  unit: string,
  opts: { humanize?: boolean } = {},
): string {
  if (qty === null || qty === undefined || Number.isNaN(qty)) return "—";
  const humanize = opts.humanize ?? true;
  if (humanize && unit === "Gram" && qty >= 1000) {
    return `${formatNumber(qty / 1000)} kg`;
  }
  if (humanize && unit === "ML" && qty >= 1000) {
    return `${formatNumber(qty / 1000)} L`;
  }
  return `${formatNumber(qty)} ${formatUnit(unit)}`;
}

/** Format a date string/Date as e.g. "Jun 23, 2026". */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Signed percent label like "+15.5%" / "-3.1%". */
export function percentChangeLabel(pct: number): string {
  return `${pct >= 0 ? "+" : ""}${pct}%`;
}

/** Relative time like "2h ago", "Yesterday", "3d ago". */
export function timeAgo(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  const sec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day === 1) return "Yesterday";
  if (day < 30) return `${day}d ago`;
  return formatDate(d);
}

/** Format a date+time as e.g. "Jun 23, 10:45". */
export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
