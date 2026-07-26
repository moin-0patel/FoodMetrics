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
      // Dark is the default: the product is designed dark-first. Light remains
      // fully supported behind the header toggle, and anyone who has already
      // chosen a theme keeps it — `persist` only uses this for a fresh visitor.
      theme: "dark",
      dark: true,
      setTheme: (theme) => set({ theme, dark: theme === "dark" }),
      toggle: () => {
        const next: Theme = get().theme === "dark" ? "light" : "dark";
        set({ theme: next, dark: next === "dark" });
      },
    }),
    {
      name: "rcms.theme",
      version: 2,
      // Migrate older shapes: boolean `{dark}` and the older 4-theme enum. An
      // explicit stored "light" is respected — only an absent/unreadable value
      // falls through to the dark default.
      migrate: (persisted: unknown) => {
        const p = persisted as { dark?: boolean; theme?: string } | undefined;
        if (!p) return { theme: "dark", dark: true } as ThemeState;
        if (p.theme === "light" || p.dark === false) return { theme: "light", dark: false } as ThemeState;
        return { theme: "dark", dark: true } as ThemeState;
      },
    },
  ),
);

/** Apply the active theme to <html> — just the dark surface class. */
export function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
}
