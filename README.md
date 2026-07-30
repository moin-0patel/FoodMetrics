# Food Metrics — Recipe Costing & Operations

Recipe costing, yield, wastage and food-cost control for multi-brand food operations. Food
Metrics replaces manual spreadsheet costing with real-time cost calculation, an approval
workflow, role-based access, branded PDF/Excel exports, and shareable read-only recipe
pages — across as many brands and outlets as you run.

The app ships with **no sample data**: brands, outlets, raw materials and recipes are all
created in-app or imported (see [`import-templates/`](import-templates/)).

## What it does

- **Recipes & In-House Prep** — build recipes from raw materials and reusable sub-recipes (sauces,
  doughs, pastes); costs roll up automatically. Track **raw weight** (auto from ingredients) and a
  manually-entered **cooked weight** with cooking-loss %.
- **Raw Materials** — ingredient catalogue with purchase pricing, unit conversion, and manageable
  **ingredient categories**. A **price cascade** recomputes every affected recipe and records cost
  history when a price changes.
- **Yield & Wastage** — yield adjustments (trim/prep loss) and outlet-scoped wastage logging.
- **Packaging** — per-recipe packaging items added on top of food cost.
- **Costing & Pricing** — total cost, cost/portion, packaging, food-cost %, gross margin. The app
  never invents a price; margins appear only once a menu price is set.
- **Approvals** — draft → testing → approved workflow; editing an approved recipe reverts it to
  draft.
- **Dashboard** — master costing table across brands with pagination.
- **Reports** — **brand-branded recipe PDF** (accent colour + brand logo) and Excel export.
- **Share links** — public, read-only recipe pages (financials hidden) matching the brand look.
- **Users & RBAC** — six roles plus custom roles, per-user brand/outlet access scopes, and a
  per-user **Data Import** grant. Full **audit log**.
- **PWA** — installable and works offline.

## Tech stack

React 18 · TypeScript · Vite · Tailwind · ShadCN-style UI (Radix) · TanStack Query · React Hook
Form · Zod · Zustand · React Router v6 · Recharts · pdfmake · SheetJS · vite-plugin-pwa ·
**Supabase** (Auth + Postgres + RLS).

## Getting started

```bash
npm install
npm run dev          # http://localhost:3005
```

With no Supabase env vars set, the app runs on the **local mock layer** (in-memory, persisted to
`localStorage`). It starts with an empty catalog and a single Super-Admin owner account. No
password is committed to the repo, so set `VITE_DEV_LOGIN_PASSWORD` in `.env.local` to enable
local sign-in (see [`.env.example`](.env.example)).

## Data backends

Food Metrics has two interchangeable backends selected in `src/lib/supabase/client.ts`:

- **Mock** (default local dev) — repos in `src/lib/data/mock/*` over `localStorage`.
- **Supabase** — real multi-user Auth + Postgres. Enabled automatically when both
  `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set. **Data follows auth**: when Supabase is
  configured the app uses the shared Supabase data layer (set `VITE_DATA_BACKEND=mock` to force the
  local layer even with Supabase auth on).

Every feature is wired through a typed repository interface (`src/lib/data/index.ts`), so UI,
costing, validation and permission code are identical across both backends. The client-side
permission checks map 1:1 to the Postgres RLS policies.

## Supabase setup

1. Create a Supabase project; copy the **Project URL** and **anon public key**.
2. `cp .env.example .env` (or `.env.local`) and fill `VITE_SUPABASE_URL` and
   `VITE_SUPABASE_ANON_KEY`. Also set them in your host/CI env (Vite inlines `VITE_*` at build time).
3. In the Supabase **SQL Editor**, run **`db/migrations/RUN_THIS_ON_SUPABASE.sql`** — one idempotent
   script that creates the whole schema (tables, RLS, roles, RPCs) and is safe to re-run. It also
   folds in every later migration (`00xx_*.sql`), so re-running it applies new columns/functions.
4. Auth → **URL Configuration**: set the Site URL and add a redirect URL for
   `<origin>/reset-password` (dev + prod).
5. Auth → **Providers → Email**: turn **off "Confirm email"** for instant self-service signup (the
   built-in mailer is rate-limited; configure custom SMTP to keep confirmation on).
6. **First Super Admin**: sign up in the app, then either rely on the owner-email auto-promotion in
   `on_sign_in()` or run `update public.user_profiles set role='super_admin' where email='you@…';`
   (new users default to `viewer`). Max 2 active Super Admins.

Individual migration files under `db/migrations/00xx_*.sql` are the history; `RUN_THIS_ON_SUPABASE.sql`
is the canonical one-shot. Brand logos live in `public/brands/*.png` and are embedded (base64) for
the PDF in `src/features/reports/brandLogos.ts` (regenerate via `scripts/gen-brand-logos.mjs`).

## Deployment (Render)

Deployed as a **static site** (`render.yaml`): `npm ci --include=dev && npm run build` → publish
`./dist`, with a SPA rewrite (`/*` → `/index.html`) so deep links refresh correctly. Set
`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the Render dashboard before the first deploy.
Auto-deploys on push to `main`.

Create the service via **New → Blueprint**, never New → Web Service: a hand-created service
ignores `render.yaml`, guesses the runtime, and tries to build this app with `go build`.

**[docs/DEPLOY.md](docs/DEPLOY.md)** is the full end-to-end guide — Supabase schema, auth
config, Edge Function, Render, custom domain, and a troubleshooting table.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Dev server (port 3005) |
| `npm run build` | Type-check + production build (+ PWA) |
| `npm run test` | Unit + integration tests (Vitest) |
| `npm run test:e2e` | Playwright E2E (`npx playwright install` once first) |
| `npm run lint` | ESLint |

## Architecture

```text
src/
  lib/
    costing.ts            # costing formulae (pure, unit-tested)
    units.ts              # unit-conversion engine
    auth/permissions.ts   # role + view-mode capability matrix
    data/
      types.ts            # entity types (mirror the SQL schema)
      mock/               # localStorage repos + price cascade + audit
      supabase/           # Supabase repos (same interface as mock)
      seed.ts             # first-run seed: roles, settings, owner (empty catalog)
      __fixtures__/       # test-only catalog builder (never bundled)
      index.ts            # active repo set (mock vs Supabase)
    supabase/             # client, profile RPCs, profileToUser mapper
    validation/           # Zod schemas
  features/               # auth, raw-materials, recipes, costing, approvals,
                          # dashboard, reports, share, users, roles, brands,
                          # profile, audit, marketing (landing)
  components/ui/          # ShadCN-style primitives
db/migrations/            # SQL schema + RLS; RUN_THIS_ON_SUPABASE.sql (one-shot)
```

## Roles

`super_admin` · `admin` · `editor` · `head_chef` · `chef` · `viewer`, plus **custom roles** a Super
Admin can create with a chosen capability set. Roles and their capabilities live in the `roles` /
`role_capabilities` tables (mirrored in mock), and the app's `can(role, capability)` checks
correspond to the RLS policies enforced server-side.

## Testing

`npm run test` runs the Vitest suite (unit + integration), covering the costing formulae, unit
conversion, the price cascade (raising an ingredient price recomputes dependent recipes and writes
cost history), permissions, and key editor flows.
