import { describe, it, expect, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { resetDb } from "@/lib/data/mock/db";
import { renderWithProviders } from "@/test/renderWithProviders";
import { MaterialEditorPage } from "./MaterialEditorPage";

// Proves Add Raw Material is a full PAGE (like the Recipe editor), not a modal:
// same simplified purchase model — no Supplier, a Material Type selector, and a
// read-only fixed purchase unit (1 kg by default).

describe("MaterialEditorPage — full-page Add Raw Material", () => {
  beforeEach(() => resetDb());

  it("renders as a page with Material Type + a read-only 1 kg unit, and no Supplier field", async () => {
    // No :id param → create ("Add Ingredient") mode.
    renderWithProviders(<MaterialEditorPage />);

    expect(await screen.findByText("Add Ingredient")).toBeInTheDocument();
    // Page chrome: a Back button (the modal had none).
    expect(screen.getByRole("button", { name: /back/i })).toBeInTheDocument();
    expect(screen.getByText("Material Type *")).toBeInTheDocument();
    // Read-only purchase-unit chip shows the fixed 1 kg basis for Weight.
    expect(screen.getAllByText("1 kg").length).toBeGreaterThanOrEqual(1);
    // Single purchase price, priced per one unit.
    expect(screen.getByText(/Purchase Price \(₹ per 1 kg\)/i)).toBeInTheDocument();
    // Supplier is gone everywhere.
    expect(screen.queryByText(/Supplier/i)).not.toBeInTheDocument();
    // No manual purchase quantity / base-unit dropdowns.
    expect(screen.queryByText(/Purchase Quantity/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Base Unit/i)).not.toBeInTheDocument();
  });
});
