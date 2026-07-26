import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/**
 * Standard confirmation shown when a user tries to leave a form with unsaved
 * changes. Paired with useUnsavedChanges — one instance per guarded form. The
 * safe action (Continue Editing) is primary; Discard Changes is destructive.
 */
export function UnsavedChangesDialog({
  open,
  onContinueEditing,
  onDiscard,
  message = "You have unsaved changes. If you leave now, all unsaved information will be permanently lost.",
}: {
  open: boolean;
  onContinueEditing: () => void;
  onDiscard: () => void;
  message?: string;
}) {
  return (
    // Closing this prompt (Escape / overlay) is treated as "Continue Editing" —
    // never a silent discard.
    <Dialog open={open} onOpenChange={(o) => { if (!o) onContinueEditing(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Discard Changes?</DialogTitle>
          <DialogDescription>{message}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="default" onClick={onContinueEditing}>
            Continue Editing
          </Button>
          <Button variant="destructive" onClick={onDiscard}>
            Discard Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
