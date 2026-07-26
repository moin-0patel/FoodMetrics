import { Line, LineChart, ResponsiveContainer } from "recharts";

/** Tiny inline trend line for KPI cards. Data is illustrative. */
export function Sparkline({ data, color = "#16a34a" }: { data: number[]; color?: string }) {
  const series = data.map((v, i) => ({ i, v }));
  return (
    <ResponsiveContainer width="100%" height={36}>
      <LineChart data={series} margin={{ top: 4, bottom: 4, left: 0, right: 0 }}>
        <Line type="monotone" dataKey="v" stroke={color} strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Deterministic 7-point series around a base value (for decorative sparklines). */
export function sparkSeries(base: number, seed: number): number[] {
  const out: number[] = [];
  let x = seed % 97;
  for (let i = 0; i < 7; i++) {
    x = (x * 1103515245 + 12345) % 2147483648;
    const jitter = ((x / 2147483648) - 0.5) * base * 0.25;
    out.push(Math.max(0, base + jitter));
  }
  return out;
}
