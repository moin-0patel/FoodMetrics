import type { LucideProps } from "lucide-react";
import type { ComponentType } from "react";
import { cn } from "@/lib/utils";

/**
 * A designed placeholder for a photograph.
 *
 * The project ships no photography, so rather than pull in stock images (someone
 * else's IP, and nothing to do with this kitchen) each slot renders a tinted,
 * textured frame. Drop a real file in `public/` and pass `src` — the placeholder
 * disappears and the image fills the frame.
 */
export function PhotoSlot({
  src,
  alt = "",
  icon: Icon,
  caption,
  className,
  overlay = true,
}: {
  /** Real image path, e.g. "/marketing/line-cook.jpg". Omit to show the placeholder. */
  src?: string;
  alt?: string;
  icon?: ComponentType<LucideProps>;
  /** Short label shown on the placeholder describing the intended shot. */
  caption?: string;
  className?: string;
  /** Darkening scrim, so overlaid text stays readable once a real photo is in. */
  overlay?: boolean;
}) {
  return (
    <div className={cn("relative overflow-hidden bg-slate-900", className)}>
      {src ? (
        <img src={src} alt={alt} loading="lazy" decoding="async" className="h-full w-full object-cover" />
      ) : (
        <>
          {/* Tinted base + fine grid, so an empty slot still reads as deliberate. */}
          <div
            aria-hidden
            className="absolute inset-0 bg-gradient-to-br from-slate-800 via-slate-900 to-black"
          />
          <div
            aria-hidden
            className="absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage:
                "linear-gradient(to right, #fff 1px, transparent 1px)," +
                "linear-gradient(to bottom, #fff 1px, transparent 1px)",
              backgroundSize: "28px 28px",
            }}
          />
          <div aria-hidden className="absolute -left-10 -top-10 h-48 w-48 rounded-full bg-primary/15 blur-3xl" />
          {(Icon || caption) && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-500">
              {Icon && <Icon className="h-8 w-8" />}
              {caption && (
                <span className="max-w-[80%] text-center text-[10px] font-semibold uppercase tracking-[0.16em]">
                  {caption}
                </span>
              )}
            </div>
          )}
        </>
      )}
      {overlay && src && <div aria-hidden className="absolute inset-0 bg-slate-950/45" />}
    </div>
  );
}
