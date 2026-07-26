import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Archive, ChevronRight, MoreVertical, Plus, ShieldCheck, Store } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { TableSkeleton } from "@/components/TableSkeleton";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/components/ui/use-toast";
import type { BrandOutletStatus, BrandRecord, OutletRecord } from "@/lib/data/types";
import {
  useBrands,
  useDeleteBrand,
  useDeleteOutlet,
  useOutlets,
  useSetBrandStatus,
  useSetOutletStatus,
} from "./hooks";
import { OutletForm } from "./OutletForm";

function StatusBadge({ status }: { status: BrandOutletStatus }) {
  const variant = status === "active" ? "success" : status === "inactive" ? "secondary" : "outline";
  return <Badge variant={variant} className="capitalize">{status}</Badge>;
}

export function BrandsOutletsPage() {
  const { data: brands = [], isLoading: brandsLoading } = useBrands();
  const { data: outlets = [], isLoading: outletsLoading } = useOutlets();
  const setBrandStatus = useSetBrandStatus();
  const deleteBrand = useDeleteBrand();
  const setOutletStatus = useSetOutletStatus();
  const deleteOutlet = useDeleteOutlet();

  const navigate = useNavigate();
  const [outletFormOpen, setOutletFormOpen] = useState(false);
  const [editingOutlet, setEditingOutlet] = useState<OutletRecord | null>(null);
  const [outletDefaultBrand, setOutletDefaultBrand] = useState<string | undefined>();
  const [outletBrandFilter, setOutletBrandFilter] = useState("all");
  const [deletingBrand, setDeletingBrand] = useState<BrandRecord | null>(null);
  const [deletingOutlet, setDeletingOutlet] = useState<OutletRecord | null>(null);

  const brandName = useMemo(() => new Map(brands.map((b) => [b.id, b.name])), [brands]);
  const outletCount = useMemo(() => {
    const m = new Map<string, number>();
    for (const o of outlets) m.set(o.brand_id, (m.get(o.brand_id) ?? 0) + 1);
    return m;
  }, [outlets]);

  const filteredOutlets = useMemo(
    () => (outletBrandFilter === "all" ? outlets : outlets.filter((o) => o.brand_id === outletBrandFilter)),
    [outlets, outletBrandFilter],
  );

  // Reset a stale brand filter when the selected brand is deleted.
  useEffect(() => {
    if (outletBrandFilter !== "all" && !brands.some((b) => b.id === outletBrandFilter)) {
      setOutletBrandFilter("all");
    }
  }, [brands, outletBrandFilter]);

  const openNewBrand = () => navigate("/brands/new");
  const openEditBrand = (b: BrandRecord) => navigate(`/brands/${b.id}/edit`);
  const openNewOutlet = (brandId?: string) => {
    setEditingOutlet(null);
    setOutletDefaultBrand(brandId);
    setOutletFormOpen(true);
  };
  const openEditOutlet = (o: OutletRecord) => {
    setEditingOutlet(o);
    setOutletDefaultBrand(undefined);
    setOutletFormOpen(true);
  };

  const changeBrandStatus = async (b: BrandRecord, status: BrandOutletStatus) => {
    try {
      await setBrandStatus.mutateAsync({ id: b.id, status });
      toast.success(`Brand ${status === "active" ? "activated" : status === "inactive" ? "deactivated" : "archived"}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    }
  };
  const changeOutletStatus = async (o: OutletRecord, status: BrandOutletStatus) => {
    try {
      await setOutletStatus.mutateAsync({ id: o.id, status });
      toast.success(`Outlet ${status === "active" ? "activated" : status === "inactive" ? "deactivated" : "archived"}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    }
  };
  const confirmDeleteBrand = async () => {
    if (!deletingBrand) return;
    try {
      await deleteBrand.mutateAsync(deletingBrand.id);
      toast.success("Brand deleted");
      setDeletingBrand(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  };
  const confirmDeleteOutlet = async () => {
    if (!deletingOutlet) return;
    try {
      await deleteOutlet.mutateAsync(deletingOutlet.id);
      toast.success("Outlet deleted");
      setDeletingOutlet(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  };

  return (
    <>
      <PageHeader
        title="Brands & Outlets"
        description="Add and manage restaurant brands and their outlets. Only a Super Admin can change these."
      />

      <Card className="mb-4 flex items-center gap-3 border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/30">
        <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-400" />
        <p className="text-sm text-emerald-900 dark:text-emerald-200">
          New outlets appear automatically across wastage, reports, user access, dashboards and exports —
          no code change or redeploy needed.
        </p>
      </Card>

      {/* Structure overview */}
      <Card className="mb-4 p-4">
        <div className="text-sm font-semibold">Food Metrics</div>
        <div className="mt-1 space-y-1 pl-2">
          {brands.map((b) => (
            <div key={b.id}>
              <div className="flex items-center gap-1.5 text-sm font-medium">
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full ring-1 ring-border"
                  style={{ backgroundColor: b.accent_color ?? "#888" }}
                />
                {b.name}
                {b.status !== "active" && <StatusBadge status={b.status} />}
              </div>
              <div className="ml-6 space-y-0.5">
                {outlets.filter((o) => o.brand_id === b.id).length === 0 ? (
                  <div className="text-xs text-muted-foreground">No outlets yet</div>
                ) : (
                  outlets
                    .filter((o) => o.brand_id === b.id)
                    .map((o) => (
                      <div key={o.id} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span className="text-muted-foreground/50">•</span>
                        {o.name}
                        {o.status !== "active" && <span className="capitalize">({o.status})</span>}
                      </div>
                    ))
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Tabs defaultValue="brands">
        <TabsList>
          <TabsTrigger value="brands">Brands</TabsTrigger>
          <TabsTrigger value="outlets">Outlets</TabsTrigger>
        </TabsList>

        {/* ── Brands ─────────────────────────────────────────────── */}
        <TabsContent value="brands">
          <div className="mb-3 flex justify-end">
            <Button variant="accent" onClick={openNewBrand}>
              <Plus className="h-4 w-4" /> New Brand
            </Button>
          </div>
          <Card className="overflow-x-auto">
            {brandsLoading ? (
              <TableSkeleton rows={3} cols={4} />
            ) : brands.length === 0 ? (
              <EmptyState title="No brands yet" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Brand</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead className="text-center">Outlets</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {brands.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-block h-3 w-3 rounded-full ring-1 ring-border"
                            style={{ backgroundColor: b.accent_color ?? "#888" }}
                          />
                          {b.name}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{b.brand_code}</TableCell>
                      <TableCell className="text-center">{outletCount.get(b.id) ?? 0}</TableCell>
                      <TableCell><StatusBadge status={b.status} /></TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditBrand(b)}>Edit</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openNewOutlet(b.id)}>
                              <Plus className="h-4 w-4" /> Add outlet
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {b.status !== "active" && (
                              <DropdownMenuItem onClick={() => changeBrandStatus(b, "active")}>Activate</DropdownMenuItem>
                            )}
                            {b.status !== "archived" && (
                              <DropdownMenuItem onClick={() => changeBrandStatus(b, "archived")}>
                                <Archive className="h-4 w-4" /> Archive
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => setDeletingBrand(b)}
                            >
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>

        {/* ── Outlets ────────────────────────────────────────────── */}
        <TabsContent value="outlets">
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Select value={outletBrandFilter} onValueChange={setOutletBrandFilter}>
              <SelectTrigger className="sm:w-56">
                <SelectValue placeholder="All brands" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All brands</SelectItem>
                {brands.map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="accent"
              onClick={() => openNewOutlet(outletBrandFilter === "all" ? undefined : outletBrandFilter)}
            >
              <Plus className="h-4 w-4" /> New Outlet
            </Button>
          </div>
          <Card className="overflow-x-auto">
            {outletsLoading ? (
              <TableSkeleton rows={4} cols={5} />
            ) : filteredOutlets.length === 0 ? (
              <EmptyState title="No outlets found" icon={<Store />} />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Outlet</TableHead>
                    <TableHead>Brand</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead className="hidden md:table-cell">City</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOutlets.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell className="font-medium">{o.name}</TableCell>
                      <TableCell className="text-muted-foreground">{brandName.get(o.brand_id) ?? o.brand_id}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{o.outlet_code}</TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground">{o.city ?? "—"}</TableCell>
                      <TableCell><StatusBadge status={o.status} /></TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditOutlet(o)}>Edit</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {o.status !== "active" && (
                              <DropdownMenuItem onClick={() => changeOutletStatus(o, "active")}>Activate</DropdownMenuItem>
                            )}
                            {o.status !== "archived" && (
                              <DropdownMenuItem onClick={() => changeOutletStatus(o, "archived")}>
                                <Archive className="h-4 w-4" /> Archive
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => setDeletingOutlet(o)}
                            >
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      <OutletForm
        open={outletFormOpen}
        onOpenChange={setOutletFormOpen}
        outlet={editingOutlet}
        defaultBrandId={outletDefaultBrand}
      />
      <ConfirmDialog
        open={!!deletingBrand}
        onOpenChange={(o) => !o && setDeletingBrand(null)}
        title={`Delete ${deletingBrand?.name}?`}
        description="Only possible if the brand has no outlets or recipes. Otherwise archive it to keep history."
        confirmLabel="Delete"
        destructive
        onConfirm={confirmDeleteBrand}
      />
      <ConfirmDialog
        open={!!deletingOutlet}
        onOpenChange={(o) => !o && setDeletingOutlet(null)}
        title={`Delete ${deletingOutlet?.name}?`}
        description="Only possible if the outlet has no wastage records. Otherwise archive it to keep history."
        confirmLabel="Delete"
        destructive
        onConfirm={confirmDeleteOutlet}
      />
    </>
  );
}
