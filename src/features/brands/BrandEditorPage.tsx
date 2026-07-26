import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { brandSchema, type BrandValues } from "@/lib/validation/schemas";
import { toast } from "@/components/ui/use-toast";
import { useUnsavedChanges, useFormDirty } from "@/lib/hooks/useUnsavedChanges";
import { UnsavedChangesDialog } from "@/components/UnsavedChangesDialog";
import { useBrands, useCreateBrand, useUpdateBrand } from "./hooks";

const EMPTY: BrandValues = {
  name: "",
  brand_code: "",
  display_name: "",
  accent_color: "",
  status: "active",
  notes: "",
};

/**
 * Full-page Add / Edit Brand — mirrors the Recipe / Raw Material editor pages
 * (dedicated route, page chrome, unsaved-changes protection) rather than a modal.
 * Routes: /brands/new and /brands/:id/edit (Super Admin only).
 */
export function BrandEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;
  const { data: brands = [], isLoading } = useBrands();
  const brand = id ? brands.find((b) => b.id === id) ?? null : null;
  const createMut = useCreateBrand();
  const updateMut = useUpdateBrand();

  const form = useForm<BrandValues>({ resolver: zodResolver(brandSchema), defaultValues: EMPTY });
  const { register, handleSubmit, reset, watch, setValue, formState } = form;
  const { errors } = formState;

  const { dirty, isDirtyNow, capture, markSaved } = useFormDirty(form, true);
  const unsaved = useUnsavedChanges(dirty, isDirtyNow);

  useEffect(() => {
    if (isEdit && !brand) return; // wait for the record to load
    reset(
      brand
        ? {
            name: brand.name,
            brand_code: brand.brand_code,
            display_name: brand.display_name,
            accent_color: brand.accent_color ?? "",
            status: brand.status,
            notes: brand.notes ?? "",
          }
        : EMPTY,
    );
    capture();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brand, isEdit]);

  const onSubmit = async (values: BrandValues) => {
    try {
      const input = {
        name: values.name,
        brand_code: values.brand_code,
        display_name: values.display_name || values.name,
        accent_color: values.accent_color || null,
        status: values.status,
        notes: values.notes || null,
      };
      if (isEdit && brand) {
        await updateMut.mutateAsync({ id: brand.id, input });
        toast.success("Brand updated");
      } else {
        await createMut.mutateAsync(input);
        toast.success("Brand created");
      }
      markSaved();
      navigate("/brands");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    }
  };

  const busy = createMut.isPending || updateMut.isPending;

  if (isEdit && !brand && isLoading) {
    return <p className="p-8 text-center text-sm text-muted-foreground">Loading brand…</p>;
  }

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="-ml-2 mb-1 gap-1.5 text-muted-foreground">
        <ArrowLeft className="h-4 w-4" /> Back
      </Button>
      <PageHeader
        title={isEdit ? "Edit Brand" : "New Brand"}
        description={isEdit ? "Update this brand." : "Add a new restaurant brand, then add its outlets."}
      />

      <form onSubmit={handleSubmit(onSubmit)} className="max-w-2xl">
        <Card className="space-y-4 p-5">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Brand Name *</Label>
              <Input {...register("name")} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Brand Code *</Label>
              <Input {...register("brand_code")} placeholder="e.g. CAP" />
              {errors.brand_code && <p className="text-xs text-destructive">{errors.brand_code.message}</p>}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Display Name</Label>
            <Input {...register("display_name")} placeholder="Defaults to the brand name" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Accent Colour</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="color"
                  className="h-9 w-12 shrink-0 p-1"
                  value={watch("accent_color") || "#888888"}
                  onChange={(e) => setValue("accent_color", e.target.value)}
                />
                <Input {...register("accent_color")} placeholder="#ed1c24" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Status *</Label>
              <Select value={watch("status")} onValueChange={(v) => setValue("status", v as BrandValues["status"])}>
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
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea rows={2} {...register("notes")} />
          </div>

          <div className="flex justify-end gap-2 border-t pt-4">
            <Button type="button" variant="outline" onClick={() => unsaved.guardClose(() => navigate("/brands"))}>
              Cancel
            </Button>
            <Button type="submit" variant="accent" disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? "Save Changes" : "Create Brand"}
            </Button>
          </div>
        </Card>
      </form>

      <UnsavedChangesDialog
        open={unsaved.promptOpen}
        onContinueEditing={unsaved.continueEditing}
        onDiscard={unsaved.discardChanges}
        message="You have unsaved changes in this brand. If you leave now, all entered information will be lost."
      />
    </>
  );
}
