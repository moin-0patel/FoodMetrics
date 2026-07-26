export type Tone = "neutral" | "good" | "warning" | "bad" | "accent";

/** For a cost metric, falling is good; for a count metric, rising is good. */
export function deltaTone(delta: number, lowerIsBetter: boolean): Tone {
  if (delta === 0) return "neutral";
  const improving = lowerIsBetter ? delta < 0 : delta > 0;
  return improving ? "good" : "bad";
}
