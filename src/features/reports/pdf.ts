// PDF export — PRD §6.2 / §13.1. Uses pdfmake. Cost columns are omitted when
// the viewer's visibility hides them (the "no cost" view).

import type { TDocumentDefinitions, TableCell, Content } from "pdfmake/interfaces";
import { calculateIngredientCost, round2 } from "@/lib/costing";
import { canConvert } from "@/lib/units";
import { formatINR, formatUnit, formatWeight } from "@/lib/utils";
import { type Recipe, type RecipeIngredientWithMaterial } from "@/lib/data/types";
import { brandLabel as resolveBrandLabel, brandAccentHex, cachedBrands } from "@/lib/data/brandCache";
import { roleLabel as resolveRoleLabel } from "@/lib/auth/roleCache";
import type { ViewVisibility } from "@/lib/auth/permissions";

/** Who exported + when — stamped by the caller from the authenticated session. */
export interface PdfExporter {
  id?: string;
  name: string;
  role: string;
}

/** Quantity as a clean string — trims float artifacts to ≤3 decimals (e.g. 0.30000004 → 0.3). */
const qtyStr = (n: number) => String(Math.round(n * 1000) / 1000);

/** Current date/time formatted in the operating timezone (Asia/Kolkata / IST). */
function istStamp() {
  const now = new Date();
  const date = now.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", year: "numeric", month: "short", day: "numeric" });
  const time = now.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" });
  return { date, time, label: `${date}, ${time} IST` };
}

/** Lazy-load pdfmake + fonts only when an export is requested.
 *  pdfmake ≤0.2.15 shipped vfs_fonts as `{ pdfMake: { vfs } }`; ≥0.2.16 (we're on
 *  0.2.23) exports the raw vfs map directly (`module.exports = vfs`), which lands on
 *  `.default` under Vite's CJS interop. Resolve all shapes so the fonts always load —
 *  a missing vfs is what silently broke export ("Roboto-Regular.ttf not found"). */
async function loadPdfMake() {
  const [pdfmakeMod, fontsMod] = await Promise.all([
    import("pdfmake/build/pdfmake"),
    import("pdfmake/build/vfs_fonts"),
  ]);
  const pdfMake = ((pdfmakeMod as { default?: unknown }).default ?? pdfmakeMod) as {
    vfs: Record<string, string>;
    createPdf: (doc: TDocumentDefinitions) => { download: (name: string) => void; getBlob: (cb: (b: Blob) => void) => void };
  };
  const fonts = (fontsMod as { default?: unknown }).default ?? fontsMod;
  const asShape = fonts as { pdfMake?: { vfs: Record<string, string> }; vfs?: Record<string, string> };
  const vfs = asShape.pdfMake?.vfs ?? asShape.vfs ?? (fonts as Record<string, string>);
  pdfMake.vfs = vfs;
  return pdfMake;
}

// Per-brand PDF look, mirroring the public share page (SharedRecipePage). Each
// brand supplies its own logo and accent colour on its brand record — nothing is
// hardcoded per brand, so a newly created brand themes correctly straight away.
const NEUTRAL_ACCENT = "#1b35a8";
function brandStyle(brand: string): { accent: string; logo: string | null } {
  const record = cachedBrands().find((b) => b.id === brand);
  // Only a data: URI can be embedded — a runtime fetch of a remote URL is
  // unreliable behind the SPA rewrite / service worker.
  const logo = record?.logo_url?.startsWith("data:") ? record.logo_url : null;
  return { accent: brandAccentHex(brand) ?? NEUTRAL_ACCENT, logo };
}

