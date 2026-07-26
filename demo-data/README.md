# Demo data — presentable content for a walkthrough

A small, coherent catalog for demoing the app: 38 ingredients, 8 yield records,
7 in-house preps and 8 menu dishes with artwork. Enough to make every screen look
alive — dashboard tiles, the recipe gallery, food cost by section, the attention
list — without pretending to be a real kitchen's book.

> **This is sample data.** It is kept out of the app seed on purpose: the app
> starts empty, and nothing here loads unless you import it. See *Removing it*
> below.

## Import order matters

Ingredients must exist before preps reference them, and preps before dishes. Go to
**Import Data** (Super Admin only) and run these in order:

| # | File | Import section |
|---|------|----------------|
| 1 | `1_raw-materials.csv` | Raw Materials |
| 2 | `2_yield.csv` | Yield |
| 3 | `3_in-house-prep.csv` | In-House Prep |
| 4 | `4_menu-recipes.csv` | Menu Recipes |

Menu Recipes needs a brand selected in the import panel, so **create at least one
brand first** in Brands & Outlets. Steps 1–3 are brand-agnostic.

## What it looks like afterwards

Costs are computed by the app, not written into the files — so the figures are
whatever the costing engine derives from these prices, yields and quantities. With
the default 30% target you should land a spread across the bands: a few dishes
comfortably under, one or two near the line, and at least one over — which is what
makes the dashboard's "over target" tile and the attention list worth looking at.

Prices are realistic Indian-market figures (₹ per kg / litre / piece) as of
mid-2026, so margins read plausibly rather than perfectly.

## The photography

`public/demo/photos/*.jpg` — real dish photography, referenced by the `Image`
column in `4_menu-recipes.csv`. Also used by the landing page.

### ⚠️ Attribution is required

These came from **Wikimedia Commons** and are reused under the licence listed for
each file in [`public/demo/photos/CREDITS.md`](../public/demo/photos/CREDITS.md).
Most are Creative Commons **BY-SA**, which obliges you to:

- **credit the author**, and
- keep the same licence on anything you redistribute.

That's fine for internal demos. If this app goes public, either add an image-credits
page/footer link, or **replace the photos with your own** — which removes the
obligation entirely. Stock-photo sites were deliberately not used: their images are
licensed per-use and cannot be committed to a repo.

Re-fetch any time with `node scripts/fetch-demo-photos.mjs`. The script rejects
greyscale and portrait images, so it won't pull vintage archive material.

### Using your own photos

1. Drop files into `public/demo/photos/`.
2. Point the `Image` column at them — `/demo/photos/butter-chicken.jpg` — and
   re-import `4_menu-recipes.csv` in **update** or **upsert** mode. Re-importing
   refreshes the image on an existing recipe.

Or set an image per recipe in the recipe editor.

Vector fallback plates (no attribution needed) are still available at
`public/demo/*.svg` — regenerate with `node scripts/gen-demo-art.mjs`.

## Removing it

Nothing here is wired into the seed, so removal is just deleting records:

- **Super Admin → wipe catalog** clears all materials, recipes, preps, yields,
  packaging and wastage in one action, leaving users, roles, brands and settings.
- Or delete individually — Raw Materials and Recipes both support multi-select
  delete. Note a material used by a recipe is protected until the recipe goes.

On Supabase you can also run `select public.wipe_catalog();` from the SQL editor
(added by `db/migrations/0028_wipe_catalog.sql`).
