import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Beef, BookOpen, ChefHat, Sprout, Upload } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { ImportDialog } from "@/components/ImportDialog";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSession } from "@/lib/auth/session";
import { useBrands } from "@/features/brands/hooks";
import { useDashboardBrand } from "@/features/dashboard/brandTheme";
import type { ImportConfig } from "@/lib/import/importTypes";
import { materialsImportConfig, yieldImportConfig, recipeImportConfig } from "./importConfigs";

/** Only the format-preview fields of a config (no generic T → no variance issues). */
type PreviewConfig = Pick<ImportConfig<unknown>, "columns" | "sample">;

type Section = "materials" | "prep" | "yield" | "recipes";

/**
 * Super-Admin-only import hub. All CSV/XLSX imports live here (revoked from the
 * per-page buttons). Raw Materials / In-House Prep / Yield are common across brands;
 * Menu Recipes are imported under a chosen brand. Route access is
 * gated to super_admin in the router — no in-component role check needed.
 */
export function ImportDataPage() {
  const user = useSession((s) => s.user)!;
  const queryClient = useQueryClient();
  const { data: brands = [] } = useBrands();
  const headerBrand = useDashboardBrand((s) => s.brand);

  const [open, setOpen] = useState<Section | null>(null);

  // Any active brand may receive menu recipes. Default to the brand selected in
  // the header when it's a real brand, else the first active one.
  const brandOptions = brands.filter((b) => b.status === "active");
  const [brand, setBrand] = useState<string>(headerBrand !== "all" ? headerBrand : "");
  const selectedBrand = brandOptions.some((b) => b.id === brand) ? brand : (brandOptions[0]?.id ?? "");

  const materialsCfg = useMemo(
    () => materialsImportConfig({ queryClient, userId: user.id }),
    [queryClient, user.id],
  );
  const yieldCfg = useMemo(
    () => yieldImportConfig({ queryClient, userId: user.id }),
    [queryClient, user.id],
  );
  // Preps are brand-agnostic; they're filed under whichever brand is selected.
  const prepCfg = useMemo(
    () => recipeImportConfig({ queryClient, userId: user.id, isPrep: true, brand: selectedBrand }),
    [queryClient, user.id, selectedBrand],
  );
  const recipesCfg = useMemo(
    () => recipeImportConfig({ queryClient, userId: user.id, isPrep: false, brand: selectedBrand }),
    [queryClient, user.id, selectedBrand],
  );

  return (
    <div>
      <PageHeader
        title="Import Data"
        description="Bulk-import catalog data from CSV or XLSX. Restricted to Super Admins."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <SectionCard
          icon={<Beef className="h-5 w-5" />}
          title="Raw Materials"
          description="Ingredients with purchase price. Common across all brands."
          config={materialsCfg}
          onImport={() => setOpen("materials")}
        />
        <SectionCard
          icon={<ChefHat className="h-5 w-5" />}
          title="In-House Prep"
          description="Reusable sub-recipes. Common across all brands."
          config={prepCfg}
          onImport={() => setOpen("prep")}
        />
        <SectionCard
          icon={<Sprout className="h-5 w-5" />}
          title="Yield"
          description="Wastage → true yield per ingredient. Common across all brands."
          config={yieldCfg}
          onImport={() => setOpen("yield")}
        />
        <SectionCard
          icon={<BookOpen className="h-5 w-5" />}
          title="Menu Recipes"
          description="Sellable dishes. Imported under the selected brand."
          config={recipesCfg}
          onImport={() => setOpen("recipes")}
          importDisabled={brandOptions.length === 0}
        >
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <span className="shrink-0 text-xs font-medium text-muted-foreground">Brand</span>
            <Select value={selectedBrand} onValueChange={setBrand}>
              <SelectTrigger className="h-9 w-full sm:w-40">
                <SelectValue placeholder="Select brand" />
              </SelectTrigger>
              <SelectContent>
                {brandOptions.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </SectionCard>
      </div>

      <ImportDialog open={open === "materials"} onOpenChange={(o) => setOpen(o ? "materials" : null)} config={materialsCfg} />
      <ImportDialog open={open === "prep"} onOpenChange={(o) => setOpen(o ? "prep" : null)} config={prepCfg} />
      <ImportDialog open={open === "yield"} onOpenChange={(o) => setOpen(o ? "yield" : null)} config={yieldCfg} />
      <ImportDialog open={open === "recipes"} onOpenChange={(o) => setOpen(o ? "recipes" : null)} config={recipesCfg} />
    </div>
  );
}

function SectionCard({
  icon,
  title,
  description,
  config,
  onImport,
  importDisabled,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  config: PreviewConfig;
  onImport: () => void;
  importDisabled?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <Card className="flex min-w-0 flex-col gap-3 p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </span>
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-foreground">{title}</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        </div>
      </div>

      <FormatPreview config={config} />

      <div className="mt-auto flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {children ?? <span className="hidden sm:block" />}
        <Button size="sm" className="w-full sm:w-auto" onClick={onImport} disabled={importDisabled}>
          <Upload className="h-4 w-4" /> Import
        </Button>
      </div>
    </Card>
  );
}

/** Compact preview of the expected columns + one sample row, so a Super Admin sees
 *  the exact format before uploading. Data comes straight from the ImportConfig.
 *
 *  Two presentations off the same rows: a stacked label→value list on phones (the
 *  8-column table would otherwise force the whole page to scroll sideways), and the
 *  spreadsheet-shaped table from `sm` up. */
function FormatPreview({ config }: { config: PreviewConfig }) {
  const sample = config.sample as Record<string, unknown>;
  const rows = config.columns.map((c) => {
    const v = sample[c.label];
    return {
      label: c.label,
      required: c.required,
      value: v == null || v === "" ? "—" : String(v),
    };
  });

  return (
    <div className="min-w-0">
      <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        Expected format · {config.columns.length} columns
      </p>

      {/* Phones: one row per column, no horizontal scrolling. */}
      <div className="divide-y rounded-md border text-xs sm:hidden">
        {rows.map((r) => (
          <div key={r.label} className="flex items-baseline justify-between gap-3 px-2.5 py-1.5">
            <span className="shrink-0 font-semibold text-foreground">
              {r.label}
              {r.required && <span className="text-destructive"> *</span>}
            </span>
            <span className="truncate text-right text-muted-foreground">{r.value}</span>
          </div>
        ))}
      </div>

      {/* sm and up: the real table shape, scrolling inside the card if needed. */}
      <div className="hidden min-w-0 overflow-x-auto rounded-md border sm:block">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-muted/50">
              {rows.map((r) => (
                <th key={r.label} className="whitespace-nowrap px-2.5 py-1.5 text-left font-semibold text-foreground">
                  {r.label}
                  {r.required && <span className="text-destructive"> *</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              {rows.map((r) => (
                <td key={r.label} className="whitespace-nowrap border-t px-2.5 py-1.5 text-muted-foreground">
                  {r.value}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <p className="mt-1.5 text-[11px] text-muted-foreground">
        <span className="text-destructive">*</span> required · one row per ingredient
      </p>
    </div>
  );
}
