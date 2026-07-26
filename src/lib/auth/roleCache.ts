// A tiny module-level cache of the loaded role definitions, primed once at
// AppLayout from the roles repo. It lets the synchronous permission layer
// (`can()`), non-React code (pdf export), and one-off label lookups resolve a
// role key → its capabilities / display label without threading the list around.
// Reactive lists (the Roles page, the user role picker) use useRoles() directly.

import { ROLE_LABELS, type RoleRecord } from "../data/types";

let cache: RoleRecord[] = [];

export function primeRoleCache(roles: RoleRecord[]): void {
  cache = roles;
}

/** All role records currently loaded (empty until the app primes the cache). */
export function cachedRoles(): RoleRecord[] {
  return cache;
}

/** Display label for a role key — cache first, then the built-in labels, then the key. */
export function roleLabel(key: string | null | undefined): string {
  if (!key) return "—";
  const hit = cache.find((r) => r.key === key);
  if (hit) return hit.label;
  return ROLE_LABELS[key] ?? key;
}

/** The capability set a role currently holds, or null if the role isn't in the
 *  cache yet (caller falls back to the built-in matrix for the six system roles). */
export function capabilitiesForRole(key: string | null | undefined): Set<string> | null {
  if (!key) return null;
  const hit = cache.find((r) => r.key === key);
  return hit ? new Set(hit.capabilities) : null;
}
