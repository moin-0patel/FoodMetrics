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
Columns: **Prep Name\***, Category, **Ingredient\***, **Quantity\***, Unit
- **One row per ingredient.** Repeat the same **Prep Name** on multiple rows to add
  all its ingredients (see `Tomato Sauce` in the sample — 3 rows = 1 prep).
- **Unit** — one of `KG, Gram, Litre, ML, Piece, Dozen, Packet, Bottle, Can` (default `Gram`).

## 4. Recipes — Menu
Columns: **Recipe Name\***, Category, Size, **Ingredient\***, **Quantity\***, Unit,
Selling Price, Packaging
- **One row per ingredient** — repeat Recipe Name (and Size) across rows.
- **Size** — pizzas only: `11-inch` or `15-inch`. Leave blank for everything else.
  Different sizes of the same recipe are separate variants — repeat all ingredient rows
  per size (see the two Margherita blocks in the sample).
- **Selling Price** / **Packaging** — numbers (₹); can be blank.

---

### Import modes
- **Add** — insert new records only (skips existing).
- **Update** — change existing records only.
- **Upsert** — insert new + update existing.

Ingredients referenced in recipes should already exist in **Raw Materials** (or be
imported first) so costs resolve. Rows that fail validation are reported and can be
re-downloaded as `import_errors.xlsx` to fix and re-import.
