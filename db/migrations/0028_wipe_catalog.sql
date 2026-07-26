-- 0028_wipe_catalog.sql — Super-Admin "wipe all catalog data" RPC.
--
-- Deletes the entire operational catalog (recipes / in-house prep, ingredient
-- lines, raw materials, yields, packaging, wastage, and their cost/price
-- history) so a super admin can start fresh. KEEPS user_profiles, roles,
-- role_capabilities, brands, outlets, system_settings and audit_logs.
--
-- SECURITY DEFINER runs as the table owner (bypasses RLS) and is gated to
-- super-admins via is_app_super_admin() (0015). TRUNCATE ... CASCADE handles FK
-- order atomically in one transaction. Idempotent (safe to re-run).

create or replace function public.wipe_catalog()
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_app_super_admin() then
    raise exception 'Only a Super Admin can wipe catalog data';
  end if;

  truncate table
    public.recipe_cost_history,
    public.ingredient_price_history,
    public.recipe_versions,
    public.recipe_packaging,
    public.recipe_ingredients,
    public.user_recipe_views,
    public.recipe_access_links,
    public.wastage_lines,
    public.wastage_entries,
    public.export_history,
    public.recipes,
    public.raw_materials,
    public.ingredient_yields,
    public.packaging_items
    restart identity cascade;

  begin
    insert into public.audit_logs (entity_type, entity_id, action, performed_by, notes)
    values ('system', auth.uid(), 'delete', auth.uid(),
            'Wiped all catalog data (recipes, materials, yields, packaging, wastage)');
  exception when others then null;  -- never fail the wipe on an audit-insert quirk
  end;
end;
$$;

revoke all on function public.wipe_catalog() from public, anon;
grant execute on function public.wipe_catalog() to authenticated;
