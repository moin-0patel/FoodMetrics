import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { accessLinksRepo, type CreateLinkInput } from "@/lib/data";

export function useAccessLinks() {
  return useQuery({ queryKey: ["access_links"], queryFn: () => accessLinksRepo.list() });
}

/** Resolve a raw share token (public view). Not retried — an invalid/expired token
 *  should surface its status immediately, not hammer the resolver. */
export function useResolveShareLink(token: string | undefined) {
  return useQuery({
    queryKey: ["share", token],
    queryFn: () => accessLinksRepo.resolve(token!),
    enabled: !!token,
    retry: false,
    staleTime: 0,
    gcTime: 0,
  });
}

export function useRecipeAccessLinks(recipeId: string | undefined) {
  return useQuery({
    queryKey: ["access_links", recipeId],
    queryFn: () => accessLinksRepo.listForRecipe(recipeId!),
    enabled: !!recipeId,
  });
}

export function useCreateAccessLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateLinkInput) => accessLinksRepo.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["access_links"] }),
  });
}

export function useRevokeAccessLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, byUserId }: { id: string; byUserId: string | null }) => accessLinksRepo.revoke(id, byUserId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["access_links"] }),
  });
}
