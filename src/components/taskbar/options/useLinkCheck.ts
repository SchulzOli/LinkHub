import { useCallback } from 'react'

import { checkLinks } from '../../../features/links/linkChecker'
import { useLinkCheckStore } from '../../../state/useLinkCheckStore'
import { useWorkspaceStore } from '../../../state/useWorkspaceStore'

export type LinkCheckStatus =
  | { kind: 'idle' }
  | { kind: 'checking'; current: number; total: number }
  | { kind: 'done'; ok: number; broken: number }
  | { kind: 'error'; message: string }

/**
 * Drives the transient link check from the Options Data panel.
 *
 * Reads workspace cards directly from the store so the hook can be used
 * in any component without threading card props through the panel tree.
 */
export function useLinkCheck() {
  const statuses = useLinkCheckStore((state) => state.statuses)
  const isChecking = useLinkCheckStore((state) => state.isChecking)
  const totalToCheck = useLinkCheckStore((state) => state.totalToCheck)
  const checkedCount = useLinkCheckStore((state) => state.checkedCount)
  const { startBatch, setChecking, setResult, finishBatch } =
    useLinkCheckStore()

  const currentStatus: LinkCheckStatus = (() => {
    if (isChecking) {
      return { kind: 'checking', current: checkedCount, total: totalToCheck }
    }

    if (Object.keys(statuses).length === 0) {
      return { kind: 'idle' }
    }

    const okCount = Object.values(statuses).filter((s) => s === 'ok').length
    const brokenCount = Object.values(statuses).filter(
      (s) => s === 'broken',
    ).length

    return { kind: 'done', ok: okCount, broken: brokenCount }
  })()

  const handleCheckLinks = useCallback(() => {
    const workspace = useWorkspaceStore.getState().workspace
    const cards = workspace.cards

    if (cards.length === 0) {
      return
    }

    const entries: Array<{ cardId: string; url: string }> = cards
      .filter((card: { url: string }) => card.url)
      .map((card: { id: string; url: string }) => ({
        cardId: card.id,
        url: card.url,
      }))

    if (entries.length === 0) {
      return
    }

    startBatch(entries.length)

    for (const entry of entries) {
      setChecking(entry.cardId)
    }

    checkLinks(
      entries,
      (cardId: string, result: 'ok' | 'broken') => {
        setResult(cardId, result)
      },
      () => {
        finishBatch()
      },
    )
  }, [startBatch, setChecking, setResult, finishBatch])

  return {
    status: currentStatus,
    statuses,
    isChecking,
    checkedCount,
    totalToCheck,
    handleCheckLinks,
  }
}
