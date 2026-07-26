import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatINR } from "@/lib/utils";
import { PACKAGING_TYPE_LABELS, type PackagingItem, type PackagingType } from "@/lib/data/types";

export interface PackagingLine {
  key: string;
  packaging_item_id: string;
  quantity_used: number;
}

/** Live total of a set of packaging lines against the master price list. */
export function packagingLinesTotal(lines: PackagingLine[], items: PackagingItem[]): number {
  const priceOf = (id: string) => items.find((i) => i.id === id)?.unit_price ?? 0;
  return Math.round(lines.reduce((s, l) => s + (l.quantity_used || 0) * priceOf(l.packaging_item_id), 0) * 100) / 100;
}

/**
 * Multi-row packaging section for the recipe editor. Each row picks a master
 * packaging item (Pizza Box, Sauce Cup…), a quantity, shows the auto-fetched unit
 * price (read-only) and a live line total. Ingredient cost + packaging stay separate.
 */
export function RecipePackagingSection({
  lines,
  items,
  onAdd,
  onRemove,
  onPatch,
}: {
  lines: PackagingLine[];
  items: PackagingItem[];
  onAdd: () => void;
  onRemove: (key: string) => void;
  onPatch: (key: string, patch: Partial<PackagingLine>) => void;
}) {
  const total = packagingLinesTotal(lines, items);
  const typeLabel = (t: string) => PACKAGING_TYPE_LABELS[t as PackagingType] ?? t;

  return (
    <div className="space-y-2 rounded-md border p-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-semibold">Packaging</Label>
        <Button type="button" variant="outline" size="sm" onClick={onAdd}>
          <Plus className="h-3.5 w-3.5" /> Add packaging
        </Button>
      </div>

      {lines.length === 0 ? (
        <p className="text-xs text-muted-foreground">No packaging added. Add boxes, cups, bags… from the master.</p>
      ) : (
        <div className="space-y-2">
          {/* Header (desktop) */}
          <div className="hidden grid-cols-12 gap-2 px-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground sm:grid">
            <span className="col-span-5">Item</span>
            <span className="col-span-2">Qty</span>
            <span className="col-span-2 text-right">Unit Price</span>
            <span className="col-span-2 text-right">Total</span>
            <span className="col-span-1" />
          </div>
          {lines.map((l) => {
            const item = items.find((i) => i.id === l.packaging_item_id) ?? null;
            const lineTotal = (l.quantity_used || 0) * (item?.unit_price ?? 0);
            return (
              <div key={l.key} className="grid grid-cols-12 items-center gap-2">
                <div className="col-span-12 sm:col-span-5">
                  <Select value={l.packaging_item_id} onValueChange={(v) => onPatch(l.key, { packaging_item_id: v })}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Select packaging" /></SelectTrigger>
                    <SelectContent>
                      {items.map((i) => (
                        <SelectItem key={i.id} value={i.id}>
                          {i.name} <span className="text-xs text-muted-foreground">· {typeLabel(i.packaging_type)}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-4 sm:col-span-2">
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    className="h-9"
                    value={l.quantity_used || ""}
                    onChange={(e) => onPatch(l.key, { quantity_used: Number(e.target.value) || 0 })}
                    placeholder="Qty"
                    aria-label="Quantity"
                  />
                </div>
                <div className="col-span-3 text-right text-xs text-muted-foreground sm:col-span-2">
                  {item ? `${formatINR(item.unit_price)}/${item.unit}` : "—"}
                </div>
                <div className="col-span-3 text-right font-mono text-sm sm:col-span-2">{formatINR(lineTotal)}</div>
                <div className="col-span-2 text-right sm:col-span-1">
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" aria-label="Remove packaging" onClick={() => onRemove(l.key)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
          <div className="flex items-center justify-between border-t pt-2 text-sm">
            <span className="text-muted-foreground">Total Packaging Cost</span>
            <span className="font-mono font-semibold">{formatINR(total)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
