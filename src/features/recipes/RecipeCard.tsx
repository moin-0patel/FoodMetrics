import { ImageOff, Pencil } from "lucide-react";
import { cn, formatINR } from "@/lib/utils";
import { brandLabel } from "@/lib/data/brandCache";
import type { Recipe } from "@/lib/data/types";

/**
 * Recipe card for the gallery view: dish photo, a derived margin badge, the
 * category path, and current food cost against target.
 *
 * Every badge and colour comes from the recipe's own status and figures — nothing
 * is invented. A dish with no cost or no selling price reports "Calculation
 * pending" rather than being shown as 0%.
 */

type Verdict =
  | "high-profit"    // comfortably under target
  | "on-target"      // at or just under target
  | "at-risk"        // over target, within 3 points
  | "critical"       // more than 3 points over target
  | "in-development" // draft / not yet submitted
  | "pending";       // approved but not costable yet

interface Assessment {
  verdict: Verdict;
  /** Corner badge over the photo. Null when there's nothing meaningful to flag. */
  badge: string | null;
  /** Footer status line. */
  status: string;
  fcPct: number | null;
}

const STYLE: Record<Verdict, { badge: string; dot: string; text: string }> = {
  "high-profit": {
    badge: "bg-emerald-500 text-white",
    dot: "bg-emerald-500",
    text: "text-emerald-600 dark:text-emerald-400",
  },
  "on-target": {
    badge: "bg-emerald-500/90 text-white",
    dot: "bg-emerald-500",
    text: "text-emerald-600 dark:text-emerald-400",
  },
  "at-risk": {
    badge: "bg-amber-500 text-slate-950",
    dot: "bg-amber-500",
    text: "text-amber-600 dark:text-amber-400",
  },
  critical: {
    badge: "bg-red-500 text-white",
    dot: "bg-red-500",
    text: "text-red-600 dark:text-red-400",
  },
  "in-development": {
    badge: "bg-slate-700 text-white",
    dot: "bg-slate-400",
    text: "text-muted-foreground",
  },
  pending: {
    badge: "bg-slate-600 text-white",
    dot: "bg-slate-400",
    text: "text-muted-foreground",
  },
};

/** Classify a recipe against the food-cost target. Exported for tests. */
export function assessRecipe(r: Recipe, targetPct: number): Assessment {
  const cost = r.total_cost;
  const price = r.selling_price;
  const costable = cost != null && price != null && price > 0;
  const fcPct = costable ? (cost / price) * 100 : null;

  if (r.status === "draft") {
    return { verdict: "in-development", badge: "In development", status: "Draft — not submitted", fcPct };
  }
  if (fcPct == null) {
    return {
      verdict: "pending",
      badge: null,
      status: cost == null ? "Calculation pending — no cost yet" : "Calculation pending — no selling price",
      fcPct: null,
    };
  }
  if (fcPct > targetPct + 3) {
    return { verdict: "critical", badge: "At risk", status: "Critical variance", fcPct };
  }
  if (fcPct > targetPct) {
    return { verdict: "at-risk", badge: "Over target", status: "Watch margin", fcPct };
  }
  if (fcPct <= targetPct - 5) {
    return { verdict: "high-profit", badge: "High margin", status: "High profitability", fcPct };
  }
  return { verdict: "on-target", badge: null, status: "On target", fcPct };
}

export function RecipeCard({
  recipe,
  targetPct,
  onView,
  onEdit,
}: {
  recipe: Recipe;
  targetPct: number;
  onView: () => void;
  onEdit?: () => void;
}) {
  const a = assessRecipe(recipe, targetPct);
  const s = STYLE[a.verdict];
  const path = [brandLabel(recipe.brand), recipe.category, recipe.size_label]
    .filter(Boolean)
    .join("  /  ");

  return (
    <div className="group overflow-hidden rounded-xl border bg-card transition-all hover:-translate-y-0.5 hover:shadow-lg">
      {/* Photo. Recipes without an image get a neutral placeholder rather than a
          broken-image icon or a stock photo that isn't theirs. */}
      <button
        type="button"
        onClick={onView}
        className="relative block aspect-[16/10] w-full overflow-hidden bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`Open ${recipe.recipe_name}`}
      >
        {recipe.image_url ? (
          <img
            src={recipe.image_url}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <span className="flex h-full w-full flex-col items-center justify-center gap-1.5 text-muted-foreground">
            <ImageOff className="h-6 w-6" />
            <span className="text-[10px] font-medium uppercase tracking-wide">No image</span>
          </span>
        )}

        {a.badge && (
          <span
            className={cn(
              "absolute left-3 top-3 rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide shadow-sm",
              s.badge,
            )}
          >
            {a.badge}
          </span>
        )}

        {recipe.archived_at && (
          <span className="absolute right-3 top-3 rounded bg-slate-900/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
            Archived
          </span>
        )}
      </button>

      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <button
            type="button"
            onClick={onView}
            className="min-w-0 text-left focus-visible:outline-none focus-visible:underline"
          >
            <h3 className="truncate font-semibold text-foreground">{recipe.recipe_name}</h3>
          </button>
          {onEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={`Edit ${recipe.recipe_name}`}
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {path && (
          <p className="mt-0.5 truncate text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {path}
          </p>
        )}

        {/* Current vs target */}
        <div className="mt-3 flex items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Current cost
            </p>
            <p className={cn("text-xl font-semibold leading-none tabular-nums", s.text)}>
              {a.fcPct == null ? "—" : `${a.fcPct.toFixed(1)}%`}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Target
            </p>
            <p className="text-xl font-semibold leading-none tabular-nums text-muted-foreground">
              {targetPct.toFixed(1)}%
            </p>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-2 border-t pt-2.5">
          <span className={cn("inline-flex items-center gap-1.5 text-[11px] font-medium", s.text)}>
            <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} aria-hidden="true" />
            {a.status}
          </span>
          <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
            {recipe.cost_per_portion != null ? `${formatINR(recipe.cost_per_portion)}/portion` : "—"}
          </span>
        </div>
      </div>
    </div>
  );
}
