import { useMemo, useState } from "react";
import { ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { MoreVertical, Plus, Trash2, Trash } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatTile } from "@/components/StatTile";
import { EmptyState } from "@/components/EmptyState";
import { TableSkeleton } from "@/components/TableSkeleton";
import { Pagination } from "@/components/Pagination";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { formatINR, formatDate } from "@/lib/utils";
import { useSession } from "@/lib/auth/session";
import { accessibleOutlets, canAccessOutlet, canManageWastage, userBrands } from "@/lib/auth/permissions";
import { WASTAGE_TYPES, type WastageEntry } from "@/lib/data/types";
import { useMaterials } from "@/features/raw-materials/hooks";
import { useRecipes } from "@/features/recipes/hooks";
import { useBrands, useOutlets } from "@/features/brands/hooks";
import { useUsersMap } from "@/features/users/hooks";
import { useWastage, useDeleteWastage } from "./hooks";
import { WastageForm } from "./WastageForm";
import { toast } from "@/components/ui/use-toast";

const PAGE_SIZE = 10;

export function WastagePage() {
  const user = useSession((s) => s.user)!;
  const canEdit = canManageWastage(user);
  const { data: brands = [] } = useBrands();
  const allBrandIds = brands.map((b) => b.id);
  const myBrands = userBrands(user, allBrandIds);
  const { data: outlets = [] } = useOutlets();
  const myOutlets = accessibleOutlets(user, outlets, allBrandIds);
  const { data: entries = [], isLoading, error } = useWastage();
  const { data: materials = [] } = useMaterials();
  const { data: recipes = [] } = useRecipes();
  const deleteMut = useDeleteWastage();

  const { map: usersMap } = useUsersMap();
  const matById = useMemo(() => new Map(materials.map((m) => [m.id, m.ingredient_name])), [materials]);
  const recById = useMemo(() => new Map(recipes.map((r) => [r.id, r.recipe_name])), [recipes]);
  const outletName = useMemo(() => new Map(outlets.map((o) => [o.id, o.name])), [outlets]);
  const brandName = useMemo(() => new Map(brands.map((b) => [b.id, b.name])), [brands]);
  const itemName = (w: WastageEntry) =>
    w.item_type === "recipe" ? recById.get(w.recipe_id ?? "") ?? "—" : matById.get(w.ingredient_id ?? "") ?? "—";

  const [search, setSearch] = useState("");
  const [brand, setBrand] = useState("all");
  const [outlet, setOutlet] = useState("all");
  const [type, setType] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<WastageEntry | null>(null);
  const [deleting, setDeleting] = useState<WastageEntry | null>(null);

  const filtered = useMemo(() => {
    return entries.filter((w) => {
      // §11/§12 outlet roles only ever see their permitted outlets' wastage.
      if (!canAccessOutlet(user, w.outlet_id, outlets, allBrandIds)) return false;
      if (brand !== "all" && w.brand !== brand) return false;
      if (outlet !== "all" && w.outlet_id !== outlet) return false;
      if (type !== "all" && w.wastage_type !== type) return false;
      // §23 day-wise filter — inclusive local-day boundaries on the YYYY-MM-DD date.
      const day = w.wastage_date.slice(0, 10);
      if (from && day < from) return false;
      if (to && day > to) return false;
      if (search) {
        const hay = `${w.name ?? ""} ${itemName(w)} ${w.category ?? ""} ${w.reason ?? ""}`.toLowerCase();
        if (!hay.includes(search.toLowerCase())) return false;
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, brand, outlet, type, from, to, search, matById, recById, user, outlets, allBrandIds]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const pageItems = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  // Summary + reports (§14)
  const stats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const month = today.slice(0, 7);
    const todayCost = filtered.filter((w) => w.wastage_date === today).reduce((s, w) => s + w.total_cost, 0);
    const monthCost = filtered.filter((w) => w.wastage_date.slice(0, 7) === month).reduce((s, w) => s + w.total_cost, 0);
    const totalCost = filtered.reduce((s, w) => s + w.total_cost, 0);
    const byOutletMap = new Map<string, number>();
    const byTypeMap = new Map<string, number>();
    const byBrandMap = new Map<string, number>();
    const byReasonMap = new Map<string, number>();
    const byDayMap = new Map<string, number>();
    const recipeMap = new Map<string, number>();
    const ingredientMap = new Map<string, number>();
    for (const w of filtered) {
      byOutletMap.set(w.outlet_id, (byOutletMap.get(w.outlet_id) ?? 0) + w.total_cost);
      byTypeMap.set(w.wastage_type, (byTypeMap.get(w.wastage_type) ?? 0) + w.total_cost);
      byBrandMap.set(w.brand, (byBrandMap.get(w.brand) ?? 0) + w.total_cost);
      const reason = w.reason || "Unspecified";
      byReasonMap.set(reason, (byReasonMap.get(reason) ?? 0) + w.total_cost);
      byDayMap.set(w.wastage_date, (byDayMap.get(w.wastage_date) ?? 0) + w.total_cost);
      const key = itemName(w);
      (w.item_type === "recipe" ? recipeMap : ingredientMap).set(key, ((w.item_type === "recipe" ? recipeMap : ingredientMap).get(key) ?? 0) + w.total_cost);
    }
    const top = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1])[0];
    const toData = (m: Map<string, number>, fmt: (k: string) => string = (k) => k) =>
      [...m.entries()].map(([name, cost]) => ({ name: fmt(name), cost: Math.round(cost) })).sort((a, b) => b.cost - a.cost).slice(0, 6);
    // Daily trend — last 30 days.
    const daily: { date: string; cost: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10);
      daily.push({ date: d.slice(5), cost: Math.round(byDayMap.get(d) ?? 0) });
    }
    const inventoryValue = materials.filter((m) => m.status === "active").reduce((s, m) => s + (m.purchase_price ?? 0), 0);
    const topItem = top(ingredientMap);
    const topRecipe = top(recipeMap);
    return {
      todayCost,
      monthCost,
      totalCost,
      topOutlet: top(byOutletMap) ? outletName.get(top(byOutletMap)[0]) ?? "—" : "—",
      topItem: topItem ? topItem[0] : "—",
      topRecipe: topRecipe ? topRecipe[0] : "—",
      pctOfInventory: inventoryValue > 0 ? (totalCost / inventoryValue) * 100 : 0,
      byOutlet: myOutlets
        .filter((o) => o.status === "active" || (byOutletMap.get(o.id) ?? 0) > 0)
        .map((o) => ({ name: o.name, cost: Math.round(byOutletMap.get(o.id) ?? 0) })),
      byType: toData(byTypeMap, (k) => k.replace(" Wastage", "")),
      byBrand: brands
        .filter((b) => b.status === "active" || (byBrandMap.get(b.id) ?? 0) > 0)
        .map((b) => ({ name: b.name, cost: Math.round(byBrandMap.get(b.id) ?? 0) })),
      byReason: toData(byReasonMap),
      topItems: toData(ingredientMap),
      daily,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, materials, matById, recById, outlets, brands]);

  const resetPage = () => setPage(1);

  return (
    <>
      <PageHeader
        eyebrow="Operations"
        title="Wastage Management"
        description="Record and analyse operational wastage across all outlets."
        actions={
          canEdit && (
            <Button variant="accent" onClick={() => { setEditing(null); setFormOpen(true); }}>
              <Plus className="h-4 w-4" /> Record Wastage
            </Button>
          )
        }
      />

      {/* Summary cards (§14) — every figure derives from recorded entries. */}
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Today's Wastage"
          value={entries.length === 0 ? "—" : formatINR(stats.todayCost)}
          valueTone={stats.todayCost > 0 ? "bad" : "good"}
          emptyHint={entries.length === 0 ? "No wastage recorded yet" : "Cost logged today"}
        />
        <StatTile
          label="This Month"
          value={entries.length === 0 ? "—" : formatINR(stats.monthCost)}
          emptyHint={entries.length === 0 ? undefined : `All-time ${formatINR(stats.totalCost)}`}
        />
        <StatTile
          label="Vs Inventory Value"
          value={stats.pctOfInventory > 0 ? `${stats.pctOfInventory.toFixed(1)}%` : "—"}
          tone={stats.pctOfInventory > 5 ? "bad" : stats.pctOfInventory > 2 ? "warning" : "good"}
          progress={stats.pctOfInventory > 0 ? Math.min(100, stats.pctOfInventory * 10) : null}
          emptyHint={stats.pctOfInventory > 0 ? undefined : "Needs priced ingredients and entries"}
        />
        <StatTile
          label="Top Wasted Ingredient"
          value={stats.topItem === "—" ? "—" : stats.topItem}
          valueTone={stats.topItem === "—" ? "neutral" : "bad"}
          emptyHint={stats.topItem === "—" ? "No wastage lines yet" : "Highest cost impact"}
        />
        <StatTile
          label="Top Outlet"
          value={stats.topOutlet}
          emptyHint={stats.topOutlet === "—" ? "No outlet has recorded wastage" : "Most wastage recorded"}
        />
        <StatTile
          label="Top Recipe"
          value={stats.topRecipe}
          emptyHint={stats.topRecipe === "—" ? "No recipe wastage logged" : "Most wasted dish"}
        />
        <StatTile
          label="Entries Logged"
          value={String(entries.length)}
          valueTone="accent"
          emptyHint={entries.length === 0 ? "Record wastage to start tracking" : undefined}
        />
        <StatTile
          label="All-Time Cost"
          value={entries.length === 0 ? "—" : formatINR(stats.totalCost)}
          emptyHint={entries.length === 0 ? "Nothing recorded" : "Across every outlet"}
        />
      </div>

      {/* Reports (§14) */}
      <Card className="mb-4 p-4">
        <p className="mb-3 text-sm font-semibold">Daily Wastage Trend (last 30 days)</p>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={stats.daily} margin={{ top: 4, right: 12, left: -12, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={4} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: number) => formatINR(v)} labelFormatter={(l) => `Day ${l}`} />
            <Line type="monotone" dataKey="cost" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </Card>
      <div className="mb-4 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <Breakdown title="By Outlet" data={stats.byOutlet} />
        <Breakdown title="By Wastage Type" data={stats.byType} />
        <Breakdown title="By Brand" data={stats.byBrand} />
        <Breakdown title="By Reason" data={stats.byReason} />
        <Breakdown title="Top Wasted Ingredients" data={stats.topItems} />
      </div>

      {/* Filters */}
      <Card className="mb-4 p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <Input placeholder="Search item / reason…" value={search} onChange={(e) => { setSearch(e.target.value); resetPage(); }} />
          <Select value={brand} onValueChange={(v) => { setBrand(v); setOutlet("all"); resetPage(); }}>
            <SelectTrigger><SelectValue placeholder="Brand" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Brands</SelectItem>
              {brands.filter((b) => b.status === "active" && myBrands.includes(b.id)).map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={outlet} onValueChange={(v) => { setOutlet(v); resetPage(); }}>
            <SelectTrigger><SelectValue placeholder="Outlet" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Outlets</SelectItem>
              {myOutlets.filter((o) => brand === "all" || o.brand_id === brand).map((o) => (
                <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={type} onValueChange={(v) => { setType(v); resetPage(); }}>
            <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {WASTAGE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input type="date" aria-label="From date" value={from} onChange={(e) => { setFrom(e.target.value); resetPage(); }} />
          <Input type="date" aria-label="To date" value={to} onChange={(e) => { setTo(e.target.value); resetPage(); }} />
        </div>
      </Card>

      <Card>
        {error ? (
          <div className="py-12 text-center text-sm text-destructive">
            Unable to load wastage. Please refresh and try again.
          </div>
        ) : isLoading ? (
          <TableSkeleton rows={6} cols={6} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Trash className="h-7 w-7" />}
            title="No wastage recorded"
            description="Record operational wastage to track spoilage, overproduction and losses by outlet."
            action={canEdit && <Button variant="accent" onClick={() => { setEditing(null); setFormOpen(true); }}><Plus className="h-4 w-4" /> Record Wastage</Button>}
          />
        ) : (
          <>
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Wastage</TableHead>
                    <TableHead>Brand</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Total Cost</TableHead>
                    <TableHead>Created By</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageItems.map((w) => (
                    <TableRow key={w.id}>
                      <TableCell className="font-medium">
                        {w.name || itemName(w)}
                        <span className="block text-xs font-normal text-muted-foreground">{outletName.get(w.outlet_id) ?? w.outlet_id} · {w.wastage_type.replace(" Wastage", "")}</span>
                      </TableCell>
                      <TableCell className="text-sm">{brandName.get(w.brand) ?? w.brand}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{w.category || "—"}</TableCell>
                      <TableCell className="text-right font-mono font-semibold">{formatINR(w.total_cost)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{w.entered_by ? usersMap.get(w.entered_by)?.name ?? "—" : "—"}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm">{formatDate(w.wastage_date)}</TableCell>
                      <TableCell><Badge variant="outline">{w.status || "recorded"}</Badge></TableCell>
                      <TableCell>{canEdit && <RowActions onEdit={() => { setEditing(w); setFormOpen(true); }} onDelete={() => setDeleting(w)} />}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <ul className="divide-y md:hidden">
              {pageItems.map((w) => (
                <li key={w.id} className="flex items-start gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{w.name || itemName(w)}</p>
                    <p className="text-xs text-muted-foreground">{brandName.get(w.brand) ?? w.brand} · {w.category || outletName.get(w.outlet_id)} · {formatDate(w.wastage_date)}</p>
                    <p className="mt-1 text-sm"><Badge variant="outline" className="mr-2">{w.status || "recorded"}</Badge><span className="font-semibold">{formatINR(w.total_cost)}</span></p>
                  </div>
                  {canEdit && <RowActions onEdit={() => { setEditing(w); setFormOpen(true); }} onDelete={() => setDeleting(w)} />}
                </li>
              ))}
            </ul>

            <Pagination page={current} pageSize={PAGE_SIZE} total={filtered.length} onPageChange={setPage} label="entries" />
          </>
        )}
      </Card>

      <WastageForm open={formOpen} onOpenChange={setFormOpen} record={editing} />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete wastage entry?"
        description="This wastage record will be permanently removed."
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await deleteMut.mutateAsync(deleting.id);
            toast.success("Wastage entry deleted");
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Delete failed");
          }
        }}
      />
    </>
  );
}


function Breakdown({ title, data }: { title: string; data: { name: string; cost: number }[] }) {
  const hasData = data.some((d) => d.cost > 0);
  return (
    <Card className="p-4">
      <p className="mb-3 text-sm font-semibold">{title}</p>
      {!hasData ? (
        <p className="flex h-[180px] items-center justify-center text-sm text-muted-foreground">No data.</p>
      ) : (
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
            <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-15} textAnchor="end" height={42} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: number) => formatINR(v)} cursor={{ fill: "hsl(var(--muted))" }} />
            <Bar dataKey="cost" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}

function RowActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Wastage entry actions">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onEdit}>Edit</DropdownMenuItem>
        <DropdownMenuItem onClick={onDelete} className="text-destructive">
          <Trash2 className="h-4 w-4" /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
