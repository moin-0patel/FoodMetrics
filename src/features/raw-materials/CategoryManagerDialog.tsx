import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/use-toast";
import { useCategories, useSaveCategories } from "@/features/settings/hooks";
import { useMaterials } from "./hooks";

/**
 * Manage the ingredient-category list (stored in system_settings). Add or remove
 * categories used when creating ingredients. Removing a category that's still on
 * some ingredients only hides it from the pickers — those ingredients keep their
 * label until re-categorised.
 */
export function CategoryManagerDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: categories = [] } = useCategories();
  const { data: materials = [] } = useMaterials();
  const save = useSaveCategories();

  const [draft, setDraft] = useState<string[]>([]);
  const [name, setName] = useState("");

  // Reset the working copy from the saved list each time the dialog opens.
  useEffect(() => {
    if (open) {
      setDraft(categories);
      setName("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const usage = (c: string) => materials.filter((m) => m.category === c).length;

  const addCategory = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (draft.some((c) => c.toLowerCase() === trimmed.toLowerCase())) {
      toast.error("That category already exists");
      return;
    }
    setDraft((d) => [...d, trimmed]);
    setName("");
  };

  const removeCategory = (c: string) => setDraft((d) => d.filter((x) => x !== c));

  const dirty =
    draft.length !== categories.length || draft.some((c, i) => c !== categories[i]);

  const onSave = async () => {
    if (draft.length === 0) {
      toast.error("Keep at least one category");
      return;
    }
    try {
      await save.mutateAsync(draft);
      toast.success("Categories updated");
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !save.isPending && onOpenChange(o)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Ingredient Categories</DialogTitle>
          <DialogDescription>
            Add or remove the categories used when creating ingredients.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCategory();
              }
            }}
            placeholder="New category name"
            autoFocus
          />
          <Button type="button" variant="outline" onClick={addCategory} disabled={!name.trim()}>
            <Plus className="h-4 w-4" /> Add
          </Button>
        </div>

        <ul className="max-h-64 space-y-1 overflow-y-auto">
          {draft.map((c) => {
            const n = usage(c);
            return (
              <li
                key={c}
                className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
              >
                <span className="flex items-center gap-2">
                  {c}
                  {n > 0 && (
                    <Badge variant="outline" className="text-xs font-normal text-muted-foreground">
                      {n} in use
                    </Badge>
                  )}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={() => removeCategory(c)}
                  aria-label={`Remove ${c}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            );
          })}
          {draft.length === 0 && (
            <li className="px-1 py-4 text-center text-sm text-muted-foreground">
              No categories — add one above.
            </li>
          )}
        </ul>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={save.isPending}>
            Cancel
          </Button>
          <Button variant="accent" onClick={onSave} disabled={!dirty || save.isPending}>
            {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
