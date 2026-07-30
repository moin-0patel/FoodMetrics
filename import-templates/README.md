# Food Metrics — Import Templates

Where to import in the app (each page has an **Import** button that opens a dialog with
a **Download template** option and Add / Update / Upsert modes):

| File | Import on page | Notes |
|------|----------------|-------|
| `1_raw-materials.csv` | **Raw Materials** | Base ingredient list + purchase price |
| `2_yield.csv` | **Yield** | Wastage → true yield % per ingredient |
| `3_recipes_in-house-prep.csv` | **Recipes → In-House Prep** | Reusable sub-recipes |
| `4_recipes_menu.csv` | **Recipes → Menu** | Sellable menu items |

CSV **or** XLSX are both accepted. Headers are matched case-insensitively.
Columns marked `*` are required. Extra columns are ignored.

---

## 1. Raw Materials
Columns: **Ingredient\***, Category, Material Type, Purchase Price, Notes
- **Material Type** → sets the purchase unit automatically. Accepts:
  - `Weight` (kg/gram) — price is **per 1 KG**
  - `Liquid` (litre/ml) — price is **per 1 Litre**
  - `Count` (piece/each) — price is **per 1 Piece**
  - Blank defaults to `Weight`.
- **Purchase Price** — number only (₹). No currency symbol needed.

## 2. Yield
Columns: **Ingredient\***, **Purchase Cost\***, **Purchase Quantity\***, **Purchase Unit\***,
**Wastage Quantity\***, Effective From, Notes
- **Purchase Unit** — one of: `KG, Gram, Litre, ML, Piece, Dozen, Packet, Bottle, Can`
- **Wastage Quantity** — in the **base** unit (grams for KG, ml for Litre, pieces for count).
- **Effective From** — `YYYY-MM-DD` (optional; defaults to today).

## 3. Recipes — In-House Prep
Columns: **Prep Name\***, Category, **Ingredient\***, **Quantity\***, Unit,
Description, Method, Prep Time, Created By
- **One row per ingredient.** Repeat the same **Prep Name** on multiple rows to add
  all its ingredients (see `Tomato Sauce` in the sample — 3 rows = 1 prep).
- **Unit** — one of `KG, Gram, Litre, ML, Piece, Dozen, Packet, Bottle, Can` (default `Gram`).
- Description / Method / Prep Time / Created By — see *Recipe text columns* below.

## 4. Recipes — Menu
Columns: **Recipe Name\***, Category, Size, **Ingredient\***, **Quantity\***, Unit,
Selling Price, Packaging, Image, Description, Method, Prep Time, Created By
- **One row per ingredient** — repeat Recipe Name (and Size) across rows.
- **Size** — pizzas only: `11-inch` or `15-inch`. Leave blank for everything else.
  Different sizes of the same recipe are separate variants — repeat all ingredient rows
  per size (see the two Margherita blocks in the sample).
- **Selling Price** / **Packaging** — numbers (₹); can be blank.
- **Image** — a path under `public/` (`/demo/photos/margherita-pizza.jpg`) or an
  absolute URL.

### Recipe text columns (both recipe files)
These describe the recipe, not the ingredient row, so fill them on the **first row**
of each recipe and leave them blank on the rest — the importer takes the first
non-empty value it finds, exactly as it does for Selling Price.

| Column | Notes |
|---|---|
| `Description` | Free text. The app has no cooking-time or difficulty field, so those usually go here: `Prep 20 min · Cook 8 min · Easy · 1 portion — …` |
| `Method` | **One cell holding every step**, separated by `\|`. Commas are not separators — steps are prose and contain them. Shown as a numbered list. |
| `Prep Time` | Minutes, a number. |
| `Created By` | Creator label, e.g. `Chef Rahul`. The recipe editor requires one, so an imported recipe without it can't be re-saved until someone types it in. |

Leaving one of these blank on an **update**/**upsert** leaves the existing value
alone, so re-importing to refresh prices won't wipe text typed in the editor. Any
cell containing a comma must be wrapped in double quotes (standard CSV) — or use
XLSX, where it doesn't matter.

---

### Import modes
- **Add** — insert new records only (skips existing).
- **Update** — change existing records only.
- **Upsert** — insert new + update existing.

Ingredients referenced in recipes should already exist in **Raw Materials** (or be
imported first) so costs resolve. Rows that fail validation are reported and can be
re-downloaded as `import_errors.xlsx` to fix and re-import.
