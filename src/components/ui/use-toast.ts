import { create } from "zustand";

export type ToastVariant = "default" | "success" | "destructive" | "warning";

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface Toast {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
  action?: ToastAction;
}

interface ToastOpts {
  action?: ToastAction;
}

interface ToastState {
  toasts: Toast[];
  push: (t: Omit<Toast, "id">) => void;
  dismiss: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push(t) {
    const id = Math.random().toString(36).slice(2);
    set((s) => ({ toasts: [...s.toasts, { ...t, id }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) }));
    }, 4000);
  },
  dismiss(id) {
    set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) }));
  },
}));

/** Convenience helpers. Pass `{ action }` for e.g. an Undo button. */
export const toast = {
  success: (title: string, description?: string, opts?: ToastOpts) =>
    useToastStore.getState().push({ title, description, variant: "success", action: opts?.action }),
  error: (title: string, description?: string, opts?: ToastOpts) =>
    useToastStore.getState().push({ title, description, variant: "destructive", action: opts?.action }),
  warning: (title: string, description?: string, opts?: ToastOpts) =>
    useToastStore.getState().push({ title, description, variant: "warning", action: opts?.action }),
  info: (title: string, description?: string, opts?: ToastOpts) =>
    useToastStore.getState().push({ title, description, variant: "default", action: opts?.action }),
};
