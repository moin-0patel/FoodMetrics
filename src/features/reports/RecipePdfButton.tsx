import { useState } from "react";
import { ChevronDown, FileDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Recipe, RecipeIngredientWithMaterial } from "@/lib/data/types";
import type { ViewVisibility } from "@/lib/auth/permissions";
import { recipesRepo } from "@/lib/data";
import { useSession } from "@/lib/auth/session";
import { useRecordExport } from "@/features/exports/hooks";
import { generateRecipePdf } from "./pdf";
import { toast } from "@/components/ui/use-toast";

/** Strip every cost/price field from a visibility (keeps ingredients/quantities/process). */
function withoutCosts(v?: ViewVisibility): ViewVisibility {
  return {
    ingredients: v?.ingredients ?? true,
    process: v?.process ?? true,
    quantities: v?.quantities ?? true,
    unitCosts: false,
    totalCost: false,
    costPerPortion: false,
    sellingPrice: false,
    grossProfit: false,
  };
}

export function RecipePdfButton({
  recipe,
  ingredients,
  visibility,
}: {
  recipe: Recipe;
  ingredients: RecipeIngredientWithMaterial[];
  visibility?: ViewVisibility;
}) {
  const [busy, setBusy] = useState(false);
  const [includeCosts, setIncludeCosts] = useState(true);
  const [includeSubs, setIncludeSubs] = useState(true);
  const user = useSession((s) => s.user);
  const recordExport = useRecordExport();

  const hasSubRecipes = ingredients.some((i) => i.component_type === "recipe" && i.subRecipe);
  // A viewer whose own visibility already hides costs can't re-enable them, so only
  // offer the costs toggle when this audience is actually allowed to see costs.
  const canSeeCosts = !visibility || visibility.totalCost || visibility.unitCosts;

  const runExport = async () => {
    if (busy) return; // block rapid double-clicks → no duplicate exports
    setBusy(true);
    try {
      const eff = canSeeCosts && includeCosts ? visibility : withoutCosts(visibility);

      // Only load sub-recipe ingredients when the reader wants the breakdown appendix.
      let subRecipes: { recipe: Recipe; ingredients: RecipeIngredientWithMaterial[] }[] | undefined;
      if (includeSubs && hasSubRecipes) {
        const subIds = [
          ...new Set(
            ingredients
              .filter((i) => i.component_type === "recipe" && i.subRecipe)
              .map((i) => i.subRecipe!.id),
          ),
        ];
        subRecipes = (await Promise.all(subIds.map((id) => recipesRepo.getWithIngredients(id))))
          .filter((d): d is NonNullable<typeof d> => !!d)
          .map((d) => ({ recipe: d.recipe, ingredients: d.ingredients }));
      }

      await generateRecipePdf(recipe, ingredients, {
        visibility: eff,
        subRecipes,
        // Exporter identity is taken from the authenticated session — never typed.
        exporter: user ? { id: user.id, name: user.name, role: user.role } : undefined,
      });
      // Audit only AFTER the file is generated — never for a failed export.
      // Awaited so the record is persisted; a failed audit doesn't fail the export.
      try {
        await recordExport.mutateAsync({
          exported_by_user_id: user?.id ?? null,
          exporter_name_snapshot: user?.name ?? "Unknown",
          exporter_email_snapshot: user?.email ?? null,
          exporter_role_snapshot: user?.role ?? "viewer",
          export_type: "single_recipe",
          entity_type: "recipe",
          entity_id: recipe.id,
          recipe_name_snapshot: recipe.recipe_name,
          report_name: null,
          brand_id: recipe.brand,
          outlet_id: null,
          filters_used: null,
          file_format: "pdf",
        });
      } catch (auditErr) {
        if (import.meta.env.DEV) console.error("Audit record failed", auditErr);
      }
      toast.success("PDF exported successfully.");
    } catch (e) {
      if (import.meta.env.DEV) console.error("PDF export failed", e);
      toast.error("Unable to generate the PDF. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const label = busy ? "Preparing professional PDF…" : "Export PDF";
  const icon = busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />;

  // Nothing to choose (no costs to hide, no sub-recipes) → plain one-click button.
  if (!canSeeCosts && !hasSubRecipes) {
    return (
      <Button variant="outline" disabled={busy} onClick={runExport}>
        {icon}
        {label}
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={busy}>
          {icon}
          {label}
          <ChevronDown className="h-4 w-4 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {canSeeCosts && (
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              setIncludeCosts((v) => !v);
            }}
          >
            <Checkbox checked={includeCosts} className="pointer-events-none" />
            Include costs
          </DropdownMenuItem>
        )}
        {hasSubRecipes && (
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              setIncludeSubs((v) => !v);
            }}
          >
            <Checkbox checked={includeSubs} className="pointer-events-none" />
            Include sub-recipe breakdown
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={runExport}>Download PDF</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
