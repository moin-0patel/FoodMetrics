import { describe, it, expect, beforeEach } from "vitest";
import { resetDb } from "./db";
import { usersRepo } from "./users";

// The mock seed ships exactly one account: M S Patel (owner), the single active
// super_admin. Every other user a test needs is created through the repo.
const mkSuper = (i: number) =>
  usersRepo.create(
    { name: `S${i}`, email: `s${i}@x.com`, role: "super_admin", password: "password1" },
    "u-owner",
  );

describe("super admin count limits", () => {
  beforeEach(() => resetDb());

  it("allows up to 2 active super admins and rejects the 3rd", async () => {
    // seed owner (1) + 1 created = 2 active supers.
    await mkSuper(1);
    await expect(mkSuper(2)).rejects.toThrow(/maximum of 2/i);
  });

  it("exempts owner emails from the maximum", async () => {
    // The seed owner (mspatel05831) already occupies the single owner email, so to
    // exercise the exemption we bootstrap a second super, demote the owner (min-1
    // still holds), fill the 2-cap with non-owner supers, then re-promote the owner.
    const s0 = await mkSuper(0); // supers: owner + s0
    // The seed has no Admin, so add one — otherwise demoting the owner to admin and
    // promoting them back trips the separate "last remaining Admin" guard.
    await usersRepo.create(
      { name: "A1", email: "a1@x.com", role: "admin", password: "password1" },
      s0.id,
    );
    await usersRepo.update("u-owner", { role: "admin" }, s0.id); // demote owner → 1 super (s0)
    await usersRepo.create(
      { name: "S1", email: "s1@x.com", role: "super_admin", password: "password1" },
      s0.id,
    ); // → 2 active supers (s0 + s1) = the cap
    // The owner email is exempt from the 2-cap, so re-promoting is allowed as a 3rd.
    const owner = await usersRepo.update("u-owner", { role: "super_admin" }, s0.id);
    expect(owner.role).toBe("super_admin");
  });

  it("only a super admin can create a super admin", async () => {
    await expect(
      usersRepo.create({ name: "X", email: "x@x.com", role: "super_admin", password: "password1" }, "u-admin"),
    ).rejects.toThrow(/only a super admin/i);
  });

  it("blocks disabling the last active super admin (min 1)", async () => {
    await expect(usersRepo.update("u-owner", { status: "inactive" }, "u-owner")).rejects.toThrow(
      /at least one active super admin/i,
    );
  });

  it("allows disabling a super admin when another remains active", async () => {
    const s = await mkSuper(1); // now moin + s = 2 active supers
    const updated = await usersRepo.update(s.id, { status: "inactive" }, "u-owner");
    expect(updated.status).toBe("inactive");
  });

  it("blocks a plain admin from promoting anyone to super_admin", async () => {
    const v = await usersRepo.create(
      { name: "V", email: "v@x.com", role: "viewer", password: "password1" },
      "u-owner",
    );
    // actor u-admin is role 'admin', not super_admin → not allowed to mint a super.
    await expect(usersRepo.update(v.id, { role: "super_admin" }, "u-admin")).rejects.toThrow(
      /only a super admin/i,
    );
  });

  it("blocks a plain admin from demoting/disabling a super_admin", async () => {
    const s = await mkSuper(1);
    await expect(usersRepo.update(s.id, { status: "inactive" }, "u-admin")).rejects.toThrow(
      /only a super admin/i,
    );
  });

  it("blocks promoting a 3rd active super admin via update", async () => {
    await mkSuper(1); // seed owner + s1 = 2 active supers (the cap)
    const editor = await usersRepo.create(
      { name: "Ed", email: "ed@x.com", role: "editor", password: "password1" },
      "u-owner",
    );
    await expect(usersRepo.update(editor.id, { role: "super_admin" }, "u-owner")).rejects.toThrow(/maximum of 2/i);
  });
});
