import { describe, it, expect, beforeEach, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { resetDb } from "@/lib/data/mock/db";
import { renderWithProviders } from "@/test/renderWithProviders";
import { PackagingForm } from "@/features/packaging/PackagingForm";

// Exercises the shared unsaved-changes protection (useUnsavedChanges + useFormDirty
// + UnsavedChangesDialog) end to end through a representative modal form. The same
// wiring is used by every create/edit form in the app.

describe("unsaved-changes protection", () => {
  beforeEach(() => resetDb());

  it("prompts on Cancel when dirty; Continue Editing keeps data; Discard Changes closes", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    renderWithProviders(<PackagingForm open onOpenChange={onOpenChange} item={null} />);
    await screen.findByText("Add Packaging Item");

    // Dirty the form by typing into a field.
    await user.type(screen.getByPlaceholderText("e.g. Pizza Box"), "Napkins");

    // Cancel → confirmation appears, form is NOT closed.
    await user.click(screen.getByRole("button", { name: /^cancel$/i }));
    expect(await screen.findByText("Discard Changes?")).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);

    // Continue Editing → dialog dismissed, entered data preserved.
    await user.click(screen.getByRole("button", { name: /continue editing/i }));
    await waitFor(() => expect(screen.queryByText("Discard Changes?")).not.toBeInTheDocument());
    expect((screen.getByPlaceholderText("e.g. Pizza Box") as HTMLInputElement).value).toBe("Napkins");

    // Cancel again → Discard Changes → the requested close proceeds.
    await user.click(screen.getByRole("button", { name: /^cancel$/i }));
    await screen.findByText("Discard Changes?");
    await user.click(screen.getByRole("button", { name: /discard changes/i }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("does not prompt when nothing was changed", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    renderWithProviders(<PackagingForm open onOpenChange={onOpenChange} item={null} />);
    await screen.findByText("Add Packaging Item");

    // Pristine form → Cancel closes immediately, no confirmation.
    await user.click(screen.getByRole("button", { name: /^cancel$/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.queryByText("Discard Changes?")).not.toBeInTheDocument();
  });
});
