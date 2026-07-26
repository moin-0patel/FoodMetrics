import { TrendingDown, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Tone } from "./statTileTone";

/**
 * Shared KPI tile for the operational pages: uppercase label, large value, an
 * optional delta chip, and optionally either a sparkline or a progress bar.
 *
 * The sparkline is an inline SVG polyline rather than a chart library — it has no
 * axes or interaction, so recharts would cost far more than it's worth. It draws
 * nothing unless there are at least two real points, and the whole component
 * expects "—" for an unknown value: it never substitutes a zero.
 */

const TONE_TEXT: Record<Tone, string> = {
  neutral: "text-muted-foreground",
  good: "text-emerald-600 dark:text-emerald-400",
  warning: "text-amber-600 dark:text-amber-400",
  bad: "text-red-600 dark:text-red-400",
  accent: "text-primary",
};

const TONE_VALUE: Record<Tone, string> = {
  neutral: "text-foreground",
  good: "text-emerald-600 dark:text-emerald-400",
  warning: "text-amber-600 dark:text-amber-400",
  bad: "text-red-600 dark:text-red-400",
  accent: "text-primary",
};

const TONE_STROKE: Record<Tone, string> = {
  neutral: "stroke-slate-400",
  good: "stroke-emerald-500",
  warning: "stroke-amber-500",
  bad: "stroke-red-500",
  accent: "stroke-primary",
};

const TONE_BAR: Record<Tone, string> = {
  neutral: "bg-slate-400",
  good: "bg-emerald-500",
  warning: "bg-amber-500",
  bad: "bg-red-500",
  accent: "bg-primary",
};

function Sparkline({ points, tone }: { points: number[]; tone: Tone }) {
  if (points.length < 2) return null;
  const w = 120;
  const h = 34;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1; // flat series → straight line through the middle
  const d = points
    .map((v, i) => {
      const x = (i / (points.length - 1)) * w;
      const y = h - ((v - min) / span) * (h - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="mt-3 h-8 w-full"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <polyline
        points={d}
        fill="none"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={TONE_STROKE[tone]}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export function StatTile({
  label,
  value,
  subValue,
  delta,
  deltaLabel,
  tone = "neutral",
  valueTone,
  trend,
  /** 0–100. Renders a progress bar in place of the sparkline. */
  progress,
  footNote,
  emptyHint,
  className,
}: {
  label: string;
  /** Already formatted. Pass "—" when there is nothing to show. */
  value: string;
  subValue?: string;
  delta?: number;
  deltaLabel?: string;
  tone?: Tone;
  /** Tone for the big value itself; defaults to plain foreground. */
  valueTone?: Tone;
  trend?: number[];
  progress?: number | null;
  footNote?: React.ReactNode;
  /** Shown in place of the chart when there's no data yet. */
  emptyHint?: string;
  className?: string;
}) {
  const showDelta = delta != null && deltaLabel != null && delta !== 0;
  const hasTrend = (trend?.length ?? 0) >= 2;
  const hasBar = progress != null;
  return (
    <Card className={cn("flex flex-col justify-between p-4", className)}>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <p
            className={cn(
              "text-2xl font-semibold leading-none tracking-tight",
              TONE_VALUE[valueTone ?? "neutral"],
            )}
          >
            {value}
          </p>
          {showDelta && (
            <span className={cn("inline-flex items-center gap-0.5 text-xs font-medium", TONE_TEXT[tone])}>
              {delta > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {deltaLabel}
            </span>
          )}
        </div>
        {subValue && <p className="mt-1 text-sm font-semibold text-foreground">{subValue}</p>}
      </div>

      {hasBar ? (
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn("h-full rounded-full transition-all", TONE_BAR[tone])}
            style={{ width: `${Math.max(0, Math.min(100, progress!))}%` }}
          />
        </div>
      ) : hasTrend ? (
        <Sparkline points={trend!} tone={tone} />
      ) : emptyHint ? (
        <p className="mt-3 text-[11px] leading-tight text-muted-foreground">{emptyHint}</p>
      ) : null}

      {footNote && (
        <p className="mt-2 flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {footNote}
        </p>
      )}
    </Card>
  );
}
