import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Lock } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/components/ui/use-toast";
import { roleSchema, type RoleValues } from "@/lib/validation/schemas";
import {
  CAPABILITY_GROUPS,
  CAPABILITY_LABELS,
  RESERVED_CAPABILITIES,
  type Capability,
} from "@/lib/auth/permissions";
import type { RoleRecord } from "@/lib/data/types";
import { useCreateRole, useUpdateRole } from "./hooks";

const RESERVED = new Set<Capability>(RESERVED_CAPABILITIES);

export function RoleForm({
  open,
  onOpenChange,
  role,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role?: RoleRecord | null;
}) {
  const isEdit = !!role;
  const createMut = useCreateRole();
  const updateMut = useUpdateRole();

  const form = useForm<RoleValues>({
    resolver: zodResolver(roleSchema),
    defaultValues: { label: "", description: "", capabilities: [] },
  });
  const { register, handleSubmit, reset, formState } = form;
  const { errors } = formState;

  const [caps, setCaps] = useState<Set<Capability>>(new Set());

  // Dirty tracking spans the RHF fields AND the capability checkboxes (extra state).
  const { dirty, capture, markSaved } = useFormDirty(form, open, [...caps].sort());
  const unsaved = useUnsavedChanges(dirty);

  useEffect(() => {
    if (!open) return;
    const initialCaps = (role?.capabilities ?? []) as Capability[];
    reset({ label: role?.label ?? "", description: role?.description ?? "", capabilities: [] });
    setCaps(new Set(initialCaps));
    capture([...initialCaps].sort());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, role]);

  const toggle = (cap: Capability, on: boolean) =>
    setCaps((prev) => {
      const next = new Set(prev);
      if (on) next.add(cap);
      else next.delete(cap);
      return next;
    });

  const onSubmit = async (values: RoleValues) => {
    // Only grantable capabilities are persisted — reserved ones stay with the
    // built-in Admin/Super Admin (the repo strips them too, as defence-in-depth).
    const capabilities = [...caps].filter((c) => !RESERVED.has(c));
    try {
      if (isEdit && role) {
        await updateMut.mutateAsync({ key: role.key, input: { label: values.label, description: values.description, capabilities } });
        toast.success("Role updated");
      } else {
        await createMut.mutateAsync({ label: values.label, description: values.description, capabilities });
        toast.success("Role created");
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
          <DialogTitle>{isEdit ? "Edit Role" : "New Role"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update this custom role's name and the features it can access."
              : "Create a custom role and choose exactly which features it can access."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Role Name *</Label>
              <Input {...register("label")} placeholder="e.g. Cost Analyst" />
              {errors.label && <p className="text-xs text-destructive">{errors.label.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Input {...register("description")} placeholder="What this role is for" />
            </div>
          </div>

          <div className="space-y-3">
            <Label>Feature access</Label>
            {CAPABILITY_GROUPS.map((group) => (
              <div key={group.label} className="rounded-md border p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {group.label}
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {group.capabilities.map((cap) => {
                    const reserved = RESERVED.has(cap);
                    return (
                      <label
                        key={cap}
                        className={
                          "flex items-start gap-2 text-sm " +
                          (reserved ? "cursor-not-allowed opacity-60" : "")
                        }
                        title={reserved ? "Reserved for the built-in Admin / Super Admin roles" : undefined}
                      >
                        <Checkbox
                          className="mt-0.5"
                          disabled={reserved}
                          checked={reserved ? false : caps.has(cap)}
                          onCheckedChange={(c) => toggle(cap, !!c)}
                        />
                        <span>
                          {CAPABILITY_LABELS[cap]}
                          {reserved && <Lock className="ml-1 inline h-3 w-3 align-text-top" />}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
            <p className="text-[11px] text-muted-foreground">
              <Lock className="mr-1 inline h-3 w-3 align-text-top" />
              Locked items (user, role, brand &amp; outlet management) stay reserved to the built-in
              Admin / Super Admin roles and can't be granted to a custom role.
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => unsaved.guardClose(() => onOpenChange(false))}>
              Cancel
            </Button>
            <Button type="submit" variant="accent" disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? "Save Changes" : "Create Role"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <UnsavedChangesDialog
      open={unsaved.promptOpen}
      onContinueEditing={unsaved.continueEditing}
      onDiscard={unsaved.discardChanges}
      message="You have unsaved changes in this role. If you leave now, all entered information will be lost."
    />
    </>
  );
}
