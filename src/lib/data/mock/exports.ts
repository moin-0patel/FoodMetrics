// §9 Export History — one audit row per successful export. Recording is idempotent
// on the row id, so a retried/double-clicked export never creates a duplicate.
import type { ExportHistory } from "../types";
import { delay, getDb, mutate, nowISO, uid } from "./db";

export type ExportRecordInput = Omit<ExportHistory, "id" | "exported_at" | "timezone" | "status"> & {
  id?: string;
  exported_at?: string;
  timezone?: string;
  status?: ExportHistory["status"];
};

export const exportsRepo = {
  async list(): Promise<ExportHistory[]> {
    return delay([...getDb().export_history].sort((a, b) => b.exported_at.localeCompare(a.exported_at)));
  },

  async record(input: ExportRecordInput): Promise<ExportHistory> {
    return delay(
      mutate((db) => {
        const id = input.id ?? uid();
        const existing = db.export_history.find((e) => e.id === id);
        if (existing) return existing; // idempotent — no duplicate audit rows
        const row: ExportHistory = {
          id,
          exported_by_user_id: input.exported_by_user_id ?? null,
          exporter_name_snapshot: input.exporter_name_snapshot,
          exporter_email_snapshot: input.exporter_email_snapshot ?? null,
          exporter_role_snapshot: input.exporter_role_snapshot,
          export_type: input.export_type,
          entity_type: input.entity_type,
          entity_id: input.entity_id ?? null,
          recipe_name_snapshot: input.recipe_name_snapshot ?? null,
          report_name: input.report_name ?? null,
          brand_id: input.brand_id ?? null,
          outlet_id: input.outlet_id ?? null,
          filters_used: input.filters_used ?? null,
          file_format: input.file_format,
          exported_at: input.exported_at ?? nowISO(),
          timezone: input.timezone ?? "Asia/Kolkata",
          status: input.status ?? "success",
        };
        db.export_history.push(row);
        return row;
      }),
    );
  },
};
