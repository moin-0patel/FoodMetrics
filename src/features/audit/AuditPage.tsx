import { useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { cn, formatDateTime, formatINR, percentChangeLabel } from "@/lib/utils";
import { percentChange } from "@/lib/costing";
import { useUsers } from "@/features/users/hooks";
import { useMaterials } from "@/features/raw-materials/hooks";
import { useRecipes } from "@/features/recipes/hooks";
import { useAllPriceHistory, useAllRecipeCostHistory } from "./hooks";

type Kind = "all" | "ingredient" | "recipe";

interface Row {
  id: string;
  when: string;
  item: string;
  kind: "Ingredient Price" | "Recipe Cost";
  oldValue: number | null;
  newValue: number | null;
  pct: number;
  by: string | null;
}

export function AuditPage() {
  const { data: priceHistory = [] } = useAllPriceHistory();
  const { data: costHistory = [] } = useAllRecipeCostHistory();
  const { data: users = [] } = useUsers();
  const { data: materials = [] } = useMaterials();
  const { data: recipes = [] } = useRecipes();

  const usersById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
  const materialsById = useMemo(() => new Map(materials.map((m) => [m.id, m])), [materials]);
  const recipesById = useMemo(() => new Map(recipes.map((r) => [r.id, r])), [recipes]);

  const [kind, setKind] = useState<Kind>("all");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const rows = useMemo<Row[]>(() => {
    const ing: Row[] = priceHistory.map((h) => ({
      id: h.id,
      when: h.changed_at,
      item: materialsById.get(h.ingredient_id)?.ingredient_name ?? "—",
      kind: "Ingredient Price",
      oldValue: h.old_price,
      newValue: h.new_price,
      pct: percentChange(h.old_price ?? 0, h.new_price ?? 0),
      by: h.changed_by,
    }));
    const rec: Row[] = costHistory.map((h) => ({
      id: h.id,
      when: h.changed_at,
      item: recipesById.get(h.recipe_id)?.recipe_name ?? "—",
      kind: "Recipe Cost",
      oldValue: h.old_total_cost,
      newValue: h.new_total_cost,
      pct: percentChange(h.old_total_cost ?? 0, h.new_total_cost ?? 0),
      by: h.changed_by,
    }));
    let all = [...ing, ...rec];
    if (kind === "ingredient") all = ing;
    if (kind === "recipe") all = rec;
    if (search) all = all.filter((r) => r.item.toLowerCase().includes(search.toLowerCase()));
    if (from) all = all.filter((r) => r.when >= from);
    if (to) all = all.filter((r) => r.when <= to + "T23:59:59.999Z");
    return all.sort((a, b) => b.when.localeCompare(a.when));
  }, [priceHistory, costHistory, materialsById, recipesById, kind, search, from, to]);

  return (
    <>
      <PageHeader
        title="Price Changes"
        description="Every ingredient price and recipe cost change — from, to, who, and when."
      />

      <Card className="mb-4 p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as Kind)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Changes</SelectItem>
                <SelectItem value="ingredient">Ingredient Prices</SelectItem>
                <SelectItem value="recipe">Recipe Costs</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Search</Label>
            <Input placeholder="Item name…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>From</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>To</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
      </Card>

      <Card>
        {rows.length === 0 ? (
          <EmptyState title="No price changes yet" description="Update an ingredient price and it will appear here." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Item</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Old</TableHead>
                <TableHead>New</TableHead>
                <TableHead>Change</TableHead>
                <TableHead>By</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const up = r.pct >= 0;
                return (
                  <TableRow key={`${r.kind}-${r.id}`}>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{formatDateTime(r.when)}</TableCell>
                    <TableCell className="font-medium">{r.item}</TableCell>
                    <TableCell>
                      <Badge variant={r.kind === "Ingredient Price" ? "info" : "secondary"}>{r.kind}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-muted-foreground">{formatINR(r.oldValue)}</TableCell>
                    <TableCell className="font-mono font-semibold">
                      <span className="inline-flex items-center gap-1">
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        {formatINR(r.newValue)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={cn("inline-flex items-center gap-1 font-semibold", up ? "text-red-600" : "text-emerald-600")}>
                        {up ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                        {percentChangeLabel(r.pct)}
                      </span>
                    </TableCell>
                    <TableCell>{usersById.get(r.by ?? "")?.name ?? "—"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>
    </>
  );
}
