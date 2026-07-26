import { create } from "zustand";
import { persist } from "zustand/middleware";

/** Per-browser UI preferences (not user-scoped data). Persisted to localStorage. */
interface PrefsState {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (v: boolean) => void;
}

export const usePrefs = create<PrefsState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
    }),
    { name: "rcms.prefs" },
  ),
);
