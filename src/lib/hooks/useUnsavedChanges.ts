import { useCallback, useEffect, useRef, useState } from "react";
import { useBlocker } from "react-router-dom";
import type { FieldValues, UseFormReturn } from "react-hook-form";

/**
 * Robust "is the form dirty?" flag for a react-hook-form used inside a modal.
 *
 * react-hook-form's `formState.isDirty` does NOT flip on `setValue(...)` unless
 * `shouldDirty:true` is passed — so changes to Selects, CurrencyInputs, pickers
 * and other controlled fields would be missed. This instead snapshots the form
 * values right after each `reset()` (call `capture()` at the end of the form's
 * open/reset effect) and deep-compares the live values, catching every field.
 *
 * Returns `{ dirty, capture, markSaved }`:
 *   • dirty      — true when the open form's values differ from the snapshot and
 *                  it hasn't just been saved.
 *   • capture()  — snapshot the current values as the clean baseline (after reset).
 *   • markSaved()— suppress the prompt for the close that follows a successful save.
 */
// A blank field has several shapes — `undefined` (dropped by JSON.stringify), `null`,
// `NaN` (a `valueAsNumber` input emits this when cleared), and `""`. Treat them all as
// "absent" so a field typed into and then cleared back to blank isn't flagged dirty.
// Real values (including `0`) are preserved. Applied to both the baseline and the live
// key, so it can only make logically-equal states compare equal — never masks a change.
const isEmptyish = (v: unknown) =>
  v === undefined || v === null || v === "" || (typeof v === "number" && Number.isNaN(v));
const serialize = (obj: unknown) =>
  JSON.stringify(obj, (_k, v) => (isEmptyish(v) ? undefined : v));

export function useFormDirty<T extends FieldValues>(
  form: UseFormReturn<T>,
  open: boolean,
  /** Extra non-RHF editable state to include (e.g. a Set of checkboxes, line
   *  rows). Pass the same serialisable shape you hand to `capture(...)`. */
  extra?: unknown,
) {
  const baseline = useRef("");
  const saved = useRef(false);
  const values = form.watch();
  const key = serialize({ v: values, x: extra });

  // Snapshot the clean baseline. Call at the end of the form's open/reset effect.
  // Pass the new extra explicitly (React state set in the same effect isn't
  // readable synchronously) so the baseline matches what the form was reset to.
  const capture = useCallback(
    (extraAtReset?: unknown) => {
      saved.current = false;
      baseline.current = serialize({ v: form.getValues(), x: extraAtReset });
    },
    [form],
  );
  const markSaved = useCallback(() => {
    saved.current = true;
  }, []);

  const dirty = open && !saved.current && baseline.current !== "" && key !== baseline.current;

  // Live getter for the route blocker: `markSaved()` flips a ref (no re-render),
  // so the blocker must read the current state through refs — not the stale
  // rendered `dirty` — or a save-then-navigate would still trip the prompt.
  const openRef = useRef(open);
  openRef.current = open;
  const keyRef = useRef(key);
  keyRef.current = key;
  const isDirtyNow = useCallback(
    () => openRef.current && !saved.current && baseline.current !== "" && keyRef.current !== baseline.current,
    [],
  );

  return { dirty, isDirtyNow, capture, markSaved };
}

/**
 * Reusable unsaved-changes protection for any create/edit form (page or modal).
 *
 * Given a `dirty` flag it guards every way a user can abandon unsaved work:
 *   • in-app route navigation (sidebar, links, browser Back/Forward) — via useBlocker
 *   • manual close of a modal/drawer (Cancel, X, Escape, overlay) — via `guardClose`
 *   • browser refresh / tab or window close — via the native beforeunload prompt
 *
 * A single confirmation is surfaced through `promptOpen` + `continueEditing` /
 * `discardChanges`, so one <UnsavedChangesDialog> per form covers all paths.
 *
 * Callers should gate `dirty` on the form being OPEN (e.g. `open && isDirty &&
 * !justSaved`) so a closed or already-saved form never blocks navigation.
 *
 * Multiple mounted forms are safe: React Router keys each blocker independently,
 * and a non-dirty form's blocker is inert (only ever one form is dirty at a time).
 */
export function useUnsavedChanges(dirty: boolean, isDirtyNow?: () => boolean) {
  // In-app route navigation (sidebar menu, links, Back/Forward, URL changes).
  // Prefer the live getter so a save-then-navigate (which flips a ref without a
  // re-render) doesn't block on a stale `dirty`; fall back to `dirty` otherwise.
  const shouldBlock = useCallback(() => (isDirtyNow ? isDirtyNow() : dirty), [isDirtyNow, dirty]);
  const blocker = useBlocker(shouldBlock);
  // A manual close (modal Cancel / X / Escape / overlay) deferred until confirmed.
  const [pendingClose, setPendingClose] = useState<null | (() => void)>(null);

  // Browser refresh / tab or window close → native "Leave site?" prompt.
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const routeBlocked = blocker.state === "blocked";
  const promptOpen = routeBlocked || pendingClose !== null;

  // "Continue Editing" — cancel the pending navigation/close, keep all data.
  const continueEditing = useCallback(() => {
    if (routeBlocked) blocker.reset?.();
    setPendingClose(null);
  }, [routeBlocked, blocker]);

  // "Discard Changes" — proceed with the navigation or the deferred close.
  const discardChanges = useCallback(() => {
    if (pendingClose) {
      const fn = pendingClose;
      setPendingClose(null);
      fn();
    }
    if (routeBlocked) blocker.proceed?.();
  }, [routeBlocked, blocker, pendingClose]);

  /**
   * Wrap a modal/drawer close. If the form is dirty the close is deferred and the
   * confirmation is shown; otherwise it runs immediately. Wire this to the
   * Dialog's onOpenChange(false), the Cancel button, and any custom close.
   */
  const guardClose = useCallback(
    (close: () => void) => {
      if (dirty) setPendingClose(() => close);
      else close();
    },
    [dirty],
  );

  return { promptOpen, continueEditing, discardChanges, guardClose };
}
