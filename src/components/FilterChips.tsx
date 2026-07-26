import { cn } from "@/lib/utils";

// Horizontal pill filter, e.g. All / Proteins / Produce / Dry Goods / Dairy.
// A tab-style control over an existing filter value — it replaces a <Select> in
// the UI without changing the state it drives.

export interface Chip {
  value: string;
  label: string;
  /** Optional count shown after the label. */
  count?: number;
}

export function FilterChips({
  chips,
  value,
  onChange,
  label,
  className,
}: {
  chips: Chip[];
  value: string;
  onChange: (value: string) => void;
  /** Small uppercase caption before the chips. */
  label?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {label && (
        <span className="mr-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
      )}
      {chips.map((c) => {
        const active = c.value === value;
        return (
          <button
            key={c.value}
            type="button"
            onClick={() => onChange(c.value)}
            aria-pressed={active}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active
                ? "border-primary/40 bg-primary/12 text-primary"
                : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {c.label}
            {c.count != null && (
              <span className={cn("tabular-nums", active ? "text-primary/70" : "text-muted-foreground/70")}>
                {c.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
