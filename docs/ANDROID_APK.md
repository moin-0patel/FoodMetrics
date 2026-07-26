# Food Metrics — Android APK (installable app)

Food Metrics is a PWA, so the Android app is a thin **TWA** (Trusted Web Activity): a native shell that
opens the live site **https://recepie-costing.onrender.com** fullscreen. It always shows the latest
deploy and works offline via the service worker — you never rebuild the APK just to ship app changes.

You generate the signed `.apk` on **PWABuilder** (no Android tools to install). One repo file —
`public/.well-known/assetlinks.json` — must carry your signing key's fingerprint so the app opens
**without a browser address bar**.

---

## 1. Generate the APK on PWABuilder

1. Open **https://www.pwabuilder.com** → enter `https://recepie-costing.onrender.com` → **Start**.
2. It analyses the PWA (manifest + icons + service worker are already in place). Click
   **Package For Stores → Android**.
3. Set the options (open **All Settings / Advanced** if needed):
   - **Package ID**: `com.onrender.recepie_costing.twa`  ← must match `assetlinks.json` in this repo.
   - **App name**: `Food Metrics`  ·  **Launcher / short name**: `Food Metrics`.
   - **Signing key**: **Create new**.
   - Leave the rest at defaults (Fallback behavior: Custom Tabs; Display: standalone).
4. **Download**. You get a zip containing:
   - `app-release-signed.apk` — the installable app (**this is what you sideload**).
   - `assetlinks.json` — the Digital Asset Links file to host (step 2).
   - `signing.keystore` (+ a readme with the passwords) — **keep these safe** (see below).

> ⚠️ **Save the keystore + passwords forever** (password manager / secure storage). Every future
> update must be signed with the *same* keystore under `com.onrender.recepie_costing.twa`. Lose it and you
> can't update the installed app — you'd have to ship a new package id and users must reinstall.

---

## 2. Publish Digital Asset Links (removes the URL bar)

This repo already has `public/.well-known/assetlinks.json` with a placeholder fingerprint. Replace
it with the real one:

1. Open the `assetlinks.json` from the PWABuilder zip (or the "SHA-256 fingerprint" it shows).
2. Copy its value into `public/.well-known/assetlinks.json` — set `sha256_cert_fingerprints` to the
   real fingerprint (a colon-separated hex string like `AA:BB:CC:…`). Keep
   `package_name: "com.onrender.recepie_costing.twa"`.
3. Commit + push to `main`. Render auto-deploys.
4. Verify it's live and served as JSON (not the app's HTML):
   ```bash
   curl -sI https://recepie-costing.onrender.com/.well-known/assetlinks.json
   # expect: HTTP/2 200  and  content-type: application/json
   ```

The app installs and runs before this is done — it may just show a thin address bar until the asset
links verify. Relaunch (or reinstall) after the redeploy to get the clean fullscreen app.

---

## 3. Install it on a phone (sideload)

1. Copy `app-release-signed.apk` to the phone (USB, Google Drive, WhatsApp/email to yourself, etc.).
2. Tap the file. Android will ask to allow installing from this source →
   **Settings → "Install unknown apps"** → enable it for the app you're installing from (Files /
   Chrome / Drive) → back → **Install**.
3. Open **Food Metrics** from the app drawer. It launches fullscreen and logs in like the website.

To distribute to the team: share the same `.apk` file; each person repeats step 2.

---

## 4. Updating

- **App content / features** (recipes, UI, fixes): nothing to do — the TWA loads the live site, so
  a normal `main` deploy updates the app instantly.
- **The APK itself** (only for launcher name, icon, package settings, or Android target changes):
  rebuild in PWABuilder using the **same package id and the saved keystore**, **bump the
  versionCode**, download, and reinstall the new `.apk` over the old one.

---

## Notes
- Manifest/icons come from `vite.config.ts` (`VitePWA` manifest) and `pwa-assets.config.ts`
  (icons generated from `public/app-icon.svg`) — already 192 / 512 / 512-maskable, standalone,
  theme `#1b35a8`.
- This is a **sideload** APK. For the **Google Play Store** you'd instead download the `.aab` from
  PWABuilder, enroll in Play App Signing (Play re-signs, so `assetlinks.json` would use Play's
  fingerprint), and publish via the Play Console.
