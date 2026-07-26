import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { exportsRepo, type ExportRecordInput } from "@/lib/data";

export function useExportHistory() {
  return useQuery({ queryKey: ["export_history"], queryFn: () => exportsRepo.list() });
}

/** Record one successful export. Fire it AFTER generation succeeds (never on failure). */
export function useRecordExport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ExportRecordInput) => exportsRepo.record(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["export_history"] }),
  });
}
