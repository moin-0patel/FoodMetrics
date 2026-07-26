import { cn } from "@/lib/utils";

/**
 * Shimmer placeholder used while data loads. A muted block with a light sweep
 * passing over it — respects `prefers-reduced-motion` (the sweep is disabled
 * via the global guard in index.css).
 */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-md bg-muted",
        "before:absolute before:inset-0 before:-translate-x-full",
        "before:animate-shimmer before:bg-gradient-to-r",
        "before:from-transparent before:via-black/[0.06] before:to-transparent",
        "dark:before:via-white/10",
        className,
      )}
      {...props}
    />
  );
}
