import { describe, it, expect, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { resetDb } from "@/lib/data/mock/db";
import { renderWithProviders } from "@/test/renderWithProviders";
import { BrandEditorPage } from "./BrandEditorPage";

// Proves Add Brand is a full PAGE (like the Recipe / Raw Material editors), not a modal.

describe("BrandEditorPage — full-page Add Brand", () => {
  beforeEach(() => resetDb());

  it("renders as a page with a Back button and the brand fields", async () => {
    // No :id param → create ("New Brand") mode.
    renderWithProviders(<BrandEditorPage />);

    expect(await screen.findByText("New Brand")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /back/i })).toBeInTheDocument();
    expect(screen.getByText("Brand Name *")).toBeInTheDocument();
    expect(screen.getByText("Brand Code *")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /create brand/i })).toBeInTheDocument();
  });
});
