import { cn } from "@/lib/utils";

// The thin telemetry strip at the foot of the operational pages. Deliberately
// generic: callers pass real readings as items. Nothing here fabricates a value —
// if a caller has nothing to report it simply passes fewer items.

export interface TelemetryItem {
  label: string;
  value: string;
  tone?: "good" | "warning" | "critical" | "neutral";
  /** Show a leading status dot (used for "live"-style readings). */
  dot?: boolean;
}

const TONE: Record<NonNullable<TelemetryItem["tone"]>, string> = {
  good: "text-emerald-400",
  warning: "text-amber-400",
  critical: "text-red-400",
  neutral: "text-slate-300",
};

export function TelemetryBar({
  items,
  right,
  className,
}: {
  items: TelemetryItem[];
  /** Optional right-aligned reading (e.g. "Last updated · 14:22"). */
  right?: React.ReactNode;
  className?: string;
}) {
  if (items.length === 0 && !right) return null;
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-x-6 gap-y-2 rounded-xl bg-slate-900 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:bg-slate-950",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {items.map((it, i) => (
          <span key={it.label} className="inline-flex items-center gap-1.5">
            {i > 0 && (
              <span className="mr-2 text-slate-700" aria-hidden="true">
                |
              </span>
            )}
            {it.dot && (
              <span
                className={cn("h-1.5 w-1.5 rounded-full bg-current", TONE[it.tone ?? "good"])}
                aria-hidden="true"
              />
            )}
            <span>{it.label}:</span>
            <span className={TONE[it.tone ?? "neutral"]}>{it.value}</span>
          </span>
        ))}
      </div>
      {right && <span className="text-slate-500">{right}</span>}
    </div>
  );
}
