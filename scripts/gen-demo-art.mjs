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

function packArt({ bg, boxColor, content }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 400" width="640" height="400" role="img">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${bg[0]}"/><stop offset="1" stop-color="${bg[1]}"/>
    </linearGradient>
    <radialGradient id="sheen" cx="0.5" cy="0.3" r="0.7">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.12"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="640" height="400" fill="url(#bg)"/>
  <rect width="640" height="400" fill="url(#sheen)"/>
  <circle cx="320" cy="200" r="145" fill="${boxColor}" opacity="0.15"/>
  <g transform="translate(0, 5)">
    ${content}
  </g>
</svg>
`;
}

const PACKAGING = {
  "pizza-box": packArt({
    bg: ["#2d1e15", "#140c07"],
    boxColor: "#d9a76a",
    content:
      // Kraft pizza box isometric angle
      `<polygon points="180,160 320,100 460,160 320,220" fill="#c49353"/>` +
      `<polygon points="180,160 320,220 320,270 180,210" fill="#9e7239"/>` +
      `<polygon points="320,220 460,160 460,210 320,270" fill="#b38245"/>` +
      `<polygon points="200,165 320,113 440,165 320,217" fill="#d4a363"/>` +
      `<circle cx="320" cy="165" r="28" fill="#a03422" opacity="0.8"/>` +
      `<text x="320" y="171" font-family="sans-serif" font-size="16" font-weight="bold" fill="#ffffff" text-anchor="middle">HOT</text>`,
  }),
  "burger-box": packArt({
    bg: ["#2a1f18", "#120b07"],
    boxColor: "#e6b87d",
    content:
      // Clamshell burger box
      `<rect x="220" y="140" width="200" height="130" rx="16" fill="#ba8c54"/>` +
      `<path d="M220 180 Q320 120 420 180 L420 250 A16 16 0 0 1 404 266 L236 266 A16 16 0 0 1 220 250 Z" fill="#d6a467"/>` +
      `<line x1="220" y1="180" x2="420" y2="180" stroke="#8c6436" stroke-width="4"/>` +
      `<rect x="270" y="195" width="100" height="40" rx="8" fill="#ffffff" opacity="0.25"/>`,
  }),
  "paper-bag": packArt({
    bg: ["#241b14", "#0f0b07"],
    boxColor: "#c99a5b",
    content:
      // Kraft paper bag with handles
      `<polygon points="240,120 400,120 420,280 220,280" fill="#ba894a"/>` +
      `<polygon points="240,120 400,120 390,140 250,140" fill="#9c6e33"/>` +
      `<path d="M280 120 C280 80, 310 80, 310 120" stroke="#6e4c20" stroke-width="8" fill="none"/>` +
      `<path d="M330 120 C330 80, 360 80, 360 120" stroke="#6e4c20" stroke-width="8" fill="none"/>`,
  }),
  "sauce-cup": packArt({
    bg: ["#1c1a24", "#09080e"],
    boxColor: "#8b9bb4",
    content:
      // Small condiment tub
      `<ellipse cx="320" cy="220" rx="80" ry="25" fill="#4a5568"/>` +
      `<path d="M240 180 L255 220 A80 25 0 0 0 385 220 L400 180 Z" fill="#718096"/>` +
      `<ellipse cx="320" cy="180" rx="80" ry="25" fill="#e2e8f0"/>` +
      `<ellipse cx="320" cy="180" rx="72" ry="21" fill="#cbd5e1"/>`,
  }),
  "dessert-box": packArt({
    bg: ["#2c1a24", "#12080e"],
    boxColor: "#e899b7",
    content:
      // Cake box with transparent window
      `<rect x="210" y="130" width="220" height="140" rx="14" fill="#d4799b"/>` +
      `<rect x="230" y="150" width="180" height="100" rx="10" fill="#fce7f3"/>` +
      `<rect x="250" y="165" width="140" height="70" rx="8" fill="#f472b6" opacity="0.35"/>` +
      `<circle cx="320" cy="200" r="20" fill="#9d174d" opacity="0.6"/>`,
  }),
  "cup": packArt({
    bg: ["#18232c", "#070c10"],
    boxColor: "#60a5fa",
    content:
      // Takeaway cup with lid & straw
      `<polygon points="255,140 385,140 365,280 275,280" fill="#3b82f6"/>` +
      `<rect x="245" y="125" width="150" height="22" rx="6" fill="#f8fafc"/>` +
      `<line x1="330" y1="60" x2="310" y2="125" stroke="#ef4444" stroke-width="10" stroke-linecap="round"/>`,
  }),
  "lid": packArt({
    bg: ["#162028", "#070b0e"],
    boxColor: "#94a3b8",
    content:
      // Round plastic lid
      `<circle cx="320" cy="200" r="100" fill="#cbd5e1" opacity="0.8"/>` +
      `<circle cx="320" cy="200" r="85" fill="#f1f5f9" opacity="0.9"/>` +
      `<circle cx="320" cy="200" r="45" fill="#94a3b8" opacity="0.5"/>` +
      `<rect x="310" y="195" width="20" height="10" rx="3" fill="#334155"/>`,
  }),
  "sticker": packArt({
    bg: ["#291a18", "#120907"],
    boxColor: "#f87171",
    content:
      // Branding seal sticker
      `<circle cx="320" cy="200" r="95" fill="#ef4444"/>` +
      `<circle cx="320" cy="200" r="82" fill="#none" stroke="#ffffff" stroke-width="4" stroke-dasharray="8 6"/>` +
      `<text x="320" y="195" font-family="sans-serif" font-size="20" font-weight="bold" fill="#ffffff" text-anchor="middle">URBAN KITCHEN</text>` +
      `<text x="320" y="218" font-family="sans-serif" font-size="12" font-weight="600" fill="#fef2f2" text-anchor="middle">SEALED FOR SAFETY</text>`,
  }),
  "fork": packArt({
    bg: ["#1e251b", "#090d07"],
    boxColor: "#84cc16",
    content:
      // Eco wooden/cutlery fork
      `<path d="M305 110 L305 180 Q305 200 315 210 L315 280 L325 280 L325 210 Q335 200 335 180 L335 110 L328 110 L328 170 L323 170 L323 110 L317 110 L317 170 L312 170 L312 110 Z" fill="#d97706"/>`,
  }),
  "spoon": packArt({
    bg: ["#232018", "#0d0b07"],
    boxColor: "#f59e0b",
    content:
      // Cutlery spoon
      `<ellipse cx="320" cy="140" rx="28" ry="40" fill="#d97706"/>` +
      `<rect x="315" y="175" width="10" height="105" rx="5" fill="#b45309"/>`,
  }),
};

fs.mkdirSync(OUT, { recursive: true });
let n = 0;
for (const [name, svg] of Object.entries(DISHES)) {
  fs.writeFileSync(path.join(OUT, `${name}.svg`), svg);
  n++;
}
for (const [name, svg] of Object.entries(PACKAGING)) {
  fs.writeFileSync(path.join(OUT, `${name}.svg`), svg);
  n++;
}
console.log(`Wrote ${n} demo images (dishes & packaging) to ${OUT}/`);

