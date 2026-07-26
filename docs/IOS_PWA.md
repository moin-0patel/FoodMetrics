# Food Metrics on iPhone / iPad (Add to Home Screen)

iOS does not allow sideloading apps the way Android does — there is no `.apk`/`.ipa` file to install
without the App Store. The supported, free way to get Food Metrics as a full-screen app on iPhone/iPad is
to **install it from Safari as a PWA** ("Add to Home Screen"). No Mac and no Apple Developer account
required.

## Install (on the iPhone/iPad)

1. Open **Safari** (it must be Safari — Chrome, Firefox, or in-app browsers can't add to the home
   screen on iOS).
2. Go to the Food Metrics URL: `https://recepie-costing.onrender.com`
3. Tap the **Share** button (the square with an up-arrow, in the toolbar).
4. Scroll down and tap **Add to Home Screen**.
5. Confirm the name (**Food Metrics**) and tap **Add**.

A Food Metrics icon appears on the home screen.

## What you get

- Launches **full-screen** (no Safari address bar or tabs) — looks and feels like a native app.
- Opens on the dark Food Metrics splash → straight to **login/dashboard** (the marketing landing page is
  skipped in the installed app).
- Renders the **mobile layout** everywhere (stacked cards, no horizontal scrolling), on both iPhone
  and iPad.
- Home-screen icon = the Food Metrics mark; label = "Food Metrics".

## Updates

Updates are automatic, just like the Android PWA. When a new version is deployed, the app fetches it in
the background — **close and reopen the app once** and you're on the latest version. You never
reinstall.

## Notes / limitations

- **Login is remembered** across launches (same as the browser/Android app).
- On the very first frame of a cold launch, iOS may show a brief blank/white system screen before the
  web loads; the dark Food Metrics splash then paints. Fully theming that first system frame requires
  per-device launch images and is an optional future enhancement.
- If "Add to Home Screen" is missing from the Share sheet, make sure you're in **Safari** and on the
  actual site (not a redirect/preview).
