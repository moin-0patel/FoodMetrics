// Dynamic outlet master data (Super-Admin managed). Mirrors the Supabase
// public.outlets table. Outlets are archived, never hard-deleted, while linked
// wastage exists (§10–§11). The six seeded outlets reuse legacy ids so wastage
// and outlet references keep resolving.

import type { BrandOutletStatus, OutletRecord } from "../types";
import { delay, getDb, mutate, nowISO, uid } from "./db";
import { recordAudit } from "./recompute";

export interface OutletInput {
  brand_id: string;
  name: string;
  outlet_code: string;
  city?: string | null;
  state?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  opening_date?: string | null;
  timezone?: string;
  status?: BrandOutletStatus;
  manager_user_id?: string | null;
  notes?: string | null;
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
const codeNorm = (s: string) => s.toUpperCase().replace(/\s+/g, "").trim();

export const outletsRepo = {
  async list(): Promise<OutletRecord[]> {
    return delay([...getDb().outlets].sort((a, b) => a.name.localeCompare(b.name)));
  },

  async getById(id: string): Promise<OutletRecord | null> {
    return delay(getDb().outlets.find((o) => o.id === id) ?? null);
  },

  async listByBrand(brandId: string): Promise<OutletRecord[]> {
    return delay(
      getDb()
        .outlets.filter((o) => o.brand_id === brandId)
        .sort((a, b) => a.name.localeCompare(b.name)),
    );
  },

  async create(input: OutletInput, actorId: string): Promise<OutletRecord> {
    return delay(
      mutate((db) => {
        if (!db.brands.some((b) => b.id === input.brand_id)) {
          throw new Error("Select a valid brand for this outlet");
        }
        const nn = norm(input.name);
        if (!nn) throw new Error("Outlet name is required");
        if (db.outlets.some((o) => o.brand_id === input.brand_id && o.normalized_name === nn)) {
          throw new Error("An outlet with this name already exists for this brand");
        }
        const code = codeNorm(input.outlet_code || input.name);
        if (!code) throw new Error("Outlet code is required");
        if (db.outlets.some((o) => codeNorm(o.outlet_code) === code)) {
          throw new Error("An outlet with this code already exists");
        }
        const outlet: OutletRecord = {
          id: uid(),
          brand_id: input.brand_id,
          name: input.name.trim(),
          normalized_name: nn,
          outlet_code: code,
          city: input.city ?? null,
          state: input.state ?? null,
          address: input.address ?? null,
          phone: input.phone ?? null,
          email: input.email ?? null,
          opening_date: input.opening_date || null,
          timezone: input.timezone || "Asia/Kolkata",
          status: input.status ?? "active",
          manager_user_id: input.manager_user_id ?? null,
          notes: input.notes ?? null,
          created_by: actorId,
          created_at: nowISO(),
          updated_by: actorId,
          updated_at: nowISO(),
        };
        db.outlets.push(outlet);
        recordAudit(db, {
          entity_type: "outlet",
          entity_id: outlet.id,
          action: "create",
          new_values: { name: outlet.name, brand_id: outlet.brand_id, code: outlet.outlet_code },
          performed_by: actorId,
          notes: `Created outlet "${outlet.name}"`,
        });
        return outlet;
      }),
    );
  },

  async update(id: string, input: OutletInput, actorId: string): Promise<OutletRecord> {
    return delay(
      mutate((db) => {
        const outlet = db.outlets.find((o) => o.id === id);
        if (!outlet) throw new Error("Outlet not found");
        if (!db.brands.some((b) => b.id === input.brand_id)) {
          throw new Error("Select a valid brand for this outlet");
        }
        const nn = norm(input.name);
        if (!nn) throw new Error("Outlet name is required");
        if (
          db.outlets.some(
            (o) => o.id !== id && o.brand_id === input.brand_id && o.normalized_name === nn,
          )
        ) {
          throw new Error("An outlet with this name already exists for this brand");
        }
        const code = codeNorm(input.outlet_code || input.name);
        if (db.outlets.some((o) => o.id !== id && codeNorm(o.outlet_code) === code)) {
          throw new Error("An outlet with this code already exists");
        }
        const before = { name: outlet.name, brand_id: outlet.brand_id, status: outlet.status };
        outlet.brand_id = input.brand_id;
        outlet.name = input.name.trim();
        outlet.normalized_name = nn;
        outlet.outlet_code = code;
        outlet.city = input.city ?? null;
        outlet.state = input.state ?? null;
        outlet.address = input.address ?? null;
        outlet.phone = input.phone ?? null;
        outlet.email = input.email ?? null;
        outlet.opening_date = input.opening_date || null;
        outlet.timezone = input.timezone || "Asia/Kolkata";
        if (input.status) outlet.status = input.status;
        outlet.manager_user_id = input.manager_user_id ?? null;
        outlet.notes = input.notes ?? null;
        outlet.updated_by = actorId;
        outlet.updated_at = nowISO();
        const brandChanged = before.brand_id !== outlet.brand_id;
        recordAudit(db, {
          entity_type: "outlet",
          entity_id: outlet.id,
          action: "update",
          old_values: before,
          new_values: { name: outlet.name, brand_id: outlet.brand_id, status: outlet.status },
          performed_by: actorId,
          notes: brandChanged
            ? `Moved outlet "${outlet.name}" to a different brand`
            : `Updated outlet "${outlet.name}"`,
        });
        return outlet;
      }),
    );
  },

  async setStatus(id: string, status: BrandOutletStatus, actorId: string): Promise<OutletRecord> {
    return delay(
      mutate((db) => {
        const outlet = db.outlets.find((o) => o.id === id);
        if (!outlet) throw new Error("Outlet not found");
        const before = outlet.status;
        outlet.status = status;
        outlet.updated_by = actorId;
        outlet.updated_at = nowISO();
        const verb = status === "archived" ? "Archived" : status === "inactive" ? "Deactivated" : "Activated";
        recordAudit(db, {
          entity_type: "outlet",
          entity_id: outlet.id,
          action: "update",
          old_values: { status: before },
          new_values: { status },
          performed_by: actorId,
          notes: `${verb} outlet "${outlet.name}"`,
        });
        return outlet;
      }),
    );
  },

  /** Hard delete — blocked while any wastage record still references the outlet. */
  async remove(id: string, actorId: string): Promise<void> {
    return delay(
      mutate((db) => {
        const outlet = db.outlets.find((o) => o.id === id);
        if (!outlet) throw new Error("Outlet not found");
        if (db.wastage_entries.some((w) => w.outlet_id === id)) {
          throw new Error("Cannot delete an outlet with wastage records. Archive it instead.");
        }
        db.outlets = db.outlets.filter((o) => o.id !== id);
        recordAudit(db, {
          entity_type: "outlet",
          entity_id: id,
          action: "delete",
          performed_by: actorId,
          notes: `Deleted outlet "${outlet.name}"`,
        });
      }),
    );
  },
};
