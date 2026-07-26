// Supabase-backed super-admin operations. `wipeCatalog` calls the SECURITY
// DEFINER wipe_catalog() RPC (0028), which is server-gated to super-admins and
// deletes the whole operational catalog atomically. Keeps users/roles/brands/
// outlets/settings.

import { sb, fail } from "./helpers";

export const supabaseAdminRepo = {
  async wipeCatalog(): Promise<void> {
    const { error } = await sb().rpc("wipe_catalog");
    if (error) fail("Wipe data", error.message);
  },
};
