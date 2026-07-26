// Fetches real demo photography from Wikimedia Commons into public/demo/photos/.
//
// WHY COMMONS: its files are freely reusable — public domain or Creative Commons.
// Most are CC BY-SA, which requires ATTRIBUTION and share-alike. This script
// therefore writes CREDITS.md alongside the images with the author, licence and
// source URL for every file. Keep that file (and credit the authors) if these
// images ship anywhere public.
//
// Stock-photo sites were not used: their images are licensed per-use and bundling
// them into a repo is not permitted.
//
// Run: node scripts/fetch-demo-photos.mjs

import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const OUT = "public/demo/photos";
const UA = "FoodMetrics-demo-fetch/1.0 (local demo data; contact: mspatel05831@gmail.com)";
const WIDTH = 1200;

/** slug → Commons search term. */
const WANTED = {
  "margherita-pizza": "pizza margherita napoletana",
  "penne-arrabbiata": "penne all'arrabbiata pasta",
  "butter-chicken": "butter chicken murgh makhani",
  "dal-makhani": "dal makhani",
  "paneer-tikka": "paneer tikka",
  "caesar-salad": "caesar salad",
  "chocolate-tart": "chocolate tart",
  "masala-chai": "masala chai tea",
  // Landing-page slots. Commons is full of historical archive material, so these
  // terms lean modern — and the greyscale check below rejects vintage B&W anyway.
  "hero-kitchen": "commercial kitchen cooks service restaurant food",
  "pass-service": "chef cooking pan restaurant kitchen",
  "pantry-shelves": "spices market stall colourful",
  "dining-room": "modern restaurant interior tables",
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
    gsrlimit: "8",
    gsrnamespace: "6",
    prop: "imageinfo",
    iiprop: "url|size|extmetadata",
    iiurlwidth: String(WIDTH),
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
    // Landscape-ish, big enough, and a licence we can actually honour.
    .filter((c) => c.url && c.width >= 600 && OK_LICENCE.test(c.licence));
}

async function download(url, dest) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`download HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  // Sanity-check the magic bytes so we never write an HTML error page as ".jpg".
  const isJpeg = buf[0] === 0xff && buf[1] === 0xd8;
  const isPng = buf[0] === 0x89 && buf[1] === 0x50;
  if (!isJpeg && !isPng) throw new Error("not a JPEG/PNG");
  if (buf.length < 8000) throw new Error(`suspiciously small (${buf.length}b)`);

  // Commons is heavy on historical archive material. Reject near-greyscale images
  // (vintage B&W) and portraits — neither suits a modern product page. Compared
  // via per-channel means: on a greyscale image R≈G≈B.
  const meta = await sharp(buf).metadata();
  const { channels } = await sharp(buf).stats();
  if (channels.length >= 3) {
    const [r, g, b] = channels.map((c) => c.mean);
    const spread = Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(r - b));
    if (spread < 7) throw new Error(`looks black & white (channel spread ${spread.toFixed(1)})`);
  }
  const w = meta.width ?? 0;
  const h = meta.height ?? 1;
  if (w / h < 1.05) throw new Error(`not landscape (${w}x${h})`);

  fs.writeFileSync(dest, buf);
  return { bytes: buf.length, ext: isPng ? "png" : "jpg" };
}

fs.mkdirSync(OUT, { recursive: true });
const credits = [];
let ok = 0;
let failed = 0;

for (const [slug, term] of Object.entries(WANTED)) {
  try {
    const candidates = await search(term);
    if (!candidates.length) throw new Error("no acceptably-licensed result");
    let saved = null;
    for (const c of candidates) {
      const tmp = path.join(OUT, `${slug}.jpg`);
      try {
        const info = await download(c.url, tmp);
        saved = { ...c, ...info };
        break;
      } catch {
        // try the next candidate
      }
    }
    if (!saved) throw new Error("every candidate failed to download");
    credits.push({ slug, ...saved });
    ok++;
    console.log(`✓ ${slug.padEnd(18)} ${saved.licence.padEnd(14)} ${saved.artist.slice(0, 28)}`);
  } catch (e) {
    failed++;
    console.log(`✗ ${slug.padEnd(18)} ${e.message}`);
  }
}

const md = `# Demo photo credits

Images in this folder came from **Wikimedia Commons** and are reused under the
licence listed for each one. Most are Creative Commons **BY-SA**, which requires
crediting the author and keeping the same licence on redistribution.

Keep this file with the images. If you publish the app anywhere public, credit
these authors (an "Image credits" page or footer link is the usual way) — or
replace the photos with your own, which removes the obligation entirely.

Fetched by \`scripts/fetch-demo-photos.mjs\`.

| File | Licence | Author | Source |
|------|---------|--------|--------|
${credits
  .map((c) => `| \`${c.slug}.jpg\` | ${c.licence} | ${c.artist} | [${c.title}](${c.descUrl}) |`)
  .join("\n")}
`;
fs.writeFileSync(path.join(OUT, "CREDITS.md"), md);

console.log(`\n${ok} saved, ${failed} failed → ${OUT}/`);
console.log("Attribution written to public/demo/photos/CREDITS.md");
