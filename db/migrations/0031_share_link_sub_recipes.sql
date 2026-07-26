-- 0031_share_link_sub_recipes.sql — include each direct sub-recipe's own ingredients
-- in the shared-recipe payload, so a temporary link shows the "Sub-Recipe Breakdown"
-- on the page and in the downloaded PDF. Financial fields are still stripped (share
-- links never expose costs). Idempotent (create or replace) — safe to re-run.

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
    return jsonb_build_object('status', 'REVOKED');
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
    ), '[]'::jsonb),
    -- Each DIRECT sub-recipe of this recipe, with its own ingredients (one level).
    'sub_recipes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', sr.id,
        'recipe_name', sr.recipe_name,
        'yield_quantity', sr.yield_quantity,
        'yield_unit', sr.yield_unit,
        'ingredients', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', sri.id,
            'component_type', sri.component_type,
            'quantity_used', sri.quantity_used,
            'unit_used', sri.unit_used,
            'sub_recipe', (sri.component_type = 'recipe'),
            'ingredient_name', case when sri.component_type = 'recipe' then ssr.recipe_name else srm.ingredient_name end
          ) order by sri.sort_order)
          from public.recipe_ingredients sri
          left join public.raw_materials srm on srm.id = sri.ingredient_id and sri.component_type <> 'recipe'
          left join public.recipes ssr on ssr.id = sri.ingredient_id and sri.component_type = 'recipe'
          where sri.recipe_id = sr.id
        ), '[]'::jsonb))
        order by sr.recipe_name)
      from (select distinct ri.ingredient_id as sid
            from public.recipe_ingredients ri
            where ri.recipe_id = v_recipe.id and ri.component_type = 'recipe') s
      join public.recipes sr on sr.id = s.sid
    ), '[]'::jsonb)
  );
end;
$$;
grant execute on function public.resolve_share_link(text) to anon, authenticated;
