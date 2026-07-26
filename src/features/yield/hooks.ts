import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { yieldsRepo, type YieldInput } from "@/lib/data";
import { useActorId } from "@/lib/hooks/useActor";

export function useYields() {
  return useQuery({ queryKey: ["yields"], queryFn: () => yieldsRepo.list() });
}

/** Yield changes affect recipe costing, so invalidate recipes too. */
function invalidate(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["yields"] });
  qc.invalidateQueries({ queryKey: ["recipes"] });
  qc.invalidateQueries({ queryKey: ["audit"] });
}

export function useCreateYield() {
  const qc = useQueryClient();
  const actorId = useActorId();
  return useMutation({
    mutationFn: (input: YieldInput) => yieldsRepo.create(input, actorId),
    onSuccess: () => invalidate(qc),
  });
}

export function useUpdateYield() {
  const qc = useQueryClient();
  const actorId = useActorId();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: YieldInput }) => yieldsRepo.update(id, input, actorId),
    onSuccess: () => invalidate(qc),
  });
}

export function useDeleteYield() {
  const qc = useQueryClient();
  const actorId = useActorId();
  return useMutation({
    mutationFn: (id: string) => yieldsRepo.remove(id, actorId),
    onSuccess: () => invalidate(qc),
  });
}

export function useBulkDeleteYield() {
  const qc = useQueryClient();
  const actorId = useActorId();
  return useMutation({
    mutationFn: (ids: string[]) => yieldsRepo.bulkRemove(ids, actorId),
    onSuccess: () => invalidate(qc),
  });
}
