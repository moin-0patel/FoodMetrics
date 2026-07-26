import { CheckCircle2, AlertCircle, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

// Dark status strip at the foot of the dashboard. Both readings are real:
// margin health is the share of priced dishes at or under target, and the
// verification state counts dishes that can't be costed yet.

export function StatusBar({
  marginHealth,
  missingData,
  pricedCount,
}: {
  /** Share of priced dishes at/under target, or null when nothing is priced. */
  marginHealth: number | null;
  /** Dishes with no cost or no selling price. */
  missingData: number;
  pricedCount: number;
}) {
  const healthLabel =
    marginHealth == null
      ? "NO PRICED DISHES"
      : `MARGIN HEALTH: ${marginHealth.toFixed(0)}% (${
          marginHealth >= 75 ? "STABLE" : marginHealth >= 50 ? "WATCH" : "AT RISK"
        })`;

  const verified = missingData === 0 && pricedCount > 0;

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 rounded-xl bg-slate-900 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-300 dark:bg-slate-950">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="inline-flex items-center gap-1.5">
          <Activity className="h-3 w-3 text-emerald-400" />
          Costing engine: live
        </span>
        <span className="text-slate-600" aria-hidden="true">
          |
        </span>
        <span
          className={cn(
            marginHealth == null
              ? "text-slate-400"
              : marginHealth >= 75
                ? "text-emerald-400"
                : marginHealth >= 50
                  ? "text-amber-400"
                  : "text-red-400",
          )}
        >
          {healthLabel}
        </span>
      </div>

      <span className="inline-flex items-center gap-1.5">
        {verified ? (
          <>
            <CheckCircle2 className="h-3 w-3 text-emerald-400" />
            All costs verified
          </>
        ) : (
          <>
            <AlertCircle className="h-3 w-3 text-amber-400" />
            {missingData > 0
              ? `${missingData} dish${missingData === 1 ? "" : "es"} missing cost or price`
              : "Awaiting first costed dish"}
          </>
        )}
      </span>
    </div>
  );
}
