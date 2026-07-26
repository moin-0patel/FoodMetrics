import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Columns3,
  Download,
  MoreVertical,
  Plus,
  RotateCcw,
  Tags,
  Trash2,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatTile } from "@/components/StatTile";
import { FilterChips, type Chip } from "@/components/FilterChips";
import { TelemetryBar } from "@/components/TelemetryBar";
import { InventoryHealthPanel } from "./InventoryHealthPanel";
import { useAllPriceHistory } from "@/features/reports/hooks";
import { EmptyState } from "@/components/EmptyState";
import { TableSkeleton } from "@/components/TableSkeleton";
import { Pagination } from "@/components/Pagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { cn, formatINR, formatQuantityWithUnit } from "@/lib/utils";
import { useSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import type { RawMaterial } from "@/lib/data/types";
import {
  useMaterials,
  useSetMaterialStatus,
  useBulkSetMaterialStatus,
  useDeleteMaterial,
  useBulkDeleteMaterial,
} from "./hooks";
import { useCategories } from "@/features/settings/hooks";
import { CategoryManagerDialog } from "./CategoryManagerDialog";
import { PriceHistoryDialog } from "./PriceHistoryDialog";
import { exportMaterials } from "./exportMaterials";
import { toast } from "@/components/ui/use-toast";

type SortKey = "name" | "category" | "price";

const PAGE_SIZE = 10;

const COLUMN_DEFS = [
  { key: "category", label: "Category" },
  { key: "price", label: "Purchase Price" },
  { key: "packSize", label: "Quantity" },
] as const;
type ColKey = (typeof COLUMN_DEFS)[number]["key"];

export function MaterialsPage() {
  const user = useSession((s) => s.user)!;
  const canEdit = can(user.role, "material.edit"); // admin-only — ingredients locked otherwise
  const { data: materials = [], isLoading } = useMaterials();
  const { data: categories = [] } = useCategories();
  // Full price history powers the intelligence panel's movement figures.
  const { data: priceHistory = [] } = useAllPriceHistory();
  const setStatus = useSetMaterialStatus();
  const bulkStatus = useBulkSetMaterialStatus();
  const delMat = useDeleteMaterial();
  const bulkDelMat = useBulkDeleteMaterial();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [status, setStatus_] = useState("active");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "name", dir: "asc" });

  const pageSize = PAGE_SIZE;
  const [page, setPage] = useState(1);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [cols, setCols] = useState<Record<ColKey, boolean>>({
    category: true,
    price: true,
    packSize: true,
  });

  const navigate = useNavigate();
  const [historyFor, setHistoryFor] = useState<RawMaterial | null>(null);
  const [deleting, setDeleting] = useState<RawMaterial | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkReactivateOpen, setBulkReactivateOpen] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);

  // Inventory readings for the tile row. Derived from the real material list —
  // an unknown average stays null so the tile shows "—" rather than ₹0.
  const stats = useMemo(() => {
    const total = materials.length;
    const active = materials.filter((m) => m.status === "active").length;
    const priced = materials.filter((m) => m.cost_per_base_unit != null);
    const costs = priced.map((m) => m.cost_per_base_unit as number);
    return {
      total,
      active,
      inactive: total - active,
      unpriced: total - priced.length,
      pricedPct: total === 0 ? 0 : (priced.length / total) * 100,
      avgCost: costs.length ? costs.reduce((a, b) => a + b, 0) / costs.length : null,
    };
  }, [materials]);

  // Price changes logged in the last 30 days — drives the panel's update count.
  const recentUpdateCount = useMemo(() => {
    const cutoff = Date.now() - 30 * 864e5;
    return priceHistory.filter((h) => {
      const t = new Date(h.changed_at).getTime();
      return !Number.isNaN(t) && t >= cutoff;
    }).length;
  }, [priceHistory]);

  // Category chips with live counts, "All" first.
  const categoryChips = useMemo<Chip[]>(
    () => [
      { value: "all", label: "All", count: materials.length },
      ...categories.map((c) => ({
        value: c,
        label: c,
        count: materials.filter((m) => m.category === c).length,
      })),
    ],
    [categories, materials],
  );

  // Raw materials are COMMON across brands (shared kitchen building blocks) — not
  // filtered by the brand selector.
  const filtered = useMemo(() => {
    return materials.filter((m) => {
      if (search && !m.ingredient_name.toLowerCase().includes(search.toLowerCase())) return false;
      if (category !== "all" && m.category !== category) return false;
      if (status !== "all" && m.status !== status) return false;
      return true;
    });
  }, [materials, search, category, status]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let cmp = 0;
      if (sort.key === "name") cmp = a.ingredient_name.localeCompare(b.ingredient_name);
      else if (sort.key === "category")
        cmp = a.category.localeCompare(b.category) || a.ingredient_name.localeCompare(b.ingredient_name);
      else if (sort.key === "price") cmp = (a.purchase_price ?? -Infinity) - (b.purchase_price ?? -Infinity);
      return sort.dir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sort]);

  // Reset paging + selection whenever the visible set changes.
  useEffect(() => {
    setPage(1);
    setSelected(new Set());
  }, [search, category, status, sort, pageSize]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const current = Math.min(page, pageCount);
  const pageItems = sorted.slice((current - 1) * pageSize, current * pageSize);

  const pageIds = pageItems.map((m) => m.id);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const toggleAllPage = () =>
    setSelected((prev) => {
      const n = new Set(prev);
      if (allPageSelected) pageIds.forEach((id) => n.delete(id));
      else pageIds.forEach((id) => n.add(id));
      return n;
    });

  const toggleSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));

  const openAdd = () => navigate("/materials/new");
  const openEdit = (m: RawMaterial) => navigate(`/materials/${m.id}/edit`);

  const [isExporting, setIsExporting] = useState(false);
  const doExport = async () => {
    if (isExporting) return;
    const list = selected.size > 0 ? sorted.filter((m) => selected.has(m.id)) : sorted;
    setIsExporting(true);
    try {
      await exportMaterials(list, String(list.length));
      toast.success(`Exported ${list.length} ingredient${list.length === 1 ? "" : "s"}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setIsExporting(false);
    }
  };

  const runReactivate = async () => {
    const ids = [...selected];
    try {
      const n = await bulkStatus.mutateAsync({ ids, status: "active" });
      setSelected(new Set());
      toast.success(`Reactivated ${n} ingredient${n === 1 ? "" : "s"}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Bulk update failed");
    }
  };

  const runBulkDelete = async () => {
    const ids = [...selected];
    try {
      const { deleted, skipped } = await bulkDelMat.mutateAsync(ids);
      setSelected(new Set());
      if (deleted && skipped) {
        toast.success(`Deleted ${deleted}; ${skipped} skipped (still used in recipes)`);
      } else if (deleted) {
        toast.success(`Deleted ${deleted} ingredient${deleted === 1 ? "" : "s"}`);
      } else {
        toast.error(`Nothing deleted — ${skipped} still used in recipes`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Bulk delete failed");
    }
  };

  const priceLabel = (m: RawMaterial) =>
    m.purchase_price === null ? null : formatINR(m.purchase_price);
  const sizeLabel = (m: RawMaterial) =>
    formatQuantityWithUnit(m.purchase_quantity, m.purchase_unit, { humanize: false });

  const renderActions = (m: RawMaterial) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Actions for ${m.ingredient_name}`}>
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {canEdit && <DropdownMenuItem onClick={() => openEdit(m)}>Edit</DropdownMenuItem>}
        <DropdownMenuItem onClick={() => setHistoryFor(m)}>Price History</DropdownMenuItem>
        {canEdit && m.status !== "active" && (
          <DropdownMenuItem
            onClick={async () => {
              try {
                await setStatus.mutateAsync({ id: m.id, status: "active" });
                toast.success("Ingredient reactivated");
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Reactivate failed");
              }
            }}
          >
            Reactivate
          </DropdownMenuItem>
        )}
        {canEdit && (
          <DropdownMenuItem onClick={() => setDeleting(m)} className="text-destructive focus:text-destructive">
            <Trash2 className="h-4 w-4" /> Delete
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const SortHead = ({ label, k, className }: { label: string; k: SortKey; className?: string }) => {
    const active = sort.key === k;
    return (
      <TableHead className={className} aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
        <button
          className="inline-flex items-center gap-1 rounded hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => toggleSort(k)}
          aria-label={`Sort by ${label}`}
        >
          {label}
          {active ? (
            sort.dir === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />
          ) : (
            <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />
          )}
        </button>
      </TableHead>
    );
  };

  return (
    <>
      <PageHeader
        eyebrow="Intelligence Hub"
        title="Raw Materials Inventory"
        description={canEdit ? "Manage ingredients and their purchase pricing" : "Ingredient prices are managed by an admin."}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={doExport} disabled={isExporting}>
              <Download className="h-4 w-4" /> Export
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Columns3 className="h-4 w-4" /> Columns
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Visible columns</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {COLUMN_DEFS.map((c) => (
                  <DropdownMenuItem
                    key={c.key}
                    onSelect={(e) => {
                      e.preventDefault();
                      setCols((prev) => ({ ...prev, [c.key]: !prev[c.key] }));
                    }}
                  >
                    <Checkbox checked={cols[c.key]} className="pointer-events-none" />
                    {c.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            {canEdit && (
              <Button variant="outline" onClick={() => setCategoriesOpen(true)}>
                <Tags className="h-4 w-4" /> Categories
              </Button>
            )}
            {canEdit && (
              <Button variant="accent" onClick={openAdd}>
                <Plus className="h-4 w-4" /> Add Ingredient
              </Button>
            )}
          </div>
        }
      />

      {/* Inventory readings — all derived from the loaded materials. */}
      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Total SKU Count"
          value={isLoading ? "—" : String(stats.total)}
          valueTone="accent"
          emptyHint={stats.total === 0 ? "No ingredients yet" : `${stats.active} active · ${stats.inactive} inactive`}
        />
        <StatTile
          label="Priced Coverage"
          value={stats.total === 0 ? "—" : `${stats.pricedPct.toFixed(1)}%`}
          tone={stats.pricedPct >= 90 ? "good" : stats.pricedPct >= 60 ? "neutral" : "bad"}
          progress={stats.total === 0 ? null : stats.pricedPct}
          emptyHint={stats.total === 0 ? "Add ingredients to track coverage" : undefined}
        />
        <StatTile
          label="Missing a Price"
          value={isLoading ? "—" : String(stats.unpriced)}
          valueTone={stats.unpriced > 0 ? "bad" : "good"}
          emptyHint={stats.unpriced > 0 ? "These cannot be costed into recipes" : "Every ingredient is priced"}
        />
        <StatTile
          label="Average Unit Cost"
          value={stats.avgCost == null ? "—" : formatINR(stats.avgCost)}
          emptyHint={stats.avgCost == null ? "Needs at least one priced ingredient" : "Per base unit, priced items only"}
        />
      </div>

      <Card className="mb-4 p-4">
        <FilterChips
          label="Category"
          className="mb-3"
          value={category}
          onChange={setCategory}
          chips={categoryChips}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            placeholder="Search ingredients…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Select value={status} onValueChange={setStatus_}>
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Bulk action bar */}
      {canEdit && selected.size > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border bg-muted/50 px-4 py-2.5 text-sm">
          <span className="font-medium">{selected.size} selected</span>
          <div className="flex-1" />
          <Button variant="outline" size="sm" onClick={doExport} disabled={isExporting}>
            <Download className="h-4 w-4" /> Export
          </Button>
          <Button variant="outline" size="sm" onClick={() => setBulkReactivateOpen(true)}>
            <RotateCcw className="h-4 w-4" /> Reactivate
          </Button>
          <Button variant="destructive" size="sm" onClick={() => setBulkDeleteOpen(true)}>
            <Trash2 className="h-4 w-4" /> Delete
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
            Clear
          </Button>
        </div>
      )}

      <Card>
        {isLoading ? (
          <TableSkeleton rows={6} cols={4} />
        ) : sorted.length === 0 ? (
          <EmptyState
            title="No ingredients found"
            description="Add your first ingredient to start building recipes."
            action={
              canEdit && (
                <Button variant="accent" onClick={openAdd}>
                  <Plus className="h-4 w-4" /> Add Ingredient
                </Button>
              )
            }
          />
        ) : (
          <>
            {/* Desktop / tablet: table */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    {canEdit && (
                      <TableHead className="w-10">
                        <Checkbox
                          checked={allPageSelected}
                          onCheckedChange={toggleAllPage}
                          aria-label="Select all on page"
                        />
                      </TableHead>
                    )}
                    <SortHead label="Name" k="name" />
                    {cols.category && <SortHead label="Category" k="category" />}
                    {cols.price && <SortHead label="Purchase Price" k="price" />}
                    {cols.packSize && <TableHead>Quantity</TableHead>}
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageItems.map((m) => (
                    <TableRow key={m.id} className={m.status === "inactive" ? "opacity-50" : ""} data-state={selected.has(m.id) ? "selected" : undefined}>
                      {canEdit && (
                        <TableCell>
                          <Checkbox
                            checked={selected.has(m.id)}
                            onCheckedChange={() => toggleOne(m.id)}
                            aria-label={`Select ${m.ingredient_name}`}
                          />
                        </TableCell>
                      )}
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {m.purchase_price === null && (
                            <AlertTriangle className="h-4 w-4 text-amber-500" />
                          )}
                          {m.ingredient_name}
                        </div>
                      </TableCell>
                      {cols.category && <TableCell>{m.category}</TableCell>}
                      {cols.price && (
                        <TableCell>{priceLabel(m) ?? <Badge variant="warning">No Price</Badge>}</TableCell>
                      )}
                      {cols.packSize && <TableCell>{sizeLabel(m)}</TableCell>}
                      <TableCell>{renderActions(m)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile: stacked cards (no horizontal scroll) */}
            <ul className="divide-y md:hidden">
              {pageItems.map((m) => (
                <li
                  key={m.id}
                  className={cn("flex items-start gap-3 p-4", m.status === "inactive" && "opacity-50")}
                >
                  {canEdit && (
                    <Checkbox
                      checked={selected.has(m.id)}
                      onCheckedChange={() => toggleOne(m.id)}
                      className="mt-1"
                      aria-label={`Select ${m.ingredient_name}`}
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {m.purchase_price === null && (
                        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
                      )}
                      <p className="truncate font-medium">{m.ingredient_name}</p>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">{m.category}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                      {priceLabel(m) ? (
                        <span className="font-medium">{priceLabel(m)}</span>
                      ) : (
                        <Badge variant="warning">No Price</Badge>
                      )}
                      <span className="text-muted-foreground">{sizeLabel(m)}</span>
                    </div>
                  </div>
                  {renderActions(m)}
                </li>
              ))}
            </ul>

            <Pagination
              page={current}
              pageSize={pageSize}
              total={sorted.length}
              onPageChange={setPage}
              label="ingredients"
            />
          </>
        )}
      </Card>

      {/* Intelligence panel — price movement + inventory health. */}
      <div className="mt-4">
        <InventoryHealthPanel
          materials={materials}
          priceHistory={priceHistory}
          pricedPct={stats.pricedPct}
          unpriced={stats.unpriced}
          recentUpdates={recentUpdateCount}
        />
      </div>

      <TelemetryBar
        className="mt-4"
        items={[
          { label: "Showing", value: `${sorted.length} of ${materials.length}`, dot: true, tone: "good" },
          { label: "Priced", value: `${stats.pricedPct.toFixed(0)}%`, tone: stats.pricedPct >= 90 ? "good" : "warning" },
          { label: "Missing price", value: String(stats.unpriced), tone: stats.unpriced > 0 ? "critical" : "good" },
        ]}
        right={`${stats.active} active · ${stats.inactive} inactive`}
      />

      <CategoryManagerDialog open={categoriesOpen} onOpenChange={setCategoriesOpen} />
      <PriceHistoryDialog
        material={historyFor}
        open={!!historyFor}
        onOpenChange={(o) => !o && setHistoryFor(null)}
      />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete ingredient?"
        description={`"${deleting?.ingredient_name}" and its price history will be permanently deleted. This can't be undone, and it's blocked if the ingredient is still used in any recipe.`}
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          if (!deleting) return;
          const m = deleting;
          try {
            await delMat.mutateAsync(m.id);
            toast.success("Ingredient deleted");
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Delete failed");
          }
        }}
      />
      <ConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        title={`Delete ${selected.size} ingredient${selected.size === 1 ? "" : "s"}?`}
        description="Permanently deletes the selected ingredients and their price history. Any still used in a recipe are skipped."
        confirmLabel="Delete"
        destructive
        onConfirm={runBulkDelete}
      />
      <ConfirmDialog
        open={bulkReactivateOpen}
        onOpenChange={setBulkReactivateOpen}
        title={`Reactivate ${selected.size} ingredient${selected.size === 1 ? "" : "s"}?`}
        description="They'll be available for new recipes again."
        confirmLabel="Reactivate"
        onConfirm={runReactivate}
      />
    </>
  );
}
