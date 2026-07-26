import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Loader2, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { userSchema, type UserValues } from "@/lib/validation/schemas";
import { useSession } from "@/lib/auth/session";
import { toast } from "@/components/ui/use-toast";
import { type BrandScope, type OutletScope } from "@/lib/data/types";
import { useBrands, useOutlets } from "@/features/brands/hooks";
import { useRoles } from "@/features/roles/hooks";
import { useUnsavedChanges, useFormDirty } from "@/lib/hooks/useUnsavedChanges";
import { UnsavedChangesDialog } from "@/components/UnsavedChangesDialog";
import { useCreateUser, useUpdateUser, useUsers } from "./hooks";

type BrandScopeUi = "DEFAULT" | BrandScope;
type OutletScopeUi = "DEFAULT" | OutletScope;

/**
 * Full-page Create / Edit User — mirrors the Recipe / Raw Material editor pages
 * (dedicated route, page chrome, unsaved-changes protection) rather than a modal.
 * Routes: /users/new and /users/:id/edit (Admin only).
 */
export function UserEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;
  const { data: users = [], isLoading } = useUsers();
  const user = id ? users.find((u) => u.id === id) ?? null : null;

  const createMut = useCreateUser();
  const updateMut = useUpdateUser();
  const me = useSession((s) => s.user);
  const iAmSuper = me?.role === "super_admin";
  const { data: brands = [] } = useBrands();
  const { data: outlets = [] } = useOutlets();
  const { data: roles = [] } = useRoles();
  const activeBrands = brands.filter((b) => b.status === "active");
  const activeOutlets = outlets.filter((o) => o.status === "active");

  const form = useForm<UserValues>({
    resolver: zodResolver(userSchema),
    defaultValues: { name: "", email: "", role: "editor", status: "active", password: "" },
  });
  const { register, handleSubmit, reset, watch, setValue, formState } = form;
  const { errors } = formState;

  // Access scopes are managed outside RHF (dynamic lists + a "Default" sentinel).
  const [brandScope, setBrandScope] = useState<BrandScopeUi>("DEFAULT");
  const [selectedBrandIds, setSelectedBrandIds] = useState<string[]>([]);
  const [assignedBrand, setAssignedBrand] = useState<string>("");
  const [outletScope, setOutletScope] = useState<OutletScopeUi>("DEFAULT");
  const [selectedOutletIds, setSelectedOutletIds] = useState<string[]>([]);
  const [assignedOutlet, setAssignedOutlet] = useState<string>("");
  // Per-user Data Import & Wastage grants (Super Admin only). Non-RHF, like the scopes.
  const [canImportGrant, setCanImportGrant] = useState(false);
  const [canManageWastageGrant, setCanManageWastageGrant] = useState(false);

  // Dirty tracking spans RHF fields AND all the access-scope state (extra).
  const scopeState = {
    bs: brandScope,
    sb: [...selectedBrandIds].sort(),
    ab: assignedBrand,
    os: outletScope,
    so: [...selectedOutletIds].sort(),
    ao: assignedOutlet,
    ci: canImportGrant,
    cw: canManageWastageGrant,
  };
  const { dirty, isDirtyNow, capture, markSaved } = useFormDirty(form, true, scopeState);
  const unsaved = useUnsavedChanges(dirty, isDirtyNow);

  useEffect(() => {
    if (isEdit && !user) return; // wait for the record to load
    reset(
      user
        ? { name: user.name, email: user.email, role: user.role, status: user.status, password: "" }
        : { name: "", email: "", role: "editor", status: "active", password: "" },
    );
    setBrandScope(user?.brand_scope ?? "DEFAULT");
    setSelectedBrandIds(user?.selected_brand_ids ?? []);
    setAssignedBrand(user?.assigned_brand ?? "");
    setOutletScope(user?.outlet_scope ?? "DEFAULT");
    setSelectedOutletIds(user?.selected_outlet_ids ?? []);
    setAssignedOutlet(user?.assigned_outlet ?? "");
    setCanImportGrant(user?.can_import === true);
    setCanManageWastageGrant(user?.can_manage_wastage === true);
    capture({
      bs: user?.brand_scope ?? "DEFAULT",
      sb: [...(user?.selected_brand_ids ?? [])].sort(),
      ab: user?.assigned_brand ?? "",
      os: user?.outlet_scope ?? "DEFAULT",
      so: [...(user?.selected_outlet_ids ?? [])].sort(),
      ao: user?.assigned_outlet ?? "",
      ci: user?.can_import === true,
      cw: user?.can_manage_wastage === true,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isEdit]);

  const role = watch("role");
  const showScope = role !== "super_admin";

  const toggle = (list: string[], id: string, on: boolean) =>
    on ? [...new Set([...list, id])] : list.filter((x) => x !== id);

  const syncedAccessibleBrands = (isReadOnly: boolean): string[] | undefined => {
    if (!isReadOnly || brandScope === "DEFAULT") return undefined;
    if (brandScope === "ALL_BRANDS") return brands.map((b) => b.id);
    if (brandScope === "SELECTED_BRANDS") return selectedBrandIds;
    return assignedBrand ? [assignedBrand] : [];
  };

  const scopePatch = () => ({
    brand_scope: brandScope === "DEFAULT" ? null : brandScope,
    selected_brand_ids: selectedBrandIds,
    assigned_brand: assignedBrand || null,
    outlet_scope: outletScope === "DEFAULT" ? null : outletScope,
    selected_outlet_ids: selectedOutletIds,
    assigned_outlet: assignedOutlet || null,
  });

  const onSubmit = async (values: UserValues) => {
    if (values.role !== "super_admin") {
      if (brandScope === "SELECTED_BRANDS" && selectedBrandIds.length === 0) {
        toast.error("Pick at least one brand for 'Specific brands' access");
        return;
      }
      if (brandScope === "ASSIGNED_BRAND" && !assignedBrand) {
        toast.error("Pick the brand for 'Single brand' access");
        return;
      }
      if (outletScope === "SELECTED_OUTLETS" && selectedOutletIds.length === 0) {
        toast.error("Pick at least one outlet for 'Specific outlets' access");
        return;
      }
      if (outletScope === "ASSIGNED_OUTLET" && !assignedOutlet) {
        toast.error("Pick the outlet for 'Single outlet' access");
        return;
      }
    }
    try {
      const isReadOnly = values.role === "viewer" || values.role === "chef";
      const scope =
        values.role === "super_admin"
          ? { brand_scope: null, selected_brand_ids: [], assigned_brand: null, outlet_scope: null, selected_outlet_ids: [], assigned_outlet: null, accessible_brands: undefined as string[] | undefined }
          : { ...scopePatch(), accessible_brands: syncedAccessibleBrands(isReadOnly) };
      if (isEdit && user) {
        await updateMut.mutateAsync({
          id: user.id,
          patch: {
            name: values.name,
            email: values.email,
            role: values.role,
            status: values.status,
            password: values.password || undefined,
            ...scope,
            ...(iAmSuper ? { can_import: canImportGrant, can_manage_wastage: canManageWastageGrant } : {}),
          },
        });
        toast.success("User updated");
      } else {
        if (!values.password) {
          toast.error("Password is required for a new user");
          return;
        }
        await createMut.mutateAsync({
          name: values.name,
          email: values.email,
          role: values.role,
          status: values.status,
          password: values.password,
          ...scope,
          ...(iAmSuper ? { can_import: canImportGrant, can_manage_wastage: canManageWastageGrant } : {}),
        });
        toast.success("User created");
      }
      markSaved();
      navigate("/users");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    }
  };

  const busy = createMut.isPending || updateMut.isPending;

  if (isEdit && !user && isLoading) {
    return <p className="p-8 text-center text-sm text-muted-foreground">Loading user…</p>;
  }

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="-ml-2 mb-1 gap-1.5 text-muted-foreground">
        <ArrowLeft className="h-4 w-4" /> Back
      </Button>
      <PageHeader
        title={isEdit ? "Edit User" : "Create User"}
        description={isEdit ? "Update profile, role, status, and access." : "Add a new user, assign a role and access."}
      />

      <form onSubmit={handleSubmit(onSubmit)} className="max-w-2xl">
        <Card className="space-y-4 p-5">
          <div className="space-y-1.5">
            <Label>Name *</Label>
            <Input {...register("name")} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Email *</Label>
            <Input type="email" {...register("email")} />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Role *</Label>
              {/* key remounts the trigger once roles finish loading, so a pre-filled
                  value (e.g. an existing user's role) always shows its label. */}
              <Select key={`role-${roles.length}`} value={role} onValueChange={(v) => setValue("role", v as UserValues["role"])}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {roles
                    .filter((r) => r.key !== "super_admin" || iAmSuper || user?.role === "super_admin")
                    .map((r) => (
                      <SelectItem key={r.key} value={r.key} disabled={r.key === "super_admin" && !iAmSuper}>
                        {r.label}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status *</Label>
              <Select value={watch("status")} onValueChange={(v) => setValue("status", v as UserValues["status"])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>{isEdit ? "New Password (optional)" : "Temporary Password *"}</Label>
            <Input type="password" autoComplete="new-password" {...register("password")} />
            {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
          </div>

          {/* ── Brand & outlet access ─────────────────────────────────── */}
          {showScope ? (
            <div className="space-y-3 rounded-md border p-3">
              <p className="text-sm font-semibold">Brand &amp; Outlet Access</p>

              <div className="space-y-1.5">
                <Label>Brand access</Label>
                <Select value={brandScope} onValueChange={(v) => setBrandScope(v as BrandScopeUi)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DEFAULT">Default (role-based)</SelectItem>
                    <SelectItem value="ALL_BRANDS">All brands</SelectItem>
                    <SelectItem value="SELECTED_BRANDS">Specific brands</SelectItem>
                    <SelectItem value="ASSIGNED_BRAND">Single brand</SelectItem>
                  </SelectContent>
                </Select>
                {brandScope === "SELECTED_BRANDS" && (
                  <div className="mt-1 grid grid-cols-2 gap-1.5">
                    {activeBrands.map((b) => (
                      <label key={b.id} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={selectedBrandIds.includes(b.id)}
                          onCheckedChange={(c) => setSelectedBrandIds((l) => toggle(l, b.id, !!c))}
                        />
                        {b.name}
                      </label>
                    ))}
                  </div>
                )}
                {brandScope === "ASSIGNED_BRAND" && (
                  <Select value={assignedBrand} onValueChange={setAssignedBrand}>
                    <SelectTrigger><SelectValue placeholder="Select a brand" /></SelectTrigger>
                    <SelectContent>
                      {activeBrands.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="space-y-1.5">
                <Label>Outlet access</Label>
                <Select value={outletScope} onValueChange={(v) => setOutletScope(v as OutletScopeUi)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DEFAULT">Default (role-based)</SelectItem>
                    <SelectItem value="ALL_OUTLETS">All outlets</SelectItem>
                    <SelectItem value="ALL_OUTLETS_IN_BRAND">All outlets in their brand(s)</SelectItem>
                    <SelectItem value="SELECTED_OUTLETS">Specific outlets</SelectItem>
                    <SelectItem value="ASSIGNED_OUTLET">Single outlet</SelectItem>
                    <SelectItem value="NO_OUTLET_ACCESS">No outlet access</SelectItem>
                  </SelectContent>
                </Select>
                {outletScope === "SELECTED_OUTLETS" && (
                  <div className="mt-1 max-h-40 space-y-1.5 overflow-y-auto rounded border p-2">
                    {activeOutlets.map((o) => (
                      <label key={o.id} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={selectedOutletIds.includes(o.id)}
                          onCheckedChange={(c) => setSelectedOutletIds((l) => toggle(l, o.id, !!c))}
                        />
                        {o.name}
                      </label>
                    ))}
                  </div>
                )}
                {outletScope === "ASSIGNED_OUTLET" && (
                  <Select value={assignedOutlet} onValueChange={setAssignedOutlet}>
                    <SelectTrigger><SelectValue placeholder="Select an outlet" /></SelectTrigger>
                    <SelectContent>
                      {activeOutlets.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">
                "All outlets in their brand(s)" auto-includes future outlets under those brands.
                "Specific outlets" does not.
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50/60 p-3 text-sm text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200">
              <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-400" />
              Super Admins have full access to all brands and outlets — current and future.
            </div>
          )}

          {/* Data Import & Wastage grants — only a Super Admin may set them, and they're
              redundant for a Super Admin target (they always have access). */}
          {iAmSuper && role !== "super_admin" && (
            <label className="flex cursor-pointer items-start gap-2.5 rounded-md border p-3 text-sm">
              <Checkbox className="mt-0.5" checked={canImportGrant} onCheckedChange={(c) => setCanImportGrant(!!c)} />
              <span>
                <span className="font-medium">Allow access to Data Import</span>
                <span className="block text-[11px] text-muted-foreground">
                  Lets this user open the Import Data hub to bulk-import raw materials, recipes, prep and yields.
                </span>
              </span>
            </label>
          )}

          {iAmSuper && role !== "super_admin" && (
            <label className="flex cursor-pointer items-start gap-2.5 rounded-md border p-3 text-sm">
              <Checkbox className="mt-0.5" checked={canManageWastageGrant} onCheckedChange={(c) => setCanManageWastageGrant(!!c)} />
              <span>
                <span className="font-medium">Allow access to Wastage Management</span>
                <span className="block text-[11px] text-muted-foreground">
                  Lets this user open and use the Wastage Management page (record and edit wastage).
                </span>
              </span>
            </label>
          )}

          <div className="flex justify-end gap-2 border-t pt-4">
            <Button type="button" variant="outline" onClick={() => unsaved.guardClose(() => navigate("/users"))}>
              Cancel
            </Button>
            <Button type="submit" variant="accent" disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? "Save Changes" : "Create User"}
            </Button>
          </div>
        </Card>
      </form>

      <UnsavedChangesDialog
        open={unsaved.promptOpen}
        onContinueEditing={unsaved.continueEditing}
        onDiscard={unsaved.discardChanges}
        message="You have unsaved changes for this user. If you leave now, all entered information will be lost."
      />
    </>
  );
}
