/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Supabase project URL. When absent, the app runs on the mock auth/data layer. */
  readonly VITE_SUPABASE_URL?: string;
  /** Supabase anonymous (public) key. */
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
