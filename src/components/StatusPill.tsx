import { cn } from "@/lib/utils";

// Small status chip used across the operational pages: ACTIVE / LOW STOCK /
// ARCHIVED / OPTIMAL / CRITICAL and friends. One tone vocabulary so the same
// meaning always reads the same colour, in light and dark.

export type PillTone = "good" | "warning" | "critical" | "neutral" | "info";

const TONE: Record<PillTone, string> = {
  good: "bg-emerald-500/12 text-emerald-700 ring-emerald-500/25 dark:text-emerald-400",
  warning: "bg-amber-500/14 text-amber-700 ring-amber-500/25 dark:text-amber-400",
  critical: "bg-red-500/12 text-red-700 ring-red-500/25 dark:text-red-400",
  neutral: "bg-muted text-muted-foreground ring-border",
  info: "bg-primary/12 text-primary ring-primary/25",
};

export function StatusPill({
  children,
  tone = "neutral",
  dot = false,
  className,
}: {
  children: React.ReactNode;
  tone?: PillTone;
  /** Leading status dot, as on the "● Active" rows. */
  dot?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ring-inset",
        TONE[tone],
        className,
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />}
      {children}
    </span>
  );
}

/** Map a material/brand/outlet status string onto a pill tone. */
export function statusTone(status: string | null | undefined): PillTone {
  switch (status) {
    case "active":
    case "approved":
      return "good";
    case "testing":
    case "draft":
      return "warning";
    case "rejected":
      return "critical";
    default:
      return "neutral";
  }
}
