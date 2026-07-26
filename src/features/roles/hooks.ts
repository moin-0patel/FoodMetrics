import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { rolesRepo, type RoleInput } from "@/lib/data";
import { useActorId } from "@/lib/hooks/useActor";

/** A role change touches the role list, the users list (labels/pickers) and audit. */
function invalidate(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["roles"] });
  qc.invalidateQueries({ queryKey: ["users"] });
  qc.invalidateQueries({ queryKey: ["audit"] });
}

export function useRoles() {
  return useQuery({ queryKey: ["roles"], queryFn: () => rolesRepo.list() });
}

export function useCreateRole() {
  const qc = useQueryClient();
  const actorId = useActorId();
  return useMutation({
    mutationFn: (input: RoleInput) => rolesRepo.create(input, actorId),
    onSuccess: () => invalidate(qc),
  });
}

export function useUpdateRole() {
  const qc = useQueryClient();
  const actorId = useActorId();
  return useMutation({
    mutationFn: ({ key, input }: { key: string; input: RoleInput }) => rolesRepo.update(key, input, actorId),
    onSuccess: () => invalidate(qc),
  });
}

export function useDeleteRole() {
  const qc = useQueryClient();
  const actorId = useActorId();
  return useMutation({
    mutationFn: (key: string) => rolesRepo.remove(key, actorId),
    onSuccess: () => invalidate(qc),
  });
}
