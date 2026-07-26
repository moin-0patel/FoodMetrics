import { isSupabaseConfigured, supabase } from "../supabase/client";
import { hydrateUserFromProfile, syncThemePref } from "../supabase/profile";
import { useSession } from "./session";
import { useTheme, type Theme } from "../theme";

const VALID_THEMES: Theme[] = ["light", "dark"];

async function applyProfile(uid: string) {
  try {
    const user = await hydrateUserFromProfile(uid);
    useSession.getState().setUser(user);
    // Follow the user's saved theme across devices (best-effort).
    const pref = user.theme_pref;
    if (pref && (VALID_THEMES as string[]).includes(pref)) {
      useTheme.getState().setTheme(pref as Theme);
    }
  } catch (err) {
    console.error("Failed to hydrate user profile:", err);
    useSession.getState().setUser(null);
  }
}

/**
 * One-time auth bootstrap. No-op in mock mode. In Supabase mode it hydrates the
 * session on cold load and keeps it in sync via onAuthStateChange (token refresh,
 * sign-in, sign-out, password recovery).
 */
export function initAuth() {
  // Mock mode: nothing to hydrate — the app is ready to route immediately.
  if (!isSupabaseConfigured || !supabase) {
    useSession.getState().setAuthReady(true);
    return;
  }

  // Resolve the initial session BEFORE marking auth ready, and await profile
  // hydration when signed in — so `authReady` never flips with a stale null user
  // (which would flash the login screen for an already-signed-in user).
  supabase.auth.getSession().then(async ({ data }) => {
    if (data.session?.user) await applyProfile(data.session.user.id);
    useSession.getState().setAuthReady(true);
  });

  supabase.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_OUT" || !session?.user) {
      useSession.getState().setUser(null);
      return;
    }
    void applyProfile(session.user.id);
  });

  // Persist theme changes to the signed-in user's profile (best-effort).
  useTheme.subscribe((state, prev) => {
    if (state.theme === prev.theme) return;
    const uid = useSession.getState().user?.id;
    if (uid) syncThemePref(uid, state.theme);
  });
}
