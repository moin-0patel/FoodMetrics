import { cn } from "@/lib/utils";
import { useBrands } from "@/features/brands/hooks";
import { deriveBrandAccent } from "@/lib/data/brandCache";

/** A brand id, or the special "all" selection. */
export type BrandSelection = string;

// Only "all" has a hand-tuned active chip colour; every brand's chip is painted
// from its own accent colour (inline) instead.
const KNOWN_ACTIVE: Record<string, string> = {
  all: "bg-[#1b35a8] text-white shadow",
};

/** Segmented All / <brands…> switcher. `className="w-full"` makes it a full-width,
 *  equal-segment control for mobile drawers. Brands load dynamically. */
export function BrandFilter({
  value,
  onChange,
  className,
}: {
  value: BrandSelection;
  onChange: (value: BrandSelection) => void;
  className?: string;
}) {
  const { data: brands = [] } = useBrands();
  const options = [
    { id: "all", name: "All Brands", accent: null as string | null },
    ...brands
      .filter((b) => b.status === "active")
      .map((b) => ({ id: b.id, name: b.name, accent: b.accent_color })),
  ];
  const fullWidth = className?.includes("w-full");
  return (
    <div className={cn("inline-flex rounded-lg border bg-muted p-1", fullWidth && "flex w-full", className)}>
      {options.map((o) => {
        const active = value === o.id;
        const known = KNOWN_ACTIVE[o.id];
        return (
          <button
            key={o.id}
            onClick={() => onChange(o.id)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              fullWidth && "flex-1",
              active
                ? known ?? "text-white shadow"
                : "text-muted-foreground hover:text-foreground",
            )}
            style={
              active && !known
                ? { backgroundColor: o.accent || deriveBrandAccent(o.id), color: "#fff" }
                : undefined
            }
          >
            {o.name}
          </button>
        );
      })}
    </div>
  );
}
