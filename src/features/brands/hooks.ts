import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { brandsRepo, outletsRepo, type BrandInput, type OutletInput } from "@/lib/data";
import type { BrandOutletStatus } from "@/lib/data/types";
import { useActorId } from "@/lib/hooks/useActor";

/** A brand/outlet change can touch selectors, wastage, reports, and the audit log. */
function invalidate(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["brands"] });
  qc.invalidateQueries({ queryKey: ["outlets"] });
  qc.invalidateQueries({ queryKey: ["audit"] });
}

export function useBrands() {
  return useQuery({ queryKey: ["brands"], queryFn: () => brandsRepo.list() });
}

export function useOutlets() {
  return useQuery({ queryKey: ["outlets"], queryFn: () => outletsRepo.list() });
}

export function useCreateBrand() {
  const qc = useQueryClient();
  const actorId = useActorId();
  return useMutation({
    mutationFn: (input: BrandInput) => brandsRepo.create(input, actorId),
    onSuccess: () => invalidate(qc),
  });
}

export function useUpdateBrand() {
  const qc = useQueryClient();
  const actorId = useActorId();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: BrandInput }) => brandsRepo.update(id, input, actorId),
    onSuccess: () => invalidate(qc),
  });
}

export function useSetBrandStatus() {
  const qc = useQueryClient();
  const actorId = useActorId();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: BrandOutletStatus }) =>
      brandsRepo.setStatus(id, status, actorId),
    onSuccess: () => invalidate(qc),
  });
}

export function useDeleteBrand() {
  const qc = useQueryClient();
  const actorId = useActorId();
  return useMutation({
    mutationFn: (id: string) => brandsRepo.remove(id, actorId),
    onSuccess: () => invalidate(qc),
  });
}

export function useCreateOutlet() {
  const qc = useQueryClient();
  const actorId = useActorId();
  return useMutation({
    mutationFn: (input: OutletInput) => outletsRepo.create(input, actorId),
    onSuccess: () => invalidate(qc),
  });
}

export function useUpdateOutlet() {
  const qc = useQueryClient();
  const actorId = useActorId();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: OutletInput }) => outletsRepo.update(id, input, actorId),
    onSuccess: () => invalidate(qc),
  });
}

export function useSetOutletStatus() {
  const qc = useQueryClient();
  const actorId = useActorId();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: BrandOutletStatus }) =>
      outletsRepo.setStatus(id, status, actorId),
    onSuccess: () => invalidate(qc),
  });
}

export function useDeleteOutlet() {
  const qc = useQueryClient();
  const actorId = useActorId();
  return useMutation({
    mutationFn: (id: string) => outletsRepo.remove(id, actorId),
    onSuccess: () => invalidate(qc),
  });
}
