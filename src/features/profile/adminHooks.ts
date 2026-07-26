import { useMutation, useQueryClient } from "@tanstack/react-query";
import { adminRepo } from "@/lib/data";

/**
 * Super-admin "wipe all catalog data". On success, clears every cached query so
 * the whole app (recipes, materials, dashboard, …) reflects the empty catalog.
 * The server RPC (wipe_catalog) independently rejects non-super-admins.
 */
export function useWipeCatalog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => adminRepo.wipeCatalog(),
    onSuccess: () => qc.clear(),
  });
}
