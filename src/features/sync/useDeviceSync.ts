import { useEffect } from 'react'

import { useNetworkFeaturesStore } from '../../state/useNetworkFeaturesStore'
import { useWorkspaceStore } from '../../state/useWorkspaceStore'

const SYNC_INTERVAL_MS = 5 * 60 * 1000
const CHANGE_DELAY_MS = 8 * 1000

/**
 * Keeps devices in step while Device sync is on and set up: syncs when
 * the app opens or comes back to the front, a few seconds after a change,
 * and every few minutes while visible. The sync code itself is only
 * loaded once the switch is on.
 */
export function useDeviceSync() {
  const status = useWorkspaceStore((state) => state.status)
  const deviceSyncOn = useNetworkFeaturesStore((state) => state.deviceSync)

  useEffect(() => {
    if (status !== 'ready' || !deviceSyncOn) {
      return
    }

    let active = true
    let changeTimer: number | undefined
    const cleanups: Array<() => void> = []

    void import('../../state/useSyncStore').then(async ({ useSyncStore }) => {
      const connection = await useSyncStore.getState().load()

      if (!active) {
        return
      }

      const sync = () => {
        if (useSyncStore.getState().connection) {
          void useSyncStore.getState().sync()
        }
      }

      const handleVisibility = () => {
        if (document.visibilityState === 'visible') {
          sync()
        }
      }

      const interval = window.setInterval(() => {
        if (document.visibilityState === 'visible') {
          sync()
        }
      }, SYNC_INTERVAL_MS)

      // Only content changes, not panning or zooming (the view position
      // stays on each device).
      const unsubscribe = useWorkspaceStore.subscribe((state, previous) => {
        if (
          state.workspace !== previous.workspace ||
          state.workspaceSummaries !== previous.workspaceSummaries
        ) {
          window.clearTimeout(changeTimer)
          changeTimer = window.setTimeout(sync, CHANGE_DELAY_MS)
        }
      })

      document.addEventListener('visibilitychange', handleVisibility)
      cleanups.push(() => {
        window.clearInterval(interval)
        unsubscribe()
        document.removeEventListener('visibilitychange', handleVisibility)
      })

      if (connection) {
        sync()
      }
    })

    return () => {
      active = false
      window.clearTimeout(changeTimer)

      for (const cleanup of cleanups) {
        cleanup()
      }
    }
  }, [deviceSyncOn, status])
}
