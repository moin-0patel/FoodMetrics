import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { formatINR, formatDate } from "@/lib/utils";
import type { IngredientYield, RawMaterial } from "@/lib/data/types";

/** Full, transparent calculation breakdown for a yield record. */
export function YieldBreakdownDialog({
  record,
  material,
  open,
  onOpenChange,
}: {
  record: IngredientYield | null;
  material: RawMaterial | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{material?.ingredient_name ?? "Yield"} — Calculation Breakdown</DialogTitle>
          <DialogDescription>How the effective ingredient cost is derived.</DialogDescription>
        </DialogHeader>
        {record && (
          <div className="space-y-3 text-sm">
            <Section title="Purchase">
              <Row label="Purchase Cost" value={formatINR(record.purchase_cost)} />
              <Row label="Purchase Quantity" value={`${record.purchase_quantity} ${record.purchase_unit}`} />
              <Row label="Raw Quantity" value={`${record.raw_quantity} ${record.raw_unit}`} />
            </Section>
            <Section title="Wastage">
              <Row label="Wastage Quantity" value={`${record.wastage_quantity} ${record.wastage_unit}`} />
              <Row label="Wastage %" value={`${record.wastage_percentage}%`} />
              <Row label="Usable Quantity" value={`${record.usable_quantity} ${record.raw_unit}`} />
              <Row label="Yield %" value={`${record.yield_percentage}%`} strong />
            </Section>
            <Section title="Effective Cost">
              <Row
                label={`Original (÷ ${record.raw_quantity} ${record.raw_unit})`}
                value={`${formatINR(record.original_unit_cost)}/${record.raw_unit}`}
              />
              <Row
                label={`Yield-Adjusted (÷ ${record.usable_quantity} ${record.raw_unit})`}
                value={`${formatINR(record.yield_adjusted_unit_cost)}/${record.raw_unit}`}
                strong
              />
              <Row label="Yield-Adjusted per kg/L" value={formatINR(record.yield_adjusted_unit_cost * 1000)} strong />
            </Section>
            <p className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
              The full purchase cost of {formatINR(record.purchase_cost)} is distributed across the{" "}
              {record.usable_quantity} {record.raw_unit} that remain usable — so each usable unit carries a
              higher effective cost than the raw rate.
            </p>
            <Section title="Record">
              <Row label="Effective From" value={formatDate(record.effective_from)} />
              <Row label="Last Updated" value={formatDate(record.updated_at)} />
              {record.notes && <Row label="Notes" value={record.notes} />}
            </Section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className={strong ? "font-mono font-semibold text-foreground" : "font-mono"}>{value}</span>
    </div>
  );
}
