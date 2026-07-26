import { Calculator, Percent, Trash2, BarChart3 } from "lucide-react";
import { Logo } from "@/components/brand/Logo";

// The left-hand brand panel on the auth pages (desktop only): a photograph under
// a dark scrim, the logo, the product statement and four capability cards.
//
// The photo is one of the demo images (Wikimedia Commons, CC — see
// public/demo/photos/CREDITS.md). Swap PANEL_PHOTO for your own and the credit
// obligation goes away. If the file is missing the scrim alone still renders, so
// the panel degrades to a plain dark surface rather than breaking.
const PANEL_PHOTO = "/demo/photos/butter-chicken.jpg";

const CAPABILITIES = [
  { icon: Calculator, label: "Recipe Costing" },
  { icon: Percent, label: "Yield Management" },
  { icon: Trash2, label: "Wastage Tracking" },
  { icon: BarChart3, label: "Brand & Outlet Reports" },
];

export function AuthBrandPanel() {
  return (
    <div className="relative hidden overflow-hidden bg-slate-950 lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
      {/* Photograph */}
      <img
        src={PANEL_PHOTO}
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        onError={(e) => (e.currentTarget.style.display = "none")}
      />
      {/* Scrim: heavy enough that the headline and cards stay legible over any
          photo, and dark enough to match the app's dark theme. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-slate-950/95 via-slate-950/88 to-slate-900/80"
      />
      {/* A touch of the brand accent, bottom-left. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-24 -left-24 h-80 w-80 rounded-full bg-primary/20 blur-3xl"
      />

      <div className="relative">
        <Logo size="lg" invert withSubtitle />
      </div>

      <div className="relative max-w-md">
        <h1 className="text-4xl font-semibold leading-tight tracking-tight text-white xl:text-5xl">
          Precision Recipes.
          <br />
          <span className="text-primary">Smarter Costs.</span>
          <br />
          Stronger Kitchens.
        </h1>
        <p className="mt-5 text-base leading-relaxed text-slate-300">
          The recipe costing, yield and wastage platform — one place to standardise
          recipes and control food cost across every brand and outlet.
        </p>

        <ul className="mt-8 grid grid-cols-2 gap-3">
          {CAPABILITIES.map(({ icon: Icon, label }) => (
            <li
              key={label}
              className="flex items-center gap-2.5 rounded-lg bg-white/[0.07] px-3 py-2.5 text-sm font-medium text-white backdrop-blur-sm ring-1 ring-inset ring-white/10"
            >
              <Icon className="h-4 w-4 shrink-0 text-primary" />
              {label}
            </li>
          ))}
        </ul>
      </div>

      <div className="relative flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
        <span>Multi-brand</span>
        <span className="text-primary">•</span>
        <span>Multi-outlet</span>
        <span className="text-primary">•</span>
        <span>Real-time costing</span>
      </div>
    </div>
  );
}
