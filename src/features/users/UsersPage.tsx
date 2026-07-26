import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BadgeCheck, Clock, KeyRound, LayoutDashboard, Mail, MoreVertical, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatTile } from "@/components/StatTile";
import { EmptyState } from "@/components/EmptyState";
import { TableSkeleton } from "@/components/TableSkeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/use-toast";
import { type User } from "@/lib/data/types";
import { roleLabel } from "@/lib/auth/roleCache";
import { useSession } from "@/lib/auth/session";
import { useRoles } from "@/features/roles/hooks";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { sendPasswordReset } from "@/lib/supabase/profile";
import { useDeleteUser, useUpdateUser, useUsers } from "./hooks";
import { AssignAccessDialog } from "@/features/viewers/AssignAccessDialog";
import { ViewerAccessPanel } from "@/features/viewers/ViewerAccessPanel";
import { RolesPanel } from "@/features/roles/RolesPanel";

const fmtDate = (iso?: string | null) => {
  if (!iso) return "Never";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
};

export function UsersPage() {
  const { data: users = [], isLoading } = useUsers();
  const { data: roles = [] } = useRoles();
  const updateMut = useUpdateUser();
  const delUser = useDeleteUser();
  const me = useSession((s) => s.user);
  const isSuperAdmin = me?.role === "super_admin";
  const [deletingUser, setDeletingUser] = useState<User | null>(null);

  const [search, setSearch] = useState("");
  const [role, setRole] = useState("all");
  const [status, setStatus] = useState("all");

  const navigate = useNavigate();
  const [assignFor, setAssignFor] = useState<User | null>(null);

  const filtered = useMemo(
    () =>
      users.filter((u) => {
        if (search && !`${u.name} ${u.email}`.toLowerCase().includes(search.toLowerCase()))
          return false;
        if (role !== "all" && u.role !== role) return false;
        if (status === "pending") {
          if (u.approved !== false) return false;
        } else if (status !== "all" && u.status !== status) return false;
        return true;
      }),
    [users, search, role, status],
  );

  const [deactivating, setDeactivating] = useState<User | null>(null);

  const setUserStatus = async (u: User, next: "active" | "inactive") => {
    try {
      await updateMut.mutateAsync({ id: u.id, patch: { status: next } });
      toast.success(next === "inactive" ? "User deactivated" : "User reactivated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    }
  };

  const sendReset = async (u: User) => {
    try {
      await sendPasswordReset(u.email);
      toast.success(`Password reset email sent to ${u.email}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send reset email");
    }
  };

  const toggleDashboard = async (u: User) => {
    try {
      await updateMut.mutateAsync({ id: u.id, patch: { dashboard_access: !u.dashboard_access } });
      toast.success(u.dashboard_access ? "Dashboard access revoked" : "Dashboard access granted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    }
  };

  const approveUser = async (u: User) => {
    try {
      await updateMut.mutateAsync({ id: u.id, patch: { approved: true } });
      toast.success(`${u.name} verified — they can now sign in`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    }
  };

  const pendingCount = users.filter((u) => u.approved === false).length;

  // Account readings, straight from the loaded user list.
  const accountStats = useMemo(() => {
    const total = users.length;
    const active = users.filter((u) => u.status === "active" && u.approved !== false).length;
    const byRole = new Map<string, number>();
    for (const u of users) byRole.set(u.role, (byRole.get(u.role) ?? 0) + 1);
    return {
      total,
      active,
      inactive: users.filter((u) => u.status === "inactive").length,
      pending: pendingCount,
      superAdmins: byRole.get("super_admin") ?? 0,
      admins: byRole.get("admin") ?? 0,
    };
  }, [users, pendingCount]);

  return (
    <>
      <PageHeader
        eyebrow="Access Control"
        title="User Management"
        description="Manage accounts, roles, verification, viewer access and custom roles"
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Total Users"
          value={isLoading ? "—" : String(accountStats.total)}
          valueTone="accent"
          emptyHint={`${accountStats.superAdmins} super admin · ${accountStats.admins} admin`}
        />
        <StatTile
          label="Active Accounts"
          value={isLoading ? "—" : String(accountStats.active)}
          tone="good"
          progress={accountStats.total === 0 ? null : (accountStats.active / accountStats.total) * 100}
          emptyHint={accountStats.total === 0 ? "No accounts yet" : undefined}
        />
        <StatTile
          label="Awaiting Verification"
          value={isLoading ? "—" : String(accountStats.pending)}
          valueTone={accountStats.pending > 0 ? "warning" : "good"}
          emptyHint={
            accountStats.pending > 0 ? "These users cannot sign in yet" : "Everyone is verified"
          }
        />
        <StatTile
          label="Deactivated"
          value={isLoading ? "—" : String(accountStats.inactive)}
          valueTone={accountStats.inactive > 0 ? "bad" : "neutral"}
          emptyHint={accountStats.inactive === 0 ? "No deactivated accounts" : "Cannot sign in"}
        />
      </div>

      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="viewer-access">Viewer Access</TabsTrigger>
          {isSuperAdmin && <TabsTrigger value="roles">Roles</TabsTrigger>}
        </TabsList>

        <TabsContent value="users">
          <div className="mb-4 flex justify-end">
            <Button variant="accent" onClick={() => navigate("/users/new")}>
              <Plus className="h-4 w-4" /> Create User
            </Button>
          </div>

      {pendingCount > 0 && (
        <button
          onClick={() => setStatus("pending")}
          className="mb-4 flex w-full items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-left text-sm text-amber-700 dark:text-amber-400"
        >
          <Clock className="h-4 w-4 shrink-0" />
          <span className="font-medium">
            {pendingCount} {pendingCount === 1 ? "user is" : "users are"} awaiting verification.
          </span>
          <span className="text-amber-700/70 dark:text-amber-400/70">Review &amp; approve →</span>
        </button>
      )}

      <Card className="mb-4 p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Input placeholder="Search users…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Select value={role} onValueChange={setRole}>
            <SelectTrigger>
              <SelectValue placeholder="Role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              {roles.map((r) => (
                <SelectItem key={r.key} value={r.key}>{r.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending">Pending Verification</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card>
        {isLoading ? (
          <TableSkeleton rows={5} cols={4} />
        ) : filtered.length === 0 ? (
          <EmptyState title="No users found" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Account</TableHead>
                <TableHead className="hidden md:table-cell">Last Login</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((u) => {
                return (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      {u.email}
                      {u.email_verified && (
                        <BadgeCheck className="h-3.5 w-3.5 text-emerald-500" aria-label="Email verified" />
                      )}
                    </div>
                    {u.id && (
                      <span className="block font-mono text-[10px] text-muted-foreground/70" title={u.id}>
                        ID {u.id.slice(0, 12)}…
                      </span>
                    )}
                  </TableCell>
                  <TableCell>{roleLabel(u.role)}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-1">
                      {u.approved === false ? (
                        <Badge variant="outline" className="gap-1 border-amber-500/50 text-amber-600 dark:text-amber-400">
                          <Clock className="h-3 w-3" /> Pending
                        </Badge>
                      ) : (
                        <Badge variant={u.status === "active" ? "success" : "secondary"}>
                          {u.status}
                        </Badge>
                      )}
                      {(u.role === "admin" || u.dashboard_access) && (
                        <Badge variant="outline" className="gap-1" title="Can view Master Costing dashboard">
                          <LayoutDashboard className="h-3 w-3" /> Costing
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">
                    {fmtDate(u.last_login)}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {u.approved === false && (
                          <DropdownMenuItem onClick={() => approveUser(u)} className="text-emerald-600 dark:text-emerald-400">
                            <BadgeCheck className="h-4 w-4" /> Verify &amp; Approve
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => navigate(`/users/${u.id}/edit`)}>
                          Edit
                        </DropdownMenuItem>
                        {u.role === "viewer" && (
                          <DropdownMenuItem onClick={() => setAssignFor(u)}>
                            <KeyRound className="h-4 w-4" /> Assign Recipe Access
                          </DropdownMenuItem>
                        )}
                        {u.role !== "admin" && (
                          <DropdownMenuItem onClick={() => toggleDashboard(u)}>
                            <LayoutDashboard className="h-4 w-4" />
                            {u.dashboard_access ? "Revoke dashboard access" : "Grant dashboard access"}
                          </DropdownMenuItem>
                        )}
                        {isSupabaseConfigured && (
                          <DropdownMenuItem onClick={() => sendReset(u)}>
                            <Mail className="h-4 w-4" /> Send Password Reset
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={() =>
                            u.status === "active" ? setDeactivating(u) : setUserStatus(u, "active")
                          }
                        >
                          {u.status === "active" ? "Deactivate" : "Reactivate"}
                        </DropdownMenuItem>
                        {me && u.id !== me.id && (u.role !== "super_admin" || me.role === "super_admin") && (
                          <DropdownMenuItem
                            onClick={() => setDeletingUser(u)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" /> Delete User
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>
        </TabsContent>

        <TabsContent value="viewer-access">
          <ViewerAccessPanel />
        </TabsContent>

        {isSuperAdmin && (
          <TabsContent value="roles">
            <RolesPanel />
          </TabsContent>
        )}
      </Tabs>

      <AssignAccessDialog
        user={assignFor}
        open={!!assignFor}
        onOpenChange={(o) => !o && setAssignFor(null)}
      />
      <ConfirmDialog
        open={!!deactivating}
        onOpenChange={(o) => !o && setDeactivating(null)}
        title={`Deactivate ${deactivating?.name}?`}
        description="They'll lose access until reactivated. Their data is kept."
        confirmLabel="Deactivate"
        destructive
        onConfirm={() => deactivating && setUserStatus(deactivating, "inactive")}
      />
      <ConfirmDialog
        open={!!deletingUser}
        onOpenChange={(o) => !o && setDeletingUser(null)}
        title={`Delete ${deletingUser?.name}?`}
        description={
          isSupabaseConfigured
            ? "Permanently removes this user's account and profile. This can't be undone. (Requires the delete-user Edge Function to be deployed.)"
            : "Permanently removes this user. This can't be undone."
        }
        confirmLabel="Delete User"
        destructive
        onConfirm={async () => {
          if (!deletingUser) return;
          try {
            await delUser.mutateAsync(deletingUser.id);
            toast.success("User deleted");
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Delete failed");
          } finally {
            setDeletingUser(null);
          }
        }}
      />
    </>
  );
}
