import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Theme = "light" | "dark";

interface ThemeState {
  theme: Theme;
  /** Back-compat alias kept so existing `useTheme(s => s.dark)` readers work. */
  dark: boolean;
  setTheme: (t: Theme) => void;
  /** Header Sun/Moon button: flips light <-> dark. */
  toggle: () => void;
}

export const useTheme = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: "light",
      dark: false,
      setTheme: (theme) => set({ theme, dark: theme === "dark" }),
      toggle: () => {
        const next: Theme = get().theme === "dark" ? "light" : "dark";
        set({ theme: next, dark: next === "dark" });
      },
    }),
    {
      name: "rcms.theme",
      version: 2,
      // Migrate older shapes: boolean `{dark}` and the older 4-theme enum (→ light).
      migrate: (persisted: unknown) => {
        const p = persisted as { dark?: boolean; theme?: string } | undefined;
        if (!p) return { theme: "light", dark: false } as ThemeState;
        if (p.theme === "dark" || p.dark === true) return { theme: "dark", dark: true } as ThemeState;
        return { theme: "light", dark: false } as ThemeState;
      },
    },
  ),
);

/** Apply the active theme to <html> — just the dark surface class. */
export function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
}
