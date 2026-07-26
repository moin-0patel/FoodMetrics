import { supabase } from "./client";
import { profileToUser, type ProfileRow } from "./types";
import type { User } from "@/lib/data/types";

const TABLE = "user_profiles";

/**
 * Load the app `User` for an authenticated Supabase uid from user_profiles.
 * Throws if the profile is missing or the account is deactivated.
 * Only call when `isSupabaseConfigured` is true (supabase is non-null).
 */
export async function hydrateUserFromProfile(uid: string): Promise<User> {
  if (!supabase) throw new Error("Supabase not configured");
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("id", uid)
    .single<ProfileRow>();
  if (error || !data) throw new Error("Profile not found. Contact an admin.");
  if (data.status === "inactive") {
    await supabase.auth.signOut();
    throw new Error("Your account has been deactivated. Contact admin.");
  }
  return profileToUser(data);
}

/**
 * Run the sign-in routine: stamps last_login, mirrors email-verification from
 * auth.users, promotes verified owner emails to Admin, and self-heals a missing
 * profile row. Returns the resulting profile. Call once after a successful sign-in
 * (and after sign-up when a session is returned).
 */
export async function onSignIn(): Promise<User> {
  if (!supabase) throw new Error("Supabase not configured");
  const { data, error } = await supabase.rpc("on_sign_in").single<ProfileRow>();
  if (error || !data) throw new Error(error?.message ?? "Could not load your profile");
  return profileToUser(data);
}

/** Send a Supabase password-reset email. */
export async function sendPasswordReset(email: string): Promise<void> {
  if (!supabase) throw new Error("Supabase not configured");
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  if (error) throw new Error(error.message);
}

/**
 * Patch the current user's own profile row (display fields only). Goes through the
 * update_own_profile RPC so role/status/approval/scope can never be self-edited —
 * there is no broad self-update RLS policy.
 */
export async function updateOwnProfile(
  _uid: string,
  patch: Partial<Pick<ProfileRow, "name" | "phone" | "avatar_url" | "theme_pref">>,
): Promise<User> {
  if (!supabase) throw new Error("Supabase not configured");
  const { data, error } = await supabase
    .rpc("update_own_profile", {
      p_name: patch.name ?? null,
      p_phone: patch.phone ?? null,
      p_avatar_url: patch.avatar_url ?? null,
      p_theme_pref: patch.theme_pref ?? null,
    })
    .single<ProfileRow>();
  if (error || !data) throw new Error(error?.message ?? "Profile update failed");
  return profileToUser(data);
}

/** Fire-and-forget: persist the chosen theme to the user's profile. */
export function syncThemePref(_uid: string, theme: string): void {
  if (!supabase) return;
  supabase
    .rpc("update_own_profile", { p_theme_pref: theme })
    .then(
      ({ error }) => error && console.error("Theme sync failed:", error),
      (err) => console.error("Theme sync failed:", err),
    );
}
