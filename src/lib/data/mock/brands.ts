// Dynamic brand master data (Super-Admin managed). Mirrors the Supabase
// public.brands table. Brands are archived, never hard-deleted, while linked
// data (outlets/recipes) exists (§10). The two seeded brands reuse the legacy
// runtime ids — no brand is hardcoded.

import type { BrandOutletStatus, BrandRecord } from "../types";
import { delay, getDb, mutate, nowISO, uid } from "./db";
import { recordAudit } from "./recompute";

export interface BrandInput {
  name: string;
  brand_code: string;
  display_name?: string | null;
  accent_color?: string | null;
  logo_url?: string | null;
  status?: BrandOutletStatus;
  notes?: string | null;
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
const codeNorm = (s: string) => s.toUpperCase().replace(/\s+/g, "").trim();

export const brandsRepo = {
  async list(): Promise<BrandRecord[]> {
    return delay([...getDb().brands].sort((a, b) => a.name.localeCompare(b.name)));
  },

  async getById(id: string): Promise<BrandRecord | null> {
    return delay(getDb().brands.find((b) => b.id === id) ?? null);
  },

  async create(input: BrandInput, actorId: string): Promise<BrandRecord> {
    return delay(
      mutate((db) => {
        const nn = norm(input.name);
        if (!nn) throw new Error("Brand name is required");
        if (db.brands.some((b) => b.normalized_name === nn)) {
          throw new Error("A brand with this name already exists");
        }
        const code = codeNorm(input.brand_code || input.name.slice(0, 4));
        if (!code) throw new Error("Brand code is required");
        if (db.brands.some((b) => codeNorm(b.brand_code) === code)) {
          throw new Error("A brand with this code already exists");
        }
        const brand: BrandRecord = {
          id: uid(),
          name: input.name.trim(),
          normalized_name: nn,
          brand_code: code,
          display_name: (input.display_name || input.name).trim(),
          accent_color: input.accent_color ?? null,
          logo_url: input.logo_url ?? null,
          status: input.status ?? "active",
          notes: input.notes ?? null,
          created_by: actorId,
          created_at: nowISO(),
          updated_by: actorId,
          updated_at: nowISO(),
        };
        db.brands.push(brand);
        recordAudit(db, {
          entity_type: "brand",
          entity_id: brand.id,
          action: "create",
          new_values: { name: brand.name, code: brand.brand_code },
          performed_by: actorId,
          notes: `Created brand "${brand.name}"`,
        });
        return brand;
      }),
    );
  },

  async update(id: string, input: BrandInput, actorId: string): Promise<BrandRecord> {
    return delay(
      mutate((db) => {
        const brand = db.brands.find((b) => b.id === id);
        if (!brand) throw new Error("Brand not found");
        const nn = norm(input.name);
        if (!nn) throw new Error("Brand name is required");
        if (db.brands.some((b) => b.id !== id && b.normalized_name === nn)) {
          throw new Error("A brand with this name already exists");
        }
        const code = codeNorm(input.brand_code || input.name.slice(0, 4));
        if (!code) throw new Error("Brand code is required");
        if (db.brands.some((b) => b.id !== id && codeNorm(b.brand_code) === code)) {
          throw new Error("A brand with this code already exists");
        }
        const before = { name: brand.name, code: brand.brand_code, status: brand.status };
        brand.name = input.name.trim();
        brand.normalized_name = nn;
        brand.brand_code = code;
        brand.display_name = (input.display_name || input.name).trim();
        brand.accent_color = input.accent_color ?? null;
        brand.logo_url = input.logo_url ?? null;
        if (input.status) brand.status = input.status;
        brand.notes = input.notes ?? null;
        brand.updated_by = actorId;
        brand.updated_at = nowISO();
        recordAudit(db, {
          entity_type: "brand",
          entity_id: brand.id,
          action: "update",
          old_values: before,
          new_values: { name: brand.name, code: brand.brand_code, status: brand.status },
          performed_by: actorId,
          notes: `Updated brand "${brand.name}"`,
        });
        return brand;
      }),
    );
  },

  async setStatus(id: string, status: BrandOutletStatus, actorId: string): Promise<BrandRecord> {
    return delay(
      mutate((db) => {
        const brand = db.brands.find((b) => b.id === id);
        if (!brand) throw new Error("Brand not found");
        const before = brand.status;
        brand.status = status;
        brand.updated_by = actorId;
        brand.updated_at = nowISO();
        const verb = status === "archived" ? "Archived" : status === "inactive" ? "Deactivated" : "Activated";
        recordAudit(db, {
          entity_type: "brand",
          entity_id: brand.id,
          action: "update",
          old_values: { status: before },
          new_values: { status },
          performed_by: actorId,
          notes: `${verb} brand "${brand.name}"`,
        });
        return brand;
      }),
    );
  },

  /** Hard delete — blocked while any outlet or recipe still references the brand. */
  async remove(id: string, actorId: string): Promise<void> {
    return delay(
      mutate((db) => {
        const brand = db.brands.find((b) => b.id === id);
        if (!brand) throw new Error("Brand not found");
        if (db.outlets.some((o) => o.brand_id === id)) {
          throw new Error("Cannot delete a brand that still has outlets. Archive it instead.");
        }
        if (db.recipes.some((r) => r.brand === id)) {
          throw new Error("Cannot delete a brand that still has recipes. Archive it instead.");
        }
        db.brands = db.brands.filter((b) => b.id !== id);
        recordAudit(db, {
          entity_type: "brand",
          entity_id: id,
          action: "delete",
          performed_by: actorId,
          notes: `Deleted brand "${brand.name}"`,
        });
      }),
    );
  },
};
