import { cn } from "@/lib/utils";

// The Food Metrics brand mark + wordmark. The mark is a plate ring with ascending
// metric bars and a rising trend tick — `public/app-icon.svg`, generated from
// assets/food-metrics-mark.svg by scripts/gen-app-icon.mjs. It sits on its own
// dark tile so it reads on both light and dark panels; the wordmark is
// "Food Metrics" text alongside it.

type Size = "sm" | "md" | "lg" | "xl";

const SIZES: Record<Size, { box: string; title: string; sub: string }> = {
  sm: { box: "h-8 w-8 rounded-lg", title: "text-base", sub: "text-[10px]" },
  md: { box: "h-10 w-10 rounded-xl", title: "text-lg", sub: "text-[11px]" },
  lg: { box: "h-12 w-12 rounded-2xl", title: "text-2xl", sub: "text-xs" },
  xl: { box: "h-14 w-14 rounded-2xl", title: "text-3xl", sub: "text-sm" },
};

/** Just the icon tile (no wordmark). The mark sits on its own dark background, so
 *  it reads on any panel — `invert` is accepted for API compatibility. */
export function BrandMark({
  size = "md",
  className,
}: {
  size?: Size;
  /** Accepted for API compatibility; the mark reads on any panel. */
  invert?: boolean;
  className?: string;
}) {
  const s = SIZES[size];
  return (
    <span
      aria-hidden="true"
      className={cn("inline-flex shrink-0 items-center justify-center overflow-hidden shadow-sm", s.box, className)}
    >
      {/* SVG, so the mark stays crisp at every size the app renders it. */}
      <img src="/app-icon.svg" alt="" className="h-full w-full object-cover" />
    </span>
  );
}

/** Full logo: the mark tile + "Food Metrics" wordmark (with an optional subtitle). */
export function Logo({
  size = "md",
  withSubtitle = false,
  subtitle = "Recipe Costing & Operations",
  invert = false,
  className,
}: {
  size?: Size;
  withSubtitle?: boolean;
  subtitle?: string;
  invert?: boolean;
  className?: string;
}) {
  const s = SIZES[size];
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <BrandMark size={size} />
      <span className="flex flex-col leading-none">
        <span className={cn("font-semibold tracking-tight", s.title, invert ? "text-white" : "text-foreground")}>
          {/* Matches the artwork lockup: white "Food" + teal "Metrics". The artwork's
              cyan is #01dadd, but that fails contrast on the light sidebar — #2bb6c4
              is the tuned, legible equivalent. */}
          Food <span style={{ color: "#2bb6c4" }}>Metrics</span>
        </span>
        {withSubtitle && (
          <span className={cn("mt-1 font-medium", s.sub, invert ? "text-white/70" : "text-muted-foreground")}>
            {subtitle}
          </span>
        )}
      </span>
    </span>
  );
}
