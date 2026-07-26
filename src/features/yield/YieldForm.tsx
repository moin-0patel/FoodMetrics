import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useUnsavedChanges, useFormDirty } from "@/lib/hooks/useUnsavedChanges";
import { UnsavedChangesDialog } from "@/components/UnsavedChangesDialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { yieldSchema, type YieldValues } from "@/lib/validation/schemas";
import { IngredientPicker } from "@/features/recipes/IngredientPicker";
import { canonicalPurchase, measurementTypeFromBaseUnit } from "@/lib/units";
import { computeYield, toBaseQuantity } from "@/lib/yield";
import { round2 } from "@/lib/costing";
import { formatINR } from "@/lib/utils";
import { todayISO } from "@/lib/data/mock/db";
import type { IngredientYield } from "@/lib/data/types";
import { useMaterials } from "@/features/raw-materials/hooks";
import { useCreateYield, useUpdateYield } from "./hooks";
import { toast } from "@/components/ui/use-toast";

export function YieldForm({
  open,
  onOpenChange,
  record,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  record?: IngredientYield | null;
}) {
  const { data: materials = [] } = useMaterials();
  const createMut = useCreateYield();
  const updateMut = useUpdateYield();
  const isEdit = !!record;

  const form = useForm<YieldValues>({
    resolver: zodResolver(yieldSchema),
    defaultValues: {
      name: "",
      ingredient_id: "",
      purchase_cost: undefined as unknown as number,
      // Purchase is always per ONE canonical unit (1 kg / 1 litre / 1 piece) —
      // quantity is fixed at 1 and the unit is derived from the ingredient.
      purchase_quantity: 1,
      purchase_unit: "KG",
      wastage_quantity: undefined as unknown as number,
      effective_from: todayISO(),
      notes: "",
    },
  });
  const { register, handleSubmit, reset, watch, setValue, formState } = form;

  const { dirty, capture, markSaved } = useFormDirty(form, open);
  const unsaved = useUnsavedChanges(dirty);

  useEffect(() => {
    if (!open) return;
    reset(
      record
        ? {
            name: record.name ?? "",
            ingredient_id: record.ingredient_id,
            purchase_cost: record.purchase_cost,
            // Normalise onto the fixed per-1-unit model regardless of any legacy qty.
            purchase_quantity: 1,
            purchase_unit: canonicalPurchase(measurementTypeFromBaseUnit(record.purchase_unit))
              .purchase_unit as YieldValues["purchase_unit"],
            wastage_quantity: record.wastage_quantity,
            effective_from: record.effective_from,
            notes: record.notes ?? "",
          }
        : {
            name: "",
            ingredient_id: "",
            purchase_cost: undefined as unknown as number,
            purchase_quantity: 1,
            purchase_unit: "KG",
            wastage_quantity: undefined as unknown as number,
            effective_from: todayISO(),
            notes: "",
          },
    );
    capture();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, record]);

  const ingredientId = watch("ingredient_id");
  const cost = watch("purchase_cost");
  const wastage = watch("wastage_quantity");

  // The purchase basis follows the chosen ingredient: Weight → 1 kg, Liquid → 1 litre,
  // Count → 1 piece. The user never picks a quantity or unit.
  const selectedMaterial = materials.find((m) => m.id === ingredientId) ?? null;
  const canon = canonicalPurchase(
    measurementTypeFromBaseUnit(selectedMaterial ? selectedMaterial.base_unit : watch("purchase_unit")),
  );
  const baseUnit = canon.base_unit;

  // Prefill the per-1-unit cost from the chosen ingredient's current pricing, and pin
  // the purchase unit to its canonical basis.
  const onPickIngredient = (id: string) => {
    setValue("ingredient_id", id);
    const m = materials.find((x) => x.id === id);
    if (m && !isEdit) {
      const c = canonicalPurchase(measurementTypeFromBaseUnit(m.base_unit));
      const perUnit =
        m.cost_per_base_unit != null
          ? round2(m.cost_per_base_unit * c.baseUnitsPerCanonical)
          : m.purchase_price;
      if (perUnit != null) setValue("purchase_cost", perUnit, { shouldValidate: true });
      setValue("purchase_quantity", 1);
      setValue("purchase_unit", c.purchase_unit as YieldValues["purchase_unit"]);
    }
  };

  const preview =
    ingredientId &&
    cost > 0 &&
    wastage != null &&
    wastage >= 0 &&
    wastage < toBaseQuantity(1, canon.purchase_unit)
      ? computeYield({ purchaseCost: cost, purchaseQuantity: 1, purchaseUnit: canon.purchase_unit, wastageQty: wastage })
      : null;

  const onSubmit = async (values: YieldValues) => {
    const c = canonicalPurchase(measurementTypeFromBaseUnit(values.purchase_unit));
    const input = {
      name: values.name?.trim() || null,
      ingredient_id: values.ingredient_id,
      purchase_cost: values.purchase_cost,
      purchase_quantity: 1,
      purchase_unit: c.purchase_unit,
      wastage_quantity: values.wastage_quantity,
      wastage_unit: c.base_unit,
      effective_from: values.effective_from,
      notes: values.notes || null,
    };
    try {
      if (isEdit && record) {
        await updateMut.mutateAsync({ id: record.id, input });
        toast.success("Yield information updated successfully.");
      } else {
        await createMut.mutateAsync(input);
        toast.success("Yield information added successfully.");
      }
      markSaved();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    }
  };

  const busy = createMut.isPending || updateMut.isPending;

  return (
    <>
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : unsaved.guardClose(() => onOpenChange(false)))}>
      <DialogContent lockClose className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Yield" : "Add Yield"}</DialogTitle>
          <DialogDescription>
            The full purchase cost is distributed across the usable quantity after wastage.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Yield Name</Label>
            <Input
              {...register("name")}
              placeholder={selectedMaterial ? `${selectedMaterial.ingredient_name} Yield` : "e.g. Onion Yield (optional)"}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Ingredient *</Label>
            {isEdit ? (
              <div className="flex h-10 items-center rounded-md border bg-muted px-3 text-sm">
                {selectedMaterial?.ingredient_name ?? "—"}
              </div>
            ) : (
              <IngredientPicker
                materials={materials}
                preps={[]}
                value={ingredientId || null}
                onSelect={(pick) => {
                  if (pick.type === "material") onPickIngredient(pick.material.id);
                }}
              />
            )}
            {formState.errors.ingredient_id && (
              <p className="text-xs text-destructive">{formState.errors.ingredient_id.message}</p>
            )}
          </div>

          <div className="rounded-md border p-3">
            <p className="text-sm font-medium">Purchase</p>
            <p className="mb-3 text-xs text-muted-foreground">
              Priced per one purchase unit ({canon.displayUnit}), set automatically from the ingredient.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Purchase Cost (₹ per {canon.displayUnit}) *</Label>
                <CurrencyInput
                  value={cost ?? undefined}
                  onChange={(v) => setValue("purchase_cost", v as number, { shouldValidate: true })}
                  placeholder="0.00"
                />
                {formState.errors.purchase_cost && (
                  <p className="text-xs text-destructive">{formState.errors.purchase_cost.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Purchase Unit</Label>
                <div className="flex h-10 items-center rounded-md border bg-muted px-3 text-sm font-medium">
                  {canon.displayUnit}
                </div>
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Wastage ({baseUnit}) *</Label>
                <Input
                  type="number"
                  step="0.001"
                  {...register("wastage_quantity", { valueAsNumber: true })}
                />
                <p className="text-xs text-muted-foreground">
                  How much of one {canon.displayUnit} is lost in prep, measured in {baseUnit}.
                </p>
                {formState.errors.wastage_quantity && (
                  <p className="text-xs text-destructive">{formState.errors.wastage_quantity.message}</p>
                )}
              </div>
            </div>
          </div>

          {/* Live, read-only derived values */}
          <div className="grid grid-cols-2 gap-2 rounded-md bg-muted/50 p-3 text-sm">
            <Derived label={`Raw Quantity (${baseUnit})`} value={preview ? String(preview.rawQtyBase) : "—"} />
            <Derived label={`Usable Quantity (${baseUnit})`} value={preview ? String(preview.usableQty) : "—"} />
            <Derived label="Wastage %" value={preview ? `${preview.wastagePct}%` : "—"} />
            <Derived label="Yield %" value={preview ? `${preview.yieldPct}%` : "—"} />
            <Derived label="Original Unit Cost" value={preview ? `${formatINR(preview.originalUnitCost)}/${baseUnit}` : "—"} />
            <Derived
              label="Yield-Adjusted Cost"
              value={preview ? `${formatINR(preview.yieldAdjustedUnitCost)}/${baseUnit}` : "—"}
              strong
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Effective Date *</Label>
              <Input type="date" {...register("effective_from")} />
              {formState.errors.effective_from && (
                <p className="text-xs text-destructive">{formState.errors.effective_from.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea rows={2} {...register("notes")} placeholder="Optional" />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => unsaved.guardClose(() => onOpenChange(false))}>
              Cancel
            </Button>
            <Button type="submit" variant="accent" disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? "Save Changes" : "Save Yield"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <UnsavedChangesDialog
      open={unsaved.promptOpen}
      onContinueEditing={unsaved.continueEditing}
      onDiscard={unsaved.discardChanges}
      message="You have unsaved changes in this yield. If you leave now, all entered information will be lost."
    />
    </>
  );
}

function Derived({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={strong ? "font-semibold text-foreground" : "font-medium"}>{value}</span>
    </div>
  );
}
