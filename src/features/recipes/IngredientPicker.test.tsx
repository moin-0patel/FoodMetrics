import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { RawMaterial } from "@/lib/data/types";
import { IngredientPicker } from "./IngredientPicker";

const materials = [
  { id: "1", ingredient_name: "Onion", base_unit: "Gram" },
  { id: "2", ingredient_name: "Tomato", base_unit: "Gram" },
  { id: "3", ingredient_name: "Garlic", base_unit: "Gram" },
] as unknown as RawMaterial[];

// Proves the yield/recipe ingredient search actually filters (not just renders).

describe("IngredientPicker — searchable", () => {
  it("filters the list as you type", async () => {
    const user = userEvent.setup();
    render(<IngredientPicker materials={materials} preps={[]} value={null} onSelect={() => {}} />);

    await user.click(screen.getByRole("combobox"));
    const input = await screen.findByPlaceholderText(/Search ingredient or prep/i);
    await user.type(input, "tom");

    expect(screen.getByText("Tomato")).toBeInTheDocument();
    expect(screen.queryByText("Onion")).not.toBeInTheDocument();
    expect(screen.queryByText("Garlic")).not.toBeInTheDocument();
  });

  it("returns the picked material via onSelect", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<IngredientPicker materials={materials} preps={[]} value={null} onSelect={onSelect} />);

    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByText("Garlic"));

    expect(onSelect).toHaveBeenCalledWith({ type: "material", material: materials[2] });
  });
});
