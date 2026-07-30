# Demo data — The Urban Kitchen

A complete, presentable catalog for demos, screenshots and product video: **33
ingredients, 7 yield records, 6 in-house preps and 5 menu dishes**, one dish in each
of five categories, every dish photographed and costed by the app.

**The Urban Kitchen is fictional.** The restaurant, the five dishes, the suppliers
(Greenfield Produce, Kaveri Creamery, Malabar Spice Co…) and the chef names are all
invented for this sample. No customer's data is reproduced here.

> **This is sample data.** It is kept out of the app seed on purpose: the app starts
> empty and nothing here loads unless you import it. See *Removing it* below.

## Create the brand first

Menu recipes belong to a brand, and brands have no import path — create one by hand
in **Brands & Outlets** (Super Admin) before step 4:

| Field | Value |
|---|---|
| Name | The Urban Kitchen |
| Brand code | TUK |
| Notes | Demo Restaurant — sample data |

Add an outlet under it (e.g. *The Urban Kitchen — Central*) if you want the wastage
and outlet reports to have somewhere to point.

## Import order matters

Ingredients must exist before preps reference them, and preps before dishes. Go to
**Import Data** (Super Admin only) and run these in order, in **Upsert** mode:

| # | File | Import section |
|---|------|----------------|
| 1 | `1_raw-materials.csv` | Raw Materials |
| 2 | `2_yield.csv` | Yield |
| 3 | `3_in-house-prep.csv` | In-House Prep |
| 4 | `4_menu-recipes.csv` | Menu Recipes — select the brand in the panel |

## What it looks like afterwards

Six preps carry the dishes, so the recipe tree, prep costing and the price cascade all
have something to show — change the flour price and Pizza Dough, Margherita Pizza and
Chocolate Lava Cake all move.

| Prep | Batch | Yield | Per gram |
|---|---|---|---|
| Pizza Dough | ₹113.55 | 1100 g | ₹0.1032 |
| Pizza Sauce | ₹155.09 | 1495 g | ₹0.1037 |
| Alfredo Sauce | ₹536.99 | 1216 g | ₹0.4416 |
| Garlic Butter | ₹330.11 | 621 g | ₹0.5316 |
| Burger Sauce | ₹172.31 | 714 g | ₹0.2413 |
| Chicken Patty | ₹439.31 | 1314 g | ₹0.3343 |

| Dish | Category | Cost | Packaging | Menu price | Food cost |
|---|---|---|---|---|---|
| Margherita Pizza | Pizza | ₹116.41 | ₹28 | ₹449 | **25.9 %** |
| Classic Chicken Burger | Burgers | ₹82.49 | ₹22 | ₹349 | **23.6 %** |
| Chocolate Lava Cake | Desserts | ₹92.55 | ₹18 | ₹279 | **33.2 %** |
| Creamy Alfredo Pasta | Pasta | ₹150.78 | ₹24 | ₹429 | **35.1 %** |
| Crispy Garlic Bread | Starters | ₹104.99 | ₹14 | ₹249 | **42.2 %** |

Two dishes sit under the default 30 % target and three above it, so the dashboard's
"over target" tile and the attention list are populated rather than empty — which is
the point of a demo catalog.

**No cost is written into these files.** Every figure above is derived by the costing
engine from the prices, yields and quantities in the CSVs, so it moves if you edit
them. `src/lib/data/demoData.test.ts` re-runs the whole import and re-checks these
numbers, so a typo'd ingredient name or an implausible price fails the test suite.

Prices are realistic Indian-market figures (₹ per kg / litre / piece) as of mid-2026.

### Things the app doesn't store

The dish descriptions carry **cooking time**, **difficulty** and **portion size** as
prose (`Prep 20 min · Cook 8 min · Easy · 1 portion — …`) because the schema has no
field for them: there is one `preparation_time` (minutes), and `serving_size` is
always 1. Likewise **supplier** — each ingredient's `Notes` column carries the
supplier and pack size, since raw materials have no supplier field.

Ingredient prices are per **1 kg / 1 litre / 1 piece**; a material cannot record
"₹650 for 2 kg". Where a real purchase is bigger than that — a 10 kg onion crate, a
2 kg chicken case — it lives in `2_yield.csv`, which does take a purchase quantity,
and whose yield-adjusted rate then overrides the material rate in costing.

## Columns

Beyond the documented import columns (see
[`import-templates/README.md`](../import-templates/README.md)), both recipe files use
the optional **Description**, **Method**, **Prep Time** and **Created By** columns.
They are header-level: fill them on the **first row** of each recipe and leave them
blank on the rest — the importer takes the first non-empty value. **Method** is one
cell holding every step, separated by `|`.

Leaving one blank on a re-import leaves the existing value alone, so re-importing to
refresh prices won't wipe text someone typed in the editor.

## The photography

`public/demo/photos/*.jpg` — one photo per dish (square, 1200 px) plus a dining-room
shot used by the landing page and the sign-in panel. Referenced by the `Image` column
in `4_menu-recipes.csv`.

### ⚠️ Attribution is required

These came from **Wikimedia Commons** and are reused under the licence listed for each
file in [`public/demo/photos/CREDITS.md`](../public/demo/photos/CREDITS.md). Most are
Creative Commons **BY-SA**, which obliges you to **credit the author** and keep the
same licence on anything you redistribute. The landing-page footer carries that credit
— don't remove the link unless you replace the photos with your own, which removes the
obligation entirely. Stock-photo sites were deliberately not used: their images are
licensed per-use and cannot be committed to a repo.

Re-fetch with `node scripts/fetch-demo-photos.mjs` (from the repo root). Each image is
**pinned to a specific Commons file** rather than a search term, because search
ranking is keyword-based and drifts — an unpinned run returned a vegetable pizza for
"garlic bread" and a branded fast-food wrapper for "chicken burger". If you change a
pin, **open the file and look at it**.

### Using your own photos

1. Drop files into `public/demo/photos/`.
2. Point the `Image` column at them — `/demo/photos/my-pizza.jpg` — and re-import
   `4_menu-recipes.csv` in **update** or **upsert** mode. Re-importing refreshes the
   image on an existing recipe.

Or set an image per recipe in the recipe editor.

Vector fallback plates (no attribution needed) are at `public/demo/*.svg` —
regenerate with `node scripts/gen-demo-art.mjs`.

## Removing it

Nothing here is wired into the seed, so removal is just deleting records:

- **Super Admin → wipe catalog** clears all materials, recipes, preps, yields,
  packaging and wastage in one action, leaving users, roles, brands and settings.
- Or delete individually — Raw Materials and Recipes both support multi-select
  delete. Note a material used by a recipe is protected until the recipe goes.

On Supabase you can also run `select public.wipe_catalog();` from the SQL editor
(added by `db/migrations/0028_wipe_catalog.sql`).
