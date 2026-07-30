// Fetches real demo photography from Wikimedia Commons into public/demo/photos/.
//
// WHY COMMONS: its files are freely reusable — public domain or Creative Commons.
// Most are CC BY-SA, which requires ATTRIBUTION and share-alike. This script
// therefore writes CREDITS.md alongside the images with the author, licence and
// source URL for every file. Keep that file (and credit the authors) if these
// images ship anywhere public — the landing-page footer links to it.
//
// Stock-photo sites were not used: their images are licensed per-use and bundling
// them into a repo is not permitted.
//
// SEARCH IS NOT SEMANTIC. Commons keyword search regularly returns something that
// merely mentions the dish. ALWAYS open the files afterwards and check the subject
// is actually right; retune the term below and re-run if not.
//
// Run: node scripts/fetch-demo-photos.mjs   (from the repo root — OUT is relative)

import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const OUT = "public/demo/photos";
const UA = "FoodMetrics-demo-fetch/1.0 (local demo data; contact: mspatel05831@gmail.com)";
/** Thumbnail width requested from Commons — big enough to crop a square from. */
const SOURCE_WIDTH = 2000;
/** Output geometry per shape. Dishes are square (recipe cards and the gallery are
 *  square); the landing-page slots are wide. Never upscaled past the source. */
const SHAPES = {
  square: { w: 1200, h: 1200, minSource: 800 },
  wide: { w: 1600, h: 900, minSource: 900 },
};

/**
 * slug → { file } for a PINNED Commons file, or { term } to search.
 *
 * Prefer `file`. Search ranking is keyword-based, not semantic, and shifts over
 * time, so an unpinned run can silently swap a verified photo for a wrong one —
 * while writing this, a "garlic bread" search returned a vegetable pizza and a
 * "chicken burger" search returned a sandwich in a branded fast-food wrapper.
 * Every entry below was fetched, opened and checked by eye. Use `term` only to
 * explore; once a file looks right, pin its title here.
 *
 * `shape`: dishes are square (recipe cards and the gallery are square); the
 * landing-page ambience shot is wide.
 */
const WANTED = {
  // The five demo dishes (see demo-data/4_menu-recipes.csv).
  "margherita-pizza": { file: "File:Margherita pizza on plate.jpg", shape: "square" },
  // Penne, not fettuccine — the ingredient list on the same screen says Penne Pasta.
  "alfredo-pasta": { file: "File:Pasta in alfredo sauce.JPG", shape: "square" },
  "chicken-burger": { file: "File:Home made Chicken Burger.jpg", shape: "square" },
  "garlic-bread": { file: "File:Garlic Bread Mozzarella - Oregano Pizzeria 2025-05-17.jpg", shape: "square" },
  "lava-cake": { file: "File:Chocolate Fondant.jpg", shape: "square" },
  // Landing page. Commons has very little usable modern commercial-kitchen or
  // pantry photography — those searches return 1940s archive scans — so the page
  // uses dish photos for its other slots rather than settling for a bad one.
  "dining-room": {
    file: "File:Restaurant room of Amantaka luxury Resort & Hotel in Luang Prabang Laos.jpg",
    shape: "wide",
  },
};

/** Licences we accept. Anything else is skipped rather than guessed at. */
const OK_LICENCE = /^(cc0|cc by|cc by-sa|public domain|pd)/i;

const api = (params) =>
  "https://commons.wikimedia.org/w/api.php?" +
  new URLSearchParams({ format: "json", origin: "*", ...params }).toString();

async function search(term) {
  const url = api({
    action: "query",
    generator: "search",
    gsrsearch: `filetype:bitmap ${term}`,
    gsrlimit: "12",
    gsrnamespace: "6",
    prop: "imageinfo",
    iiprop: "url|size|extmetadata",
    iiurlwidth: String(SOURCE_WIDTH),
  });
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`search HTTP ${res.status}`);
  const json = await res.json();
  const pages = json?.query?.pages ?? {};
  return Object.values(pages)
    .map((p) => {
      const ii = (p.imageinfo ?? [])[0] ?? {};
      const em = ii.extmetadata ?? {};
      const strip = (v) => String(v ?? "").replace(/<[^>]+>/g, "").trim();
      return {
        title: p.title,
        url: ii.thumburl || ii.url,
        width: ii.thumbwidth ?? ii.width ?? 0,
        licence: strip(em.LicenseShortName?.value) || "unknown",
        artist: strip(em.Artist?.value) || "Unknown",
        descUrl: ii.descriptionurl || `https://commons.wikimedia.org/wiki/${encodeURIComponent(p.title ?? "")}`,
      };
    })
    // Big enough, and a licence we can actually honour.
    .filter((c) => c.url && c.width >= 800 && OK_LICENCE.test(c.licence));
}

/** Look up one pinned file by its Commons title. Same shape as a search hit. */
async function byTitle(title) {
  const url = api({
    action: "query",
    titles: title,
    prop: "imageinfo",
    iiprop: "url|size|extmetadata",
    iiurlwidth: String(SOURCE_WIDTH),
  });
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`lookup HTTP ${res.status}`);
  const json = await res.json();
  const page = Object.values(json?.query?.pages ?? {})[0];
  if (!page || page.missing !== undefined) throw new Error(`no such file: ${title}`);
  const ii = (page.imageinfo ?? [])[0] ?? {};
  const em = ii.extmetadata ?? {};
  const strip = (v) => String(v ?? "").replace(/<[^>]+>/g, "").trim();
  const licence = strip(em.LicenseShortName?.value) || "unknown";
  if (!OK_LICENCE.test(licence)) throw new Error(`licence not reusable: ${licence}`);
  return [{
    title: page.title,
    url: ii.thumburl || ii.url,
    width: ii.thumbwidth ?? ii.width ?? 0,
    licence,
    artist: strip(em.Artist?.value) || "Unknown",
    descUrl: ii.descriptionurl || `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title ?? "")}`,
  }];
}

