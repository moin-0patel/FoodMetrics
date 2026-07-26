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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { packagingItemSchema, type PackagingItemValues } from "@/lib/validation/schemas";
import { PACKAGING_TYPES, PACKAGING_TYPE_LABELS, type PackagingItem } from "@/lib/data/types";
import { useCreatePackaging, useUpdatePackaging } from "./hooks";
import { toast } from "@/components/ui/use-toast";

export const PACKAGING_UNITS = ["Piece", "Gram", "Kilogram", "Millilitre", "Litre", "Packet", "Roll", "Box"];

const EMPTY: PackagingItemValues = {
  name: "",
  packaging_type: "primary",
  unit: "Piece",
  unit_price: undefined as unknown as number,
  status: "active",
  notes: "",
};

export function PackagingForm({
  open,
  onOpenChange,
  item,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  item?: PackagingItem | null;
}) {
  const createMut = useCreatePackaging();
  const updateMut = useUpdatePackaging();
  const isEdit = !!item;

  const form = useForm<PackagingItemValues>({ resolver: zodResolver(packagingItemSchema), defaultValues: EMPTY });
  const { register, handleSubmit, reset, watch, setValue, formState } = form;

  const { dirty, capture, markSaved } = useFormDirty(form, open);
  const unsaved = useUnsavedChanges(dirty);

  useEffect(() => {
    if (!open) return;
    reset(
      item
        ? {
            name: item.name,
            packaging_type: item.packaging_type,
            unit: item.unit,
            unit_price: item.unit_price ?? (undefined as unknown as number),
            status: item.status,
            notes: item.notes ?? "",
          }
        : EMPTY,
    );
    capture();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item]);

  const onSubmit = async (values: PackagingItemValues) => {
    const input = {
      name: values.name,
      packaging_type: values.packaging_type,
      unit: values.unit,
      unit_price: values.unit_price ?? null,
      status: values.status,
      notes: values.notes || null,
    };
    try {
      if (isEdit && item) {
        await updateMut.mutateAsync({ id: item.id, input });
        toast.success("Packaging item updated");
      } else {
        await createMut.mutateAsync(input);
        toast.success("Packaging item added");
      }
      markSaved();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    }
  };

  const busy = createMut.isPending || updateMut.isPending;
  const price = watch("unit_price");

  return (
    <>
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : unsaved.guardClose(() => onOpenChange(false)))}>
      <DialogContent lockClose className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Packaging Item" : "Add Packaging Item"}</DialogTitle>
          <DialogDescription>Master packaging item with a unit price, used by recipes.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Packaging Name *</Label>
            <Input {...register("name")} placeholder="e.g. Pizza Box" />
            {formState.errors.name && <p className="text-xs text-destructive">{formState.errors.name.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Packaging Type *</Label>
              <Select value={watch("packaging_type")} onValueChange={(v) => setValue("packaging_type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PACKAGING_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{PACKAGING_TYPE_LABELS[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Unit *</Label>
              <Select value={watch("unit")} onValueChange={(v) => setValue("unit", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PACKAGING_UNITS.map((u) => (
                    <SelectItem key={u} value={u}>{u}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Unit Price (₹) *</Label>
            <CurrencyInput
              value={price ?? undefined}
              onChange={(v) => setValue("unit_price", v ?? null, { shouldValidate: true })}
              placeholder="0.00"
            />
            {formState.errors.unit_price && <p className="text-xs text-destructive">{formState.errors.unit_price.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea {...register("notes")} rows={2} placeholder="Optional — supplier, size, spec…" />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => unsaved.guardClose(() => onOpenChange(false))}>Cancel</Button>
            <Button type="submit" variant="accent" disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? "Save Changes" : "Save Packaging"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <UnsavedChangesDialog
      open={unsaved.promptOpen}
      onContinueEditing={unsaved.continueEditing}
      onDiscard={unsaved.discardChanges}
      message="You have unsaved changes in this packaging item. If you leave now, all entered information will be lost."
    />
    </>
  );
}
