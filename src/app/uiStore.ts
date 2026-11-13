import { create } from 'zustand'

export interface Toast {
  id: number
  message: string
  tone: 'neutral' | 'success' | 'danger'
}

interface UIState {
  inspectorOpen: boolean
  inspectorAvailable: boolean
  mobileNavOpen: boolean
  toasts: Toast[]
  setMobileNavOpen: (open: boolean) => void
  setInspectorAvailable: (available: boolean) => void
  toggleInspector: () => void
  setInspectorOpen: (open: boolean) => void
  pushToast: (message: string, tone?: Toast['tone']) => void
  dismissToast: (id: number) => void
}

let toastId = 0

export const useUI = create<UIState>()((set) => ({
  inspectorOpen: false,
  inspectorAvailable: false,
  mobileNavOpen: false,
  toasts: [],
  setMobileNavOpen: (open) => set({ mobileNavOpen: open }),
  setInspectorAvailable: (available) =>
    set((state) => ({
      inspectorAvailable: available,
      inspectorOpen: available ? state.inspectorOpen : false,
    })),
  toggleInspector: () => set((state) => ({ inspectorOpen: !state.inspectorOpen })),
  setInspectorOpen: (open) => set({ inspectorOpen: open }),
  pushToast: (message, tone = 'neutral') =>
    set((state) => ({
      toasts: [...state.toasts, { id: ++toastId, message, tone }].slice(-3),
    })),
  dismissToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
}))
