import { describe, it, expect, beforeEach } from "vitest";
import { resetDb } from "./db";
import { packagingRepo } from "./packaging";

const ACTOR = "u-owner";

// The packaging master starts empty (admin-managed), so each test creates the
// items it needs through the repo.
describe("packaging master repo", () => {
  beforeEach(() => resetDb());

  const newItem = (name: string, unit_price = 5) =>
    packagingRepo.create({ name, packaging_type: "primary", unit: "Piece", unit_price }, ACTOR);

  it("starts empty", async () => {
    expect((await packagingRepo.list()).length).toBe(0);
  });

  it("creates a packaging item and computes normalized name", async () => {
    const item = await newItem("Custom Noodle Box", 6);
    expect(item.normalized_name).toBe("custom noodle box");
    expect(item.unit_price).toBe(6);
    expect(item.status).toBe("active");
  });

  it("rejects a duplicate name", async () => {
    const existing = await newItem("Takeaway Bag", 4);
    await expect(newItem(existing.name, 4)).rejects.toThrow(/already exists/i);
    // Case-insensitive too.
    await expect(newItem("takeaway bag", 4)).rejects.toThrow(/already exists/i);
  });

  it("deactivate + update work", async () => {
    const item = await newItem("Pizza Box", 12);
    const off = await packagingRepo.setStatus(item.id, "inactive", ACTOR);
    expect(off.status).toBe("inactive");
    const up = await packagingRepo.update(
      item.id,
      { name: item.name, packaging_type: item.packaging_type, unit: item.unit, unit_price: 2 },
      ACTOR,
    );
    expect(up.unit_price).toBe(2);
  });
});
