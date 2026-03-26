import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: number;
  type: ToastType;
  title: string;
  message: string;
}

let nextToastId = 1;

interface ToastState {
  toasts: Toast[];
  addToast: (type: ToastType, title: string, message: string) => void;
  removeToast: (id: number) => void;
  clearToasts: () => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],

  addToast: (type, title, message) => {
    const id = nextToastId++;
    set((state) => ({
      toasts: [...state.toasts, { id, type, title, message }],
    }));

    // Auto-dismiss after 5 seconds
    globalThis.setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }));
    }, 5000);
  },

  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),

  clearToasts: () => set({ toasts: [] }),
}));
