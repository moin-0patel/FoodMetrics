import { useState } from "react";
import { Check, Copy, Link2, Loader2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/use-toast";
import type { AccessType, Recipe, User } from "@/lib/data/types";
import { useCreateAccessLink, useRecipeAccessLinks, useRevokeAccessLink } from "@/features/exports/accessHooks";

const ACCESS_LABELS: Record<AccessType, string> = {
  READ_ONLY: "View only",
  DOWNLOAD_PDF: "Download PDF only",
  VIEW_AND_DOWNLOAD: "View & download PDF",
};

const fmt = (iso: string) => new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

export function ShareLinkDialog({
  open, onOpenChange, recipe, user,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  recipe: Recipe;
  user: User | null;
}) {
  const [accessType, setAccessType] = useState<AccessType>("READ_ONLY");
  const [created, setCreated] = useState<{ url: string; expires: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const create = useCreateAccessLink();
  const revoke = useRevokeAccessLink();
  const { data: links = [] } = useRecipeAccessLinks(recipe.id);

  const onCreate = async () => {
    if (create.isPending) return; // block double-submit → no duplicate links
    try {
      const { link, token } = await create.mutateAsync({
        recipe_id: recipe.id,
        granted_by_user_id: user?.id ?? null,
        granted_by_name: user?.name ?? "Unknown",
        granted_by_role: user?.role ?? "viewer",
        access_type: accessType,
      });
      setCreated({ url: `${window.location.origin}/share/${token}`, expires: link.expires_at });
      setCopied(false);
      toast.success("Temporary recipe link created successfully.");
    } catch {
      toast.error("Unable to create the link. Please try again.");
    }
  };

  const copy = async () => {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.url);
      setCopied(true);
      toast.success("Link copied.");
    } catch {
      toast.error("Copy failed — select and copy manually.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setCreated(null); }}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create temporary recipe link</DialogTitle>
          <DialogDescription>
            A secure, read-only link to "{recipe.recipe_name}". It expires in 7 days and never exposes cost or price data.
          </DialogDescription>
        </DialogHeader>

        {!created ? (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Access type</label>
              <Select value={accessType} onValueChange={(v) => setAccessType(v as AccessType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(ACCESS_LABELS) as AccessType[]).map((t) => (
                    <SelectItem key={t} value={t}>{ACCESS_LABELS[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={onCreate} disabled={create.isPending} variant="accent" className="w-full">
              {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
              {create.isPending ? "Creating temporary recipe link…" : "Create link"}
            </Button>
          </div>
        ) : (
          <div className="space-y-2 rounded-md border bg-muted/30 p-3">
            <p className="text-xs font-medium text-emerald-700">Link expires in 7 days (on {fmt(created.expires)} IST).</p>
            <div className="flex items-center gap-2">
              <Input readOnly value={created.url} className="text-xs" onFocus={(e) => e.currentTarget.select()} />
              <Button size="icon" variant="outline" onClick={copy}>
                {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setCreated(null)}>Create another</Button>
          </div>
        )}

        {links.length > 0 && (
          <div className="mt-2">
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Links for this recipe</p>
            <ul className="divide-y text-sm">
              {links.map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-2 py-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant={l.status === "ACTIVE" ? "success" : l.status === "REVOKED" ? "danger" : "secondary"}>{l.status}</Badge>
                      <span className="text-xs text-muted-foreground">{ACCESS_LABELS[l.access_type]}</span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      By {l.granted_by_name} · expires {fmt(l.expires_at)} · {l.access_count} view(s)
                    </p>
                  </div>
                  {l.status === "ACTIVE" && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={revoke.isPending}
                      onClick={async () => {
                        try {
                          await revoke.mutateAsync({ id: l.id, byUserId: user?.id ?? null });
                          toast.success("Recipe link revoked successfully.");
                        } catch {
                          toast.error("Unable to revoke the link.");
                        }
                      }}
                    >
                      Revoke
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
