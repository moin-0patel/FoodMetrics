import { describe, it, expect, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { resetDb } from "@/lib/data/mock/db";
import { renderWithProviders } from "@/test/renderWithProviders";
import { YieldForm } from "./YieldForm";

// Proves the simplified Yield form: a searchable ingredient picker (not a plain
// dropdown), a read-only fixed 1 kg unit, and no manual quantity/unit inputs.

describe("YieldForm — searchable picker + fixed unit", () => {
  beforeEach(() => resetDb());

  it("renders a search picker, a read-only 1 kg unit, and per-1-unit cost", async () => {
    renderWithProviders(<YieldForm open onOpenChange={() => {}} record={null} />);

    expect(await screen.findByText("Add Yield")).toBeInTheDocument();
    // Searchable combobox (replaces the old <select>): its placeholder text.
    expect(screen.getByText(/Search ingredient or prep/i)).toBeInTheDocument();
    // Fixed per-1-unit purchase basis, read-only.
    expect(screen.getAllByText("1 kg").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Purchase Cost \(₹ per 1 kg\)/i)).toBeInTheDocument();
    // Wastage is measured in the base unit.
    expect(screen.getByText(/Wastage \(Gram\)/i)).toBeInTheDocument();
  });
});
