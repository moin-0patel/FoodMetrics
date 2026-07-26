import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, ChevronsUpDown, Loader2, Plus, Trash2 } from "lucide-react";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { wastageSchema, type WastageValues } from "@/lib/validation/schemas";
import { useSession } from "@/lib/auth/session";
import { accessibleOutlets, userBrands } from "@/lib/auth/permissions";
import { applicableUnitCost } from "@/lib/data";
import { DEPARTMENTS, WASTAGE_TYPES, type WastageEntry } from "@/lib/data/types";
import { cn, formatINR } from "@/lib/utils";
import { todayISO } from "@/lib/data/mock/db";
import { useMaterials } from "@/features/raw-materials/hooks";
import { useRecipes } from "@/features/recipes/hooks";
import { useYields } from "@/features/yield/hooks";
import { useBrands, useOutlets } from "@/features/brands/hooks";
import { useCreateWastage, useUpdateWastage, useWastageWithLines } from "./hooks";
import { toast } from "@/components/ui/use-toast";

const SHIFTS = ["Morning", "Afternoon", "Evening", "Night"];

type PickItem = { id: string; label: string; type: "ingredient" | "recipe"; unit: string };
interface WasteRow {
  key: string;
  item_type: "ingredient" | "recipe";
  item_id: string;
  quantity: number;
  unit: string;
  unit_cost: number;
}
let rowSeq = 0;
const newRow = (): WasteRow => ({ key: `wr-${rowSeq++}`, item_type: "ingredient", item_id: "", quantity: 0, unit: "Gram", unit_cost: 0 });

