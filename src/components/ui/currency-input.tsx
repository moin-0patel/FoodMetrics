import * as React from "react";
import { cn } from "@/lib/utils";

interface CurrencyInputProps {
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  id?: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  "aria-invalid"?: boolean;
}

/**
 * Numeric money input: blocks letters/symbols, allows at most two decimals, and
 * shows grouped thousands (₹120.50) when not focused. Emits a `number | undefined`
 * so it drops straight into react-hook-form via setValue.
 */
export function CurrencyInput({
  value,
  onChange,
  className,
  ...rest
}: CurrencyInputProps) {
  const [focused, setFocused] = React.useState(false);
  const [draft, setDraft] = React.useState("");

  const grouped =
    value === undefined || Number.isNaN(value)
      ? ""
      : value.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

  const display = focused ? draft : grouped;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Strip everything except digits and a single decimal point.
    let raw = e.target.value.replace(/[^0-9.]/g, "");
    const parts = raw.split(".");
    if (parts.length > 2) raw = `${parts[0]}.${parts.slice(1).join("")}`;
    const [int, dec] = raw.split(".");
    raw = dec !== undefined ? `${int}.${dec.slice(0, 2)}` : int; // max 2 decimals
    setDraft(raw);
    onChange(raw === "" || raw === "." ? undefined : Number(raw));
  };

  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
        ₹
      </span>
      <input
        inputMode="decimal"
        className={cn(
          "flex h-9 w-full rounded-md border border-input bg-background py-1 pl-7 pr-3 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        value={display}
        onFocus={() => {
          setFocused(true);
          setDraft(value === undefined || Number.isNaN(value) ? "" : String(value));
        }}
        onBlur={() => setFocused(false)}
        onChange={handleChange}
        {...rest}
      />
    </div>
  );
}
