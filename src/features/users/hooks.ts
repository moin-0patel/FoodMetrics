import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { usersRepo, type CreateUserInput, type UpdateUserInput } from "@/lib/data";
import { useActorId } from "@/lib/hooks/useActor";

export function useUsers() {
  return useQuery({ queryKey: ["users"], queryFn: () => usersRepo.list() });
}

/** Map of user id → user, for resolving names in tables. */
export function useUsersMap() {
  const q = useUsers();
  const map = new Map((q.data ?? []).map((u) => [u.id, u]));
  return { ...q, map };
}

export function useCreateUser() {
  const qc = useQueryClient();
  const actorId = useActorId();
  return useMutation({
    mutationFn: (input: CreateUserInput) => usersRepo.create(input, actorId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      qc.invalidateQueries({ queryKey: ["audit"] });
    },
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  const actorId = useActorId();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateUserInput }) =>
      usersRepo.update(id, patch, actorId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      qc.invalidateQueries({ queryKey: ["audit"] });
    },
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  const actorId = useActorId();
  return useMutation({
    mutationFn: (id: string) => usersRepo.remove(id, actorId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      qc.invalidateQueries({ queryKey: ["audit"] });
    },
  });
}

/** Viewers only — for the Viewer Access page. */
export function useViewers() {
  const q = useUsers();
  return { ...q, viewers: (q.data ?? []).filter((u) => u.role === "viewer") };
}
