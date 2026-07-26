import { lazy, Suspense, type ReactNode } from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { AppLayout } from "@/layouts/AppLayout";
import { RequireAuth, RequireRole } from "@/features/auth/guards";
import { canImport, canManageWastage } from "@/lib/auth/permissions";
// Auth shell stays eager (small, first paint); everything else is code-split.
import { LoginPage } from "@/features/auth/LoginPage";
import { ForgotPasswordPage } from "@/features/auth/ForgotPasswordPage";
import { ResetPasswordPage } from "@/features/auth/ResetPasswordPage";
import { SignUpPage } from "@/features/auth/SignUpPage";
import { Splash } from "@/components/Splash";
import { useSession } from "@/lib/auth/session";

// Code-split app pages — each becomes its own chunk, kept out of the initial bundle.
const DashboardPage = lazy(() => import("@/features/dashboard/DashboardPage").then((m) => ({ default: m.DashboardPage })));
const MaterialsPage = lazy(() => import("@/features/raw-materials/MaterialsPage").then((m) => ({ default: m.MaterialsPage })));
const MaterialEditorPage = lazy(() => import("@/features/raw-materials/MaterialEditorPage").then((m) => ({ default: m.MaterialEditorPage })));
const RecipesPage = lazy(() => import("@/features/recipes/RecipesPage").then((m) => ({ default: m.RecipesPage })));
const YieldPage = lazy(() => import("@/features/yield/YieldPage").then((m) => ({ default: m.YieldPage })));
const WastagePage = lazy(() => import("@/features/wastage/WastagePage").then((m) => ({ default: m.WastagePage })));
const RecipeEditorPage = lazy(() => import("@/features/recipes/RecipeEditorPage").then((m) => ({ default: m.RecipeEditorPage })));
const RecipeDetailPage = lazy(() => import("@/features/recipes/RecipeDetailPage").then((m) => ({ default: m.RecipeDetailPage })));
const ApprovalsPage = lazy(() => import("@/features/approvals/ApprovalsPage").then((m) => ({ default: m.ApprovalsPage })));
const ReportsPage = lazy(() => import("@/features/reports/ReportsPage").then((m) => ({ default: m.ReportsPage })));
const UsersPage = lazy(() => import("@/features/users/UsersPage").then((m) => ({ default: m.UsersPage })));
const UserEditorPage = lazy(() => import("@/features/users/UserEditorPage").then((m) => ({ default: m.UserEditorPage })));
const AuditPage = lazy(() => import("@/features/audit/AuditPage").then((m) => ({ default: m.AuditPage })));
const ProfilePage = lazy(() => import("@/features/profile/ProfilePage").then((m) => ({ default: m.ProfilePage })));
const BrandsOutletsPage = lazy(() => import("@/features/brands/BrandsOutletsPage").then((m) => ({ default: m.BrandsOutletsPage })));
const BrandEditorPage = lazy(() => import("@/features/brands/BrandEditorPage").then((m) => ({ default: m.BrandEditorPage })));
const PackagingMasterPage = lazy(() => import("@/features/packaging/PackagingMasterPage").then((m) => ({ default: m.PackagingMasterPage })));
const ImportDataPage = lazy(() => import("@/features/data-import/ImportDataPage").then((m) => ({ default: m.ImportDataPage })));
const SharedRecipePage = lazy(() => import("@/features/share/SharedRecipePage").then((m) => ({ default: m.SharedRecipePage })));
// Public marketing landing page (code-split; the app's public entry point at "/").
const LandingPage = lazy(() => import("@/features/marketing/LandingPage").then((m) => ({ default: m.LandingPage })));

/** Suspense wrapper for code-split PUBLIC routes (the app shell has its own). */
function PublicRoute({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[100dvh] items-center justify-center bg-background">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      {children}
    </Suspense>
  );
}

/**
 * True when running as the installed app (PWA / Android TWA), not a browser tab.
 * TWAs don't reliably report a single signal, so we OR several — the launch-URL
 * marker (`?app=1`, set on the manifest start_url), display-mode variants, the iOS
 * flag, and the TWA referrer — and remember the result (a TWA's referrer only marks
 * the FIRST launch, so we persist it for later cold starts).
 */
function isInstalledApp(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const KEY = "cc_app_mode";
    if (localStorage.getItem(KEY) === "1") return true;
    const mm = (q: string) => window.matchMedia?.(q).matches === true;
    const installed =
      new URLSearchParams(window.location.search).get("app") === "1" ||
      mm("(display-mode: standalone)") ||
      mm("(display-mode: fullscreen)") ||
      mm("(display-mode: minimal-ui)") ||
      (window.navigator as { standalone?: boolean }).standalone === true ||
      document.referrer.startsWith("android-app://");
    if (installed) localStorage.setItem(KEY, "1");
    return installed;
  } catch {
    return false;
  }
}

/**
 * Entry at "/". In a browser: the marketing landing page (unchanged). In the
 * installed app: a branded splash until auth resolves, then straight to the
 * dashboard (signed in) or login (signed out) — the landing page is skipped.
 */
function RootEntry() {
  const user = useSession((s) => s.user);
  const authReady = useSession((s) => s.authReady);
  if (!isInstalledApp()) {
    return <PublicRoute><LandingPage /></PublicRoute>;
  }
  if (!authReady) return <Splash />;
  return <Navigate to={user ? "/dashboard" : "/login"} replace />;
}

