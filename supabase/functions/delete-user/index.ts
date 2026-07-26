// Supabase Edge Function: delete-user
// -----------------------------------------------------------------------------
// The browser CANNOT delete a Supabase auth account (that needs the service_role
// key, which must never ship to the client). This function runs server-side with
// the service key and fully removes a user: it deletes the auth.users row, which
// cascades the public.user_profiles row (0007: id references auth.users on delete
// cascade).
//
// It re-checks authorization server-side (never trust the client):
//   • caller must be an active admin or super_admin,
//   • only a super_admin may delete a super_admin,
//   • you can't delete your own account,
//   • never drop below one active admin or one active super_admin.
//
// It returns HTTP 200 with { ok: false, error } for handled/guard failures so the
// client can show a precise message, and { ok: true } on success.
//
// Deploy:
//   supabase functions deploy delete-user
// (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically.)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const authHeader = req.headers.get("Authorization") ?? "";

  // Admin client (service role) — bypasses RLS; used for reads/counts + the delete.
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  // Caller client — carries the caller's JWT so we can identify them.
  const caller = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });

  const { data: authData, error: authErr } = await caller.auth.getUser();
  if (authErr || !authData?.user) return json({ ok: false, error: "Not authenticated" }, 401);
  const callerId = authData.user.id;

  let userId: string | undefined;
  try {
    ({ userId } = await req.json());
  } catch {
    return json({ ok: false, error: "Invalid request body" }, 400);
  }
  if (!userId) return json({ ok: false, error: "userId is required" }, 400);

  const { data: callerProfile } = await admin
    .from("user_profiles")
    .select("role, status")
    .eq("id", callerId)
    .maybeSingle();
  const callerRole = callerProfile?.role as string | undefined;
  if (!callerProfile || callerProfile.status !== "active" || (callerRole !== "admin" && callerRole !== "super_admin")) {
    return json({ ok: false, error: "Only an active Admin or Super Admin can delete users" }, 403);
  }

  if (userId === callerId) return json({ ok: false, error: "You cannot delete your own account" });

  const { data: target } = await admin
    .from("user_profiles")
    .select("role, status, approved, email")
    .eq("id", userId)
    .maybeSingle();
  if (!target) return json({ ok: false, error: "User not found" });

  const targetRole = target.role as string;
  const targetActive = target.status === "active" && target.approved !== false;

  if (targetRole === "super_admin" && callerRole !== "super_admin") {
    return json({ ok: false, error: "Only a Super Admin can delete a Super Admin user" });
  }

  // Never drop below one active admin / one active super_admin.
  if (targetRole === "admin" && target.status === "active") {
    const { count } = await admin
      .from("user_profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin")
      .eq("status", "active");
    if ((count ?? 0) <= 1) return json({ ok: false, error: "Cannot delete the last remaining Admin" });
  }
  if (targetRole === "super_admin" && targetActive) {
    const { count } = await admin
      .from("user_profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "super_admin")
      .eq("status", "active");
    if ((count ?? 0) <= 1) {
      return json({ ok: false, error: "The system must retain at least one active Super Admin." });
    }
  }

  const { error: delErr } = await admin.auth.admin.deleteUser(userId);
  if (delErr) return json({ ok: false, error: delErr.message });

  // Best-effort audit (the profile row is gone via cascade; log the action).
  await admin.from("audit_logs").insert({
    entity_type: "user",
    entity_id: userId,
    action: "delete",
    old_values: { email: target.email, role: targetRole },
    performed_by: callerId,
    notes: `Deleted user ${target.email}`,
  });

  return json({ ok: true });
});
