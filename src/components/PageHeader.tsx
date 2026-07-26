import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  /** Small accent-coloured uppercase label above the title, e.g. "Resource Management". */
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        {eyebrow && (
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
            {eyebrow}
          </p>
        )}
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && (
        // Keep action buttons on a single line. On mobile they collapse to
        // icon-only squares (label text hidden via text-[0]; the icon is a
        // fixed-size svg) so any number of buttons fit without wrapping/clipping.
        // Labels return from sm up. Text stays in the DOM for screen readers.
        <div
          className="flex items-center gap-1.5 sm:gap-2 sm:justify-end
            [&>div]:flex [&>div]:min-w-0 [&>div]:items-center [&>div]:gap-1.5 sm:[&>div]:gap-2
            [&_button]:h-9 [&_button]:w-9 [&_button]:justify-center [&_button]:gap-0 [&_button]:px-0 [&_button]:text-[0px]
            sm:[&_button]:w-auto sm:[&_button]:justify-center sm:[&_button]:gap-2 sm:[&_button]:px-4 sm:[&_button]:text-sm"
        >
          {actions}
        </div>
      )}
    </div>
  );
}
