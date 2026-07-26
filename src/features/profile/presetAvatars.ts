// Built-in "preset" avatars: flat-design character illustrations rendered as
// inline SVG data URIs. Stored in the same avatar_url field (no schema change),
// they render straight into the <img> Avatar and work offline (no external host).

interface CharOpts {
  bg: string;
  skin: string;
  hair: "short" | "buzz" | "curly" | "bun" | "long" | "bald";
  hairColor: string;
  shirt: string;
  beard?: boolean;
  glasses?: boolean;
}

function buildCharacter(o: CharOpts): string {
  const { bg, skin, hair, hairColor, shirt, beard, glasses } = o;
  const p: string[] = [];
  p.push(`<defs><clipPath id="c"><circle cx="64" cy="64" r="64"/></clipPath></defs>`);
  p.push(`<g clip-path="url(#c)">`);
  p.push(`<rect width="128" height="128" fill="${bg}"/>`);
  p.push(`<ellipse cx="64" cy="136" rx="47" ry="40" fill="${shirt}"/>`);
  p.push(`<rect x="57" y="82" width="14" height="16" fill="${skin}"/>`);
  // Long hair sits behind the head so it frames the face and falls to the shoulders.
  if (hair === "long")
    p.push(`<path d="M32,74 Q28,34 64,30 Q100,34 96,74 Q96,100 84,106 L84,64 Q80,52 64,52 Q48,52 44,64 L44,106 Q32,100 32,74 Z" fill="${hairColor}"/>`);
  p.push(`<circle cx="39" cy="66" r="5" fill="${skin}"/><circle cx="89" cy="66" r="5" fill="${skin}"/>`);
  p.push(`<ellipse cx="64" cy="62" rx="25" ry="27" fill="${skin}"/>`);
  if (beard)
    p.push(`<path d="M41,60 Q41,90 64,90 Q87,90 87,60 Q80,74 64,74 Q48,74 41,60 Z" fill="${hairColor}"/>`);
  if (hair === "short" || hair === "long")
    p.push(`<path d="M39,60 Q37,33 64,33 Q91,33 89,60 Q80,46 64,46 Q48,46 39,60 Z" fill="${hairColor}"/>`);
  else if (hair === "buzz")
    p.push(`<path d="M41,54 Q41,36 64,36 Q87,36 87,54 Q80,48 64,48 Q48,48 41,54 Z" fill="${hairColor}"/>`);
  else if (hair === "curly")
    p.push(`<g fill="${hairColor}"><circle cx="46" cy="46" r="9"/><circle cx="57" cy="39" r="10"/><circle cx="71" cy="39" r="10"/><circle cx="82" cy="46" r="9"/><circle cx="52" cy="50" r="8"/><circle cx="76" cy="50" r="8"/></g>`);
  else if (hair === "bun")
    p.push(`<circle cx="64" cy="30" r="7" fill="${hairColor}"/><path d="M39,58 Q37,34 64,34 Q91,34 89,58 Q80,46 64,46 Q48,46 39,58 Z" fill="${hairColor}"/>`);
  // mouth (drawn over any beard)
  p.push(`<path d="M56,72 Q64,79 72,72" fill="none" stroke="#8a4b3a" stroke-width="2.6" stroke-linecap="round"/>`);
  // eyes + brows
  p.push(`<circle cx="55" cy="60" r="2.8" fill="#33312e"/><circle cx="73" cy="60" r="2.8" fill="#33312e"/>`);
  p.push(`<path d="M50,53 Q55,50 60,53" stroke="${hairColor}" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M68,53 Q73,50 78,53" stroke="${hairColor}" stroke-width="2" fill="none" stroke-linecap="round"/>`);
  if (glasses)
    p.push(`<g fill="none" stroke="#2b2b2b" stroke-width="2"><circle cx="55" cy="60" r="7"/><circle cx="73" cy="60" r="7"/><path d="M62,60 h4"/><path d="M48,58 l-6,-2"/><path d="M80,58 l6,-2"/></g>`);
  p.push(`</g>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">${p.join("")}</svg>`;
}

const PRESETS: CharOpts[] = [
  { bg: "#4b9cd3", skin: "#f2c79b", hair: "short", hairColor: "#2b2b2b", shirt: "#c0483a" },
  { bg: "#e05a47", skin: "#e0a878", hair: "curly", hairColor: "#3a2a1a", shirt: "#2f8f7f" },
  { bg: "#2fb3a3", skin: "#c8895b", hair: "buzz", hairColor: "#1f1f1f", shirt: "#3f6fb0" },
  { bg: "#5b8def", skin: "#f7d6b0", hair: "bun", hairColor: "#6b4423", shirt: "#d68a2e" },
  { bg: "#f0a733", skin: "#a4663a", hair: "short", hairColor: "#111111", shirt: "#3a3f4a" },
  { bg: "#7b6bd6", skin: "#f2c79b", hair: "long", hairColor: "#4a2f1b", shirt: "#c0483a" },
  { bg: "#3aa856", skin: "#e0a878", hair: "short", hairColor: "#c98a3a", shirt: "#3f6fb0", glasses: true },
  { bg: "#d95d8a", skin: "#f7d6b0", hair: "long", hairColor: "#2b2b2b", shirt: "#5a5f6a" },
  { bg: "#e2703a", skin: "#7a4a2b", hair: "curly", hairColor: "#111111", shirt: "#2f8f7f" },
  { bg: "#5cc0c0", skin: "#f2c79b", hair: "short", hairColor: "#6b4423", shirt: "#7a5aa0", beard: true },
  { bg: "#8a94a6", skin: "#c8895b", hair: "bald", hairColor: "#2b2b2b", shirt: "#c0483a", beard: true },
  { bg: "#4b9cd3", skin: "#e0a878", hair: "bun", hairColor: "#2b2b2b", shirt: "#3a3f4a" },
  { bg: "#e8c547", skin: "#a4663a", hair: "buzz", hairColor: "#111111", shirt: "#3f6fb0" },
  { bg: "#5b8def", skin: "#f7d6b0", hair: "curly", hairColor: "#c98a3a", shirt: "#c0483a" },
  { bg: "#3aa856", skin: "#f2c79b", hair: "short", hairColor: "#2b2b2b", shirt: "#d68a2e", glasses: true },
  { bg: "#d95d8a", skin: "#c8895b", hair: "long", hairColor: "#3a2a1a", shirt: "#2f8f7f" },
  { bg: "#7b6bd6", skin: "#7a4a2b", hair: "bald", hairColor: "#111111", shirt: "#5a5f6a" },
  { bg: "#e05a47", skin: "#f7d6b0", hair: "short", hairColor: "#4a2f1b", shirt: "#3f6fb0", beard: true },
  { bg: "#2fb3a3", skin: "#f2c79b", hair: "buzz", hairColor: "#6b4423", shirt: "#c0483a" },
  { bg: "#f0a733", skin: "#e0a878", hair: "long", hairColor: "#2b2b2b", shirt: "#7a5aa0" },
];

export interface PresetAvatar {
  id: string;
  uri: string;
}

/** Precomputed character-avatar data URIs (deterministic — built once at load). */
export const CHARACTER_AVATARS: PresetAvatar[] = PRESETS.map((o, i) => ({
  id: `char-${i + 1}`,
  uri: `data:image/svg+xml,${encodeURIComponent(buildCharacter(o))}`,
}));
