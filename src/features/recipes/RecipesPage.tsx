import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronDown,
  Copy,
  FileDown,
  MoreVertical,
  Pencil,
  Plus,
  AlertTriangle,
  TrendingDown,
  Boxes,
  ClipboardCheck,
  Percent,
  Trash2,
  Archive,
  ArchiveRestore,
  LayoutGrid,
  Rows3,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatTile } from "@/components/StatTile";
import { RecipeCard } from "./RecipeCard";
import { EmptyState } from "@/components/EmptyState";
import { TableSkeleton } from "@/components/TableSkeleton";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { cn, formatDateTime, formatINR, formatQuantityWithUnit, formatWeight } from "@/lib/utils";
import { useSession } from "@/lib/auth/session";
import { can, canEditRecipe, viewerBrands, viewerShowCost } from "@/lib/auth/permissions";
import type { Recipe } from "@/lib/data/types";
import { toast } from "@/components/ui/use-toast";
import { useRecipeCategories, useAllSettings } from "@/features/settings/hooks";
import { useMaterials } from "@/features/raw-materials/hooks";
import { useUsersMap } from "@/features/users/hooks";
import { useDashboardBrand } from "@/features/dashboard/brandTheme";
import { useBrands } from "@/features/brands/hooks";
import { useArchiveRecipe, useDeleteRecipe, useDuplicateRecipe, useRecipe, useRecipes, useUnarchiveRecipe } from "./hooks";
import {
  FC_TONE_STYLES,
  fcTone,
  foodCostPctOf,
  foodCostNoPackagingPct,
  hasMenuPrice,
  menuPriceOf,
  profitMarginOf,
} from "./recipeMetrics";
import { Pagination } from "@/components/Pagination";

const PAGE_SIZE = 10;

const CATEGORY_EMOJI: Record<string, string> = {
  Pasta: "🍝",
  Rice: "🍚",
  Dessert: "🍰",
  Beverage: "🍵",
  Protein: "🍗",
};
const emojiFor = (category: string) => CATEGORY_EMOJI[category] ?? "🍽️";

