-- 0021_normalize_material_pricing.sql
-- Simplified raw-material purchase model: the price is per ONE automatic purchase
-- unit — 1 kg (weight), 1 litre (volume), 1 piece (count) — so purchase_quantity is
-- always 1 and users never pick a unit. This migration normalizes existing rows.
--
-- COST-PRESERVING: cost_per_base_unit is a plain, app-maintained column (see 0001)
-- and is left untouched. We only rewrite purchase_price to "per 1 canonical unit"
-- (= cost_per_base_unit × base-units-per-unit) and set purchase_quantity = 1 with
-- the canonical unit. Re-computing from these gives back the SAME cost_per_base_unit,
-- so no recipe is re-costed and no data is corrupted.
--
-- ⚠ TAKE A SUPABASE BACKUP BEFORE RUNNING (Dashboard → Database → Backups, or pg_dump).
-- Idempotent: re-running against already-normalized rows is a no-op.

-- Weight (base Gram) → 1 kg
update public.raw_materials set
  purchase_price    = case when cost_per_base_unit is null then purchase_price
                           else round(cost_per_base_unit * 1000, 2) end,
  purchase_quantity = 1,
  purchase_unit     = 'KG',
  base_unit         = 'Gram'
where base_unit = 'Gram';

-- Volume (base ML) → 1 litre
update public.raw_materials set
  purchase_price    = case when cost_per_base_unit is null then purchase_price
                           else round(cost_per_base_unit * 1000, 2) end,
  purchase_quantity = 1,
  purchase_unit     = 'Litre',
  base_unit         = 'ML'
where base_unit = 'ML';

-- Count (already piece-based) → 1 piece
update public.raw_materials set
  purchase_price    = case when cost_per_base_unit is null then purchase_price
                           else round(cost_per_base_unit, 2) end,
  purchase_quantity = 1,
  purchase_unit     = 'Piece',
  base_unit         = 'Piece'
where base_unit = 'Piece';

-- NOTE: rows with base_unit Packet/Bottle/Can are intentionally left as-is — they
-- don't map cleanly onto 1 piece and are still costed correctly with their existing
-- purchase_quantity/unit. Convert them by hand if you want them on the piece model.
