import { OperationsDashboard } from "./OperationsDashboard";
import { SimpleDashboard } from "./SimpleDashboard";
import { useDashboardBrand } from "./brandTheme";
import { useSession } from "@/lib/auth/session";
import { canViewMasterDashboard } from "@/lib/auth/permissions";

// Admins (and anyone an admin grants dashboard access) see the Operations
// dashboard with full cost stats. Everyone else — viewers and users without
// access — sees the plain overview dashboard (no cost figures). The header brand
// toggle re-scopes either view: All = every brand, else one brand.
export function DashboardPage() {
  const brand = useDashboardBrand((s) => s.brand);
  const user = useSession((s) => s.user);
  return canViewMasterDashboard(user) ? (
    <OperationsDashboard brand={brand} />
  ) : (
    <SimpleDashboard brand={brand} />
  );
}
