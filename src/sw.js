// Custom service worker (vite-plugin-pwa `injectManifest`).
//
// Why this exists instead of the generated worker: with `generateSW` +
// `navigateFallback`, workbox serves the PRECACHED index.html for every
// navigation (cache-first). After a deploy that meant the previous build's
// shell painted first — old <title>, old boot-splash logo — until the new
// worker activated and force-reloaded the page. That's what made a rebrand
// flash the old name for ~2s.
//
// Here navigations go to the NETWORK first, so the HTML shell is always the
// freshly deployed one, and fall back to the precached index.html when the
// network is unavailable or slow (keeping offline deep-links working).
//
// Written in plain JS on purpose: `tsconfig.app.json` includes `src` with the
// DOM libs (no "WebWorker"), so a .ts worker would fail `tsc -b` and break the
// build. Vite still bundles this file; tsc ignores it (allowJs is off).
/// <reference lib="webworker" />
import { clientsClaim } from "workbox-core";
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";

// Take over immediately, matching the previous `registerType: "autoUpdate"` behaviour.
self.skipWaiting();
clientsClaim();

// Injected at build time by vite-plugin-pwa.
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

const SHELL_URL = "/index.html";
const NETWORK_TIMEOUT_MS = 3000;

/** Precached index.html — the offline answer for any route in this SPA. */
const shellFromPrecache = createHandlerBoundToURL(SHELL_URL);

/**
 * Network-first navigation. Bounded by a timeout so a flaky connection falls
 * back to the cached shell quickly instead of hanging on a dead socket.
 *
 * Nothing is runtime-cached here: every route in this SPA resolves to the same
 * index.html, which precache already holds. Caching per-URL would grow without
 * bound (each unique /share/:token would add an entry) for no benefit.
 */
registerRoute(
  new NavigationRoute(
    async (options) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), NETWORK_TIMEOUT_MS);
      try {
        const fresh = await fetch(options.request, { signal: controller.signal });
        if (fresh && fresh.ok) return fresh;
      } catch {
        // offline, timed out, or server unreachable — fall through
      } finally {
        clearTimeout(timer);
      }
      return shellFromPrecache(options);
    },
    { denylist: [/^\/assets\//] },
  ),
);
