import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * True only when BOTH Supabase env vars are present. When false the whole app
 * transparently falls back to the mock/localStorage auth + data layer, so the
 * build ships and runs fine before a Supabase project exists.
 */
export const isSupabaseConfigured = Boolean(url && anonKey);

/**
 * Data backend (materials/recipes/yields/wastage/…). Data now follows auth: when
 * Supabase is configured, the shared Supabase repos are used so the app is truly
 * multi-user. Set VITE_DATA_BACKEND=mock to force the local/localStorage layer
 * (e.g. offline/local dev). Tests have no Supabase env, so they stay on mock.
 */
export const isSupabaseDataBackend =
  isSupabaseConfigured && import.meta.env.VITE_DATA_BACKEND !== "mock";

/**
 * The Supabase client, or `null` in mock mode. Feature code must NOT import this
 * directly — go through `src/lib/auth/session.ts` and `src/lib/supabase/profile.ts`
 * so the mock fallback stays centralized.
 */
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url!, anonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // Required so the password-reset / email-verification redirect tokens
        // in the URL hash are consumed on load.
        detectSessionInUrl: true,
      },
    })
  : null;
