import { describe, it, expect, beforeEach } from "vitest";
import { resetDb } from "./db";
import { brandsRepo } from "./brands";
import { outletsRepo } from "./outlets";

const ACTOR = "u-owner";

// Brands and outlets are created by a Super Admin — nothing is seeded — so each
// test builds exactly the records it needs through the repos.
describe("brands & outlets repo", () => {
  beforeEach(() => resetDb());

  const newBrand = (name: string, code: string) => brandsRepo.create({ name, brand_code: code }, ACTOR);

  it("starts with no brands and no outlets", async () => {
    expect((await brandsRepo.list()).length).toBe(0);
    expect((await outletsRepo.list()).length).toBe(0);
  });

  it("creates a brand and rejects duplicate name / code", async () => {
    const b = await newBrand("Nomad", "NOM");
    expect(b.id).toBeTruthy();
    expect((await brandsRepo.list()).length).toBe(1);
    await expect(newBrand("nomad", "X")).rejects.toThrow(/name already exists/i);
    await expect(newBrand("Other", "NOM")).rejects.toThrow(/code already exists/i);
  });

  it("creates an outlet under a brand, dedupes per brand, and validates the brand", async () => {
    const b = await newBrand("Nomad", "NOM");
    const o = await outletsRepo.create(
      { brand_id: b.id, name: "Nomad Adajan", outlet_code: "NOM-ADA" },
      ACTOR,
    );
    expect(o.brand_id).toBe(b.id);
    await expect(
      outletsRepo.create({ brand_id: b.id, name: "nomad adajan", outlet_code: "X" }, ACTOR),
    ).rejects.toThrow(/already exists for this brand/i);
    await expect(
      outletsRepo.create({ brand_id: "nope", name: "Z", outlet_code: "Z" }, ACTOR),
    ).rejects.toThrow(/valid brand/i);
  });

  it("archives an outlet via setStatus", async () => {
    const b = await newBrand("Nomad", "NOM");
    const o = await outletsRepo.create(
      { brand_id: b.id, name: "Nomad Central", outlet_code: "NOM-CEN" },
      ACTOR,
    );
    await outletsRepo.setStatus(o.id, "archived", ACTOR);
    expect((await outletsRepo.getById(o.id))!.status).toBe("archived");
  });

  it("blocks deleting a brand that still has outlets; deletes a fresh one", async () => {
    const used = await newBrand("Occupied", "OCC");
    await outletsRepo.create(
      { brand_id: used.id, name: "Occupied One", outlet_code: "OCC-1" },
      ACTOR,
    );
    await expect(brandsRepo.remove(used.id, ACTOR)).rejects.toThrow(/outlets|recipes/i);

    const fresh = await newBrand("Temp", "TMP");
    await brandsRepo.remove(fresh.id, ACTOR);
    expect(await brandsRepo.getById(fresh.id)).toBeNull();
  });

  it("deletes a fresh outlet with no wastage", async () => {
    const b = await newBrand("Nomad", "NOM");
    const o = await outletsRepo.create(
      { brand_id: b.id, name: "Nomad Temp", outlet_code: "NOM-TMP" },
      ACTOR,
    );
    await outletsRepo.remove(o.id, ACTOR);
    expect(await outletsRepo.getById(o.id)).toBeNull();
  });
});
