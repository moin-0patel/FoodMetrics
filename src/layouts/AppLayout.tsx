import { Suspense, useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  Loader2,
  Menu,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Sun,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo, BrandMark } from "@/components/brand/Logo";
import { useSession } from "@/lib/auth/session";
import { useTheme } from "@/lib/theme";
import { usePrefs } from "@/lib/prefs";
import { navGroupsForUser } from "./nav";
import { useUsers } from "@/features/users/hooks";
import { GlobalSearch } from "./GlobalSearch";
import { OutletPicker } from "./OutletPicker";
import { Button } from "@/components/ui/button";
import { useDashboardBrand, applyBrand, brandBgClass, brandAccentText, brandWordmark } from "@/features/dashboard/brandTheme";
import { BrandFilter } from "@/features/dashboard/BrandFilter";
import { ProfileMenu } from "./HeaderControls";
import { useBrands } from "@/features/brands/hooks";
import { useRoles } from "@/features/roles/hooks";
import { primeBrandCache } from "@/lib/data/brandCache";
import { primeRoleCache, roleLabel } from "@/lib/auth/roleCache";

export function AppLayout() {
  const user = useSession((s) => s.user);
  const { dark, toggle } = useTheme();
  const brand = useDashboardBrand((s) => s.brand);
  const setBrand = useDashboardBrand((s) => s.setBrand);
  const { data: brandRecords = [] } = useBrands();
  const { data: roleRecords = [] } = useRoles();
  // Prime the role cache synchronously in render (not just an effect) so nav +
  // route guards see custom-role capabilities on the same render the roles load.
  primeRoleCache(roleRecords);
  const [mobileOpen, setMobileOpen] = useState(false);
  const collapsed = usePrefs((s) => s.sidebarCollapsed);
  const toggleSidebar = usePrefs((s) => s.toggleSidebar);
  const location = useLocation();
  const isAdmin = user?.role === "admin";
  const { data: allUsers = [] } = useUsers();
  const pendingUsers = isAdmin ? allUsers.filter((u) => u.approved === false).length : 0;

  // Prime the brand cache (label/accent lookups) and re-theme the whole app to the
  // active brand. Re-runs when brands load so a newly-added brand's accent applies.
  useEffect(() => {
    primeBrandCache(brandRecords);
    applyBrand(brand);
  }, [brand, brandRecords]);

  // On logout the shell unmounts — drop the brand class so the auth pages fall
  // back to the neutral -blue base instead of a stale brand accent.
  useEffect(() => {
    return () => {
      document.documentElement.classList.remove("brand-all");
    };
  }, []);

  if (!user) return null;
  const groups = navGroupsForUser(user);

  // `rail` collapses the desktop sidebar to icons only. The mobile drawer always
  // shows the full sidebar (rail=false).
  const sidebar = (rail: boolean) => (
    <div className="flex h-full flex-col">
      <div
        className={cn(
          "flex h-14 items-center border-b border-black/5 px-4",
          rail && "justify-center px-2",
        )}
      >
        {rail ? <BrandMark size="sm" /> : <Logo size="sm" />}
      </div>
      <nav className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {groups.map(({ group, items }) => (
          <div key={group} className="space-y-1">
            {!rail && (
              <p className="px-3 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                {group}
              </p>
            )}
            {items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setMobileOpen(false)}
                title={rail ? item.label : undefined}
                className={({ isActive }) =>
                  cn(
                    "relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    rail && "justify-center px-2",
                    isActive
                      ? // Theme-aware active state: primary tint + left indicator, so the
                        // chosen brand accent theme is always visible.
                        "border-l-2 border-primary bg-primary/10 font-semibold text-foreground"
                      : "border-l-2 border-transparent text-muted-foreground hover:bg-black/5 hover:text-foreground dark:hover:bg-white/10",
                  )
                }
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {!rail && item.label}
                {item.to === "/users" && pendingUsers > 0 && (
                  <span
                    className={cn(
                      "rounded-full bg-amber-500 font-bold text-white",
                      rail
                        ? "absolute right-1 top-1 h-2 w-2"
                        : "ml-auto min-w-5 px-1.5 py-0.5 text-center text-[10px] leading-none",
                    )}
                    title={`${pendingUsers} awaiting verification`}
                  >
                    {!rail && pendingUsers}
                  </span>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
      {!rail && (
        <div className="border-t border-black/5 p-3">
          <div className="px-1">
            <p className="truncate text-sm font-medium">{user.name}</p>
            <p className="text-xs text-muted-foreground">{roleLabel(user.role)}</p>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div
      className={cn(
        // 100dvh (not 100vh) so mobile browser chrome / display scaling never
        // clips the shell; overflow-hidden keeps scrolling inside main + sidebar.
        "flex h-[100dvh] overflow-hidden transition-colors duration-300",
        // Soft brand tint fills the screen in light mode; neutral in dark.
        dark ? "bg-background" : brandBgClass(brand),
      )}
    >
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden shrink-0 border-r transition-[width] duration-200 md:block",
          collapsed ? "w-16" : "w-60",
          dark ? "border-border bg-background" : "border-black/5 bg-white/50",
        )}
      >
        {sidebar(collapsed)}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 animate-fade-in bg-black/50"
            onClick={() => setMobileOpen(false)}
          />
          <aside
            className={cn(
              "absolute left-0 top-0 flex h-full w-72 max-w-[85vw] animate-slide-in-left flex-col shadow-xl",
              dark ? "bg-background" : "bg-white",
            )}
          >
            <div className="shrink-0 border-b p-3">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Brand</p>
              <BrandFilter value={brand} onChange={(b) => setBrand(b)} className="w-full" />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">{sidebar(false)}</div>
          </aside>
        </div>
      )}

      <div className="flex flex-1 flex-col overflow-hidden">
        <header
          className={cn(
            "sticky top-0 z-30 flex h-14 items-center gap-1 border-b px-3 sm:px-4",
            dark ? "border-border bg-background" : "border-black/5 bg-white/70 backdrop-blur",
          )}
        >
          {/* Mobile: open drawer. Desktop: collapse rail. */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Toggle navigation"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="hidden md:inline-flex"
            onClick={toggleSidebar}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
          </Button>

          {/* Global catalog search — recipes, preps, ingredients, packaging. */}
          <GlobalSearch className="ml-1 hidden w-full max-w-xs md:block lg:max-w-sm" />

          <div className="flex-1" />

          {/* Mobile: brand chip (tap to open the drawer, which holds the selector). */}
          <button
            onClick={() => setMobileOpen(true)}
            className={cn(
              "mr-1 rounded-full border px-2.5 py-1 text-xs font-bold uppercase tracking-wide sm:hidden",
              brandAccentText(brand),
            )}
            aria-label={`Brand ${brandWordmark(brand)} — tap to change`}
          >
            {brandWordmark(brand)}
          </button>
          <OutletPicker className="mr-1.5" />
          <div className="mr-1 hidden max-w-[min(46vw,560px)] overflow-x-auto sm:block">
            <BrandFilter value={brand} onChange={setBrand} />
          </div>
          <Button variant="ghost" size="icon" onClick={toggle} title="Toggle light/dark" aria-label="Toggle light/dark">
            {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>
          <ProfileMenu />
        </header>

        <main className="relative flex-1 overflow-y-auto p-3 transition-colors sm:p-4 lg:p-6">
          {/* Brand wordmark watermark behind the content — sized to fit the width */}
          {!dark && (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 z-0 flex h-[70vh] items-center justify-center overflow-hidden"
            >
              <span
                className={cn("select-none whitespace-nowrap font-black leading-none tracking-tighter opacity-[0.05]", brandAccentText(brand))}
                style={{ fontSize: `${Math.min(22, 92 / brandWordmark(brand).length)}vw` }}
              >
                {brandWordmark(brand)}
              </span>
            </div>
          )}
          {/* Keyed on the route so each navigation replays the entrance animation. */}
          <div key={location.pathname} className="relative z-10 animate-fade-in-up">
            <Suspense
              fallback={
                <div className="flex items-center justify-center py-24 text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              }
            >
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>

    </div>
  );
}
