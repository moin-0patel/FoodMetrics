import { useState } from "react";
import { Check, Minus, Pencil, Plus, ShieldCheck, Trash2, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/components/ui/use-toast";
import { ALL_CAPABILITIES, CAPABILITY_LABELS } from "@/lib/auth/permissions";
import type { RoleRecord } from "@/lib/data/types";
import { useRoles, useDeleteRole } from "./hooks";
import { RoleForm } from "./RoleForm";

/** Custom-role creator + effective-permission matrix. Rendered inside the User
 *  Management "Roles" tab (Super-Admin only; no PageHeader of its own).
 *  Built-in roles are protected/read-only; custom roles can be created, edited
 *  and deleted with their own tailored feature access. */
export function RolesPanel() {
  const { data: roles = [], isLoading } = useRoles();
  const deleteMut = useDeleteRole();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<RoleRecord | null>(null);
  const [toDelete, setToDelete] = useState<RoleRecord | null>(null);

  const openNew = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (role: RoleRecord) => {
    setEditing(role);
    setFormOpen(true);
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    try {
      await deleteMut.mutateAsync(toDelete.key);
      toast.success(`Deleted role "${toDelete.label}"`);
      setToDelete(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const capsByRole = new Map(roles.map((r) => [r.key, new Set(r.capabilities)]));

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Create custom roles with a tailored set of features. Built-in roles are protected.
        </p>
        <Button variant="accent" className="shrink-0" onClick={openNew}>
          <Plus className="h-4 w-4" /> New Role
        </Button>
      </div>

      <Card className="mb-4 flex items-center gap-3 border-emerald-200 bg-emerald-50/60 p-4">
        <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-700" />
        <p className="text-sm text-emerald-900">
          <span className="font-semibold">Built-in roles</span> are protected and read-only. Create a{" "}
          <span className="font-semibold">custom role</span> to grant a tailored set of features — user, role,
          brand &amp; outlet management stay reserved to Admin / Super Admin.
        </p>
      </Card>

      {isLoading ? (
        <Card>
          <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading roles…
          </div>
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-56">Permission</TableHead>
                {roles.map((r) => (
                  <TableHead key={r.key} className="text-center align-top">
                    <div className="flex flex-col items-center gap-1">
                      <span className="whitespace-nowrap">{r.label}</span>
                      {r.protected ? (
                        <Badge variant="success" className="text-[10px]">Protected</Badge>
                      ) : r.is_system ? (
                        <Badge variant="outline" className="text-[10px]">Built-in</Badge>
                      ) : (
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEdit(r)} title="Edit role">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-destructive"
                            onClick={() => setToDelete(r)}
                            title="Delete role"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {ALL_CAPABILITIES.map((cap) => (
                <TableRow key={cap}>
                  <TableCell className="font-medium">
                    {CAPABILITY_LABELS[cap]}
                    <span className="ml-2 text-[11px] text-muted-foreground">{cap}</span>
                  </TableCell>
                  {roles.map((r) => (
                    <TableCell key={r.key} className="text-center">
                      {r.key === "super_admin" || capsByRole.get(r.key)!.has(cap) ? (
                        <Check className="mx-auto h-4 w-4 text-emerald-600" />
                      ) : (
                        <Minus className="mx-auto h-4 w-4 text-muted-foreground/40" />
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <RoleForm open={formOpen} onOpenChange={setFormOpen} role={editing} />

      <Dialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete role?</DialogTitle>
            <DialogDescription>
              This permanently deletes the custom role <span className="font-semibold">{toDelete?.label}</span>.
              Roles currently assigned to users can't be deleted — reassign those users first.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setToDelete(null)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleteMut.isPending}>
              {deleteMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Delete Role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
