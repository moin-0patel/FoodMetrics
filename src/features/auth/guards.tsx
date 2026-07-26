import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useSession } from "@/lib/auth/session";
import { can, isPendingApproval, type Capability } from "@/lib/auth/permissions";
import { PendingApprovalPage } from "./PendingApprovalPage";
import type { Role, User } from "@/lib/data/types";

/** Requires a logged-in (and admin-verified) user; otherwise redirect/gate. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const user = useSession((s) => s.user);
  const location = useLocation();
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  // Self sign-ups await admin verification before they can use the app.
  if (isPendingApproval(user)) {
    return <PendingApprovalPage />;
  }
  return <>{children}</>;
}

/** Requires one of the given built-in roles OR the given capability (so custom
 *  roles granted that capability get in too); otherwise bounce to the dashboard. */
export function RequireRole({
  roles,
  cap,
  allow,
  children,
}: {
  roles: Role[];
  cap?: Capability;
  /** Extra per-user predicate — lets a granted flag (not just a role/cap) allow in. */
  allow?: (user: User) => boolean;
  children: ReactNode;
}) {
  const user = useSession((s) => s.user);
  if (!user) return <Navigate to="/login" replace />;
  // Super Admin satisfies every requirement (it sits above Admin).
  const allowed =
    user.role === "super_admin" ||
    roles.includes(user.role) ||
    (cap ? can(user.role, cap) : false) ||
    (allow ? allow(user) : false);
  if (!allowed) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}