export function RecipesPage({ prepMode = false }: { prepMode?: boolean } = {}) {
  const user = useSession((s) => s.user)!;
  const navigate = useNavigate();
  const { data: allRecipes = [], isLoading } = useRecipes();
  const { data: brandList = [] } = useBrands();
  const allBrandIds = useMemo(() => brandList.map((b) => b.id), [brandList]);
  const globalBrand = useDashboardBrand((s) => s.brand);
  const canSeeCost = user.role !== "viewer" || viewerShowCost(user);
  const recipes = useMemo(() => {
    // Exclude size variants — a pizza shows once as its master (§14).
    let base = allRecipes.filter((r) => (prepMode ? r.is_prep : !r.is_prep) && !r.parent_recipe_id);
    // In-House Prep is COMMON across brands (shared sub-recipes) — never brand-filtered.
    // Only menu recipes are brand-specific.
    if (!prepMode) {
      if (user.role === "viewer") {
        const brands = viewerBrands(user, allBrandIds);
        base = base.filter((r) => r.status === "approved" && brands.includes(r.brand));
      } else if (globalBrand !== "all") {
        base = base.filter((r) => r.brand === globalBrand);
      }
    }
    // Collapse name-variant families (Baby/Mid/Prime Hulk) to ONE entry — the
    // variant switcher on the detail page reaches the others. Prefer the flagship.
    const QUAL = /\b(Prime|Mid|Baby|Mini|Small|Large|Regular|Classic|Special|Jumbo)\b/i;
    const baseKey = (r: (typeof base)[number]) =>
      r.brand + "|" + r.recipe_name.replace(QUAL, "").replace(/\s+/g, " ").trim().toLowerCase();
    const famCount = new Map<string, number>();
    for (const r of base) if (QUAL.test(r.recipe_name)) famCount.set(baseKey(r), (famCount.get(baseKey(r)) ?? 0) + 1);
    const repAt = new Map<string, number>();
    const collapsed: typeof base = [];
    for (const r of base) {
      if (!QUAL.test(r.recipe_name) || (famCount.get(baseKey(r)) ?? 0) < 2) { collapsed.push(r); continue; }
      const k = baseKey(r);
      if (!repAt.has(k)) { repAt.set(k, collapsed.length); collapsed.push(r); }
      else if (/\bprime\b/i.test(r.recipe_name) && !/\bprime\b/i.test(collapsed[repAt.get(k)!].recipe_name)) {
        collapsed[repAt.get(k)!] = r; // promote the flagship as the family's single entry
      }
    }
    // Show the FAMILY name on the collapsed entry (e.g. "Prime Hulk Pizza" → "Hulk
    // Pizza"); the Prime/Mid/Baby tiers are the variant switcher on the detail page.
    for (const idx of repAt.values()) {
      const r = collapsed[idx];
      collapsed[idx] = { ...r, recipe_name: r.recipe_name.replace(QUAL, "").replace(/\s+/g, " ").trim() };
    }
    return collapsed;
  }, [allRecipes, prepMode, user, globalBrand, allBrandIds]);

  // Available size labels per master recipe (master + its variants), e.g. ["11-inch","15-inch"].
  const sizesByMaster = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const r of allRecipes) {
      if (!r.size_label) continue;
      const masterId = r.parent_recipe_id ?? r.id;
      const list = m.get(masterId) ?? [];
      if (!list.includes(r.size_label)) list.push(r.size_label);
      m.set(masterId, list.sort());
    }
    return m;
  }, [allRecipes]);
  const { data: categories = [] } = useRecipeCategories();
  const { data: settings = [] } = useAllSettings();
  const { data: materials = [] } = useMaterials();
  const { map: usersMap } = useUsersMap();
  const dupMut = useDuplicateRecipe();
  const delMut = useDeleteRecipe();
  const archiveMut = useArchiveRecipe();
  const unarchiveMut = useUnarchiveRecipe();
  const canDelete = can(user.role, "recipe.delete");
  // Archiving is a reversible retire, offered to the same audience that can delete.
  const canArchive = canDelete;
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const pendingDelete = allRecipes.find((r) => r.id === deletingId) ?? null;
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const pendingArchive = allRecipes.find((r) => r.id === archivingId) ?? null;

  const unarchive = async (id: string) => {
    try {
      await unarchiveMut.mutateAsync(id);
      toast.success("Recipe restored");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Restore failed");
    }
  };

  // "Updated by" attribution is for staff roles, not external viewers.
  const showUpdatedBy = user.role !== "viewer";

  const criticalPct = Number(
    settings.find((s) => s.key === "margin_alert_pct")?.value ?? 35,
  );

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");
  const [fcRange, setFcRange] = useState("all");
  const [creator, setCreator] = useState("all");
  const [creatorSort, setCreatorSort] = useState<"none" | "az" | "za">("none");
  const creators = useMemo(
    () => [...new Set(allRecipes.map((r) => r.created_by_name).filter((c): c is string => !!c))].sort((a, b) => a.localeCompare(b)),
    [allRecipes],
  );
  const [page, setPage] = useState(1);

  // §13: clear stale filters when the global brand changes, so one brand's category
  // (e.g. Pizza) never persists into another brand after switching.
  useEffect(() => {
    setCategory("all");
    setStatus("all");
    setFcRange("all");
    setCreator("all");
    setCreatorSort("none");
    setPage(1);
  }, [globalBrand]);
  const pageSize = PAGE_SIZE;
  const [expanded, setExpanded] = useState<string | null>(null);
  const [view, setView] = useState<"gallery" | "table">("gallery");

  const canCreate = can(user.role, "recipe.create");

  // Food-cost target for the tiles. `food_cost_pct` is the target; margin_alert_pct
  // (criticalPct above) is the separate "critical" threshold used by the table.
  const fcTarget = Number(settings.find((s) => s.key === "food_cost_pct")?.value ?? 30);

  // Margin readings over the brand-scoped, non-archived recipes in this view.
  // avgFc is null when nothing is priced, so the tile shows "—" not 0%.
  const marginStats = useMemo(() => {
    const live = recipes.filter((r) => !r.archived_at);
    const pcts: number[] = [];
    let unpriced = 0;
    for (const r of live) {
      const cost = r.total_cost;
      const price = r.selling_price;
      if (cost == null || price == null || price <= 0) unpriced++;
      else pcts.push((cost / price) * 100);
    }
    return {
      total: live.length,
      approved: live.filter((r) => r.status === "approved").length,
      priced: pcts.length,
      unpriced,
      avgFc: pcts.length ? pcts.reduce((a, b) => a + b, 0) / pcts.length : null,
      overTarget: pcts.filter((p) => p > fcTarget).length,
    };
  }, [recipes, fcTarget]);

  const filtered = useMemo(() => {
    const out = recipes.filter((r) => {
      // Archived recipes are hidden everywhere except the dedicated "Archived" view.
      const isArchived = !!r.archived_at;
      if (status === "archived") {
        if (!isArchived) return false;
      } else {
        if (isArchived) return false;
        if (status !== "all" && r.status !== status) return false;
      }
      if (search) {
        const q = search.toLowerCase();
        if (!r.recipe_name.toLowerCase().includes(q) && !(r.created_by_name ?? "").toLowerCase().includes(q)) return false;
      }
      if (category !== "all" && r.category !== category) return false;
      if (creator !== "all" && (r.created_by_name || "—") !== creator) return false;
      if (fcRange !== "all") {
        // A food-cost % only exists once a menu price is saved — unpriced recipes
        // match no FC band.
        if (!hasMenuPrice(r)) return false;
        const fc = foodCostPctOf(r);
        if (fcRange === "low" && !(fc < 25)) return false;
        if (fcRange === "mid" && !(fc >= 25 && fc <= 35)) return false;
        if (fcRange === "high" && !(fc > 35)) return false;
      }
      return true;
    });
    if (creatorSort !== "none") {
      out.sort((a, b) => {
        const cmp = (a.created_by_name || "").localeCompare(b.created_by_name || "");
        return creatorSort === "az" ? cmp : -cmp;
      });
    }
    return out;
  }, [recipes, search, category, status, fcRange, creator, creatorSort]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageItems = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const kpis = useMemo(() => {
    // FC% only exists for priced recipes; unpriced ones are excluded from the averages.
    const priced = recipes.filter(hasMenuPrice);
    const withFc = priced.map((r) => foodCostPctOf(r));
    const avgFc = withFc.length ? withFc.reduce((a, b) => a + b, 0) / withFc.length : 0;
    const critical = priced.filter((r) => foodCostPctOf(r) >= criticalPct).length;
    const activeMaterials = materials.filter((m) => m.status === "active");
    const pendingPrices = materials.filter((m) => m.purchase_price === null).length;
    const inventoryValue = activeMaterials.reduce((sum, m) => sum + (m.purchase_price ?? 0), 0);
    return {
      avgFc: avgFc.toFixed(1),
      critical,
      pendingPrices,
      inventoryValue,
      activeCount: activeMaterials.length,
    };
  }, [recipes, materials, criticalPct]);

  const clearFilters = () => {
    setSearch("");
    setCategory("all");
    setStatus("all");
    setFcRange("all");
    setCreator("all");
    setCreatorSort("none");
    setPage(1);
  };

  const duplicate = async (id: string) => {
    try {
      const copy = await dupMut.mutateAsync(id);
      toast.success("Recipe duplicated");
      navigate(`/recipes/${copy.id}/edit`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Duplicate failed");
    }
  };

  return (
    <>
      <PageHeader
        eyebrow={prepMode ? "Prep Library" : "Menu Architecture"}
        title={prepMode ? "In-House Prep" : "Recipe Inventory"}
        description={
          prepMode
            ? "Sauces, doughs, pastes and bases made in-house and used across recipes."
            : "Real-time margin performance and recipe intelligence."
        }
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => navigate("/reports")}>
              <FileDown className="h-4 w-4" /> Export
            </Button>
            {canCreate && (
              <Button
                variant="accent"
                onClick={() => navigate("/recipes/new", { state: prepMode ? { isPrep: true } : undefined })}
              >
                <Plus className="h-4 w-4" /> {prepMode ? "New Prep" : "New Recipe"}
              </Button>
            )}
          </div>
        }
      />

      {/* Margin readings across the recipes in view. */}
      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label={prepMode ? "Total Preps" : "Total Dishes"}
          value={isLoading ? "—" : String(marginStats.total)}
          valueTone="accent"
          emptyHint={marginStats.total === 0 ? "Nothing in the catalog yet" : `${marginStats.approved} approved`}
        />
        <StatTile
          label="Avg Food Cost %"
          value={marginStats.avgFc == null ? "—" : `${marginStats.avgFc.toFixed(1)}%`}
          valueTone={
            marginStats.avgFc == null ? "neutral" : marginStats.avgFc <= fcTarget ? "good" : "bad"
          }
          progress={marginStats.avgFc == null ? null : Math.min(100, marginStats.avgFc)}
          tone={marginStats.avgFc != null && marginStats.avgFc <= fcTarget ? "good" : "bad"}
          emptyHint={
            marginStats.avgFc == null
              ? "Needs a cost and a selling price"
              : `Target ${fcTarget}% · ${marginStats.priced} priced`
          }
        />
        <StatTile
          label="Over Target"
          value={isLoading ? "—" : String(marginStats.overTarget)}
          valueTone={marginStats.overTarget > 0 ? "bad" : "good"}
          emptyHint={
            marginStats.priced === 0 ? "Needs priced dishes" : `Above the ${fcTarget}% target`
          }
        />
        <StatTile
          label="Awaiting Costing"
          value={isLoading ? "—" : String(marginStats.unpriced)}
          valueTone={marginStats.unpriced > 0 ? "warning" : "good"}
          emptyHint={
            marginStats.unpriced > 0 ? "No cost or no selling price set" : "Everything is costed"
          }
        />
      </div>

      {/* Filters */}
      <Card className="mb-4 p-4">
        <div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Filter label="Category">
            <Select value={category} onValueChange={(v) => { setCategory(v); setPage(1); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Filter>
          <Filter label="Status">
            <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="testing">Testing</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </Filter>
          <Filter label="Food Cost Range">
            <Select value={fcRange} onValueChange={(v) => { setFcRange(v); setPage(1); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any Cost %</SelectItem>
                <SelectItem value="low">Under 25%</SelectItem>
                <SelectItem value="mid">25% – 35%</SelectItem>
                <SelectItem value="high">Over 35%</SelectItem>
              </SelectContent>
            </Select>
          </Filter>
          <Filter label="Created By">
            <Select value={creator} onValueChange={(v) => { setCreator(v); setPage(1); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Creators</SelectItem>
                {creators.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </Filter>
          <Filter label="Sort by Creator">
            <Select value={creatorSort} onValueChange={(v) => setCreatorSort(v as "none" | "az" | "za")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Default order</SelectItem>
                <SelectItem value="az">Creator A–Z</SelectItem>
                <SelectItem value="za">Creator Z–A</SelectItem>
              </SelectContent>
            </Select>
          </Filter>
          <div className="flex items-center gap-3">
            <Input
              placeholder="Search recipes or creator…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
            <button onClick={clearFilters} aria-label="Clear all filters" className="whitespace-nowrap rounded text-sm font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              Clear Filters
            </button>
          </div>
        </div>
      </Card>

      {/* View switch — gallery matches the design; the table keeps sorting,
          inline expansion and the dense costing columns. */}
      <div className="mb-3 flex items-center justify-end gap-1.5">
        <span className="mr-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          View
        </span>
        <Button
          variant={view === "gallery" ? "accent" : "outline"}
          size="sm"
          onClick={() => setView("gallery")}
          aria-pressed={view === "gallery"}
        >
          <LayoutGrid className="h-4 w-4" /> Gallery
        </Button>
        <Button
          variant={view === "table" ? "accent" : "outline"}
          size="sm"
          onClick={() => setView("table")}
          aria-pressed={view === "table"}
        >
          <Rows3 className="h-4 w-4" /> Table
        </Button>
      </div>

      {view === "gallery" ? (
        isLoading ? (
          <Card className="mb-6 overflow-hidden">
            <TableSkeleton rows={Math.min(pageSize, 6)} cols={4} />
          </Card>
        ) : filtered.length === 0 ? (
          <Card className="mb-6 overflow-hidden">
            <EmptyState
              title="No recipes found"
              description="Adjust your filters or create a new recipe."
              action={canCreate && (
                <Button variant="accent" onClick={() => navigate("/recipes/new")}>
                  <Plus className="h-4 w-4" /> New Recipe
                </Button>
              )}
            />
          </Card>
        ) : (
          <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {pageItems.map((r) => (
              <RecipeCard
                key={r.id}
                recipe={r}
                targetPct={fcTarget}
                onView={() => navigate(`/recipes/${r.id}`)}
                onEdit={canCreate ? () => navigate(`/recipes/${r.id}/edit`) : undefined}
              />
            ))}
          </div>
        )
      ) : (
      /* Table */
      <Card className="mb-6 overflow-hidden">
        {isLoading ? (
          <TableSkeleton rows={Math.min(pageSize, 8)} cols={6} />
        ) : filtered.length === 0 ? (
          <EmptyState
            title="No recipes found"
            description="Adjust your filters or create a new recipe."
            action={canCreate && (
              <Button variant="accent" onClick={() => navigate("/recipes/new")}>
                <Plus className="h-4 w-4" /> New Recipe
              </Button>
            )}
          />
        ) : (
          <>
            {/* Header */}
            <div className="hidden grid-cols-12 gap-2 border-b bg-muted/40 px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground lg:grid">
              <div className="col-span-3">Recipe Name</div>
              <div className="col-span-2">Category</div>
              <div className="col-span-1">Yield</div>
              <div className="col-span-1 text-right">{prepMode ? "Total Cost" : "Unit Cost"}</div>
              {!prepMode && <div className="col-span-1 text-right">Menu Price</div>}
              {!prepMode && <div className="col-span-2">Food Cost %</div>}
              <div className={prepMode ? "col-span-4" : "col-span-1"}>Last Updated</div>
              <div className="col-span-1" />
            </div>

            <div className="divide-y">
              {pageItems.map((r) => (
                <RecipeRow
                  key={r.id}
                  recipe={r}
                  criticalPct={criticalPct}
                  expanded={expanded === r.id}
                  onToggle={() => setExpanded(expanded === r.id ? null : r.id)}
                  onView={() => navigate(`/recipes/${r.id}`)}
                  canEdit={canEditRecipe(user, r)}
                  canDuplicate={can(user.role, "recipe.duplicate")}
                  canDelete={canDelete}
                  canArchive={canArchive}
                  onEdit={() => navigate(`/recipes/${r.id}/edit`)}
                  onDuplicate={() => duplicate(r.id)}
                  onDelete={() => setDeletingId(r.id)}
                  onArchive={() => setArchivingId(r.id)}
                  onUnarchive={() => unarchive(r.id)}
                  updatedBy={showUpdatedBy ? usersMap.get(r.updated_by ?? "")?.name ?? null : null}
                  canSeeCost={canSeeCost}
                  brandColored={prepMode}
                  sizes={sizesByMaster.get(r.id)}
                />
              ))}
            </div>

            <Pagination
              page={currentPage}
              pageSize={pageSize}
              total={filtered.length}
              onPageChange={setPage}
              label="recipes"
            />
          </>
        )}
      </Card>
      )}

      {/* Gallery view paginates too — the table renders its own Pagination. */}
      {view === "gallery" && filtered.length > 0 && (
        <Card className="mb-6">
          <Pagination
            page={currentPage}
            pageSize={pageSize}
            total={filtered.length}
            onPageChange={setPage}
            label="recipes"
          />
        </Card>
      )}

      {/* Bottom KPI strip (cost — hidden for viewers without cost access) */}
      {canSeeCost && (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<Percent className="h-4 w-4" />}
          label="Average Food Cost"
          value={`${kpis.avgFc}%`}
          sub={<span className="inline-flex items-center gap-1 text-emerald-600"><TrendingDown className="h-3 w-3" /> 1.2% from last month</span>}
        />
        <StatCard
          icon={<AlertTriangle className="h-4 w-4" />}
          label="Critical Recipes"
          value={<span className="text-red-600">{kpis.critical}</span>}
          sub={`Cost exceeding ${criticalPct}% target`}
        />
        <StatCard
          icon={<ClipboardCheck className="h-4 w-4" />}
          label="Pending Ingredient Updates"
          value={<span className="text-amber-600">{kpis.pendingPrices}</span>}
          sub="Awaiting price confirmation"
        />
        <StatCard
          icon={<Boxes className="h-4 w-4" />}
          label="Inventory Value"
          value={formatINR(kpis.inventoryValue)}
          sub={`Across ${kpis.activeCount} active items`}
        />
      </div>
      )}

      <ConfirmDialog
        open={!!deletingId}
        onOpenChange={(o) => !o && setDeletingId(null)}
        title="Delete this recipe?"
        description={
          pendingDelete
            ? `"${pendingDelete.recipe_name}" and its cost history will be permanently deleted. This can't be undone.`
            : undefined
        }
        confirmLabel="Delete Recipe"
        destructive
        onConfirm={async () => {
          if (!deletingId) return;
          try {
            await delMut.mutateAsync(deletingId);
            toast.success("Recipe deleted");
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Delete failed");
          } finally {
            setDeletingId(null);
          }
        }}
      />

      <ConfirmDialog
        open={!!archivingId}
        onOpenChange={(o) => !o && setArchivingId(null)}
        title="Archive this recipe?"
        description={
          pendingArchive
            ? `"${pendingArchive.recipe_name}" will be hidden from active recipes but kept with its cost history and any sub-recipe links. You can restore it anytime from the Archived filter.`
            : undefined
        }
        confirmLabel="Archive"
        onConfirm={async () => {
          if (!archivingId) return;
          try {
            await archiveMut.mutateAsync(archivingId);
            toast.success("Recipe archived");
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Archive failed");
          } finally {
            setArchivingId(null);
          }
        }}
      />
    </>
  );
}

function Filter({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  sub: React.ReactNode;
}) {
  return (
    <Card className="p-4">
      <div className="mb-1 flex items-center gap-2 text-sm text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="text-2xl font-bold">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{sub}</div>
    </Card>
  );
}

function RecipeRow({
  recipe,
  criticalPct,
  expanded,
  onToggle,
  onView,
  canEdit,
  canDuplicate,
  canDelete,
  canArchive,
  onEdit,
  onDuplicate,
  onDelete,
  onArchive,
  onUnarchive,
  updatedBy,
  canSeeCost,
  brandColored,
  sizes,
}: {
  recipe: Recipe;
  criticalPct: number;
  expanded: boolean;
  onToggle: () => void;
  onView: () => void;
  canEdit: boolean;
  canDuplicate: boolean;
  canDelete: boolean;
  canArchive: boolean;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onArchive: () => void;
  onUnarchive: () => void;
  updatedBy: string | null;
  canSeeCost: boolean;
  /** Color the food-cost bar/badge by the active brand instead of by FC tone. */
  brandColored?: boolean;
  /** Available size labels for a pizza master (e.g. ["11-inch","15-inch"]). */
  sizes?: string[];
}) {
  const unitCost = recipe.cost_per_portion ?? 0;
  const priced = hasMenuPrice(recipe);
  const menuPrice = menuPriceOf(recipe);
  const fc = foodCostPctOf(recipe);
  const tone = fcTone(fc, criticalPct);
  const toneStyle = FC_TONE_STYLES[tone];
  // Preps follow the brand accent (--primary); menu recipes keep the FC tone.
  const barClass = brandColored ? "bg-primary" : toneStyle.bar;
  const badgeClass = brandColored ? "bg-primary/10 text-primary" : toneStyle.badge;

  return (
    <div className={cn(expanded && "bg-primary/5")}>
      <button
        onClick={onToggle}
        aria-expanded={expanded}
        aria-label={`${recipe.recipe_name} — toggle cost breakdown`}
        className={cn(
          "grid w-full grid-cols-2 items-center gap-2 px-4 py-3 text-left lg:grid-cols-12",
          expanded && "border-l-4 border-primary",
        )}
      >
        <div className="col-span-2 flex items-center gap-3 lg:col-span-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted text-lg">
            {recipe.image_url ? (
              <img src={recipe.image_url} alt={recipe.recipe_name} className="h-full w-full object-cover" />
            ) : (
              emojiFor(recipe.category)
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate font-semibold">{recipe.recipe_name}</p>
            {recipe.created_by_name && (
              <p className="truncate text-[11px] text-muted-foreground">by {recipe.created_by_name}</p>
            )}
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {recipe.category}
              {sizes && sizes.length > 0 && (
                <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                  {sizes.join(" · ")}
                </span>
              )}
              {recipe.archived_at && (
                <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Archived
                </span>
              )}
            </p>
            {/* Mobile-only stat line (desktop shows these as columns) */}
            {canSeeCost && (
              <p className="mt-1 font-mono text-xs text-muted-foreground lg:hidden">
                Cost {formatINR(unitCost)}
                {!brandColored && <> · Price {priced ? formatINR(menuPrice) : "—"}</>}
              </p>
            )}
          </div>
        </div>
        <div className="col-span-1 hidden text-xs font-medium uppercase text-muted-foreground lg:block lg:col-span-2">
          {recipe.category}
        </div>
        <div className="hidden lg:block lg:col-span-1">
          <span className="font-mono">{recipe.serving_size} Port.</span>
        </div>
        <div className="hidden text-right font-mono lg:block lg:col-span-1">{canSeeCost ? formatINR(unitCost) : "—"}</div>
        {!brandColored && (
          <div className="hidden text-right font-mono font-semibold lg:block lg:col-span-1">{canSeeCost && priced ? formatINR(menuPrice) : "—"}</div>
        )}
        {!brandColored && (
        <div className="col-span-2 lg:col-span-2">
          {canSeeCost && priced ? (
          <div className="flex items-center gap-2">
            <span className={cn("rounded px-1.5 py-0.5 text-xs font-semibold", badgeClass)}>
              {fc}%
            </span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className={cn("h-full rounded-full", barClass)}
                style={{ width: `${Math.min(100, (fc / Math.max(criticalPct + 15, 1)) * 100)}%` }}
              />
            </div>
          </div>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </div>
        )}
        <div className={cn("hidden text-xs text-muted-foreground lg:block", brandColored ? "lg:col-span-4" : "lg:col-span-1")}>
          <div>{formatDateTime(recipe.updated_at)}</div>
          {updatedBy && <div className="text-[11px]">by {updatedBy}</div>}
        </div>
        <div className="hidden items-center justify-end lg:flex lg:col-span-1">
          <ChevronDown className={cn("h-4 w-4 transition-transform", expanded && "rotate-180")} />
        </div>
      </button>

      {expanded && canSeeCost && (
        <ExpandedBreakdown
          recipe={recipe}
          onView={onView}
          canEdit={canEdit}
          canDuplicate={canDuplicate}
          canDelete={canDelete}
          canArchive={canArchive}
          onEdit={onEdit}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
          onArchive={onArchive}
          onUnarchive={onUnarchive}
        />
      )}
    </div>
  );
}

function ExpandedBreakdown({
  recipe,
  onView,
  canEdit,
  canDuplicate,
  canDelete,
  canArchive,
  onEdit,
  onDuplicate,
  onDelete,
  onArchive,
  onUnarchive,
}: {
  recipe: Recipe;
  onView: () => void;
  canEdit: boolean;
  canDuplicate: boolean;
  canDelete: boolean;
  canArchive: boolean;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onArchive: () => void;
  onUnarchive: () => void;
}) {
  const isArchived = !!recipe.archived_at;
  const { data, isLoading } = useRecipe(recipe.id);
  const priced = hasMenuPrice(recipe);
  const menuPrice = menuPriceOf(recipe);
  const margin = profitMarginOf(recipe);
  const actualFc = foodCostPctOf(recipe);
  const fcNoPkg = foodCostNoPackagingPct(recipe);

  // Use the persisted (yield-adjusted) line cost — single source of truth (§9).
  const lines = (data?.ingredients ?? []).map((ing) => ({
    name: `${ing.material?.ingredient_name ?? "—"} (${formatQuantityWithUnit(ing.quantity_used, ing.unit_used, { humanize: false })})`,
    cost: ing.calculated_cost,
  }));
  const mid = Math.ceil(lines.length / 2);

  return (
    <div className="grid gap-4 border-t bg-background/60 p-4 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Cost Component Breakdown
          </p>
          <div className="flex items-center gap-2">
            <StatusBadge status={recipe.status} />
            <Button variant="ghost" size="sm" onClick={onView}>View</Button>
            {canEdit && (
              <Button variant="ghost" size="sm" onClick={onEdit}>
                <Pencil className="h-3.5 w-3.5" /> Edit
              </Button>
            )}
            {(canDuplicate || canDelete || canArchive) && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="More recipe actions"><MoreVertical className="h-4 w-4" /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {canDuplicate && (
                    <DropdownMenuItem onClick={onDuplicate}>
                      <Copy className="h-4 w-4" /> Duplicate
                    </DropdownMenuItem>
                  )}
                  {canArchive && (
                    isArchived ? (
                      <DropdownMenuItem onClick={onUnarchive}>
                        <ArchiveRestore className="h-4 w-4" /> Restore from archive
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem onClick={onArchive}>
                        <Archive className="h-4 w-4" /> Archive
                      </DropdownMenuItem>
                    )
                  )}
                  {canDelete && (
                    <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
                      <Trash2 className="h-4 w-4" /> Delete
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
        <p className="mb-3 text-xs text-muted-foreground">
          Total Dish Weight:{" "}
          <span className="font-mono font-semibold text-foreground">{formatWeight(recipe.total_weight_g)}</span>
        </p>
        {isLoading ? (
          <p className="py-4 text-sm text-muted-foreground">Loading breakdown…</p>
        ) : (
          <div className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
            {[lines.slice(0, mid), lines.slice(mid)].map((col, ci) => (
              <div key={ci} className="space-y-2">
                {col.map((l, i) => (
                  <div key={i} className="flex items-baseline justify-between gap-2 border-b border-dashed pb-1 text-sm">
                    <span className="text-muted-foreground">{l.name}</span>
                    <span className="font-mono">{formatINR(l.cost)}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Profit margin card — only when a menu price has been saved (no suggestion). */}
      <div className="rounded-lg border bg-muted/40 p-4 text-center">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Profit / Portion</p>
        {priced ? (
          <>
            <p className="my-1 text-3xl font-bold text-emerald-700">{formatINR(margin)}</p>
            <div className="mt-3 grid grid-cols-2 gap-2 border-t pt-3 text-left">
              <div>
                <p className="text-[11px] uppercase text-muted-foreground">Menu Price</p>
                <p className="font-mono font-semibold">{formatINR(menuPrice)}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase text-muted-foreground">FC% with pkg</p>
                <p className="font-mono font-semibold">{actualFc.toFixed(1)}%</p>
              </div>
              <div>
                <p className="text-[11px] uppercase text-muted-foreground">FC% without pkg</p>
                <p className="font-mono font-semibold">{(fcNoPkg ?? 0).toFixed(1)}%</p>
              </div>
              <div>
                <p className="text-[11px] uppercase text-muted-foreground">Packaging</p>
                <p className="font-mono font-semibold">{formatINR(recipe.packaging_cost ?? 0)}</p>
              </div>
            </div>
          </>
        ) : (
          <>
            <p className="my-1 text-3xl font-bold text-muted-foreground">—</p>
            <p className="text-[11px] text-muted-foreground">No menu price set</p>
          </>
        )}
      </div>
    </div>
  );
}
