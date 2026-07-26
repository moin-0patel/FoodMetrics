-- 0020_fix_share_link_digest.sql
-- Fix: temporary recipe share links (resolve_share_link) failed with
--   "function digest(text, unknown) does not exist"
-- because pgcrypto's digest() lives in the `extensions` schema on Supabase, but
-- the function's search_path was only `public`, so the unqualified digest() call
-- couldn't be resolved. Recreate the function with `extensions` on the search_path.
-- Idempotent / re-runnable.

create extension if not exists pgcrypto with schema extensions;

create or replace function public.resolve_share_link(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash   text := encode(digest(p_token, 'sha256'), 'hex');
  v_link   public.recipe_access_links%rowtype;
  v_recipe public.recipes%rowtype;
  v_status text;
begin
  select * into v_link from public.recipe_access_links where token_hash = v_hash;
  if not found then
    return jsonb_build_object('status', 'REVOKED'); -- unknown/tampered token → unusable
  end if;

  if v_link.revoked_at is not null then
    v_status := 'REVOKED';
  elsif v_link.expires_at <= now() then
    v_status := 'EXPIRED';
  else
    v_status := 'ACTIVE';
  end if;

  update public.recipe_access_links set status = v_status where id = v_link.id;
  if v_status <> 'ACTIVE' then
    return jsonb_build_object('status', v_status);
  end if;

  select * into v_recipe from public.recipes where id = v_link.recipe_id;
  if not found then
    return jsonb_build_object('status', 'REVOKED');
  end if;

  update public.recipe_access_links
     set access_count = access_count + 1, last_accessed_at = now()
   where id = v_link.id;

  return jsonb_build_object(
    'status', 'ACTIVE',
    'access_type', v_link.access_type,
    'granted_by_name', v_link.granted_by_name,
    'brand', v_recipe.brand,
    -- Strip financial + costing columns server-side — they never leave the database.
    'recipe', (to_jsonb(v_recipe) - 'total_cost' - 'cost_per_portion' - 'packaging_cost' - 'selling_price' - 'wastage_pct'),
    'ingredients', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', ri.id,
        'component_type', ri.component_type,
        'quantity_used', ri.quantity_used,
        'unit_used', ri.unit_used,
        'sub_recipe', (ri.component_type = 'recipe'),
        'ingredient_name', case when ri.component_type = 'recipe' then sr.recipe_name else rm.ingredient_name end
      ) order by ri.sort_order)
      from public.recipe_ingredients ri
      left join public.raw_materials rm on rm.id = ri.ingredient_id and ri.component_type <> 'recipe'
      left join public.recipes sr on sr.id = ri.ingredient_id and ri.component_type = 'recipe'
      where ri.recipe_id = v_recipe.id
    ), '[]'::jsonb)
  );
end;
$$;

grant execute on function public.resolve_share_link(text) to anon, authenticated;
