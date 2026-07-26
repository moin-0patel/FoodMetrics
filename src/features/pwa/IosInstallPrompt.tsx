import { useEffect, useState } from "react";
import { Share, Plus, X } from "lucide-react";

// iOS Safari has no automatic install prompt (no beforeinstallprompt), so we
// show a gentle popup telling iPhone/iPad users how to "Add to Home Screen".
// Only for iOS Safari, not-yet-installed, not previously dismissed.

const DISMISS_KEY = "cc_ios_install_dismissed";

/** True on iOS Safari specifically (other iOS browsers can't Add to Home Screen). */
export function isIosSafari(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const iOS =
    /iPad|iPhone|iPod/.test(ua) ||
    // iPadOS 13+ reports as desktop Mac; detect it via touch support.
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (!iOS) return false;
  // Must be Safari — exclude Chrome (CriOS), Firefox (FxiOS), Edge (EdgiOS), Opera (OPiOS).
  return /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA/.test(ua);
}

/** True when running as an installed/standalone PWA (already added — no prompt). */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    (window.navigator as { standalone?: boolean }).standalone === true ||
    window.matchMedia?.("(display-mode: standalone)").matches === true
  );
}

export function IosInstallPrompt() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(DISMISS_KEY) === "1") return;
      if (!isIosSafari() || isStandalone()) return;
      // Don't nag read-only share-link guests to install the whole app.
      if (window.location.pathname.startsWith("/share")) return;
      const t = setTimeout(() => setShow(true), 1200);
      return () => clearTimeout(t);
    } catch {
      /* localStorage/matchMedia unavailable — just don't show */
    }
  }, []);

  if (!show) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
    setShow(false);
  };

  return (
    <div
      role="dialog"
      aria-label="Install Food Metrics"
      className="fixed inset-x-0 bottom-0 z-[120] flex justify-center px-3 pb-[calc(env(safe-area-inset-bottom)+12px)]"
    >
      <div className="relative w-full max-w-sm rounded-2xl border bg-background p-4 shadow-2xl">
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="absolute right-2 top-2 rounded-md p-1 text-muted-foreground hover:bg-muted"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-3">
          <img src="/app-icon.svg" alt="" className="h-11 w-11 shrink-0 rounded-xl" />
          <div className="min-w-0 pr-6">
            <p className="font-semibold leading-tight">Install Food Metrics</p>
            <p className="text-xs text-muted-foreground">
              Add it to your Home Screen for a full-screen app.
            </p>
          </div>
        </div>

        <p className="mt-3 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm">
          <span>Tap</span>
          <Share className="h-4 w-4 text-sky-500" aria-hidden />
          <span className="font-medium">Share</span>
          <span>then</span>
          <span className="inline-flex items-center gap-1 font-medium">
            <Plus className="h-4 w-4" aria-hidden /> Add to Home Screen
          </span>
        </p>

        {/* Pointer toward the Safari toolbar / share button below. */}
        <span
          aria-hidden
          className="absolute -bottom-2 left-1/2 h-4 w-4 -translate-x-1/2 rotate-45 border-b border-r bg-background"
        />
      </div>
    </div>
  );
}