export function WastageForm({
  open,
  onOpenChange,
  record,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  record?: WastageEntry | null;
}) {
  const { data: materials = [] } = useMaterials();
  const { data: recipes = [] } = useRecipes();
  const { data: yields = [] } = useYields();
  const createMut = useCreateWastage();
  const updateMut = useUpdateWastage();
  const isEdit = !!record;
  const { data: withLines } = useWastageWithLines(open && isEdit ? record!.id : null);

  const sessionUser = useSession((s) => s.user);
  const { data: brands = [] } = useBrands();
  const { data: outlets = [] } = useOutlets();
  const allBrandIds = brands.map((b) => b.id);
  const myBrands = userBrands(sessionUser, allBrandIds);
  const myOutlets = accessibleOutlets(sessionUser, outlets, allBrandIds);
  const activeOutlets = myOutlets.filter((o) => o.status === "active");
  const defBrand = myBrands[0] ?? "";
  const defOutlet = (activeOutlets.find((o) => o.brand_id === defBrand) ?? activeOutlets[0])?.id ?? "";

  const menuRecipes = recipes.filter((r) => !r.is_prep);
  const pickItems: PickItem[] = [
    ...materials.map((m) => ({ id: m.id, label: m.ingredient_name, type: "ingredient" as const, unit: m.base_unit })),
    ...menuRecipes.map((r) => ({
      id: r.id,
      label: r.size_label ? `${r.recipe_name} (${r.size_label})` : r.recipe_name,
      type: "recipe" as const,
      unit: "Portion",
    })),
  ];

  const [lines, setLines] = useState<WasteRow[]>([newRow()]);

  const form = useForm<WastageValues>({
    resolver: zodResolver(wastageSchema),
    defaultValues: {
      name: "",
      wastage_date: todayISO(),
      brand: defBrand,
      outlet_id: defOutlet,
      category: "",
      wastage_type: "Spoilage",
      reason: "",
      department: "Kitchen Staff",
      shift: "",
      done_by: "",
      approved_by: "",
      packaging_cost: 0,
      description: "",
      notes: "",
    },
  });
  const { register, handleSubmit, reset, watch, setValue, formState } = form;

  // Dirty tracking spans RHF fields AND the itemised wastage lines (extra state).
  const serializeLines = (rows: WasteRow[]) =>
    rows.map((l) => ({ t: l.item_type, i: l.item_id, q: l.quantity, u: l.unit, c: l.unit_cost }));
  const { dirty, capture, markSaved } = useFormDirty(form, open, serializeLines(lines));
  const unsaved = useUnsavedChanges(dirty);

  useEffect(() => {
    if (!open) return;
    reset(
      record
        ? {
            name: record.name ?? "",
            wastage_date: record.wastage_date,
            brand: record.brand,
            outlet_id: record.outlet_id,
            category: record.category ?? "",
            wastage_type: record.wastage_type,
            reason: record.reason ?? "",
            department: record.department,
            shift: record.shift ?? "",
            done_by: record.done_by ?? "",
            approved_by: record.approved_by ?? "",
            packaging_cost: record.packaging_cost ?? 0,
            description: record.description ?? "",
            notes: record.notes ?? "",
          }
        : {
            name: "",
            wastage_date: todayISO(),
            brand: defBrand,
            outlet_id: defOutlet,
            category: "",
            wastage_type: "Spoilage",
            reason: "",
            department: "Kitchen Staff",
            shift: "",
            done_by: "",
            approved_by: "",
            packaging_cost: 0,
            description: "",
            notes: "",
          },
    );
    if (!record) {
      const init = [newRow()];
      setLines(init);
      capture(serializeLines(init));
    } else {
      // Provisional baseline; re-captured once the record's lines hydrate below.
      capture(serializeLines(lines));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, record]);

  // Hydrate lines once the record's lines load (edit).
  useEffect(() => {
    if (!open || !isEdit || !withLines) return;
    const hydrated = withLines.lines.length
      ? withLines.lines.map((l) => ({
          key: `wr-${rowSeq++}`,
          item_type: l.item_type,
          item_id: (l.item_type === "recipe" ? l.recipe_id : l.ingredient_id) ?? "",
          quantity: l.quantity,
          unit: l.unit,
          unit_cost: l.unit_cost,
        }))
      : [newRow()];
    setLines(hydrated);
    capture(serializeLines(hydrated));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isEdit, withLines]);

  const brand = watch("brand");
  const packagingCost = watch("packaging_cost") || 0;
  const ingredientCost = lines.reduce((s, l) => s + (l.quantity || 0) * (l.unit_cost || 0), 0);
  const total = Math.round((ingredientCost + packagingCost) * 100) / 100;

  const onBrand = (b: string) => {
    setValue("brand", b);
    const next = activeOutlets.filter((o) => o.brand_id === b);
    setValue("outlet_id", next[0]?.id ?? "");
  };

  const addRow = () => setLines((prev) => [...prev, newRow()]);
  const removeRow = (key: string) => setLines((prev) => (prev.length > 1 ? prev.filter((l) => l.key !== key) : prev));
  const patchRow = (key: string, patch: Partial<WasteRow>) =>
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const pickRow = (key: string, item: PickItem) => {
    const cost = applicableUnitCost(item.type, item.id, materials, recipes, yields);
    patchRow(key, { item_type: item.type, item_id: item.id, unit: item.unit, unit_cost: Number(cost.toFixed(2)) });
  };

  const onSubmit = async (values: WastageValues) => {
    const valid = lines.filter((l) => l.item_id && l.quantity > 0);
    if (valid.length === 0) {
      toast.error("Add at least one wasted item with a quantity");
      return;
    }
    const input = {
      name: values.name || null,
      wastage_date: values.wastage_date,
      brand: values.brand,
      outlet_id: values.outlet_id,
      category: values.category || null,
      wastage_type: values.wastage_type,
      reason: values.reason,
      department: values.department,
      shift: values.shift || null,
      done_by: values.done_by,
      approved_by: values.approved_by || null,
      description: values.description || null,
      notes: values.notes || null,
      packaging_cost: values.packaging_cost ?? 0,
      lines: valid.map((l) => ({
        item_type: l.item_type,
        ingredient_id: l.item_type === "ingredient" ? l.item_id : null,
        recipe_id: l.item_type === "recipe" ? l.item_id : null,
        quantity: l.quantity,
        unit: l.unit,
        unit_cost: l.unit_cost,
      })),
    };
    try {
      if (isEdit && record) {
        await updateMut.mutateAsync({ id: record.id, input });
        toast.success("Wastage entry updated");
      } else {
        await createMut.mutateAsync(input);
        toast.success("Wastage recorded");
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
      <DialogContent lockClose className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Wastage" : "Record Wastage"}</DialogTitle>
          <DialogDescription>Log wasted items like a recipe — add as many as you need.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* General information */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Wastage Name" className="col-span-2">
              <Input {...register("name")} placeholder="e.g. Evening spoilage (optional)" />
            </Field>
            <Field label="Date *" error={formState.errors.wastage_date?.message}>
              <Input type="date" {...register("wastage_date")} />
            </Field>
            <Field label="Wastage Type *">
              <Select value={watch("wastage_type")} onValueChange={(v) => setValue("wastage_type", v as WastageValues["wastage_type"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{WASTAGE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Brand *">
              <Select value={brand} onValueChange={onBrand} disabled={myBrands.length <= 1}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {brands.filter((b) => b.status === "active" && myBrands.includes(b.id)).map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Outlet *" error={formState.errors.outlet_id?.message}>
              <Select value={watch("outlet_id")} onValueChange={(v) => setValue("outlet_id", v)} disabled={activeOutlets.length <= 1}>
                <SelectTrigger><SelectValue placeholder="Select outlet" /></SelectTrigger>
                <SelectContent>
                  {myOutlets.filter((o) => o.brand_id === brand && (o.status === "active" || o.id === watch("outlet_id"))).map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Category">
              <Input {...register("category")} placeholder="e.g. Kitchen / Expiry" />
            </Field>
          </div>

          {/* Itemised wastage lines (recipe-style) */}
          <div className="space-y-2 rounded-md border p-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Wasted Items</Label>
              <Button type="button" variant="outline" size="sm" onClick={addRow}><Plus className="h-3.5 w-3.5" /> Add item</Button>
            </div>
            <div className="hidden grid-cols-12 gap-2 px-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground sm:grid">
              <span className="col-span-5">Item</span>
              <span className="col-span-2">Qty</span>
              <span className="col-span-1">Unit</span>
              <span className="col-span-2 text-right">Unit Cost</span>
              <span className="col-span-1 text-right">Total</span>
              <span className="col-span-1" />
            </div>
            {lines.map((l) => (
              <div key={l.key} className="grid grid-cols-12 items-center gap-2">
                <div className="col-span-12 sm:col-span-5">
                  <ItemCombobox items={pickItems} value={l.item_id || null} onPick={(it) => pickRow(l.key, it)} />
                </div>
                <div className="col-span-4 sm:col-span-2">
                  <Input type="number" min="0" step="0.001" className="h-9" value={l.quantity || ""} onChange={(e) => patchRow(l.key, { quantity: Number(e.target.value) || 0 })} placeholder="Qty" aria-label="Quantity" />
                </div>
                <div className="col-span-3 text-xs text-muted-foreground sm:col-span-1">{l.unit}</div>
                <div className="col-span-3 sm:col-span-2">
                  <CurrencyInput value={l.unit_cost || undefined} onChange={(v) => patchRow(l.key, { unit_cost: (v as number) || 0 })} />
                </div>
                <div className="col-span-1 text-right font-mono text-sm">{formatINR((l.quantity || 0) * (l.unit_cost || 0))}</div>
                <div className="col-span-1 text-right">
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" aria-label="Remove item" onClick={() => removeRow(l.key)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            ))}

            {/* Live summary */}
            <div className="mt-1 space-y-1 border-t pt-2 text-sm">
              <div className="flex items-center justify-between text-muted-foreground">
                <span>Ingredient Cost</span>
                <span className="font-mono">{formatINR(ingredientCost)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Packaging Cost</span>
                <div className="w-28"><CurrencyInput value={watch("packaging_cost") || undefined} onChange={(v) => setValue("packaging_cost", (v as number) || 0)} /></div>
              </div>
              <div className="flex items-center justify-between border-t pt-1 font-semibold">
                <span>Total Wastage Cost</span>
                <span className="font-mono">{formatINR(total)}</span>
              </div>
            </div>
          </div>

          {/* Operational + notes */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Department *">
              <Select value={watch("department")} onValueChange={(v) => setValue("department", v as WastageValues["department"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Shift">
              <Select value={watch("shift") || ""} onValueChange={(v) => setValue("shift", v)}>
                <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                <SelectContent>{SHIFTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Reason *" error={formState.errors.reason?.message}>
              <Input {...register("reason")} placeholder="e.g. Spoiled / burnt / expired" />
            </Field>
            <Field label="Wastage Done By *" error={formState.errors.done_by?.message}>
              <Input {...register("done_by")} placeholder="Staff member name" />
            </Field>
            <Field label="Approved By">
              <Input {...register("approved_by")} placeholder="Manager name (optional)" />
            </Field>
          </div>
          <Field label="Description">
            <Textarea rows={2} {...register("description")} placeholder="Optional context" />
          </Field>
          <Field label="Notes">
            <Textarea rows={2} {...register("notes")} placeholder="Optional" />
          </Field>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => unsaved.guardClose(() => onOpenChange(false))}>Cancel</Button>
            <Button type="submit" variant="accent" disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? "Save Changes" : "Record Wastage"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <UnsavedChangesDialog
      open={unsaved.promptOpen}
      onContinueEditing={unsaved.continueEditing}
      onDiscard={unsaved.discardChanges}
      message="You have unsaved changes in this wastage entry. If you leave now, all entered information will be lost."
    />
    </>
  );
}

function Field({ label, error, className, children }: { label: string; error?: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

/** Searchable picker across ingredients + menu recipes; returns the picked item. */
function ItemCombobox({ items, value, onPick }: { items: PickItem[]; value: string | null; onPick: (item: PickItem) => void }) {
  const [open, setOpen] = useState(false);
  const selected = items.find((i) => i.id === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" className="h-9 w-full justify-between font-normal">
          <span className={cn("truncate", !selected && "text-muted-foreground")}>{selected ? selected.label : "Search item…"}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search ingredient or recipe…" />
          <CommandList>
            <CommandEmpty>No match found.</CommandEmpty>
            <CommandGroup>
              {items.map((i) => (
                <CommandItem key={`${i.type}-${i.id}`} value={i.label} onSelect={() => { onPick(i); setOpen(false); }}>
                  <Check className={cn("mr-2 h-4 w-4", value === i.id ? "opacity-100" : "opacity-0")} />
                  <span className="flex-1 truncate">{i.label}</span>
                  <span className="text-xs text-muted-foreground">{i.type === "recipe" ? "Recipe" : "Ingredient"}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
