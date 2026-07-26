import { EmptyState } from "@/components/EmptyState";
import { TableSkeleton } from "@/components/TableSkeleton";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/components/ui/use-toast";
import { viewerBrands, viewerShowCost } from "@/lib/auth/permissions";
import { useBrands } from "@/features/brands/hooks";
import { useUpdateUser, useViewers } from "@/features/users/hooks";

/** Viewer × brand access matrix. Rendered inside the User Management "Viewer Access"
 *  tab (no PageHeader of its own). */
export function ViewerAccessPanel() {
  const { viewers, isLoading } = useViewers();
  const updateUser = useUpdateUser();
  const { data: brandList = [] } = useBrands();
  const allBrandIds = brandList.map((b) => b.id);
  const activeBrands = brandList.filter((b) => b.status === "active");

  const toggleBrand = async (userId: string, current: string[], brand: string, on: boolean) => {
    const next = on ? [...new Set([...current, brand])] : current.filter((b) => b !== brand);
    // Writing the explicit list turns the default-everything into a restriction, and
    // clears any brand_scope so this legacy field stays the single source of truth
    // (otherwise a set brand_scope would silently override the restriction).
    await updateUser.mutateAsync({
      id: userId,
      patch: { accessible_brands: next, brand_scope: null, selected_brand_ids: [] },
    });
    toast.success("Access updated");
  };

  const toggleCost = async (userId: string, show: boolean) => {
    await updateUser.mutateAsync({ id: userId, patch: { show_cost: show } });
    toast.success(show ? "Costs shown for this viewer" : "Costs hidden for this viewer");
  };

  return (
    <>
      <p className="mb-4 text-sm text-muted-foreground">
        Viewers see everything by default. Uncheck a brand to restrict a viewer to particular items.
      </p>

      <Card>
        {isLoading ? (
          <TableSkeleton rows={4} cols={4} />
        ) : viewers.length === 0 ? (
          <EmptyState title="No viewers yet" description="Create a user with the Viewer role to grant access." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Viewer</TableHead>
                {activeBrands.map((b) => (
                  <TableHead key={b.id} className="text-center">{b.name}</TableHead>
                ))}
                <TableHead className="text-center">Show Costs</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {viewers.map((v) => {
                const brands = viewerBrands(v, allBrandIds); // unset → all (everything)
                return (
                  <TableRow key={v.id}>
                    <TableCell>
                      <div className="font-medium">{v.name}</div>
                      <div className="text-xs text-muted-foreground">{v.email}</div>
                    </TableCell>
                    {activeBrands.map((b) => (
                      <TableCell key={b.id} className="text-center">
                        <Checkbox
                          checked={brands.includes(b.id)}
                          onCheckedChange={(c) => toggleBrand(v.id, brands, b.id, !!c)}
                        />
                      </TableCell>
                    ))}
                    <TableCell className="text-center">
                      <Checkbox
                        checked={viewerShowCost(v)}
                        onCheckedChange={(c) => toggleCost(v.id, !!c)}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      <p className="mt-3 text-xs text-muted-foreground">
        Both brands checked = full access (the default). Uncheck one to limit the viewer to the
        other. A viewer sees all <strong>approved</strong> recipes of their checked brands. "Show
        Costs" off hides ingredient costs, totals, and pricing.
      </p>
    </>
  );
}
