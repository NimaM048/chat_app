import { create } from 'zustand'

export interface AppToast {
  id: string
  title: string
  body: string
  conversationId?: string
}

interface ToastState {
  toasts: AppToast[]
  pushToast: (toast: Omit<AppToast, 'id'>) => void
  dismissToast: (id: string) => void
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  pushToast: (toast) =>
    set((state) => ({
      toasts: [
        ...state.toasts.slice(-4),
        { ...toast, id: crypto.randomUUID() },
      ],
    })),
  dismissToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((toast) => toast.id !== id),
    })),
}))
