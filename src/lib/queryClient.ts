import { QueryClient, QueryCache, MutationCache } from "@tanstack/react-query";
import { toast } from "@/components/ui/use-toast";

/**
 * Global query/mutation error handling so nothing fails silently:
 *  - every query failure logs to the console and surfaces a toast (most query
 *    consumers fall back to empty data and would otherwise show nothing);
 *  - every mutation failure logs to the console as a safety net (call sites also
 *    toast their own contextual message, so we don't double-toast here).
 */
export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => {
      console.error("Query failed:", error);
      toast.error(
        "Couldn't load data",
        error instanceof Error ? error.message : "Please try again.",
      );
    },
  }),
  mutationCache: new MutationCache({
    onError: (error) => {
      console.error("Mutation failed:", error);
    },
  }),
  defaultOptions: {
    queries: {
      // Recipes/materials are edited infrequently — keep data fresh for a few
      // minutes to avoid refetch storms when many components read the same key.
      staleTime: 3 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
