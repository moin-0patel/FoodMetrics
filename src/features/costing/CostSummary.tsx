import { Package, Receipt, Tag, Percent, TrendingUp, Wallet, Scale } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn, formatINR, formatWeight } from "@/lib/utils";
import { round2 } from "@/lib/costing";
import { fcTone, type FcTone } from "@/features/recipes/recipeMetrics";

const TONE_TEXT: Record<FcTone, string> = {
  good: "text-emerald-600",
  warn: "text-amber-600",
  bad: "text-red-600",
};

interface CostSummaryProps {
  /** Ingredient cost incl. wastage (per portion / single-portion recipe). */
  recipeCost: number;
  packagingCost: number;
  /** The chef-set menu price. 0/undefined when none is saved — the app never
   *  suggests a price, so the price-dependent metrics show "–" until one is set. */
  sellingPrice: number;
  criticalPct?: number;
  /** Finished dish weight in grams (sum of ingredient quantities). */
  totalWeightGrams?: number;
  /** In-House Prep: show ONLY the calculated Total Cost — no packaging / selling
   *  price / food-cost / margin / profit. */
  prepOnly?: boolean;
}

/** A compact metric tile. */
function Stat({
  icon,
  label,
  value,
  hint,
  className,
  valueClass,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  className?: string;
  valueClass?: string;
}) {
  return (
    <Card className={cn("p-3", className)}>
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className={cn("mt-1 text-lg font-bold", valueClass)}>{value}</div>
      {hint && <div className="mt-0.5 text-[11px] text-muted-foreground">{hint}</div>}
    </Card>
  );
}

export function CostSummary({
  recipeCost,
  packagingCost,
  sellingPrice,
  criticalPct = 35,
  totalWeightGrams,
  prepOnly = false,
}: CostSummaryProps) {
  const weightStat =
    totalWeightGrams !== undefined ? (
      <Stat
        icon={<Scale className="h-3.5 w-3.5" />}
        label="Total Dish Weight"
        value={formatWeight(totalWeightGrams)}
        hint="Finished product weight"
        className="col-span-2"
      />
    ) : null;

  if (prepOnly) {
    return (
      <div className="space-y-3">
        <p className="text-sm font-semibold">Cost Summary</p>
        <Stat
          icon={<Receipt className="h-3.5 w-3.5" />}
          label="Total Cost"
          value={formatINR(recipeCost)}
          hint="Sum of all ingredient costs"
        />
        {weightStat}
      </div>
    );
  }

  // No menu price saved → the app never suggests one, so price-dependent metrics
  // stay blank ("–") until a chef sets the price.
  const priced = sellingPrice > 0;
  const fullCost = round2(recipeCost + packagingCost);
  const profit = round2(sellingPrice - fullCost);
  const fcPct = priced ? round2((fullCost / sellingPrice) * 100) : 0;
  const fcNoPkg = priced ? round2((recipeCost / sellingPrice) * 100) : 0;
  const marginPct = priced ? round2((profit / sellingPrice) * 100) : 0;
  const tone = fcTone(fcPct, criticalPct);

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold">Cost Summary</p>
      <div className="grid grid-cols-2 gap-3">
        <Stat icon={<Receipt className="h-3.5 w-3.5" />} label="Recipe Cost" value={formatINR(recipeCost)} />
        <Stat icon={<Package className="h-3.5 w-3.5" />} label="Packaging" value={formatINR(packagingCost)} />
        <Stat
          icon={<Tag className="h-3.5 w-3.5" />}
          label="Selling Price"
          value={priced ? formatINR(sellingPrice) : "—"}
          hint={priced ? "Your menu price" : "Set a menu price to see margins"}
          className="col-span-2"
        />
        <Stat
          icon={<Percent className="h-3.5 w-3.5" />}
          label="FC% (with pkg)"
          value={priced ? `${fcPct}%` : "—"}
          valueClass={priced ? TONE_TEXT[tone] : undefined}
        />
        <Stat
          icon={<Percent className="h-3.5 w-3.5" />}
          label="FC% (no pkg)"
          value={priced ? `${fcNoPkg}%` : "—"}
        />
        <Stat icon={<TrendingUp className="h-3.5 w-3.5" />} label="Gross Margin" value={priced ? `${marginPct}%` : "—"} className="col-span-2" />
        <Stat
          icon={<Wallet className="h-3.5 w-3.5" />}
          label="Profit / Portion"
          value={priced ? formatINR(profit) : "—"}
          className="col-span-2"
        />
        {weightStat}
      </div>
    </div>
  );
}
