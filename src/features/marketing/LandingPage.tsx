import { Link } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  Boxes,
  ChefHat,
  Flame,
  Gauge,
  LineChart,
  Package,
  Percent,
  ShieldCheck,
  Sprout,
  Trash2,
  Utensils,
} from "lucide-react";
import { usePageMeta } from "@/lib/usePageMeta";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PublicHeader } from "./PublicHeader";
import { PublicFooter } from "./PublicFooter";
import { PhotoSlot } from "./PhotoSlot";

// Public marketing page.
//
// One deliberate departure from the reference design: NO PRICING TIERS. There is
// no billing, subscription or payment anywhere in this app, so "$200 / $499 per
// month" would be an invented commercial offer. The three-card band describes the
// real ACCESS LEVELS (the app's RBAC) instead.
//
// Photography comes from Wikimedia Commons under CC / public-domain licences —
// see public/demo/photos/CREDITS.md, which lists the author and licence for each
// file. Most are CC BY-SA, so those authors must be credited if this page ships
// publicly. Swap in your own photos and that obligation goes away.

const PILLARS = [
  {
    icon: LineChart,
    kicker: "Live margin",
    title: "Live Margin Tracker",
    body: "Food cost per dish and per menu section, recalculated the moment an ingredient price moves. No overnight batch, no stale spreadsheet.",
  },
  {
    icon: Sprout,
    kicker: "Zero leakage",
    title: "Zero Leakage Systems",
    body: "Yield and wastage recorded against real quantities, so a dish is costed on the usable portion — not the purchase weight.",
  },
];

const GUESSWORK = [
  {
    icon: Boxes,
    title: "One ingredient master",
    body: "Purchase price, unit and category in one place, shared across every brand and outlet you run.",
  },
  {
    icon: ChefHat,
    title: "Preps cost like recipes",
    body: "Sauces, doughs and bases are costed once and roll up into every dish that uses them, at any depth.",
  },
  {
    icon: ShieldCheck,
    title: "Numbers you can audit",
    body: "Every price change and recost is logged with who changed it and when, so a figure can always be traced.",
  },
];

/** Real access levels from the app's role model — not commercial tiers. */
const ACCESS_LEVELS = [
  {
    name: "Read Only",
    role: "Viewer / Chef",
    summary: "See the recipes they're assigned, with costs hidden or shown per grant.",
    points: ["Assigned recipes only", "Costs hidden by default", "Shareable read-only links", "No edit rights"],
    featured: false,
  },
  {
    name: "Kitchen",
    role: "Editor / Head Chef",
    summary: "Build and cost the catalog day to day.",
    points: [
      "Create & edit recipes and preps",
      "Manage ingredient pricing",
      "Record yield & wastage",
      "Submit recipes for approval",
    ],
    featured: true,
  },
  {
    name: "Command",
    role: "Admin / Super Admin",
    summary: "Full control of the platform, its people and its structure.",
    points: [
      "Approvals & master costing",
      "Brands, outlets & packaging",
      "Users, roles & permissions",
      "Bulk import and exports",
    ],
    featured: false,
  },
];

