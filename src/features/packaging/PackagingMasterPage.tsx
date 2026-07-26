import { useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Power, Package, LayoutGrid, Rows3 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatTile } from "@/components/StatTile";
import { FilterChips, type Chip } from "@/components/FilterChips";
import { PackagingCard } from "./PackagingCard";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";
import { TableSkeleton } from "@/components/TableSkeleton";
import { toast } from "@/components/ui/use-toast";
import { formatINR } from "@/lib/utils";
import { useSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { PACKAGING_TYPE_LABELS, type PackagingItem, type PackagingType } from "@/lib/data/types";
import { usePackagingItems, useDeletePackaging, useSetPackagingStatus } from "./hooks";
import { useBrandScope } from "@/features/brands/useBrandScope";
import { PackagingForm } from "./PackagingForm";

export function PackagingMasterPage() {
  const role = useSession((s) => s.user?.role);
  const canManage = can(role, "packaging.manage");
  const { data: items = [], isLoading } = usePackagingItems();
  const { inPackagingScope } = useBrandScope();
  const delMut = useDeletePackaging();
  const statusMut = useSetPackagingStatus();

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<PackagingItem | null>(null);
  const [deleting, setDeleting] = useState<PackagingItem | null>(null);
  const [view, setView] = useState<"gallery" | "table">("gallery");

  const filtered = useMemo(
    () =>
      items.filter((p) => {
        if (!inPackagingScope(p.id)) return false; // brand scope: only this brand's packaging
        if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
        if (typeFilter !== "all" && p.packaging_type !== typeFilter) return false;
        return true;
      }),
    [items, search, typeFilter, inPackagingScope],
  );

  const openAdd = () => {
    setEditing(null);
    setFormOpen(true);
  };

  /** Flip active/inactive — same mutation the table's Power button uses. */
  const toggleStatus = (p: PackagingItem) =>
    statusMut.mutate({ id: p.id, status: p.status === "active" ? "inactive" : "active" });

  const typeLabel = (t: string) => PACKAGING_TYPE_LABELS[t as PackagingType] ?? t;

  // Cost readings over the in-scope packaging master. Average is null (not zero)
  // when nothing is priced, so the tile shows "—".
  const stats = useMemo(() => {
    const scoped = items.filter((p) => inPackagingScope(p.id));
    const prices = scoped.map((p) => p.unit_price).filter((n): n is number => n != null);
    const active = scoped.filter((p) => p.status === "active").length;
    return {
      total: scoped.length,
      active,
      inactive: scoped.length - active,
      avg: prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : null,
      dearest: prices.length ? Math.max(...prices) : null,
    };
  }, [items, inPackagingScope]);

  const typeChips = useMemo<Chip[]>(() => {
    const scoped = items.filter((p) => inPackagingScope(p.id));
    const count = (t: string) => scoped.filter((p) => p.packaging_type === t).length;
    return [
      { value: "all", label: "All", count: scoped.length },
      { value: "primary", label: "Primary", count: count("primary") },
      { value: "secondary", label: "Secondary", count: count("secondary") },
      { value: "tertiary", label: "Tertiary", count: count("tertiary") },
    ];
  }, [items, inPackagingScope]);

  return (
    <>
      <PageHeader
        eyebrow="Resource Management"
        title="Packaging Intelligence"
        description="Master packaging items (Pizza Box, Sauce Cup…) with unit prices, used by recipes."
        actions={
          canManage && (
            <Button variant="accent" onClick={openAdd}>
              <Plus className="h-4 w-4" /> Add Packaging
            </Button>
          )
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <StatTile
          label="Average Unit Cost"
          value={stats.avg == null ? "—" : formatINR(stats.avg)}
          valueTone="accent"
          emptyHint={stats.avg == null ? "No priced packaging yet" : `Across ${stats.total} item${stats.total === 1 ? "" : "s"}`}
        />
        <StatTile
          label="Dearest Item"
          value={stats.dearest == null ? "—" : formatINR(stats.dearest)}
          emptyHint={stats.dearest == null ? "Needs a priced item" : "Highest unit price in the master"}
        />
        <StatTile
          label="Active Items"
          value={isLoading ? "—" : String(stats.active)}
          tone="good"
          progress={stats.total === 0 ? null : (stats.active / stats.total) * 100}
          emptyHint={stats.total === 0 ? "No packaging yet" : `${stats.inactive} inactive`}
        />
      </div>

      <Card className="mb-4 p-4">
        <FilterChips label="Type" className="mb-3" value={typeFilter} onChange={setTypeFilter} chips={typeChips} />
        <Input placeholder="Search packaging library…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </Card>

      {/* Gallery matches the design; the table keeps the dense columns. */}
      <div className="mb-3 flex items-center justify-end gap-1.5">
        <span className="mr-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          View
        </span>
        <Button variant={view === "gallery" ? "accent" : "outline"} size="sm" onClick={() => setView("gallery")} aria-pressed={view === "gallery"}>
          <LayoutGrid className="h-4 w-4" /> Gallery
        </Button>
        <Button variant={view === "table" ? "accent" : "outline"} size="sm" onClick={() => setView("table")} aria-pressed={view === "table"}>
          <Rows3 className="h-4 w-4" /> Table
        </Button>
      </div>

      {view === "gallery" && !isLoading && filtered.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((p) => (
            <PackagingCard
              key={p.id}
              item={p}
              canManage={canManage}
              onEdit={() => {
                setEditing(p);
                setFormOpen(true);
              }}
              onToggleStatus={() => toggleStatus(p)}
            />
          ))}
        </div>
      )}

      {(view === "table" || isLoading || filtered.length === 0) && (
      <Card>
        {isLoading ? (
          <TableSkeleton rows={6} cols={5} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Package className="h-7 w-7" />}
            title="No packaging items yet"
            description="Add packaging items so recipes can reference them with automatic pricing."
            action={canManage && <Button variant="accent" onClick={openAdd}><Plus className="h-4 w-4" /> Add Packaging</Button>}
          />
        ) : (
          <>
            {/* Desktop */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead>Status</TableHead>
                    {canManage && <TableHead className="w-28" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell className="text-muted-foreground">{typeLabel(p.packaging_type)}</TableCell>
                      <TableCell className="text-muted-foreground">{p.unit}</TableCell>
                      <TableCell className="text-right font-mono">{formatINR(p.unit_price)}</TableCell>
                      <TableCell>
                        <Badge variant={p.status === "active" ? "default" : "outline"}>{p.status}</Badge>
                      </TableCell>
                      {canManage && (
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" aria-label="Edit" onClick={() => { setEditing(p); setFormOpen(true); }}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={p.status === "active" ? "Deactivate" : "Activate"}
                              onClick={() => statusMut.mutate({ id: p.id, status: p.status === "active" ? "inactive" : "active" })}
                            >
                              <Power className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" aria-label="Delete" className="text-destructive" onClick={() => setDeleting(p)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile */}
            <ul className="divide-y md:hidden">
              {filtered.map((p) => (
                <li key={p.id} className="flex items-start justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{typeLabel(p.packaging_type)} · {p.unit}</p>
                    <p className="mt-1 font-mono text-sm">{formatINR(p.unit_price)}</p>
                  </div>
                  {canManage && (
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" aria-label="Edit" onClick={() => { setEditing(p); setFormOpen(true); }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" aria-label="Delete" className="text-destructive" onClick={() => setDeleting(p)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>
      )}

      {canManage && <PackagingForm open={formOpen} onOpenChange={setFormOpen} item={editing} />}

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete "${deleting?.name}"?`}
        description="This permanently removes the packaging item. It's blocked if any recipe still uses it — deactivate instead."
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await delMut.mutateAsync(deleting.id);
            toast.success("Packaging item deleted");
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Delete failed");
          } finally {
            setDeleting(null);
          }
        }}
      />
    </>
  );
}
