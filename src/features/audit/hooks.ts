import { useQuery } from "@tanstack/react-query";
import { auditRepo, materialsRepo, recipesRepo, type AuditFilter } from "@/lib/data";

export function useAuditLogs(filter: AuditFilter = {}) {
  return useQuery({
    queryKey: ["audit", filter],
    queryFn: () => auditRepo.list(filter),
  });
}

export function useAllPriceHistory() {
  return useQuery({
    queryKey: ["priceHistory", "all"],
    queryFn: () => materialsRepo.allPriceHistory(),
  });
}

export function useAllRecipeCostHistory() {
  return useQuery({
    queryKey: ["recipeCostHistory", "all"],
    queryFn: () => recipesRepo.allCostHistory(),
  });
}