async function download(url, dest, shape) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`download HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  // Sanity-check the magic bytes so we never write an HTML error page as ".jpg".
  const isJpeg = buf[0] === 0xff && buf[1] === 0xd8;
  const isPng = buf[0] === 0x89 && buf[1] === 0x50;
  if (!isJpeg && !isPng) throw new Error("not a JPEG/PNG");
  if (buf.length < 8000) throw new Error(`suspiciously small (${buf.length}b)`);

  // Commons is heavy on historical archive material. Reject near-greyscale images
  // (vintage B&W) — they don't suit a modern product page. Compared via
  // per-channel means: on a greyscale image R≈G≈B.
  const meta = await sharp(buf).metadata();
  const { channels } = await sharp(buf).stats();
  if (channels.length >= 3) {
    const [r, g, b] = channels.map((c) => c.mean);
    const spread = Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(r - b));
    if (spread < 7) throw new Error(`looks black & white (channel spread ${spread.toFixed(1)})`);
  }

  const w = meta.width ?? 0;
  const h = meta.height ?? 1;
  const spec = SHAPES[shape];
  // A square crop comes out of the middle, so the short edge sets the ceiling.
  // A wide slot needs a landscape source — cropping one out of a portrait would
  // lose the top and bottom of whatever the photo is actually of.
  if (shape === "wide" && w / h < 1.2) throw new Error(`not landscape (${w}x${h})`);
  const source = shape === "square" ? Math.min(w, h) : w;
  if (source < spec.minSource) throw new Error(`too small to crop (${w}x${h})`);

  // Centre-crop to the target aspect and re-encode. `fit: cover` + `withoutEnlargement`
  // means we never upscale past what Commons actually gave us.
  const scale = Math.min(1, source / spec.w);
  const out = await sharp(buf)
    .resize({
      width: Math.round(spec.w * scale),
      height: Math.round(spec.h * scale),
      fit: "cover",
      position: "centre",
    })
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();

  fs.writeFileSync(dest, out);
  const final = await sharp(out).metadata();
  return { bytes: out.length, dims: `${final.width}x${final.height}` };
}

fs.mkdirSync(OUT, { recursive: true });
const credits = [];
const missing = [];

for (const [slug, { term, file, shape }] of Object.entries(WANTED)) {
  try {
    const candidates = file ? await byTitle(file) : await search(term);
    if (!candidates.length) throw new Error("no acceptably-licensed result");
    let saved = null;
    const why = [];
    for (const c of candidates) {
      try {
        const info = await download(c.url, path.join(OUT, `${slug}.jpg`), shape);
        saved = { ...c, ...info };
        break;
      } catch (e) {
        why.push(e.message);
      }
    }
    if (!saved) throw new Error(`all ${candidates.length} candidates rejected — ${why.join("; ")}`);
    credits.push({ slug, ...saved });
    console.log(
      `✓ ${slug.padEnd(18)} ${saved.dims.padEnd(10)} ${String(Math.round(saved.bytes / 1024)).padStart(4)} KB  ` +
      `${saved.licence.padEnd(14)} ${saved.artist.slice(0, 26)}`,
    );
  } catch (e) {
    missing.push(slug);
    console.log(`✗ ${slug.padEnd(18)} ${e.message}`);
  }
}

// CREDITS.md is rewritten from scratch, so a slug that failed here would silently
// lose its attribution row while its old image sits on disk. Refuse to pretend the
// run succeeded — attribution is a licence obligation, not a nicety.
const md = `# Demo photo credits

Images in this folder came from **Wikimedia Commons** and are reused under the
licence listed for each one. Most are Creative Commons **BY-SA**, which requires
crediting the author and keeping the same licence on redistribution.

Keep this file with the images. The landing-page footer links here — if you remove
that link, credit the authors somewhere else instead, or replace the photos with
your own, which removes the obligation entirely.

Fetched by \`scripts/fetch-demo-photos.mjs\`. Dish photos are centre-cropped square;
landing-page photos are 16:9.

| File | Licence | Author | Source |
|------|---------|--------|--------|
${credits
  .map((c) => `| \`${c.slug}.jpg\` | ${c.licence} | ${c.artist} | [${c.title}](${c.descUrl}) |`)
  .join("\n")}
`;
fs.writeFileSync(path.join(OUT, "CREDITS.md"), md);

console.log(`\n${credits.length} saved, ${missing.length} failed → ${OUT}/`);
console.log("Attribution written to public/demo/photos/CREDITS.md");
console.log("NOW OPEN THE IMAGES: keyword search is not semantic and regularly returns the wrong subject.");
if (missing.length) {
  console.error(`\nMISSING: ${missing.join(", ")}`);
  console.error("CREDITS.md has no row for these, so any stale file on disk is now uncredited.");
  console.error("Retune the search term in WANTED and re-run, or supply the image by hand.");
  process.exitCode = 1;
}
