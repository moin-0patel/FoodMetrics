// Supabase-backed Export History repository (Phase 2). Mirrors the mock
// `exportsRepo` 1:1; selection happens in src/lib/data/index.ts. Backed by
// public.export_history (db/migrations/0010). `record` upserts on the row id so a
// retried/double-clicked export never creates a duplicate audit row.
import type { ExportHistory } from "../types";
import type { ExportRecordInput } from "../mock/exports";
import { nowISO, uid } from "../mock/db";
import { sb, fail } from "./helpers";

export type { ExportRecordInput };

export const supabaseExportsRepo = {
  async list(): Promise<ExportHistory[]> {
    const { data, error } = await sb()
      .from("export_history")
      .select("*")
      .order("exported_at", { ascending: false });
    if (error) fail("Load export history", error.message);
    return (data ?? []) as ExportHistory[];
  },

  async record(input: ExportRecordInput): Promise<ExportHistory> {
    const row: ExportHistory = {
      id: input.id ?? uid(),
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
    // Idempotent insert — ignore duplicates on the primary key.
    const { data, error } = await sb()
      .from("export_history")
      .upsert(row, { onConflict: "id", ignoreDuplicates: true })
      .select("*")
      .maybeSingle();
    if (error) fail("Record export", error.message);
    return (data as ExportHistory | null) ?? row;
  },
};
