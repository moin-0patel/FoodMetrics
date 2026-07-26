import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, Loader2 } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { outletSchema, type OutletValues } from "@/lib/validation/schemas";
import { toast } from "@/components/ui/use-toast";
import type { BrandRecord, OutletRecord } from "@/lib/data/types";
import { useBrands, useCreateOutlet, useUpdateOutlet } from "./hooks";

const emptyValues = (brandId: string): OutletValues => ({
  brand_id: brandId,
  name: "",
  outlet_code: "",
  city: "",
  state: "",
  address: "",
  phone: "",
  email: "",
  opening_date: "",
  timezone: "Asia/Kolkata",
  status: "active",
  notes: "",
});

export function OutletForm({
  open,
  onOpenChange,
  outlet,
  defaultBrandId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  outlet?: OutletRecord | null;
  defaultBrandId?: string;
}) {
  const isEdit = !!outlet;
  const { data: brands = [] } = useBrands();
  const createMut = useCreateOutlet();
  const updateMut = useUpdateOutlet();

  const form = useForm<OutletValues>({
    resolver: zodResolver(outletSchema),
    defaultValues: emptyValues(defaultBrandId ?? ""),
  });
  const { register, handleSubmit, reset, watch, setValue, formState } = form;
  const { errors } = formState;

  const { dirty, capture, markSaved } = useFormDirty(form, open);
  const unsaved = useUnsavedChanges(dirty);

  useEffect(() => {
    if (open) {
      reset(
        outlet
          ? {
              brand_id: outlet.brand_id,
              name: outlet.name,
              outlet_code: outlet.outlet_code,
              city: outlet.city ?? "",
              state: outlet.state ?? "",
              address: outlet.address ?? "",
              phone: outlet.phone ?? "",
              email: outlet.email ?? "",
              opening_date: outlet.opening_date ?? "",
              timezone: outlet.timezone || "Asia/Kolkata",
              status: outlet.status,
              notes: outlet.notes ?? "",
            }
          : emptyValues(defaultBrandId ?? (brands.find((b) => b.status === "active")?.id ?? "")),
      );
      capture();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, outlet, defaultBrandId]);

  // If brands load AFTER the dialog opened for a NEW outlet, fill the default brand
  // once — without clobbering a brand the user may have already picked.
  useEffect(() => {
    if (open && !outlet && !defaultBrandId && !watch("brand_id") && brands.length) {
      setValue("brand_id", brands.find((b) => b.status === "active")?.id ?? "");
      capture(); // programmatic prefill, not a user edit — keep the form pristine
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, brands]);

  const selectedBrand = watch("brand_id");
  const brandChanged = isEdit && outlet && selectedBrand !== outlet.brand_id;
  // Show active brands; keep the current brand available even if it's archived.
  const brandOptions: BrandRecord[] = brands.filter(
    (b) => b.status === "active" || b.id === outlet?.brand_id || b.id === selectedBrand,
  );

  const onSubmit = async (values: OutletValues) => {
    try {
      const input = {
        brand_id: values.brand_id,
        name: values.name,
        outlet_code: values.outlet_code,
        city: values.city || null,
        state: values.state || null,
        address: values.address || null,
        phone: values.phone || null,
        email: values.email || null,
        opening_date: values.opening_date || null,
        timezone: values.timezone || "Asia/Kolkata",
        status: values.status,
        notes: values.notes || null,
      };
      if (isEdit && outlet) {
        await updateMut.mutateAsync({ id: outlet.id, input });
        toast.success("Outlet updated");
      } else {
        await createMut.mutateAsync(input);
        toast.success("Outlet created");
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
          <DialogTitle>{isEdit ? "Edit Outlet" : "New Outlet"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Update this outlet's details." : "Add a new outlet under a brand."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Brand *</Label>
              <Select value={selectedBrand} onValueChange={(v) => setValue("brand_id", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select brand" />
                </SelectTrigger>
                <SelectContent>
                  {brandOptions.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                      {b.status !== "active" ? ` (${b.status})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.brand_id && <p className="text-xs text-destructive">{errors.brand_id.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Status *</Label>
              <Select value={watch("status")} onValueChange={(v) => setValue("status", v as OutletValues["status"])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {brandChanged && (
            <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                You're moving this outlet to a different brand. Existing wastage and reports for it stay
                intact but will now roll up under the new brand. This is recorded in the audit log.
              </span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Outlet Name *</Label>
              <Input {...register("name")} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Outlet Code *</Label>
              <Input {...register("outlet_code")} placeholder="e.g. CAP-PIP" />
              {errors.outlet_code && <p className="text-xs text-destructive">{errors.outlet_code.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>City</Label>
              <Input {...register("city")} />
            </div>
            <div className="space-y-1.5">
              <Label>State</Label>
              <Input {...register("state")} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Address</Label>
            <Input {...register("address")} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Contact Number</Label>
              <Input {...register("phone")} />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" {...register("email")} />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Opening Date</Label>
              <Input type="date" {...register("opening_date")} />
            </div>
            <div className="space-y-1.5">
              <Label>Timezone</Label>
              <Input {...register("timezone")} placeholder="Asia/Kolkata" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea rows={2} {...register("notes")} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => unsaved.guardClose(() => onOpenChange(false))}>
              Cancel
            </Button>
            <Button type="submit" variant="accent" disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? "Save Changes" : "Create Outlet"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <UnsavedChangesDialog
      open={unsaved.promptOpen}
      onContinueEditing={unsaved.continueEditing}
      onDiscard={unsaved.discardChanges}
      message="You have unsaved changes in this outlet. If you leave now, all entered information will be lost."
    />
    </>
  );
}