export const router = createBrowserRouter([
  // "/" → marketing landing (web) or splash→login/dashboard (installed app).
  { path: "/", element: <RootEntry /> },
  { path: "/login", element: <LoginPage /> },
  { path: "/signup", element: <SignUpPage /> },
  { path: "/forgot-password", element: <ForgotPasswordPage /> },
  { path: "/reset-password", element: <ResetPasswordPage /> },
  // Public, read-only shared recipe — no auth guard, no app chrome.
  { path: "/share/:token", element: <SharedRecipePage /> },
  {
    // Pathless layout route — its children resolve to absolute paths
    // (/dashboard, /materials, …). "/" itself is the public landing page above.
    element: (
      <RequireAuth>
        <AppLayout />
      </RequireAuth>
    ),
    children: [
      { path: "dashboard", element: <DashboardPage /> },
      { path: "profile", element: <ProfilePage /> },
      {
        path: "materials",
        element: (
          <RequireRole roles={["admin", "editor", "head_chef"]} cap="material.view">
            <MaterialsPage />
          </RequireRole>
        ),
      },
      {
        path: "materials/new",
        element: (
          <RequireRole roles={["admin", "editor", "head_chef"]} cap="material.edit">
            <MaterialEditorPage />
          </RequireRole>
        ),
      },
      {
        path: "materials/:id/edit",
        element: (
          <RequireRole roles={["admin", "editor", "head_chef"]} cap="material.edit">
            <MaterialEditorPage />
          </RequireRole>
        ),
      },
      {
        path: "packaging",
        element: (
          <RequireRole roles={["admin", "editor", "head_chef"]} cap="packaging.view">
            <PackagingMasterPage />
          </RequireRole>
        ),
      },
      { path: "recipes", element: <RecipesPage /> },
      {
        path: "yield",
        element: (
          <RequireRole roles={["admin", "editor", "head_chef"]} cap="yield.manage">
            <YieldPage />
          </RequireRole>
        ),
      },
      {
        path: "wastage",
        element: (
          <RequireRole roles={["super_admin"]} allow={canManageWastage}>
            <WastagePage />
          </RequireRole>
        ),
      },
      {
        path: "prep",
        element: (
          <RequireRole roles={["admin", "editor", "head_chef"]} cap="recipe.editAll">
            <RecipesPage prepMode />
          </RequireRole>
        ),
      },
      {
        path: "recipes/new",
        element: (
          <RequireRole roles={["admin", "editor", "head_chef"]} cap="recipe.editAll">
            <RecipeEditorPage />
          </RequireRole>
        ),
      },
      {
        path: "recipes/:id/edit",
        element: (
          <RequireRole roles={["admin", "editor", "head_chef"]} cap="recipe.editAll">
            <RecipeEditorPage />
          </RequireRole>
        ),
      },
      { path: "recipes/:id", element: <RecipeDetailPage /> },
      {
        path: "approvals",
        element: (
          <RequireRole roles={["admin"]} cap="recipe.approve">
            <ApprovalsPage />
          </RequireRole>
        ),
      },
      {
        path: "reports",
        element: (
          <RequireRole roles={["admin", "editor", "head_chef"]} cap="report.excel">
            <ReportsPage />
          </RequireRole>
        ),
      },
      {
        path: "users",
        element: (
          <RequireRole roles={["admin"]} cap="user.manage">
            <UsersPage />
          </RequireRole>
        ),
      },
      {
        path: "users/new",
        element: (
          <RequireRole roles={["admin"]} cap="user.manage">
            <UserEditorPage />
          </RequireRole>
        ),
      },
      {
        path: "users/:id/edit",
        element: (
          <RequireRole roles={["admin"]} cap="user.manage">
            <UserEditorPage />
          </RequireRole>
        ),
      },
      {
        path: "audit",
        element: (
          <RequireRole roles={["admin"]} cap="audit.view">
            <AuditPage />
          </RequireRole>
        ),
      },
      // Export History + Access History now live as tabs inside Reports (/reports);
      // their old standalone routes are gone (stale links fall through to /dashboard).
      // Roles & Permissions and Viewer Access now live as tabs inside User
      // Management (/users). Their old standalone routes are intentionally gone;
      // the catch-all below redirects any stale links to /dashboard.
      // "Brands & Outlets" management has been removed. The old /brands route is
      // intentionally gone; the catch-all below redirects it to /dashboard.
      {
        // Data import hub — Super Admins, plus any user a Super Admin grants
        // Data Import access (can_import).
        path: "import-data",
        element: (
          <RequireRole roles={["super_admin"]} allow={canImport}>
            <ImportDataPage />
          </RequireRole>
        ),
      },
      {
        // Brands & Outlets master-data management — Super Admin only.
        path: "brands",
        element: (
          <RequireRole roles={["super_admin"]}>
            <BrandsOutletsPage />
          </RequireRole>
        ),
      },
      {
        path: "brands/new",
        element: (
          <RequireRole roles={["super_admin"]}>
            <BrandEditorPage />
          </RequireRole>
        ),
      },
      {
        path: "brands/:id/edit",
        element: (
          <RequireRole roles={["super_admin"]}>
            <BrandEditorPage />
          </RequireRole>
        ),
      },
      {
        // The old global cost-config Settings page has been removed. "Settings" now
        // opens the user's Profile Settings (the same page as /profile) — every
        // authenticated user manages their own account, so there is no admin gate.
        path: "settings",
        element: <ProfilePage />,
      },
    ],
  },
  { path: "*", element: <Navigate to="/dashboard" replace /> },
]);
