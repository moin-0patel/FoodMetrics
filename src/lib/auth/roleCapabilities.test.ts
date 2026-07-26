import { describe, it, expect, afterEach } from "vitest";
import { can } from "./permissions";
import { primeRoleCache } from "./roleCache";
import type { RoleRecord } from "../data/types";

const mkRole = (key: string, capabilities: string[]): RoleRecord => ({
  key,
  label: key,
  description: null,
  is_system: false,
  protected: false,
  sort_order: 100,
  capabilities,
  created_by: null,
  created_at: "",
  updated_by: null,
  updated_at: "",
});

afterEach(() => primeRoleCache([])); // reset the module cache between tests

describe("data-driven capabilities (can)", () => {
  it("super_admin can do anything, regardless of the cache", () => {
    primeRoleCache([]);
    expect(can("super_admin", "role.manage")).toBe(true);
    expect(can("super_admin", "recipe.delete")).toBe(true);
  });

  it("falls back to the built-in matrix before the cache is primed", () => {
    primeRoleCache([]);
    expect(can("editor", "recipe.editAll")).toBe(true);
    expect(can("editor", "recipe.approve")).toBe(false);
    expect(can("viewer", "recipe.editAll")).toBe(false);
  });

  it("grants a custom role exactly the capabilities it holds", () => {
    primeRoleCache([mkRole("cost_analyst", ["recipe.viewAll", "report.excel"])]);
    expect(can("cost_analyst", "recipe.viewAll")).toBe(true);
    expect(can("cost_analyst", "report.excel")).toBe(true);
    expect(can("cost_analyst", "recipe.editAll")).toBe(false);
    expect(can("cost_analyst", "material.edit")).toBe(false);
  });

  it("an unknown role with no cache entry has no capabilities", () => {
    primeRoleCache([mkRole("cost_analyst", ["recipe.viewAll"])]);
    expect(can("ghost_role", "recipe.viewAll")).toBe(false);
  });

  it("live cache overrides the built-in matrix for a system role key", () => {
    // If a built-in were re-seeded with fewer caps, can() reflects the live data.
    primeRoleCache([mkRole("editor", ["recipe.viewAll"])]);
    expect(can("editor", "recipe.viewAll")).toBe(true);
    expect(can("editor", "recipe.editAll")).toBe(false);
  });
});
