import { Box, Package, Layers } from "lucide-react";
import { cn, formatINR } from "@/lib/utils";
import { StatusPill } from "@/components/StatusPill";
import { Button } from "@/components/ui/button";
import { PACKAGING_TYPE_LABELS, type PackagingItem, type PackagingType } from "@/lib/data/types";

/**
 * Packaging card for the gallery view.
 *
 * PackagingItem has no image field, so instead of a stock photo the card leads
 * with a typed icon plate tinted by packaging type. Adding real photos would mean
 * an `image_url` column on the packaging table plus an upload path.
 */

const TYPE_ICON: Record<string, React.ReactNode> = {
  primary: <Package className="h-7 w-7" />,
  secondary: <Box className="h-7 w-7" />,
  tertiary: <Layers className="h-7 w-7" />,
};

const TYPE_PLATE: Record<string, string> = {
  primary: "from-primary/25 to-primary/5 text-primary",
  secondary: "from-sky-500/25 to-sky-500/5 text-sky-600 dark:text-sky-400",
  tertiary: "from-violet-500/25 to-violet-500/5 text-violet-600 dark:text-violet-400",
};

export function PackagingCard({
  item,
  canManage,
  onEdit,
  onToggleStatus,
}: {
  item: PackagingItem;
  canManage: boolean;
  onEdit: () => void;
  onToggleStatus: () => void;
}) {
  const active = item.status === "active";
  const typeLabel = PACKAGING_TYPE_LABELS[item.packaging_type as PackagingType] ?? item.packaging_type;

  return (
    <div className="group flex flex-col overflow-hidden rounded-xl border bg-card transition-all hover:-translate-y-0.5 hover:shadow-lg">
      {/* Photo or fallback icon plate. */}
      <div className="relative flex aspect-[16/9] items-center justify-center bg-muted">
        {item.image_url ? (
          <img src={item.image_url} alt={item.name} className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <span
            className={cn(
              "flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br ring-1 ring-inset ring-black/5",
              TYPE_PLATE[item.packaging_type] ?? "from-muted to-muted text-muted-foreground",
            )}
          >
            {TYPE_ICON[item.packaging_type] ?? <Package className="h-7 w-7" />}
          </span>
        )}
        <span className="absolute right-3 top-3 rounded bg-background/85 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-muted-foreground ring-1 ring-inset ring-border">
          {item.id.slice(0, 8)}
        </span>
        {!active && (
          <span className="absolute left-3 top-3">
            <StatusPill tone="neutral">Inactive</StatusPill>
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate font-semibold text-foreground">{item.name}</h3>
            <p className="mt-0.5 truncate text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {typeLabel}  /  per {item.unit}
            </p>
          </div>
          {canManage && (
            // Status switch. A real checkbox so it's keyboard-operable and
            // announces its state, styled as a track + knob.
            <label className="relative inline-flex shrink-0 cursor-pointer items-center">
              <input
                type="checkbox"
                className="peer sr-only"
                checked={active}
                onChange={onToggleStatus}
                aria-label={`${active ? "Deactivate" : "Activate"} ${item.name}`}
              />
              <span className="h-5 w-9 rounded-full bg-muted ring-1 ring-inset ring-border transition-colors peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-ring" />
              <span className="absolute left-0.5 h-4 w-4 rounded-full bg-background shadow transition-transform peer-checked:translate-x-4" />
            </label>
          )}
        </div>

        <div className="mt-4 flex items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Unit price
            </p>
            <p className="text-xl font-semibold leading-none tabular-nums text-primary">
              {item.unit_price == null ? "—" : formatINR(item.unit_price)}
            </p>
          </div>
          <StatusPill tone={active ? "good" : "neutral"} dot>
            {active ? "Active" : "Inactive"}
          </StatusPill>
        </div>

        {canManage && (
          <Button variant="outline" size="sm" className="mt-4 w-full" onClick={onEdit}>
            Edit item
          </Button>
        )}
      </div>
    </div>
  );
}