/** Blend a #hex toward white (amt 0→1) for zebra row fills. */
function tint(hex: string, amt: number): string {
  const h = hex.replace(/^#/, "");
  const n = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const ch = (i: number) => parseInt(n.slice(i, i + 2), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * amt);
  const to2 = (c: number) => c.toString(16).padStart(2, "0");
  return `#${to2(mix(ch(0)))}${to2(mix(ch(2)))}${to2(mix(ch(4)))}`;
}

export async function generateRecipePdf(
  recipe: Recipe,
  ingredients: RecipeIngredientWithMaterial[],
  opts: {
    visibility?: ViewVisibility;
    exporter?: PdfExporter;
    brandLabel?: string;
    /** Each direct sub-recipe with its own ingredients, for the appendix breakdown. */
    subRecipes?: { recipe: Recipe; ingredients: RecipeIngredientWithMaterial[] }[];
  } = {},
) {
  const { visibility, exporter, subRecipes } = opts;
  // Financial fields are dropped here (before generation), not merely hidden in UI —
  // a Viewer / restricted export never contains cost data in the file.
  const showCost = visibility ? visibility.totalCost : true;
  const showUnitCost = visibility ? visibility.unitCosts : true;
  const showPrice = visibility ? visibility.sellingPrice : true;

  // Brand comes from the stored recipe.brand — never from on-screen text. A caller
  // (e.g. the public share page, which can't read the brands table) may pass the
  // resolved label directly.
  const brandLabel = opts.brandLabel ?? resolveBrandLabel(recipe.brand);
  const stamp = istStamp();

  // Branding: brand accent + logo (matches the public share page), plus the
  // confidential footer line (drops "Financial data hidden" for authorised exports).
  const { accent, logo: logoDataUri } = brandStyle(recipe.brand);
  const footerText = showCost
    ? "Confidential · Shared via Food Metrics"
    : "Confidential · Financial data hidden · Shared via Food Metrics";

  const headRow = ["#", "Ingredient", "Qty", "Unit"];
  if (showUnitCost) headRow.push("Unit Cost");
  if (showCost) headRow.push("Total");

  // Build an ingredients-table body (header + rows) for any ingredient list — reused
  // for the main recipe and for each sub-recipe appendix table.
  const buildBody = (list: RecipeIngredientWithMaterial[]): TableCell[][] => {
    const rows: TableCell[][] = [
      headRow.map((h) => ({ text: h, color: "#ffffff", bold: true, fontSize: 9 })),
    ];
    list.forEach((ing, idx) => {
      const isSub = ing.component_type === "recipe";
      const m = ing.material;
      const name = isSub
        ? `${ing.subRecipe?.recipe_name ?? "Sub-recipe"}  ·  sub-recipe`
        : m?.ingredient_name ?? "—";
      const cost =
        ing.calculated_cost != null
          ? round2(ing.calculated_cost)
          : !isSub && m && m.cost_per_base_unit !== null && canConvert(ing.unit_used, m.base_unit)
            ? calculateIngredientCost(m.cost_per_base_unit, ing.quantity_used, ing.unit_used, m.base_unit)
            : null;
      const row: TableCell[] = [
        { text: String(idx + 1), color: accent, bold: true },
        { text: name },
        { text: qtyStr(ing.quantity_used), alignment: "right" },
        { text: formatUnit(ing.unit_used), color: "#6b7280" },
      ];
      if (showUnitCost) row.push({ text: isSub ? "—" : formatINR(m?.cost_per_base_unit ?? null), alignment: "right" });
      if (showCost) row.push({ text: formatINR(cost), alignment: "right" });
      rows.push(row);
    });
    return rows;
  };

  const ingredientTable = (list: RecipeIngredientWithMaterial[]): Content => ({
    table: { headerRows: 1, widths: tableWidths(headRow.length), body: buildBody(list) },
    layout: {
      fillColor: (rowIndex: number) => (rowIndex === 0 ? accent : rowIndex % 2 === 0 ? tint(accent, 0.93) : null),
      hLineWidth: (i: number, node: { table: { body: unknown[] } }) =>
        i === 0 || i === 1 || i === node.table.body.length ? 0.8 : 0.4,
      hLineColor: () => "#e5e7eb",
      vLineWidth: () => 0,
      paddingTop: () => 5,
      paddingBottom: () => 5,
      paddingLeft: () => 7,
      paddingRight: () => 7,
    },
  });

  // Appendix: each direct sub-recipe's own ingredients (a chef can see what's inside
  // "Pizza Dough", "Pomodoro Sauce", …). Only shown when the caller supplies them.
  const subBlocks: Content[] = (subRecipes ?? [])
    .filter((sr) => sr.ingredients.length > 0)
    .flatMap((sr) => {
      const meta: string[] = [];
      if (sr.recipe.yield_quantity) meta.push(`Batch ${qtyStr(sr.recipe.yield_quantity)} ${sr.recipe.yield_unit ?? ""}`.trim());
      if (showCost && sr.recipe.total_cost != null) meta.push(`Batch cost ${formatINR(sr.recipe.total_cost)}`);
      return [
        { text: sr.recipe.recipe_name, bold: true, fontSize: 11, color: accent, margin: [0, 12, 0, 2] },
        ...(meta.length ? [{ text: meta.join("  ·  "), fontSize: 8, color: "#64748b", margin: [0, 0, 0, 4] }] : []),
        ingredientTable(sr.ingredients),
      ] as Content[];
    });

  const total = recipe.total_cost ?? 0;
  const perPortion = recipe.cost_per_portion ?? 0;
  const packaging = recipe.packaging_cost ?? 0;
  const fullPerPortion = round2(perPortion + packaging);
  // The app never suggests a price — profit/margin appear only when a chef has saved
  // a menu price, and are derived from that actual price (not a target food-cost %).
  const menuPrice = recipe.selling_price != null && recipe.selling_price > 0 ? recipe.selling_price : 0;
  const priced = menuPrice > 0;
  const grossProfit = priced ? round2(menuPrice - fullPerPortion) : 0;
  const grossMargin = priced ? round2((grossProfit / menuPrice) * 100) : 0;
  const actualFc = priced ? round2((fullPerPortion / menuPrice) * 100) : 0;
  const actualFcNoPkg = priced ? round2((perPortion / menuPrice) * 100) : 0;

  const summary: [string, string][] = [];
  // Total dish weight is not financial — always shown when known.
  if (recipe.total_weight_g != null && recipe.total_weight_g > 0) {
    summary.push(["Total Dish Weight", formatWeight(recipe.total_weight_g)]);
  }
  if (showCost) {
    summary.push(["Total Recipe Cost", formatINR(total)]);
    summary.push(["Cost Per Portion", formatINR(perPortion)]);
    if (packaging > 0) {
      summary.push(["Packaging / Portion", formatINR(packaging)]);
      summary.push(["Full Cost / Portion", formatINR(fullPerPortion)]);
    }
  }
  if (showPrice && !recipe.is_prep) {
    if (priced) {
      summary.push(["Menu Price", formatINR(menuPrice)]);
      summary.push(["Food Cost % (with packaging)", `${actualFc}%`]);
      summary.push(["Food Cost % (without packaging)", `${actualFcNoPkg}%`]);
      summary.push(["Gross Profit", formatINR(grossProfit)]);
      summary.push(["Gross Margin", `${grossMargin}%`]);
    } else {
      summary.push(["Menu Price", "—"]);
    }
  }

  const subtitle = [recipe.category, recipe.is_prep ? "In-House Prep" : null, recipe.size_label ?? null]
    .filter(Boolean)
    .join("  ·  ");
  // Only embeddable data URIs render synchronously in pdfmake — uploads always are.
  const hasPhoto = !!recipe.image_url && recipe.image_url.startsWith("data:");
  const method = (recipe.method ?? []).filter((s) => s.trim());

  // A4 page width (pt) — the logo band is placed with absolutePosition in content,
  // so it needs the page width the background() callback otherwise supplies.
  const PAGE_W = 595.28;
  // Logo band (chip + logo + brand label), centered in the top brand-colour strip.
  // This lives in `content`, NOT `background`: pdfmake's browser build does not
  // preload images referenced only from background()/header()/footer(), and an
  // unresolved image reference there silently drops the whole background block —
  // so the logo (and even the white chip) never rendered. Content images are always
  // preloaded, and absolutePosition still lets us paint into the top strip. It only
  // renders on page 1 because content flows from the first page.
  const logoBand: Content[] = logoDataUri
    ? (() => {
        const chipW = 158, chipH = 54, chipX = (PAGE_W - chipW) / 2, chipY = 20;
        return [
          { canvas: [{ type: "rect", x: chipX, y: chipY, w: chipW, h: chipH, r: 12, color: "#ffffff" }], absolutePosition: { x: 0, y: 0 } },
          // Center the logo on the page (the chip is page-centered), so it sits centered in
          // the chip regardless of the logo's aspect ratio. Wrap in a column because an image
          // node's own `width` would override `fit`.
          { columns: [{ width: PAGE_W, image: logoDataUri, fit: [chipW - 30, chipH - 18], alignment: "center" }], absolutePosition: { x: 0, y: chipY + 9 } },
        ] as Content[];
      })()
    : [];

  const doc: TDocumentDefinitions = {
    pageSize: "A4",
    // Content flows INSIDE the white card (see background). The top margin leaves
    // room for the logo badge on page 1; the bottom margin clears the footer band.
    pageMargins: [46, 86, 46, 76],
    background: (currentPage, pageSize): Content => {
      const W = pageSize.width;
      const H = pageSize.height;
      const cardX = 22;
      // Page 1 keeps a taller top band for the logo badge; continuation pages use a
      // thin band so the white card fills the page — no big empty red header on p2+.
      const cardTop = currentPage === 1 ? 74 : 30;
      const cardBottom = 52;
      const bg: Content[] = [
        {
          canvas: [
            { type: "rect", x: 0, y: 0, w: W, h: H, color: accent }, // full-bleed brand colour
            { type: "rect", x: cardX, y: cardTop, w: W - cardX * 2, h: H - cardTop - cardBottom, r: 12, color: "#ffffff" }, // white card
            { type: "rect", x: cardX + 16, y: cardTop, w: W - cardX * 2 - 32, h: 4, color: accent }, // accent bar at card top
          ],
        },
        { text: footerText, absolutePosition: { x: 0, y: H - 38 }, width: W, alignment: "center", color: "#ffffff", fontSize: 8 } as Content,
      ];
      // Audit line: who downloaded this file. Guarded by the id so it appears only for
      // authenticated downloads (the public share page has no id), but shows the display
      // name rather than the raw UUID.
      if (exporter?.id) {
        bg.push({ text: `Downloaded by: ${exporter.name}`, absolutePosition: { x: 0, y: H - 26 }, width: W, alignment: "center", color: "#ffffff", fontSize: 7 } as Content);
      }
      return bg;
    },
    content: [
      // Logo band first so it lands on page 1 (absolutePosition keeps it out of flow).
      ...logoBand,
      {
        columns: [
          { width: "*", stack: [{ text: "Food Metrics", style: "brandMark" }, { text: "Food Metrics", style: "org" }] },
          {
            width: "auto",
            table: { body: [[{ text: brandLabel.toUpperCase(), color: "#ffffff", bold: true, fontSize: 9 }]] },
            layout: { defaultBorder: false, fillColor: () => accent, paddingLeft: () => 8, paddingRight: () => 8, paddingTop: () => 3, paddingBottom: () => 3 },
          },
        ],
      },
      { canvas: [{ type: "line" as const, x1: 0, y1: 0, x2: 503, y2: 0, lineWidth: 1, lineColor: "#e5e7eb" }], margin: [0, 8, 0, 12] as [number, number, number, number] },
      // Title + subtitle, with the dish photo as a thumbnail alongside when present.
      // The photo is a base64 data URI (recipe upload), so pdfmake embeds it inline
      // from content with no dict entry or fetch. External URLs are skipped.
      hasPhoto
        ? ({
            columns: [
              { width: "*", stack: [{ text: recipe.recipe_name, style: "title" }, { text: subtitle, style: "subtitle" }] },
              { width: "auto", image: recipe.image_url as string, fit: [88, 88], margin: [8, 0, 0, 0] },
            ],
          } as Content)
        : { stack: [{ text: recipe.recipe_name, style: "title" }, { text: subtitle, style: "subtitle" }] },
      ...(method.length
        ? [{ text: "Preparation", style: "section" }, { ol: method, style: "body" }]
        : recipe.description
          ? [{ text: "Preparation", style: "section" }, { text: recipe.description, style: "body" }]
          : []),
      { text: "Ingredients", style: "section" },
      ingredientTable(ingredients),
      ...(summary.length
        ? [
            { text: "Cost Summary", style: "section" },
            {
              table: {
                widths: ["*", "auto"],
                body: summary.map(([k, v]) => [
                  { text: k, color: "#64748b" },
                  { text: v, alignment: "right" as const, bold: true },
                ]),
              },
              layout: "noBorders",
            },
          ]
        : []),
      ...(subBlocks.length
        ? [{ text: "Sub-Recipe Breakdown", style: "section" } as Content, ...subBlocks]
        : []),
    ],
    styles: {
      brandMark: { fontSize: 14, bold: true, color: "#0f172a" },
      org: { fontSize: 9, color: "#64748b" },
      title: { fontSize: 18, bold: true, margin: [0, 4, 0, 2] },
      subtitle: { fontSize: 10, color: "#64748b", margin: [0, 0, 0, 10] },
      meta: { fontSize: 9, margin: [0, 0, 0, 6], lineHeight: 1.3, color: "#334155" },
      section: { fontSize: 12, bold: true, color: accent, margin: [0, 14, 0, 6] },
      body: { fontSize: 10, lineHeight: 1.3 },
    },
    defaultStyle: { fontSize: 10 },
  };

  const safeName = recipe.recipe_name.replace(/[^\w]+/g, "_").replace(/^_+|_+$/g, "");
  const filename = `${brandLabel}_${safeName}_${stamp.date.replace(/[\s,]+/g, "")}.pdf`;
  const pdfMake = await loadPdfMake();
  pdfMake.createPdf(doc).download(filename);
}

function tableWidths(cols: number): (string | number)[] {
  // first col narrow, ingredient flexible, rest auto
  const widths: (string | number)[] = [18, "*"];
  for (let i = 2; i < cols; i++) widths.push("auto");
  return widths;
}

export interface ReportRow {
  name: string;
  category: string;
  status: string;
  costPerPortion: number;
  menuPrice: number;
  fcPct: number | null;
}

/** A report-shaped PDF: filter context + a table of recipes (day / brand / recipe
 *  reports). Cost/price columns are dropped for restricted viewers, and the table
 *  header repeats across pages. */
export async function generateReportPdf(opts: {
  title: string;
  brandLabel: string;
  rows: ReportRow[];
  filtersText?: string;
  exporter?: PdfExporter;
  visibility?: ViewVisibility;
}) {
  const { title, brandLabel, rows, filtersText, exporter, visibility } = opts;
  const showCost = visibility ? visibility.totalCost : true;
  const showPrice = visibility ? visibility.sellingPrice : true;
  const stamp = istStamp();
  const roleLabel = exporter ? resolveRoleLabel(exporter.role) : "";

  const headRow = ["#", "Recipe", "Category"];
  if (showCost) headRow.push("Cost / Portion");
  if (showPrice) {
    headRow.push("Menu Price");
    headRow.push("FC %");
  }
  headRow.push("Status");

  const body: string[][] = [headRow];
  rows.forEach((r, idx) => {
    const row = [String(idx + 1), r.name, r.category];
    if (showCost) row.push(formatINR(r.costPerPortion));
    if (showPrice) {
      row.push(r.menuPrice > 0 ? formatINR(r.menuPrice) : "—");
      row.push(r.fcPct != null ? `${r.fcPct}%` : "—");
    }
    row.push(r.status);
    body.push(row);
  });

  const widths: (string | number)[] = [18, "*", "auto"];
  for (let i = 3; i < headRow.length; i++) widths.push("auto");

  const doc: TDocumentDefinitions = {
    pageMargins: [40, 40, 40, 54],
    footer: (currentPage: number, pageCount: number) => ({
      margin: [40, 14, 40, 0] as [number, number, number, number],
      columns: [
        { text: `${brandLabel} · Generated from Food Metrics`, fontSize: 8, color: "#94a3b8" },
        { text: `Page ${currentPage} of ${pageCount}`, alignment: "center" as const, fontSize: 8, color: "#94a3b8" },
        { text: "Confidential", alignment: "right" as const, fontSize: 8, color: "#94a3b8" },
      ],
    }),
    content: [
      {
        columns: [
          [
            { text: "Food Metrics", style: "brandMark" },
            { text: "Food Metrics", style: "org" },
          ],
          { text: brandLabel.toUpperCase(), style: "brandName", alignment: "right" as const },
        ],
      },
      { canvas: [{ type: "line" as const, x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: "#e2e8f0" }], margin: [0, 8, 0, 12] as [number, number, number, number] },
      { text: title, style: "title" },
      {
        style: "meta",
        columns: [
          [
            `Generated: ${stamp.label}`,
            exporter ? `Exported by: ${exporter.name} (${roleLabel})` : "",
          ],
          [
            `Recipes: ${rows.length}`,
            filtersText ? `Filters: ${filtersText}` : "",
          ],
        ],
      },
      {
        table: { headerRows: 1, widths, body },
        layout: "lightHorizontalLines",
      },
    ],
    styles: {
      brandMark: { fontSize: 15, bold: true, color: "#0f172a" },
      org: { fontSize: 9, color: "#64748b" },
      brandName: { fontSize: 13, bold: true, color: "#0f172a" },
      title: { fontSize: 16, bold: true, margin: [0, 0, 0, 8] },
      meta: { fontSize: 9, margin: [0, 0, 0, 10], lineHeight: 1.3, color: "#334155" },
    },
    defaultStyle: { fontSize: 9 },
  };

  const filename = `${brandLabel}_${title.replace(/[^\w]+/g, "_")}_${stamp.date.replace(/[\s,]+/g, "")}.pdf`;
  const pdfMake = await loadPdfMake();
  pdfMake.createPdf(doc).download(filename);
}
