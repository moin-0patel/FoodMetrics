import { describe, it, expect, beforeEach } from "vitest";
import { resetDb } from "./db";
import { rolesRepo } from "./roles";
import { usersRepo } from "./users";

const mk = (label: string, capabilities: string[] = []) =>
  rolesRepo.create({ label, capabilities }, "u-owner");

describe("custom roles repo", () => {
  beforeEach(() => resetDb());

  it("seeds the six built-in roles as read-only system roles", async () => {
    const roles = await rolesRepo.list();
    const keys = roles.map((r) => r.key).sort();
    expect(keys).toEqual(["admin", "chef", "editor", "head_chef", "super_admin", "viewer"]);
    expect(roles.every((r) => r.is_system)).toBe(true);
    expect(roles.find((r) => r.key === "super_admin")!.protected).toBe(true);
    expect(roles.find((r) => r.key === "admin")!.protected).toBe(true);
  });

  it("creates a custom role with a derived key and sanitized capabilities", async () => {
    const role = await mk("Cost Analyst", ["report.excel", "recipe.viewAll", "user.manage"]);
    expect(role.key).toBe("cost_analyst");
    expect(role.is_system).toBe(false);
    expect(role.protected).toBe(false);
    // user.manage is RESERVED and must be stripped; the two grantable ones stay.
    expect(role.capabilities.sort()).toEqual(["recipe.viewAll", "report.excel"]);
  });

  it("rejects a duplicate role name", async () => {
    await mk("Cost Analyst", []);
    await expect(mk("Cost Analyst", [])).rejects.toThrow(/already exists/i);
  });

  it("blocks editing a built-in role", async () => {
    await expect(
      rolesRepo.update("editor", { label: "Editor X", capabilities: [] }, "u-owner"),
    ).rejects.toThrow(/built-in/i);
  });

  it("blocks deleting a built-in role", async () => {
    await expect(rolesRepo.remove("viewer", "u-owner")).rejects.toThrow(/built-in/i);
  });

  it("edits a custom role's capabilities", async () => {
    const role = await mk("Analyst", ["recipe.viewAll"]);
    const updated = await rolesRepo.update(
      role.key,
      { label: "Analyst", capabilities: ["recipe.viewAll", "report.excel"] },
      "u-owner",
    );
    expect(updated.capabilities.sort()).toEqual(["recipe.viewAll", "report.excel"]);
  });

  it("blocks deleting a custom role still assigned to a user, allows it once free", async () => {
    const role = await mk("Analyst", ["recipe.viewAll"]);
    const u = await usersRepo.create(
      { name: "A", email: "a@x.com", role: role.key, password: "password1" },
      "u-owner",
    );
    await expect(rolesRepo.remove(role.key, "u-owner")).rejects.toThrow(/still assigned/i);
    await usersRepo.update(u.id, { role: "viewer" }, "u-owner");
    await rolesRepo.remove(role.key, "u-owner");
    expect(await rolesRepo.getByKey(role.key)).toBeNull();
  });
});
