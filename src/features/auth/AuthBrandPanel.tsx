import { Calculator, Percent, Trash2, BarChart3 } from "lucide-react";
import { Logo } from "@/components/brand/Logo";

// The premium left-hand brand panel shown on the auth pages (desktop only).
// Brand-blue gradient, Food Metrics logo, product statement and a small set of
// capability chips (no fabricated metrics, no customer names).

const CAPABILITIES = [
  { icon: Calculator, label: "Recipe Costing" },
  { icon: Percent, label: "Yield Management" },
  { icon: Trash2, label: "Wastage Tracking" },
  { icon: BarChart3, label: "Brand & Outlet Reports" },
];

export function AuthBrandPanel() {
  return (
    <div className="relative hidden overflow-hidden bg-[#152c8f] lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
      {/* Depth: soft tinted glows over the blue base. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-90"
        style={{
          background:
            "radial-gradient(60% 55% at 15% 10%, rgba(255,255,255,0.16), transparent 60%)," +
            "radial-gradient(45% 45% at 100% 30%, rgba(237,28,36,0.28), transparent 60%)," +
            "radial-gradient(45% 45% at 85% 100%, rgba(245,193,7,0.22), transparent 60%)",
        }}
      />
      {/* Fine grid texture (kitchen/analytics feel), very subtle. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      <div className="relative">
        <Logo size="lg" invert withSubtitle />
      </div>

      <div className="relative max-w-md">
        <h1 className="text-4xl font-semibold leading-tight tracking-tight text-white xl:text-5xl">
          Precision Recipes.
          <br />
          Smarter Costs.
          <br />
          Stronger Kitchens.
        </h1>
        <p className="mt-5 text-base leading-relaxed text-white/70">
          The recipe costing, yield and wastage platform — one place to standardise
          recipes and control food cost across every brand and outlet.
        </p>

        <ul className="mt-8 grid grid-cols-2 gap-3">
          {CAPABILITIES.map(({ icon: Icon, label }) => (
            <li
              key={label}
              className="flex items-center gap-2.5 rounded-lg bg-white/10 px-3 py-2.5 text-sm font-medium text-white ring-1 ring-inset ring-white/15"
            >
              <Icon className="h-4 w-4 shrink-0 text-white/80" />
              {label}
            </li>
          ))}
        </ul>
      </div>

      <div className="relative flex items-center gap-3 text-sm font-medium text-white/70">
        <span>Multi-brand</span>
        <span className="text-white/30">•</span>
        <span>Multi-outlet</span>
        <span className="text-white/30">•</span>
        <span>Real-time costing</span>
      </div>
    </div>
  );
}
