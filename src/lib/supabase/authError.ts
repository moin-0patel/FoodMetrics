/**
 * Turn a Supabase auth error into a human-readable message. Supabase returns an
 * empty body on some 5xx responses, which surfaces as a useless "{}" / "" — this
 * maps those (and common cases) to actionable copy. Always `console.error` the
 * raw error alongside calling this.
 */
export function authErrorMessage(
  error: unknown,
  fallback = "Something went wrong. Please try again.",
): string {
  const e = error as { message?: unknown; status?: number } | null;
  const msg = typeof e?.message === "string" ? e.message.trim() : "";

  if (!msg || msg === "{}" || msg === "[object Object]") {
    if (typeof e?.status === "number" && e.status >= 500) {
      return "Server error — sign-up could not complete. This usually means email confirmation is failing. In Supabase, turn off Authentication → Providers → Email → \"Confirm email\" (or configure SMTP), then try again.";
    }
    return fallback;
  }
  if (/email not confirmed/i.test(msg)) return "Please confirm your email first — check your inbox for the verification link.";
  if (/invalid login credentials/i.test(msg)) return "Invalid email or password.";
  if (/user already registered|already registered/i.test(msg)) return "An account with this email already exists. Try signing in instead.";
  if (/password/i.test(msg) && /weak|short|least/i.test(msg)) return "Password is too weak — use at least 8 characters with a letter and a number.";
  return msg;
}