export function LandingPage() {
  usePageMeta({
    title: "Food Metrics — Recipe Costing & Operations",
    description:
      "Food Metrics is the recipe costing, yield and wastage platform. Standardise recipes and control food cost across every brand and outlet.",
  });

  return (
    <div className="min-h-[100dvh] bg-background">
      <PublicHeader />

      <main>
        {/* ── Hero ───────────────────────────────────────────────────────── */}
        <section id="overview" className="relative isolate overflow-hidden">
          <PhotoSlot
            className="absolute inset-0 -z-10"
            src="/demo/photos/margherita-pizza.jpg"
            alt=""
            icon={Flame}
            caption="Hero shot — the line during service"
          />
          {/* Scrim so the headline holds up over any photo dropped in later. */}
          <div
            aria-hidden
            className="absolute inset-0 -z-10 bg-gradient-to-t from-slate-950 via-slate-950/85 to-slate-950/60"
          />

          <div className="mx-auto max-w-[1728px] px-4 py-24 sm:px-6 lg:py-36">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">
              Recipe costing &amp; kitchen operations
            </p>
            <h1 className="mt-5 max-w-4xl text-5xl font-extrabold uppercase leading-[0.95] tracking-tight text-white sm:text-6xl lg:text-8xl">
              Precision is
              <br />
              the <span className="text-primary">ingredient</span>
            </h1>
            <p className="mt-7 max-w-xl text-lg leading-relaxed text-slate-300">
              Track food cost, standardise recipes and control yield in real time. Turn a drawer of
              spreadsheets into one costing engine every station can trust.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="h-12 rounded-full px-7 text-base font-semibold">
                <Link to="/login">
                  Sign In
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-12 rounded-full border-white/25 bg-white/5 px-7 text-base font-semibold text-white hover:bg-white/10 hover:text-white"
              >
                <Link to="/signup">Request Access</Link>
              </Button>
            </div>
            <p className="mt-4 text-xs text-slate-400">
              Access is granted by an administrator — there is no public sign-up.
            </p>
          </div>
        </section>

        {/* ── Command the line: bento grid ───────────────────────────────── */}
        <section id="features" className="border-t bg-background">
          <div className="mx-auto max-w-[1728px] px-4 py-20 sm:px-6 sm:py-28">
            <h2 className="text-4xl font-extrabold uppercase tracking-tight text-foreground sm:text-5xl">
              Command the line.
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
              High-precision tools consolidated into a single operating layer for the heart of the
              production suite. Manage margins with clinical certainty.
            </p>

            <div className="mt-12 grid gap-4 lg:grid-cols-3">
              {/* Wide card with a photo band */}
              <article className="overflow-hidden rounded-2xl border bg-card lg:col-span-2">
                <PhotoSlot
                  className="h-52 w-full sm:h-64"
                  src="/demo/photos/butter-chicken.jpg"
                  icon={Gauge}
                  caption="Dashboard on the pass"
                />
                <div className="p-6">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
                    {PILLARS[0].kicker}
                  </p>
                  <h3 className="mt-2 text-2xl font-bold tracking-tight text-foreground">
                    {PILLARS[0].title}
                  </h3>
                  <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
                    {PILLARS[0].body}
                  </p>
                </div>
              </article>

              {/* Metric card */}
              <article className="flex flex-col justify-between rounded-2xl border bg-card p-6">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
                    {PILLARS[1].kicker}
                  </p>
                  <h3 className="mt-2 text-2xl font-bold tracking-tight text-foreground">
                    {PILLARS[1].title}
                  </h3>
                </div>
                <div className="mt-8">
                  <Percent className="h-9 w-9 text-primary" />
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    {PILLARS[1].body}
                  </p>
                </div>
              </article>

              {/* Solid accent card */}
              <article className="flex flex-col justify-between rounded-2xl bg-primary p-6 text-primary-foreground">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] opacity-70">
                    Procurement
                  </p>
                  <h3 className="mt-2 text-3xl font-extrabold uppercase leading-none tracking-tight">
                    Smart
                    <br />
                    Procurement
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed opacity-80">
                    Every purchase-price movement is logged with its old and new value, so you can
                    see exactly which ingredients are pushing cost up.
                  </p>
                </div>
                <Link
                  to="/login"
                  aria-label="Sign in to Food Metrics"
                  className="mt-8 inline-flex h-11 w-11 items-center justify-center rounded-full bg-primary-foreground/10 ring-1 ring-inset ring-primary-foreground/20 transition-transform hover:scale-105"
                >
                  <ArrowUpRight className="h-5 w-5" />
                </Link>
              </article>

              {/* Pantry card */}
              <article className="overflow-hidden rounded-2xl border bg-card lg:col-span-2">
                <div className="grid h-full sm:grid-cols-2">
                  <div className="p-6">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
                      Inventory
                    </p>
                    <h3 className="mt-2 text-2xl font-bold tracking-tight text-foreground">
                      The Intelligent Pantry
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      One ingredient master with packaging, yield and price history attached — so a
                      dish&apos;s true cost is never a guess.
                    </p>
                    <ul className="mt-4 space-y-1.5">
                      {[Package, Utensils, Trash2].map((Icon, i) => (
                        <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Icon className="h-3.5 w-3.5 shrink-0 text-primary" />
                          {["Packaging costs per dish", "Prep sub-recipes", "Wastage per outlet"][i]}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <PhotoSlot className="min-h-[180px]" src="/demo/photos/pantry-shelves.jpg" icon={Package} caption="Pantry / walk-in" />
                </div>
              </article>
            </div>
          </div>
        </section>

        {/* ── Eliminate guesswork ────────────────────────────────────────── */}
        <section id="how-it-works" className="border-t bg-card">
          <div className="mx-auto max-w-[1728px] px-4 py-20 sm:px-6 sm:py-28">
            <div className="grid items-center gap-12 lg:grid-cols-2">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">
                  One source of truth
                </p>
                <h2 className="mt-4 text-4xl font-extrabold uppercase tracking-tight text-foreground sm:text-5xl">
                  Eliminate
                  <br />
                  guesswork.
                </h2>
                <p className="mt-5 max-w-lg text-base leading-relaxed text-muted-foreground">
                  Every figure traces back to a recorded price, a measured yield and a named person.
                  From the costing desk to the pass, everyone reads the same number.
                </p>

                <ul className="mt-8 space-y-5">
                  {GUESSWORK.map(({ icon: Icon, title, body }) => (
                    <li key={title} className="flex gap-4">
                      <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary ring-1 ring-inset ring-primary/20">
                        <Icon className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="font-semibold text-foreground">{title}</p>
                        <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
                      </div>
                    </li>
                  ))}
                </ul>

                <Button asChild variant="outline" className="mt-9 rounded-full px-6">
                  <a href="#access">See access levels</a>
                </Button>
              </div>

              <PhotoSlot
                className="aspect-[4/3] w-full rounded-2xl"
                src="/demo/photos/dining-room.jpg"
                icon={Utensils}
                caption="Dining room / plated dish"
              />
            </div>
          </div>
        </section>

        {/* ── Access levels (design's tier band, without invented pricing) ── */}
        <section id="access" className="border-t bg-background">
          <div className="mx-auto max-w-[1728px] px-4 py-20 sm:px-6 sm:py-28">
            <h2 className="text-4xl font-extrabold uppercase tracking-tight text-foreground sm:text-5xl">
              Choose your access.
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
              Three levels of control, enforced server-side by role. An administrator assigns the
              level — every screen and every figure respects it.
            </p>

            <div className="mt-12 grid gap-5 lg:grid-cols-3">
              {ACCESS_LEVELS.map((t) => (
                <article
                  key={t.name}
                  className={cn(
                    "flex flex-col rounded-2xl border p-6",
                    t.featured
                      ? "border-primary/50 bg-primary/[0.06] ring-1 ring-inset ring-primary/20"
                      : "bg-card",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Level
                    </p>
                    {t.featured && (
                      <span className="rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary-foreground">
                        Most used
                      </span>
                    )}
                  </div>

                  <h3 className="mt-3 text-2xl font-extrabold uppercase tracking-tight text-foreground">
                    {t.name}
                  </h3>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-primary">
                    {t.role}
                  </p>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{t.summary}</p>

                  <ul className="mt-5 flex-1 space-y-2">
                    {t.points.map((p) => (
                      <li key={p} className="flex items-start gap-2 text-sm text-foreground/85">
                        <span
                          aria-hidden
                          className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
                        />
                        {p}
                      </li>
                    ))}
                  </ul>

                  <Button
                    asChild
                    variant={t.featured ? "accent" : "outline"}
                    className="mt-7 w-full rounded-full"
                  >
                    <Link to="/signup">Request this level</Link>
                  </Button>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ── Closing band ───────────────────────────────────────────────── */}
        <section className="bg-primary text-primary-foreground">
          <div className="mx-auto max-w-3xl px-4 py-24 text-center sm:px-6">
            <h2 className="text-5xl font-extrabold uppercase leading-none tracking-tight sm:text-7xl">
              Stop the leak.
            </h2>
            <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed opacity-80">
              Bring recipes, ingredient prices, yield and wastage into one costing engine — and find
              the margin that&apos;s quietly walking out of the kitchen.
            </p>
            <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
              <Button
                asChild
                size="lg"
                className="h-12 rounded-full bg-slate-950 px-8 text-base font-semibold text-white hover:bg-slate-900"
              >
                <Link to="/login">Sign In</Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-12 rounded-full border-current/30 bg-transparent px-8 text-base font-semibold hover:bg-primary-foreground/10"
              >
                <Link to="/signup">Request Access</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
