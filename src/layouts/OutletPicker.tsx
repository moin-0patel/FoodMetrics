import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Store } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useOutlets } from "@/features/brands/hooks";
import { useDashboardBrand } from "@/features/dashboard/brandTheme";

/**
 * Header outlet selector.
 *
 * Outlets are the app's location dimension, but the catalog (recipes, materials,
 * costing) is scoped by BRAND, not by outlet — only wastage is recorded per
 * outlet. So picking an outlet here scopes the app to that outlet's brand, which
 * is the strongest scoping the data model actually supports. It deliberately does
 * not pretend to filter costing per location.
 */

const ALL = "all";

interface OutletState {
  outletId: string;
  setOutletId: (id: string) => void;
}

export const useSelectedOutlet = create<OutletState>()(
  persist(
    (set) => ({
      outletId: ALL,
      setOutletId: (outletId) => set({ outletId }),
    }),
    { name: "rcms.outlet" },
  ),
);

export function OutletPicker({ className }: { className?: string }) {
  const { data: outlets = [] } = useOutlets();
  const outletId = useSelectedOutlet((s) => s.outletId);
  const setOutletId = useSelectedOutlet((s) => s.setOutletId);
  const setBrand = useDashboardBrand((s) => s.setBrand);

  const active = outlets.filter((o) => o.status === "active");

  // No outlets yet (fresh install) — show a disabled hint instead of an empty menu.
  if (active.length === 0) {
    return (
      <span
        className={cn(
          "hidden items-center gap-1.5 rounded-md border border-dashed px-2.5 py-1.5 text-xs text-muted-foreground lg:inline-flex",
          className,
        )}
        title="Create outlets in Brands & Outlets"
      >
        <Store className="h-3.5 w-3.5" />
        No outlets yet
      </span>
    );
  }

  // A stale stored id (outlet deleted/archived) falls back to "all".
  const value = active.some((o) => o.id === outletId) ? outletId : ALL;

  return (
    <Select
      value={value}
      onValueChange={(v) => {
        setOutletId(v);
        // Scope the app to the outlet's brand; "all outlets" clears the scope.
        if (v === ALL) {
          setBrand("all");
        } else {
          const brandId = active.find((o) => o.id === v)?.brand_id;
          if (brandId) setBrand(brandId);
        }
      }}
    >
      <SelectTrigger className={cn("h-9 w-auto min-w-[9.5rem] gap-1.5", className)} aria-label="Outlet">
        <Store className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <SelectValue placeholder="All outlets" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>All outlets</SelectItem>
        {active.map((o) => (
          <SelectItem key={o.id} value={o.id}>
            {o.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
