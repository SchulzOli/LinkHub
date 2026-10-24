import { useEffect } from 'react'

import { isAutoDashboardStale } from '../../contracts/autoDashboard'
import { useWorkspaceStore } from '../../state/useWorkspaceStore'
import { loadAutoDashboardSettings } from '../../storage/autoDashboardRepository'

/**
 * Rebuilds the Auto workspace when it is opened and older than the chosen
 * refresh interval. Only uses permissions the user already granted; it
 * never prompts. While the Auto dashboard is off this costs one small
 * settings read; the build code is only loaded when a rebuild is due.
 */
export function useAutoDashboardRefresh() {
  const status = useWorkspaceStore((state) => state.status)
  const activeWorkspaceId = useWorkspaceStore(
    (state) => state.activeWorkspaceId,
  )

  useEffect(() => {
    if (status !== 'ready') {
      return
    }

    let active = true

    void loadAutoDashboardSettings().then(async (settings) => {
      if (
        !active ||
        settings.workspaceId !== activeWorkspaceId ||
        !isAutoDashboardStale(settings)
      ) {
        return
      }

      const { useAutoDashboardStore } =
        await import('../../state/useAutoDashboardStore')
      const store = useAutoDashboardStore.getState()

      await store.load()

      if (active) {
        void store.build()
      }
    })

    return () => {
      active = false
    }
  }, [activeWorkspaceId, status])
}
