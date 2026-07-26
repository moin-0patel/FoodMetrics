import { useState } from "react";
import { useParams } from "react-router-dom";
import { FileDown, Loader2, Lock, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatUnit } from "@/lib/utils";
import type { ViewVisibility } from "@/lib/auth/permissions";
import { generateRecipePdf } from "@/features/reports/pdf";
import { toast } from "@/components/ui/use-toast";
import { useResolveShareLink } from "@/features/exports/accessHooks";
import { brandAccentHex, brandLabel } from "@/lib/data/brandCache";
import { Logo } from "@/components/brand/Logo";

const NEUTRAL_ACCENT = "#1b35a8";

/** Darken a #hex toward black by `amt` (0→1), for the gradient's far stop. */
function darken(hex: string, amt: number): string {
  const h = hex.replace(/^#/, "");
  const n = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const ch = (i: number) => Math.round(parseInt(n.slice(i, i + 2), 16) * (1 - amt));
  return `#${[ch(0), ch(2), ch(4)].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

/**
 * Look for the public shared page: a full-bleed background in the brand's own
 * colour. Brands are created in-app, so the accent comes from the brand record
 * (or is derived deterministically from its id) — no brand is hardcoded, and a
 * newly created brand themes correctly with no code change.
 */
function shareBrandStyle(brandId: string, label: string) {
  const accent = (brandId ? brandAccentHex(brandId) : null) ?? NEUTRAL_ACCENT;
  return {
    name: label || "Recipe",
    accent,
    grad: `linear-gradient(160deg, ${accent} 0%, ${darken(accent, 0.55)} 100%)`,
  };
}

// A shared link never exposes financial data (§19).
const NO_FINANCIALS: ViewVisibility = {
  ingredients: true,
  process: true,
  quantities: true,
  unitCosts: false,
  totalCost: false,
  costPerPortion: false,
  sellingPrice: false,
  grossProfit: false,
};

function Screen({ icon, title, sub }: { icon: React.ReactNode; title: string; sub: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <Card className="max-w-md p-8 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">{icon}</div>
        <h1 className="text-lg font-semibold">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{sub}</p>
        <p className="mt-4 text-xs text-muted-foreground">Shared via Food Metrics</p>
      </Card>
    </div>
  );
}

export function SharedRecipePage() {
  const { token } = useParams<{ token: string }>();
  const { data, isLoading, isError } = useResolveShareLink(token);
  const [busy, setBusy] = useState(false);

  if (isLoading) return <Screen icon={<Loader2 className="h-6 w-6 animate-spin" />} title="Opening recipe…" sub="Validating your link." />;
  if (isError || !data) return <Screen icon={<ShieldAlert className="h-6 w-6" />} title="This recipe link is invalid." sub="The link may be malformed or no longer available." />;
  if (data.status === "EXPIRED") return <Screen icon={<Lock className="h-6 w-6" />} title="This recipe link has expired." sub="Temporary links are valid for 7 days. Ask the sender for a new one." />;
  if (data.status === "REVOKED" || !data.recipe) return <Screen icon={<Lock className="h-6 w-6" />} title="This recipe link is no longer active." sub="Access has been revoked or the link is invalid." />;

  const recipe = data.recipe;
  const ingredients = data.ingredients ?? [];
  const subRecipes = data.subRecipes ?? [];
  const brandId = String(data.brand || recipe.brand || "");
  const bc = shareBrandStyle(brandId, brandLabel(brandId));
  const canDownload = data.access_type === "DOWNLOAD_PDF" || data.access_type === "VIEW_AND_DOWNLOAD";
  const method = (recipe.method ?? []).filter((s) => s.trim());

  return (
    <div className="min-h-screen py-8 sm:py-10" style={{ background: bc.grad }}>
      <div className="mx-auto max-w-3xl px-4">
        {/* Branded header on the brand-colour background */}
        <div className="mb-5 flex flex-col items-center gap-2 text-center">
          <span className="inline-flex items-center justify-center rounded-2xl bg-white px-5 py-3 shadow-lg ring-1 ring-black/5">
            <Logo size="lg" />
          </span>
          <p className="text-sm font-semibold text-white/95 drop-shadow-sm">{bc.name}</p>
        </div>

        <Card className="overflow-hidden p-0 shadow-2xl">
          <div className="h-1.5 w-full" style={{ backgroundColor: bc.accent }} />
          <div className="p-6 sm:p-8">
          <div className="flex items-start justify-between gap-3 border-b pb-4">
            <div>
              <p className="text-sm font-bold">Food Metrics</p>
              <p className="text-xs text-muted-foreground">Recipe Costing &amp; Operations</p>
            </div>
            <span
              className="rounded-md px-3 py-1 text-xs font-bold uppercase tracking-wide text-white"
              style={{ backgroundColor: bc.accent }}
            >
              {bc.name}
            </span>
          </div>

          <div className="mt-4">
            <h1 className="text-2xl font-bold tracking-tight">{recipe.recipe_name}</h1>
            <p className="text-sm text-muted-foreground">
              {[recipe.category, recipe.is_prep ? "In-House Prep" : null, recipe.size_label ?? null].filter(Boolean).join("  ·  ")}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Shared by {data.granted_by_name} · Read-only{canDownload ? " · Download enabled" : ""}
            </p>
          </div>

          {method.length > 0 && (
            <section className="mt-5">
              <h2 className="mb-1 text-sm font-semibold">Preparation</h2>
              <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
                {method.map((s, i) => <li key={i}>{s}</li>)}
              </ol>
            </section>
          )}

          <section className="mt-5">
            <h2 className="mb-1 text-sm font-semibold">Ingredients</h2>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">#</TableHead>
                  <TableHead>Ingredient</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead>Unit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ingredients.map((ing, idx) => (
                  <TableRow key={ing.id}>
                    <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                    <TableCell className="font-medium">
                      {ing.component_type === "recipe" ? (ing.subRecipe?.recipe_name ?? "Sub-recipe") : ing.material?.ingredient_name ?? "—"}
                      {ing.component_type === "recipe" && <span className="ml-1.5 text-[11px] text-muted-foreground">· sub-recipe</span>}
                    </TableCell>
                    <TableCell className="text-right font-mono">{ing.quantity_used}</TableCell>
                    <TableCell className="text-muted-foreground">{formatUnit(ing.unit_used)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </section>

          {subRecipes.length > 0 && (
            <section className="mt-6">
              <h2 className="mb-2 text-sm font-semibold">Sub-Recipe Breakdown</h2>
              <div className="space-y-4">
                {subRecipes.map((sr) => (
                  <div key={sr.recipe.id}>
                    <p className="text-sm font-semibold" style={{ color: bc.accent }}>{sr.recipe.recipe_name}</p>
                    {sr.recipe.yield_quantity ? (
                      <p className="mb-1 text-xs text-muted-foreground">
                        Yield: {sr.recipe.yield_quantity} {formatUnit(sr.recipe.yield_unit)}
                      </p>
                    ) : null}
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-8">#</TableHead>
                          <TableHead>Ingredient</TableHead>
                          <TableHead className="text-right">Qty</TableHead>
                          <TableHead>Unit</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sr.ingredients.map((ing, idx) => (
                          <TableRow key={ing.id}>
                            <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                            <TableCell className="font-medium">
                              {ing.component_type === "recipe" ? (ing.subRecipe?.recipe_name ?? "Sub-recipe") : ing.material?.ingredient_name ?? "—"}
                              {ing.component_type === "recipe" && <span className="ml-1.5 text-[11px] text-muted-foreground">· sub-recipe</span>}
                            </TableCell>
                            <TableCell className="text-right font-mono">{ing.quantity_used}</TableCell>
                            <TableCell className="text-muted-foreground">{formatUnit(ing.unit_used)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ))}
              </div>
            </section>
          )}

          <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
            <span>Yield: {recipe.yield_quantity} {formatUnit(recipe.yield_unit)}</span>
          </div>

          {canDownload && (
            <div className="mt-6 border-t pt-4">
              <Button
                variant="outline"
                disabled={busy}
                onClick={async () => {
                  if (busy) return;
                  setBusy(true);
                  try {
                    await generateRecipePdf(recipe, ingredients, {
                      visibility: NO_FINANCIALS,
                      subRecipes,
                      exporter: { name: `Shared by ${data.granted_by_name}`, role: "viewer" },
                      brandLabel: data.brand || undefined,
                    });
                    toast.success("PDF exported successfully.");
                  } catch {
                    toast.error("Unable to generate the PDF. Please try again.");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
                {busy ? "Preparing…" : "Download Recipe PDF"}
              </Button>
            </div>
          )}

          </div>
        </Card>

        <p className="mt-5 text-center text-[11px] text-white/85 drop-shadow-sm">
          Confidential · Financial data hidden · Shared via Food Metrics
        </p>
      </div>
    </div>
  );
}
