// Generates the demo dish artwork in public/demo/.
//
// The project ships no photography, and pulling stock photos in would mean
// shipping someone else's licensed images. So each demo dish gets a small,
// deliberately-designed SVG "plate": a warm background, a rim, and a few shapes
// suggesting the dish. They look intentional on the recipe cards and are a few
// hundred bytes each.
//
// Run: node scripts/gen-demo-art.mjs
// Replacing them with real photos is a drop-in: same filename, or point the CSV's
// Image column at whatever you upload.

import fs from "node:fs";
import path from "node:path";

const OUT = "public/demo";

/** Deterministic plate. `garnish` draws the food on top of the plate circle. */
function plate({ bg, rim, plate: plateFill, garnish }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 400" width="640" height="400" role="img">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${bg[0]}"/><stop offset="1" stop-color="${bg[1]}"/>
    </linearGradient>
    <radialGradient id="sheen" cx="0.32" cy="0.28" r="0.7">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.16"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="640" height="400" fill="url(#bg)"/>
  <rect width="640" height="400" fill="url(#sheen)"/>
  <circle cx="320" cy="205" r="150" fill="${rim}" opacity="0.55"/>
  <circle cx="320" cy="200" r="132" fill="${plateFill}"/>
  <circle cx="320" cy="200" r="132" fill="none" stroke="#000" stroke-opacity="0.07" stroke-width="2"/>
  ${garnish}
</svg>
`;
}

/** Scatter n small circles deterministically inside the plate. */
function scatter(n, r, fill, seed = 1) {
  let out = "";
  let s = seed;
  const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  for (let i = 0; i < n; i++) {
    const a = rnd() * Math.PI * 2;
    const d = 30 + rnd() * 75;
    const x = 320 + Math.cos(a) * d;
    const y = 200 + Math.sin(a) * d * 0.85;
    out += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" fill="${fill}"/>`;
  }
  return out;
}

const DISHES = {
  // name: colours + garnish
  "margherita-pizza": plate({
    bg: ["#2b1a10", "#120a06"],
    rim: "#e8c9a0",
    plate: "#f2ddb8",
    garnish:
      `<circle cx="320" cy="200" r="118" fill="#d8552f"/>` +
      `<circle cx="320" cy="200" r="112" fill="#e86b3d"/>` +
      scatter(9, 15, "#f6f1e4", 7) +
      scatter(11, 7, "#3f7d34", 21),
  }),
  "alfredo-pasta": plate({
    bg: ["#2a2117", "#120d08"],
    rim: "#e4d2ae",
    plate: "#f4e9d2",
    garnish:
      `<circle cx="320" cy="205" r="104" fill="#efe0bd"/>` +
      scatter(15, 16, "#f7eed8", 5) +
      scatter(10, 6, "#5c8f3a", 33),
  }),
  "chicken-burger": plate({
    bg: ["#2c1d10", "#140c06"],
    rim: "#e3c79c",
    plate: "#f5e6c8",
    garnish:
      // Bun crown, fillings, bun heel — stacked rather than scattered.
      `<path d="M212 186 q108 -76 216 0 z" fill="#d99b4f"/>` +
      `<rect x="212" y="186" width="216" height="18" rx="6" fill="#79a63f"/>` +
      `<rect x="212" y="200" width="216" height="26" rx="6" fill="#b3652c"/>` +
      `<rect x="212" y="222" width="216" height="16" rx="6" fill="#e8b62f"/>` +
      `<path d="M212 238 q108 40 216 0 z" fill="#c98a3f"/>` +
      scatter(7, 4, "#f6ecd2", 19),
  }),
  "garlic-bread": plate({
    bg: ["#2a2013", "#120c07"],
    rim: "#e0cba2",
    plate: "#f3e6c9",
    garnish:
      `<g>${[0, 1].map((i) => `<rect x="${196 + i * 130}" y="140" width="112" height="128" rx="42" fill="#e2b871"/><rect x="${208 + i * 130}" y="152" width="88" height="104" rx="34" fill="#f2dfa8"/>`).join("")}</g>` +
      scatter(9, 5, "#5c8f3a", 27),
  }),
  "lava-cake": plate({
    bg: ["#1e1410", "#0c0705"],
    rim: "#d9c3a3",
    plate: "#f1e4cf",
    garnish:
      `<circle cx="320" cy="202" r="92" fill="#4a2a1c"/>` +
      `<circle cx="320" cy="202" r="80" fill="#35190f"/>` +
      `<circle cx="320" cy="202" r="26" fill="#6b3a1e"/>` +
      `<path d="M300 226 q22 34 44 0" stroke="#5a2f18" stroke-width="12" fill="none" stroke-linecap="round"/>` +
      scatter(6, 6, "#c0472f", 37),
  }),
};

fs.mkdirSync(OUT, { recursive: true });
let n = 0;
for (const [name, svg] of Object.entries(DISHES)) {
  fs.writeFileSync(path.join(OUT, `${name}.svg`), svg);
  n++;
}
console.log(`Wrote ${n} demo dish images to ${OUT}/`);
