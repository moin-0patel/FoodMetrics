import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { packagingRepo, type PackagingInput } from "@/lib/data";
import type { MaterialStatus } from "@/lib/data/types";
import { useActorId } from "@/lib/hooks/useActor";

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["packaging"] });
  qc.invalidateQueries({ queryKey: ["audit"] });
}

export function usePackagingItems() {
  return useQuery({ queryKey: ["packaging"], queryFn: () => packagingRepo.list() });
}

export function useCreatePackaging() {
  const qc = useQueryClient();
  const actorId = useActorId();
  return useMutation({
    mutationFn: (input: PackagingInput) => packagingRepo.create(input, actorId),
    onSuccess: () => invalidate(qc),
  });
}

export function useUpdatePackaging() {
  const qc = useQueryClient();
  const actorId = useActorId();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: PackagingInput }) => packagingRepo.update(id, input, actorId),
    onSuccess: () => invalidate(qc),
  });
}

export function useSetPackagingStatus() {
  const qc = useQueryClient();
  const actorId = useActorId();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: MaterialStatus }) => packagingRepo.setStatus(id, status, actorId),
    onSuccess: () => invalidate(qc),
  });
}

export function useDeletePackaging() {
  const qc = useQueryClient();
  const actorId = useActorId();
  return useMutation({
    mutationFn: (id: string) => packagingRepo.remove(id, actorId),
    onSuccess: () => invalidate(qc),
  });
}
