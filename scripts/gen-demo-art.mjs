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
  "penne-arrabbiata": plate({
    bg: ["#2a1512", "#120807"],
    rim: "#d9b48a",
    plate: "#f0e2cc",
    garnish:
      `<circle cx="320" cy="205" r="104" fill="#c0402a"/>` +
      scatter(14, 17, "#e9c98f", 5) +
      scatter(9, 6, "#37701f", 33),
  }),
  "butter-chicken": plate({
    bg: ["#2c1c0d", "#140c05"],
    rim: "#e3c79c",
    plate: "#f5e6c8",
    garnish:
      `<circle cx="320" cy="205" r="106" fill="#c8622a"/>` +
      `<circle cx="320" cy="205" r="96" fill="#d8763a"/>` +
      scatter(8, 20, "#b9541f", 11) +
      `<path d="M250 150 q70 -22 140 0" stroke="#fff" stroke-opacity="0.5" stroke-width="7" fill="none" stroke-linecap="round"/>` +
      scatter(7, 5, "#2f6b25", 41),
  }),
  "dal-makhani": plate({
    bg: ["#241a10", "#100a06"],
    rim: "#d8bd93",
    plate: "#efe0c2",
    garnish:
      `<circle cx="320" cy="205" r="104" fill="#5a3520"/>` +
      `<circle cx="320" cy="205" r="94" fill="#6d4026"/>` +
      `<path d="M258 175 q62 -26 124 0" stroke="#fff" stroke-opacity="0.55" stroke-width="8" fill="none" stroke-linecap="round"/>` +
      scatter(6, 5, "#8fbf5a", 17),
  }),
  "paneer-tikka": plate({
    bg: ["#2a1b12", "#120a07"],
    rim: "#dfc59b",
    plate: "#f3e5c9",
    garnish:
      scatter(0, 0, "#000") +
      `<g>${[0, 1, 2].map((i) => `<rect x="${232 + i * 62}" y="140" width="46" height="46" rx="8" fill="#e8a13c"/><rect x="${232 + i * 62}" y="196" width="46" height="46" rx="8" fill="#d4842a"/>`).join("")}</g>` +
      scatter(8, 6, "#3f7d34", 29),
  }),
  "caesar-salad": plate({
    bg: ["#1b2416", "#0a0f08"],
    rim: "#cfd8bc",
    plate: "#eef3e2",
    garnish:
      scatter(16, 20, "#4e8f3a", 3) +
      scatter(12, 11, "#6fb04d", 13) +
      scatter(9, 8, "#e8d9a8", 23),
  }),
  "chocolate-tart": plate({
    bg: ["#1e1410", "#0c0705"],
    rim: "#d9c3a3",
    plate: "#f1e4cf",
    garnish:
      `<circle cx="320" cy="202" r="98" fill="#4a2a1c"/>` +
      `<circle cx="320" cy="202" r="86" fill="#35190f"/>` +
      `<circle cx="320" cy="202" r="30" fill="#e8dcc6" opacity="0.85"/>` +
      scatter(7, 6, "#c0472f", 37),
  }),
  "masala-chai": plate({
    bg: ["#241a12", "#100a07"],
    rim: "#dcc4a0",
    plate: "#f2e5cd",
    garnish:
      `<circle cx="320" cy="202" r="92" fill="#b98a56"/>` +
      `<circle cx="320" cy="202" r="80" fill="#caa070"/>` +
      `<path d="M268 168 q52 -20 104 0" stroke="#fff" stroke-opacity="0.45" stroke-width="9" fill="none" stroke-linecap="round"/>`,
  }),
};

fs.mkdirSync(OUT, { recursive: true });
let n = 0;
for (const [name, svg] of Object.entries(DISHES)) {
  fs.writeFileSync(path.join(OUT, `${name}.svg`), svg);
  n++;
}
console.log(`Wrote ${n} demo dish images to ${OUT}/`);
