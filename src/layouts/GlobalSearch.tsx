import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, ChefHat, Package, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { useRecipes } from "@/features/recipes/hooks";
import { useMaterials } from "@/features/raw-materials/hooks";
import { usePackagingItems } from "@/features/packaging/hooks";

// Header search across the operational catalog: recipes, in-house preps, raw
// materials and packaging. Plain input + results list (not a modal palette) so it
// matches the header layout. Results come from the already-cached queries, so
// typing costs nothing extra.

interface Hit {
  id: string;
  label: string;
  kind: "Recipe" | "Prep" | "Ingredient" | "Packaging";
  to: string;
}

const ICON: Record<Hit["kind"], React.ReactNode> = {
  Recipe: <BookOpen className="h-3.5 w-3.5" />,
  Prep: <ChefHat className="h-3.5 w-3.5" />,
  Ingredient: <Package className="h-3.5 w-3.5" />,
  Packaging: <Package className="h-3.5 w-3.5" />,
};

const MAX = 8;

export function GlobalSearch({ className }: { className?: string }) {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);

  const { data: recipes = [] } = useRecipes();
  const { data: materials = [] } = useMaterials();
  const { data: packaging = [] } = usePackagingItems();

  const hits = useMemo<Hit[]>(() => {
    const term = q.trim().toLowerCase();
    if (term.length < 2) return [];
    const out: Hit[] = [];
    for (const r of recipes) {
      if (r.archived_at) continue;
      if (!r.recipe_name.toLowerCase().includes(term)) continue;
      out.push({
        id: r.id,
        label: r.recipe_name,
        kind: r.is_prep ? "Prep" : "Recipe",
        to: `/recipes/${r.id}`,
      });
    }
    for (const m of materials) {
      if (!m.ingredient_name.toLowerCase().includes(term)) continue;
      // Materials have no read-only detail route — go straight to the editor.
      out.push({ id: m.id, label: m.ingredient_name, kind: "Ingredient", to: `/materials/${m.id}/edit` });
    }
    for (const p of packaging) {
      if (!p.name.toLowerCase().includes(term)) continue;
      out.push({ id: p.id, label: p.name, kind: "Packaging", to: "/packaging" });
    }
    return out.slice(0, MAX);
  }, [q, recipes, materials, packaging]);

  // Close on outside click.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  // Reset the highlighted row whenever the result set changes.
  useEffect(() => setActive(0), [q]);

  const go = (h: Hit) => {
    navigate(h.to);
    setQ("");
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    if (!hits.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % hits.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i - 1 + hits.length) % hits.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(hits[active]);
    }
  };

  const showPanel = open && q.trim().length >= 2;

  return (
    <div ref={boxRef} className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder="Search operations…"
        aria-label="Search recipes, ingredients and packaging"
        className="h-9 pl-8"
      />

      {showPanel && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1.5 overflow-hidden rounded-lg border bg-popover shadow-lg">
          {hits.length === 0 ? (
            <p className="px-3 py-3 text-sm text-muted-foreground">
              No matches for “{q.trim()}”.
            </p>
          ) : (
            <ul className="max-h-80 overflow-y-auto py-1">
              {hits.map((h, i) => (
                <li key={`${h.kind}-${h.id}`}>
                  <button
                    type="button"
                    onMouseEnter={() => setActive(i)}
                    onClick={() => go(h)}
                    className={cn(
                      "flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm",
                      i === active ? "bg-muted" : "hover:bg-muted/60",
                    )}
                  >
                    <span className="text-muted-foreground">{ICON[h.kind]}</span>
                    <span className="min-w-0 flex-1 truncate font-medium">{h.label}</span>
                    <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {h.kind}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
