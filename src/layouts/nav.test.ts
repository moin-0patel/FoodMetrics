import { describe, it, expect } from "vitest";
import { navForRole } from "./nav";

// Brands & Outlets management is Super-Admin only.
describe("nav — Brands & Outlets gating", () => {
  const hasBrands = (role: string) => navForRole(role).some((i) => i.to === "/brands");

  it("is visible to super_admin", () => {
    expect(hasBrands("super_admin")).toBe(true);
  });

  it("is hidden from admin, editor, and viewer", () => {
    expect(hasBrands("admin")).toBe(false);
    expect(hasBrands("editor")).toBe(false);
    expect(hasBrands("viewer")).toBe(false);
  });
});
