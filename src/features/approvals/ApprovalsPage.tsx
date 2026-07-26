import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, XCircle } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatTile } from "@/components/StatTile";
import { relativeTime } from "@/features/dashboard/metrics";
import { EmptyState } from "@/components/EmptyState";
import { TableSkeleton } from "@/components/TableSkeleton";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { formatDate, formatINR } from "@/lib/utils";
import { toast } from "@/components/ui/use-toast";
import type { Recipe } from "@/lib/data/types";
import { useUsersMap } from "@/features/users/hooks";
import { useApproveRecipe, useRecipes, useRejectRecipe } from "@/features/recipes/hooks";

export function ApprovalsPage() {
  const navigate = useNavigate();
  const { data: recipes = [], isLoading } = useRecipes();
  const { map: usersMap } = useUsersMap();
  const approveMut = useApproveRecipe();
  const rejectMut = useRejectRecipe();

  const [approving, setApproving] = useState<Recipe | null>(null);
  const [rejecting, setRejecting] = useState<Recipe | null>(null);
  const [rejectNote, setRejectNote] = useState("");

  const pending = recipes.filter((r) => r.status === "testing");

  // Queue readings from the pending set. Oldest submission drives the wait time —
  // null when the queue is empty, so the tile shows "—" not "0".
  const queue = useMemo(() => {
    const stamps = pending
      .map((r) => r.updated_at ?? r.created_at)
      .filter((s): s is string => !!s)
      .map((s) => new Date(s).getTime())
      .filter((n) => !Number.isNaN(n));
    const oldest = stamps.length ? Math.min(...stamps) : null;
    const drafts = recipes.filter((r) => r.status === "draft").length;
    return {
      count: pending.length,
      oldest,
      waitLabel: oldest == null ? "—" : relativeTime(new Date(oldest).toISOString()),
      drafts,
    };
  }, [pending, recipes]);

  return (
    <>
      <PageHeader
        eyebrow="Operations"
        title="Pending Approvals"
        description="Review recipes submitted for testing before they reach the live costing engine."
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <StatTile
          label="Items in Queue"
          value={isLoading ? "—" : String(queue.count)}
          valueTone={queue.count > 0 ? "accent" : "good"}
          emptyHint={queue.count === 0 ? "Nothing awaiting approval" : "Submitted for testing"}
        />
        <StatTile
          label="Longest Wait"
          value={queue.waitLabel}
          tone={queue.count > 0 ? "warning" : "good"}
          emptyHint={queue.oldest == null ? "Queue is empty" : "Since submission"}
        />
        <StatTile
          label="Still in Draft"
          value={isLoading ? "—" : String(queue.drafts)}
          emptyHint={queue.drafts === 0 ? "No drafts open" : "Not yet submitted for review"}
        />
      </div>

      <Card>
        {isLoading ? (
          <TableSkeleton rows={4} cols={5} />
        ) : pending.length === 0 ? (
          <EmptyState
            icon={<CheckCircle2 className="h-10 w-10" />}
            title="All caught up"
            description="No recipes are awaiting approval."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Recipe</TableHead>
                <TableHead>Submitted By</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead>Cost / Portion</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pending.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.recipe_name}</TableCell>
                  <TableCell>{usersMap.get(r.created_by ?? "")?.name ?? "—"}</TableCell>
                  <TableCell>{formatDate(r.updated_at)}</TableCell>
                  <TableCell>{formatINR(r.cost_per_portion)}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => navigate(`/recipes/${r.id}`)}>
                        Review
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          setRejectNote("");
                          setRejecting(r);
                        }}
                      >
                        <XCircle className="h-4 w-4" /> Reject
                      </Button>
                      <Button variant="accent" size="sm" onClick={() => setApproving(r)}>
                        <CheckCircle2 className="h-4 w-4" /> Approve
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <ConfirmDialog
        open={!!approving}
        onOpenChange={(o) => !o && setApproving(null)}
        title="Approve recipe?"
        description={`"${approving?.recipe_name}" will become available to assigned viewers.`}
        confirmLabel="Approve"
        onConfirm={async () => {
          if (!approving) return;
          await approveMut.mutateAsync(approving.id);
          toast.success("Recipe approved");
        }}
      />

      <Dialog open={!!rejecting} onOpenChange={(o) => !o && setRejecting(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Recipe</DialogTitle>
            <DialogDescription>
              “{rejecting?.recipe_name}” returns to Draft. A note is required.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Reason for rejection…"
            value={rejectNote}
            onChange={(e) => setRejectNote(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejecting(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!rejectNote.trim()}
              onClick={async () => {
                if (!rejecting) return;
                await rejectMut.mutateAsync({ id: rejecting.id, note: rejectNote.trim() });
                toast.success("Recipe rejected");
                setRejecting(null);
              }}
            >
              Reject Recipe
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
