import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CostSummary } from "./CostSummary";

// Proves the "no suggested price" UI: price-dependent metrics show "–" until a
// menu price is set, and real figures once it is.

describe("CostSummary — no price suggestion", () => {
  it("shows '–' for Selling Price / FC% / Margin / Profit when unpriced", () => {
    render(<CostSummary recipeCost={50} packagingCost={10} sellingPrice={0} />);
    // Recipe cost + packaging still render.
    expect(screen.getByText("Recipe Cost")).toBeInTheDocument();
    expect(screen.getByText("Selling Price")).toBeInTheDocument();
    // No computed percentages/prices are invented from a target food-cost %.
    expect(screen.queryByText("30%")).not.toBeInTheDocument();
    expect(screen.queryByText("70%")).not.toBeInTheDocument();
    // At least the four price-dependent stats show the em dash.
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(4);
    // The old "Suggested @ x%" hint is gone.
    expect(screen.queryByText(/Suggested/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Set a menu price/i)).toBeInTheDocument();
  });

  it("shows real FC% and margin once a menu price exists", () => {
    // full cost = 60; price 200 → FC 30%, margin 70%.
    render(<CostSummary recipeCost={50} packagingCost={10} sellingPrice={200} />);
    expect(screen.getByText("30%")).toBeInTheDocument();
    expect(screen.getByText("70%")).toBeInTheDocument();
    expect(screen.queryByText(/Suggested/i)).not.toBeInTheDocument();
  });

  it("prep mode shows only Total Cost (no price/margin fields)", () => {
    render(<CostSummary recipeCost={42} packagingCost={0} sellingPrice={0} prepOnly />);
    expect(screen.getByText("Total Cost")).toBeInTheDocument();
    expect(screen.queryByText("Selling Price")).not.toBeInTheDocument();
    expect(screen.queryByText("Gross Margin")).not.toBeInTheDocument();
  });
});
