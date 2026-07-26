import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Loader2, Plus } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { materialSchema, type MaterialValues } from "@/lib/validation/schemas";
import {
  canonicalPurchase,
  measurementTypeFromBaseUnit,
  MEASUREMENT_TYPE_LABELS,
  type MeasurementType,
} from "@/lib/units";
import { round2 } from "@/lib/costing";
import { formatINR } from "@/lib/utils";
import { toast } from "@/components/ui/use-toast";
import { useUnsavedChanges, useFormDirty } from "@/lib/hooks/useUnsavedChanges";
import { UnsavedChangesDialog } from "@/components/UnsavedChangesDialog";
import { useCategories, useSaveCategories } from "@/features/settings/hooks";
import { useCreateMaterial, useMaterial, useUpdateMaterial } from "./hooks";

const TYPES: MeasurementType[] = ["weight", "volume", "count"];
const NEW_CATEGORY = "__new_category__";

/**
 * Full-page Add / Edit Raw Material — mirrors the Recipe editor page (dedicated
 * route, page chrome, unsaved-changes protection) rather than a modal dialog.
 * Routes: /materials/new and /materials/:id/edit.
 */
export function MaterialEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;
  const { data: categories = [] } = useCategories();
  const { data: material, isLoading } = useMaterial(id);
  const createMut = useCreateMaterial();
  const updateMut = useUpdateMaterial();

  const form = useForm<MaterialValues>({
    resolver: zodResolver(materialSchema),
    defaultValues: {
      ingredient_name: "",
      category: "",
      notes: "",
      purchase_price: undefined as unknown as number,
      measurement_type: "weight",
    },
  });
  const { register, handleSubmit, reset, watch, setValue, formState } = form;

  const { dirty, isDirtyNow, capture, markSaved } = useFormDirty(form, true);
  const unsaved = useUnsavedChanges(dirty, isDirtyNow);

  // Inline "add a new category" from the Category dropdown.
  const saveCategories = useSaveCategories();
  const [newCatOpen, setNewCatOpen] = useState(false);
  const [newCat, setNewCat] = useState("");

  const onPickCategory = (v: string) => {
    if (v === NEW_CATEGORY) {
      setNewCat("");
      setNewCatOpen(true);
    } else {
      setValue("category", v, { shouldValidate: true, shouldDirty: true });
    }
  };

  const addCategory = async () => {
    const trimmed = newCat.trim();
    if (!trimmed) return;
    const existing = categories.find((c) => c.toLowerCase() === trimmed.toLowerCase());
    if (existing) {
      // Already there — just select it rather than erroring.
      setValue("category", existing, { shouldValidate: true, shouldDirty: true });
      setNewCatOpen(false);
      return;
    }
    try {
      await saveCategories.mutateAsync([...categories, trimmed]);
      setValue("category", trimmed, { shouldValidate: true, shouldDirty: true });
      setNewCatOpen(false);
      toast.success("Category added");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add category");
    }
  };

  // Populate: existing material (once loaded) or a blank create form.
  useEffect(() => {
    if (isEdit && !material) return; // wait for the record to load
    if (material) {
      const type = measurementTypeFromBaseUnit(material.base_unit);
      const canon = canonicalPurchase(type);
      const normalizedPrice =
        material.cost_per_base_unit != null
          ? round2(material.cost_per_base_unit * canon.baseUnitsPerCanonical)
          : (material.purchase_price ?? (undefined as unknown as number));
      reset({
        ingredient_name: material.ingredient_name,
        category: material.category,
        notes: material.notes ?? "",
        purchase_price: normalizedPrice,
        measurement_type: type,
      });
    } else {
      // A new ingredient starts with NO category selected (the Select shows its
      // placeholder and category is required). Defaulting to categories[0] here
      // desynced the dirty-baseline from the empty field shown to the user, which
      // made an untouched form falsely prompt "Discard changes?".
      reset({
        ingredient_name: "",
        category: "",
        notes: "",
        purchase_price: undefined as unknown as number,
        measurement_type: "weight",
      });
    }
    capture();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [material, isEdit]);

  const price = watch("purchase_price");
  const type = watch("measurement_type");
  const canon = canonicalPurchase(type);
  const costPerBase = price != null && price > 0 ? round2(price / canon.baseUnitsPerCanonical) : null;

  const onSubmit = async (values: MaterialValues) => {
    const c = canonicalPurchase(values.measurement_type);
    const input = {
      ingredient_name: values.ingredient_name,
      category: values.category,
      notes: values.notes || null,
      purchase_price: values.purchase_price ?? null,
      purchase_quantity: 1,
      purchase_unit: c.purchase_unit,
      base_unit: c.base_unit,
    };
    try {
      if (isEdit && material) {
        await updateMut.mutateAsync({ id: material.id, input });
        toast.success("Ingredient updated");
      } else {
        await createMut.mutateAsync(input);
        toast.success("Ingredient added");
      }
      markSaved(); // suppress the unsaved-changes prompt on the navigation below
      navigate("/materials");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    }
  };

  const busy = createMut.isPending || updateMut.isPending;

  if (isEdit && isLoading) {
    return <p className="p-8 text-center text-sm text-muted-foreground">Loading ingredient…</p>;
  }

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="-ml-2 mb-1 gap-1.5 text-muted-foreground">
        <ArrowLeft className="h-4 w-4" /> Back
      </Button>
      <PageHeader
        title={isEdit ? "Edit Ingredient" : "Add Ingredient"}
        description={`Price is per one purchase unit (${canon.displayUnit}), set automatically from the material type.`}
      />

      <form onSubmit={handleSubmit(onSubmit)} className="max-w-2xl">
        <Card className="space-y-4 p-5">
          <div className="space-y-1.5">
            <Label>Ingredient Name *</Label>
            <Input {...register("ingredient_name")} />
            {formState.errors.ingredient_name && (
              <p className="text-xs text-destructive">{formState.errors.ingredient_name.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Category *</Label>
            <Select value={watch("category")} onValueChange={onPickCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
                <SelectItem value={NEW_CATEGORY} className="mt-1 border-t text-primary">
                  <span className="flex items-center gap-1.5">
                    <Plus className="h-3.5 w-3.5" /> New category…
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
            {formState.errors.category && (
              <p className="text-xs text-destructive">{formState.errors.category.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Material Type *</Label>
              <Select value={type} onValueChange={(v) => setValue("measurement_type", v as MeasurementType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {MEASUREMENT_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Purchase Unit</Label>
              <div className="flex h-10 items-center rounded-md border bg-muted px-3 text-sm font-medium">
                {canon.displayUnit}
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Purchase Price (₹ per {canon.displayUnit}) *</Label>
            <CurrencyInput
              value={price ?? undefined}
              onChange={(v) => setValue("purchase_price", v ?? null, { shouldValidate: true })}
              placeholder="Leave blank if price is pending"
            />
            {formState.errors.purchase_price && (
              <p className="text-xs text-destructive">{formState.errors.purchase_price.message}</p>
            )}
          </div>

          <div className="flex items-center justify-between rounded-md bg-muted px-3 py-2 text-sm">
            <span className="text-muted-foreground">Cost Per {canon.base_unit}</span>
            <span className="font-semibold">
              {costPerBase !== null ? `${formatINR(costPerBase)} / ${canon.base_unit}` : "—"}
            </span>
          </div>

          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea {...register("notes")} placeholder="Optional — storage, brand, prep notes…" rows={2} />
          </div>

          <div className="flex justify-end gap-2 border-t pt-4">
            <Button type="button" variant="outline" onClick={() => unsaved.guardClose(() => navigate("/materials"))}>
              Cancel
            </Button>
            <Button type="submit" variant="accent" disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? "Save Changes" : "Save Ingredient"}
            </Button>
          </div>
        </Card>
      </form>

      <UnsavedChangesDialog
        open={unsaved.promptOpen}
        onContinueEditing={unsaved.continueEditing}
        onDiscard={unsaved.discardChanges}
        message="You have unsaved changes in this Raw Material. If you leave now, all entered information will be lost."
      />

      <Dialog open={newCatOpen} onOpenChange={(o) => !saveCategories.isPending && setNewCatOpen(o)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>New Category</DialogTitle>
            <DialogDescription>Add an ingredient category and select it for this ingredient.</DialogDescription>
          </DialogHeader>
          <Input
            value={newCat}
            onChange={(e) => setNewCat(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCategory();
              }
            }}
            placeholder="e.g. Seafood"
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewCatOpen(false)} disabled={saveCategories.isPending}>
              Cancel
            </Button>
            <Button variant="accent" onClick={addCategory} disabled={!newCat.trim() || saveCategories.isPending}>
              {saveCategories.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Add Category
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
