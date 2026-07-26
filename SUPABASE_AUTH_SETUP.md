# Food Metrics — Supabase Auth Setup (required for deletion + OTP)

The app code for user deletion, signup email OTP, and OTP-based password recovery
is in place. These flows depend on **Supabase Dashboard / CLI configuration** that
cannot be done from the app code. Complete the steps below once per project.

---

## 1. Deploy the delete-user Edge Function (fixes "user deletion fails")

User deletion needs the `service_role` key, which must never ship to the browser.
It runs server-side in the `delete-user` Edge Function (`supabase/functions/delete-user`).
**If it isn't deployed, deletion fails** — the app now shows exactly that message.

```bash
# From the repo root, with the Supabase CLI logged in and linked:
supabase link --project-ref <your-project-ref>
supabase functions deploy delete-user
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are injected
into deployed functions automatically — you do **not** set them manually and they
never touch the frontend. Verify: Dashboard → Edge Functions → `delete-user` is
listed and "Deployed".

The function re-checks authorization server-side: caller must be an active
admin/super_admin, only a super_admin may delete a super_admin, you can't delete
yourself, and it never drops below one active admin / one active super_admin.

## 2. Turn on email confirmation

Dashboard → Authentication → Providers → Email:
- **Enable "Confirm email"** (so new signups must verify).

## 3. Email templates — expose the OTP token

Dashboard → Authentication → Email Templates. Add the 6-digit code (`{{ .Token }}`)
to both templates so users can enter a **code** (the app's OTP flow), not just a link.

**Confirm signup** (used by signup OTP):
```
Your Food Metrics verification code is: {{ .Token }}
This code expires shortly. If you didn't sign up, ignore this email.
```

**Reset Password** (used by recovery OTP):
```
Your Food Metrics password reset code is: {{ .Token }}
This code expires shortly. If you didn't request it, ignore this email.
```

(Keeping the `{{ .ConfirmationURL }}` link in the template as well is fine — the
reset page also accepts a clicked link as a fallback.)

## 4. Site URL + Redirect URLs (fixes the broken reset link fallback)

Dashboard → Authentication → URL Configuration:
- **Site URL**: your production origin, e.g. `https://app.yourdomain.com`
- **Redirect URLs** — add every origin you use:
  - `https://app.yourdomain.com/reset-password`
  - `https://app.yourdomain.com/login`
  - `http://localhost:3005/reset-password` (local dev — `npm run dev`)
  - `http://localhost:3005/login`
  - `http://localhost:4173/reset-password` (local — `npm run preview`)
  - `http://localhost:4173/login`

> **Ports come from [vite.config.ts](vite.config.ts), not Vite's defaults**: this
> project sets `server.port = 3005` and `preview.port = 4173`. Do not use 5173.
> Both use `strictPort: false`, so if a port is taken Vite picks the next free one
> and prints the real URL on startup — add that origin too if it differs.

## 5. Custom SMTP (needed for reliable OTP delivery)

The built-in Supabase email sender is rate-limited (a few messages/hour) and not
for production. Dashboard → Authentication → SMTP Settings → enable custom SMTP
(e.g. Resend, SendGrid, Postmark, SES). Store credentials in the dashboard, never
in code.

## 6. OTP expiry / rate limits

Dashboard → Authentication → (Email OTP expiry & rate limits). The default expiry
applies; the app treats Supabase as the source of truth for validity and shows
"code expired / incorrect / too many attempts" messages accordingly.

---

## Environment variables (frontend)

`.env.local` (already used by the app):
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
# optional: VITE_DATA_BACKEND=supabase
```
The `service_role` key is **not** a frontend variable — it lives only in the
deployed Edge Function's injected env.

## Rollback

- Deletion: `supabase functions delete delete-user` (reverts to "not available").
- OTP flows: revert `SignUpPage.tsx`, `ForgotPasswordPage.tsx`, `ResetPasswordPage.tsx`
  and remove `{{ .Token }}` from templates to return to link-only reset.
