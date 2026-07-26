import { useMemo, useState } from "react";
import { Link2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/EmptyState";
import { TableSkeleton } from "@/components/TableSkeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";
import { type AccessType } from "@/lib/data/types";
import { useSession } from "@/lib/auth/session";
import { useRecipes } from "@/features/recipes/hooks";
import { useBrands } from "@/features/brands/hooks";
import { brandLabel } from "@/lib/data/brandCache";
import { useAccessLinks, useRevokeAccessLink } from "@/features/exports/accessHooks";

const ACCESS_LABELS: Record<AccessType, string> = {
  READ_ONLY: "View only",
  DOWNLOAD_PDF: "Download PDF",
  VIEW_AND_DOWNLOAD: "View & download",
};
const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" }) : "—");

/** §17 Access History — all shared recipe links (Given By / Given To / status), with
 *  revoke. Rendered inside the Reports "Access History" tab (no PageHeader). */
export function AccessHistoryPanel() {
  const { data: links = [], isLoading, isError } = useAccessLinks();
  const { data: recipes = [] } = useRecipes();
  const { data: brands = [] } = useBrands();
  const user = useSession((s) => s.user);
  const revoke = useRevokeAccessLink();
  const [search, setSearch] = useState("");
  const [type, setType] = useState("all");
  const [status, setStatus] = useState("all");
  const [brand, setBrand] = useState("all");

  const recipeName = useMemo(() => new Map(recipes.map((r) => [r.id, r.recipe_name])), [recipes]);

  const filtered = useMemo(
    () =>
      links.filter((l) => {
        if (type !== "all" && l.access_type !== type) return false;
        if (status !== "all" && l.status !== status) return false;
        if (brand !== "all" && (l.granted_to_brand_id ?? "") !== brand) return false;
        if (search) {
          const hay = `${recipeName.get(l.recipe_id) ?? ""} ${l.granted_by_name} ${l.granted_to_email ?? ""}`.toLowerCase();
          if (!hay.includes(search.toLowerCase())) return false;
        }
        return true;
      }),
    [links, type, status, brand, search, recipeName],
  );

  return (
    <>
      <p className="mb-4 text-sm text-muted-foreground">
        Every temporary recipe share link — who granted access, to whom, and its status.
      </p>

      <Card className="mb-4 p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Input placeholder="Search recipe / grantor / email…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Select value={type} onValueChange={setType}>
            <SelectTrigger><SelectValue placeholder="Access Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Access Types</SelectItem>
              {(Object.keys(ACCESS_LABELS) as AccessType[]).map((t) => <SelectItem key={t} value={t}>{ACCESS_LABELS[t]}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="EXPIRED">Expired</SelectItem>
              <SelectItem value="REVOKED">Revoked</SelectItem>
            </SelectContent>
          </Select>
          <Select value={brand} onValueChange={setBrand}>
            <SelectTrigger><SelectValue placeholder="Brand" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Brands</SelectItem>
              {brands.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card>
        {isError ? (
          <div className="py-12 text-center text-sm text-destructive">Unable to load access history. Please refresh.</div>
        ) : isLoading ? (
          <TableSkeleton rows={6} cols={7} />
        ) : filtered.length === 0 ? (
          <EmptyState icon={<Link2 className="h-7 w-7" />} title="No share links yet" description="Temporary recipe links created from a recipe page appear here." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Recipe</TableHead>
                <TableHead>Given By</TableHead>
                <TableHead>Given To</TableHead>
                <TableHead>Access</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead>Last Accessed</TableHead>
                <TableHead className="text-right">Views</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="font-medium">{recipeName.get(l.recipe_id) ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{l.granted_by_name}</TableCell>
                  <TableCell className="text-muted-foreground">{l.granted_to_email ?? l.granted_to_role ?? brandLabel(l.granted_to_brand_id) ?? "Anyone with link"}</TableCell>
                  <TableCell className="text-muted-foreground">{ACCESS_LABELS[l.access_type]}</TableCell>
                  <TableCell className="text-muted-foreground">{fmt(l.created_at)}</TableCell>
                  <TableCell className="text-muted-foreground">{fmt(l.expires_at)}</TableCell>
                  <TableCell className="text-muted-foreground">{fmt(l.last_accessed_at)}</TableCell>
                  <TableCell className="text-right font-mono">{l.access_count}</TableCell>
                  <TableCell>
                    <Badge variant={l.status === "ACTIVE" ? "success" : l.status === "REVOKED" ? "danger" : "secondary"}>{l.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {l.status === "ACTIVE" && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={revoke.isPending}
                        onClick={async () => {
                          try {
                            await revoke.mutateAsync({ id: l.id, byUserId: user?.id ?? null });
                            toast.success("Recipe link revoked successfully.");
                          } catch {
                            toast.error("Unable to revoke the link.");
                          }
                        }}
                      >
                        Revoke
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </>
  );
}
