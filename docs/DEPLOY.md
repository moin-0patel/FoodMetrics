# Deploy Guide — Food Metrics

End-to-end: from an empty Supabase project to a live URL on Render. Budget ~30 minutes the
first time. Steps 1–3 (Supabase) must be done **before** step 4, because Vite bakes the
Supabase keys into the bundle at build time.

Architecture: a Vite + React SPA served as static files from Render's CDN, talking directly
to Supabase (auth, Postgres with RLS, one Edge Function). There is no backend of ours to run.

---

## 1. Supabase project + schema

1. [supabase.com](https://supabase.com) → **New project**. Pick a region near your kitchens
   and save the database password somewhere safe.
2. **SQL Editor → New query** → paste the entire contents of
   [`db/migrations/SETUP_SUPABASE_CLEAN.sql`](../db/migrations/SETUP_SUPABASE_CLEAN.sql) → **Run**.

   That one file creates every table, enum, RLS policy, trigger and function, and seeds the
   six built-in roles and their capabilities. It ships **no** sample catalog — you start with
   an empty materials/recipes list, matching `buildSeed()` in `src/lib/data/seed.ts`.

   > Use `SETUP_SUPABASE_CLEAN.sql`, not `RUN_THIS_ON_SUPABASE.sql` — the latter is the same
   > schema *plus* a dummy catalog, useful for a demo instance only. Do **not** run the
   > numbered `0001…` files individually; the aggregate replaces them.

3. **Settings → API** — copy these two, you need them in step 4:

   | Value | Env var |
   |---|---|
   | Project URL | `VITE_SUPABASE_URL` |
   | `anon` `public` key | `VITE_SUPABASE_ANON_KEY` |

   The `service_role` key is **never** a frontend variable. It only exists inside the Edge
   Function, injected automatically.

## 2. Supabase auth configuration

Dashboard → **Authentication**:

- **Providers → Email**: ON. Enable **Confirm email** so new signups must verify.
  Leave **Secure email change** ON (the default) — owner auto-promotion only fires for a
  confirmed address, so this is what stops someone claiming an owner email they don't control.
- **Email Templates** → add the 6-digit code to both templates, or the in-app OTP screens have
  nothing to accept:

  *Confirm signup*
  ```
  Your Food Metrics verification code is: {{ .Token }}
  ```
  *Reset Password*
  ```
  Your Food Metrics password reset code is: {{ .Token }}
  ```
  Keeping `{{ .ConfirmationURL }}` as well is fine — the reset page accepts a clicked link too.
- **SMTP Settings** → configure custom SMTP (Resend, SendGrid, Postmark, SES). Supabase's
  built-in sender is capped at a few emails per hour and will silently throttle real signups.
- **URL Configuration** → you'll fill this in at step 5, once you know the deployed URL.

Full detail and rollback notes: [SUPABASE_AUTH_SETUP.md](../SUPABASE_AUTH_SETUP.md).

## 3. Deploy the `delete-user` Edge Function

User deletion needs the `service_role` key, so it runs server-side. Skip this and the app
shows "deletion unavailable" — everything else works.

```bash
npm i -g supabase          # once
supabase login
supabase link --project-ref <your-project-ref>
supabase functions deploy delete-user
```

Verify: Dashboard → Edge Functions → `delete-user` shows **Deployed**.

## 4. Render

**Create the service from the Blueprint. Never from New → Web Service.**
[`render.yaml`](../render.yaml) is only read by a blueprint-created service. A hand-created
one ignores it, guesses the language from the repo, and produces exactly this:

```
==> Using Go version 1.26.5
==> Running build command 'go build -tags netgo -ldflags '-s -w' -o app'
go: go.mod file not found in current directory or any parent directory
==> Build failed 😭
```

A service's language **cannot be changed after creation** — if you hit this, the service has
to be deleted and recreated, no code change will help.

1. **Connect GitHub properly.** Render → Account Settings → GitHub → install the Render app
   and grant access to `moin-0patel/FoodMetrics`. If a build log ever says
   `It looks like we don't have access to your repo`, this step was skipped: the clone only
   worked because the repo is public, and **auto-deploy on push will not fire**.
2. **Delete any previous broken service** (its Settings → Delete Service) *before* the next
   step. Otherwise it keeps the `foodmetrics` hostname and the new service gets a random
   suffix like `foodmetrics-5pon.onrender.com`.
3. **New → Blueprint** → this repo → branch `main`. Render reads `render.yaml` and offers one
   **static site** named `foodmetrics`.
4. It prompts for `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (declared `sync: false`, so
   no secret is committed). Paste the values from step 1. `VITE_DATA_BACKEND=supabase` is set
   by the blueprint already.
5. **Apply.** The build runs `npm ci --include=dev && npm run build` on Node 22 (pinned by
   [`.node-version`](../.node-version)), then publishes `./dist`. ~2–4 minutes.

Every later push to `main` auto-deploys.

## 5. Post-deploy wiring

1. Note the live URL, e.g. `https://foodmetrics.onrender.com`.
2. Supabase → Authentication → **URL Configuration**:
   - **Site URL**: `https://foodmetrics.onrender.com`
   - **Redirect URLs**: add `https://foodmetrics.onrender.com/login` and
     `…/reset-password`, plus the local-dev origins `http://localhost:3005/login`,
     `http://localhost:3005/reset-password`, `http://localhost:4173/login`,
     `http://localhost:4173/reset-password`.

     Ports 3005 (dev) and 4173 (preview) come from [`vite.config.ts`](../vite.config.ts), not
     Vite's defaults. Don't use 5173.

   Miss this and confirmation/reset emails bounce to the wrong origin.
3. **Create the owner account**: open the live site → Sign up as **`mspatel05831@gmail.com`** →
   confirm via the emailed code. Every signup, including this one, lands as a pending Viewer.

   That address is not a placeholder — it is hardcoded as the owner in
   `0034_promote_owner_super_admin.sql` and in the super-admin cap trigger
   (`0022_super_admin_limit_2.sql`). To use a different owner address, edit both files
   *before* running the schema in step 1.
4. **Promote it**: SQL Editor → run
   [`db/migrations/0034_promote_owner_super_admin.sql`](../db/migrations/0034_promote_owner_super_admin.sql).
   It's idempotent, and it prints a notice if you run it before the signup exists. The
   account becomes an active Super Admin and can then invite and approve everyone else in-app.

   (`_promote.mjs` in the repo root is a throwaway one-off — it targets a hardcoded project
   ref and a `public.profiles` table that isn't this schema. Ignore it.)
5. Sign out, sign back in, and confirm you land on the dashboard with an empty catalog.

## 6. Custom domain (optional)

Render → your static site → **Settings → Custom Domains** → add `app.yourdomain.com`, then
create the CNAME it shows at your DNS provider. TLS is issued automatically. Afterwards,
**go back and update the Supabase Site URL and Redirect URLs** to the new domain, and rebuild
if you changed any `VITE_*` value.

---

## Environment variables

| Variable | Set where | Notes |
|---|---|---|
| `VITE_SUPABASE_URL` | Render dashboard + `.env.local` | Build-time. Changing it requires a **rebuild**, not a restart. |
| `VITE_SUPABASE_ANON_KEY` | Render dashboard + `.env.local` | Build-time. Safe in the browser; RLS is the real guard. |
| `VITE_DATA_BACKEND` | `render.yaml` (`supabase`) | Set to `mock` to force the local localStorage layer. |
| `VITE_DEV_LOGIN_PASSWORD` | `.env.local` only | Mock-mode dev sign-in. Ignored once Supabase vars are set. |

If either Supabase var is missing at build time, the app **silently falls back to the local
mock layer** — the site loads and looks fine, but data lives in each browser's localStorage.
That is the single most common "deployed but nothing saves" cause.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `go: go.mod file not found` | Service was created by hand, not from the blueprint. Delete it, redo step 4. |
| `tsc: not found` / `vite: not found` | Build command lost `--include=dev`. Render sets `NODE_ENV=production`, so a plain `npm ci` skips devDependencies — and `npm run build` is `tsc -b && vite build`. |
| `It looks like we don't have access to your repo` | GitHub app not installed on the repo (step 4.1). Public repos still clone, but pushes won't trigger deploys. |
| Deploy stuck on an old commit | Same as above, or Auto-Deploy is off in Settings → Build & Deploy. |
| Deep links 404 on refresh | The SPA rewrite in `render.yaml` isn't applied — again, a non-blueprint service. |
| Data doesn't persist / every browser sees different data | App fell back to the mock layer: the `VITE_SUPABASE_*` vars were missing **at build time**. Set them and trigger a manual redeploy. |
| Signup emails never arrive | Custom SMTP not configured (step 2), or you've hit Supabase's built-in sender limit. |
| Reset link lands on the wrong origin | Redirect URLs missing in Supabase (step 5.2). |
| "User deletion unavailable" | `delete-user` Edge Function not deployed (step 3). |
| Login works, but everything is empty and read-only | Account is still a pending Viewer — promote the owner (step 5.4). |

## Notes on repo files

- [`server.mjs`](../server.mjs) — a zero-dependency Node static server, used **only** if you
  deploy to a platform that has no static-site product (Railway, Fly, a container). On
  Render's static site it never runs. For a web service: build `npm ci --include=dev && npm
  run build`, start `npm start`, language **Node**.
- [`.github/workflows/keep-alive.yml`](../.github/workflows/keep-alive.yml) — pings the site
  every 10 min so a free **web service** doesn't idle out. A static site is served from the
  CDN and never sleeps, so on this setup the workflow is unnecessary; it also still points at
  an old hostname. Update `SITE_URL` or delete the workflow.
