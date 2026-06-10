import { create } from 'zustand'

export type LinkCheckEntryStatus = 'checking' | 'ok' | 'broken'

export type LinkCheckState = {
  /** Per-card status, keyed by card ID. */
  statuses: Record<string, LinkCheckEntryStatus>
  /** True while a check is running. */
  isChecking: boolean
  /** Total cards to check in the current batch. */
  totalToCheck: number
  /** How many cards have been resolved so far. */
  checkedCount: number
}

type LinkCheckActions = {
  setChecking: (cardId: string) => void
  setResult: (cardId: string, result: 'ok' | 'broken') => void
  startBatch: (total: number) => void
  finishBatch: () => void
  clearResults: () => void
}

export type LinkCheckStore = LinkCheckState & LinkCheckActions

export const useLinkCheckStore = create<LinkCheckStore>((set) => ({
  statuses: {},
  isChecking: false,
  totalToCheck: 0,
  checkedCount: 0,

  setChecking: (cardId) =>
    set((state) => ({
      statuses: { ...state.statuses, [cardId]: 'checking' as const },
    })),

  setResult: (cardId, result) =>
    set((state) => ({
      statuses: { ...state.statuses, [cardId]: result },
      checkedCount: state.checkedCount + 1,
    })),

  startBatch: (total) =>
    set({
      statuses: {},
      isChecking: true,
      totalToCheck: total,
      checkedCount: 0,
    }),

  finishBatch: () =>
    set({
      isChecking: false,
    }),

  clearResults: () =>
    set({
      statuses: {},
      isChecking: false,
      totalToCheck: 0,
      checkedCount: 0,
    }),
}))
