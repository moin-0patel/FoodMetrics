// Generates the whole app icon set from the single vector source
// assets/food-metrics-mark.svg — favicon, PWA icons, Apple touch icon, the
// maskable icon, and the boot-splash lockup.
//
// Vector in, raster out: edit the SVG, re-run, and every size stays in step.
//
// Run: node scripts/gen-app-icon.mjs

import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const SRC = "assets/food-metrics-mark.svg";
const BG = "#04090b"; // tile background, matches the SVG and the dark theme
const MINT = "#25e79f";

if (!fs.existsSync(SRC)) {
  console.error(`Missing ${SRC}`);
  process.exit(1);
}
const svg = fs.readFileSync(SRC);

fs.mkdirSync("public/brand", { recursive: true });

/** Square icon at `size`, rendered straight from the vector. */
const square = (size, out) =>
  sharp(svg, { density: 384 })
    .resize(size, size, { fit: "contain", background: BG })
    .png({ compressionLevel: 9 })
    .toFile(out)
    .then(() => console.log(`  ${out}  ${size}x${size}`));

/**
 * Maskable icon: Android crops to a circle, so the art must sit inside a safe
 * zone (~78% of the canvas) with the tile colour bleeding to the edges.
 */
async function maskable(size, out) {
  const inner = Math.round(size * 0.78);
  const art = await sharp(svg, { density: 384 }).resize(inner, inner).png().toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: BG } })
    .composite([{ input: art, gravity: "centre" }])
    .png({ compressionLevel: 9 })
    .toFile(out);
  console.log(`  ${out}  ${size}x${size} (maskable, 78% safe zone)`);
}

/** Boot-splash lockup: the mark beside the wordmark, on the dark background. */
async function splash(out) {
  const W = 1200;
  const H = 320;
  const markPx = 200;
  const mark = await sharp(svg, { density: 384 }).resize(markPx, markPx).png().toBuffer();

  // Wordmark as text-in-SVG so no font file is needed — the system sans is
  // resolved at render time. "Food" white, "Metrics" mint, matching Logo.tsx.
  // The gap is an explicit dx: a trailing space inside a tspan gets collapsed.
  const word = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
       <text x="0" y="196" font-family="Segoe UI, Helvetica, Arial, sans-serif"
             font-size="128" font-weight="700" letter-spacing="-3">
         <tspan fill="#ffffff">Food</tspan><tspan fill="${MINT}" dx="30">Metrics</tspan>
       </text>
     </svg>`,
  );
  const wordImg = await sharp(word).png().toBuffer();

  await sharp({ create: { width: W, height: H, channels: 4, background: BG } })
    .composite([
      { input: mark, left: 150, top: Math.round((H - markPx) / 2) },
      { input: wordImg, left: 150 + markPx + 44, top: 0 },
    ])
    .png({ compressionLevel: 9 })
    .toFile(out);
  console.log(`  ${out}  ${W}x${H} (boot splash lockup)`);
}

console.log("Generating icons from", SRC);
await square(512, "public/app-icon.png");
await square(32, "public/favicon.png");
await square(180, "public/apple-touch-icon-180x180.png");
await square(64, "public/pwa-64x64.png");
await square(192, "public/pwa-192x192.png");
await square(512, "public/pwa-512x512.png");
await maskable(512, "public/maskable-icon-512x512.png");
await square(512, "public/brand/mark.png");
await splash("public/brand/logo.png");

// Served directly too — crisp at any size, and what the in-app Logo uses.
fs.copyFileSync(SRC, path.join("public", "app-icon.svg"));
console.log("  public/app-icon.svg  (vector, used by the in-app Logo)");
console.log("\nDone. Background", BG);
