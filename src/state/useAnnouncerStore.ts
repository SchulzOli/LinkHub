import { create } from 'zustand'

/**
 * Lightweight global announcer for screen-reader status messages.
 *
 * Feature hooks call `announce(message)` when a canvas action succeeds, is
 * rejected, or otherwise has no visual affordance (e.g. paste, undo, snap
 * blocked). `<AriaLiveRegion />` renders the current message inside an
 * `aria-live="polite"` region. The micro-task reset guarantees that repeated
 * identical messages still trigger a fresh announcement.
 */
export interface AnnouncerState {
  message: string
  announce: (message: string) => void
  clear: () => void
}

export const useAnnouncerStore = create<AnnouncerState>((set) => ({
  message: '',
  announce: (message) => {
    if (!message) {
      set({ message: '' })
      return
    }
    set({ message: '' })
    queueMicrotask(() => {
      set({ message })
    })
  },
  clear: () => {
    set({ message: '' })
  },
}))

/**
 * Non-hook accessor for call sites outside of React components (e.g. effects
 * in hooks that don't want to subscribe).
 */
export function announce(message: string) {
  useAnnouncerStore.getState().announce(message)
}
