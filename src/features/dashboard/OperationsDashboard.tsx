import { useMemo } from "react";
import { RefreshCw } from "lucide-react";
import { formatINR } from "@/lib/utils";
import { useRecipes } from "@/features/recipes/hooks";
import { useMaterials } from "@/features/raw-materials/hooks";
import { useAllCostHistory, useAllPriceHistory } from "@/features/reports/hooks";
import { useFoodCostPct } from "@/features/settings/hooks";
import { StatTile } from "@/components/StatTile";
import { deltaTone } from "@/components/statTileTone";
import { FoodCostBySection } from "./panels/FoodCostBySection";
import { RecipesNeedingAttention } from "./panels/RecipesNeedingAttention";
import { RecentPriceChanges } from "./panels/RecentPriceChanges";
import { StatusBar } from "./panels/StatusBar";
import {
  computeKpis,
  costTrend,
  foodCostBySection,
  marginHealthPct,
  menuDishes,
  recipeCountTrend,
  recentPriceChanges,
  recipesNeedingAttention,
  relativeTime,
} from "./metrics";
import type { BrandSelection } from "./BrandFilter";

/**
 * Operations dashboard — food-cost control at a glance. Every figure is derived
 * from real recipe / material / history records (see metrics.ts); there is no
 * seeded or placeholder data, so a fresh install shows explicit empty states
 * rather than invented numbers. Re-scopes on the header brand toggle.
 */
export function OperationsDashboard({ brand }: { brand: BrandSelection }) {
  const { data: recipes = [], isLoading: recipesLoading } = useRecipes();
  const { data: materials = [] } = useMaterials();
  const { data: costHistory = [] } = useAllCostHistory();
  const { data: priceHistory = [] } = useAllPriceHistory();
  const { data: targetPct = 30 } = useFoodCostPct();

  const m = useMemo(() => {
    const dishes = menuDishes(recipes, brand);
    const dishIds = new Set(dishes.map((d) => d.id));
    // Scope history to the dishes in view so the brand toggle actually filters.
    const scopedCost = costHistory.filter((h) => dishIds.has(h.recipe_id));

    const kpis = computeKpis(dishes, targetPct, scopedCost, priceHistory);
    const attention = recipesNeedingAttention(dishes, targetPct);
    return {
      kpis,
      sections: foodCostBySection(dishes, targetPct),
      attention,
      priceRows: recentPriceChanges(priceHistory, materials),
      costSpark: costTrend(scopedCost),
      countSpark: recipeCountTrend(dishes),
      marginHealth: marginHealthPct(dishes, targetPct),
      newThisMonth: dishes.filter(
        (d) => d.created_at && Date.now() - new Date(d.created_at).getTime() < 30 * 864e5,
      ).length,
    };
  }, [recipes, materials, costHistory, priceHistory, targetPct, brand]);

  const { kpis } = m;

  return (
    <div className="space-y-4">
      {/* ── KPI row ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatTile
          label="Avg Food Cost %"
          value={
            recipesLoading
              ? "—"
              : kpis.avgFoodCostPct == null
                ? "—"
                : `${kpis.avgFoodCostPct.toFixed(1)}%`
          }
          tone={
            kpis.avgFoodCostPct == null
              ? "neutral"
              : kpis.avgFoodCostPct <= targetPct
                ? "good"
                : "bad"
          }
          trend={m.costSpark}
          emptyHint={
            kpis.avgFoodCostPct == null
              ? "Needs dishes with a cost and a selling price"
              : `Across ${kpis.pricedCount} priced dish${kpis.pricedCount === 1 ? "" : "es"} · target ${targetPct}%`
          }
        />

        <StatTile
          label="Active Recipes"
          value={recipesLoading ? "—" : String(kpis.activeRecipes)}
          delta={m.newThisMonth || undefined}
          deltaLabel={m.newThisMonth ? String(m.newThisMonth) : undefined}
          tone={deltaTone(m.newThisMonth, false)}
          trend={m.countSpark}
          emptyHint={kpis.activeRecipes === 0 ? "No menu dishes yet" : "New in the last 30 days"}
        />

        <StatTile
          label="Highest-Cost Item"
          value={kpis.highestCost ? kpis.highestCost.name : "—"}
          subValue={
            kpis.highestCost ? `${formatINR(kpis.highestCost.costPerPortion)} / portion` : undefined
          }
          emptyHint={kpis.highestCost ? undefined : "No costed dishes yet"}
        />

        <StatTile
          label="Dishes Over Target"
          value={recipesLoading ? "—" : String(kpis.overTarget)}
          tone={kpis.overTarget > 0 ? "bad" : "good"}
          emptyHint={
            kpis.pricedCount === 0
              ? "Needs priced dishes to compare"
              : `Above the ${targetPct}% target`
          }
        />

        <StatTile
          label="Last Costing Update"
          value={relativeTime(kpis.lastUpdate)}
          footNote={
            <>
              <RefreshCw className="h-2.5 w-2.5" /> Auto-recosted on price change
            </>
          }
          emptyHint={kpis.lastUpdate ? undefined : "No cost or price changes recorded yet"}
        />
      </div>

      {/* ── Food cost by section + attention list ── */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <FoodCostBySection sections={m.sections} />
        </div>
        <RecipesNeedingAttention items={m.attention} totalOverTarget={kpis.overTarget} />
      </div>

      {/* ── Recent price movements ── */}
      <RecentPriceChanges rows={m.priceRows} />

      <StatusBar
        marginHealth={m.marginHealth}
        missingData={kpis.missingData}
        pricedCount={kpis.pricedCount}
      />
    </div>
  );
}
