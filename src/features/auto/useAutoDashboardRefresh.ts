import { useEffect } from 'react'

import {
  isAutoDashboardStale,
  withSetupSwitches,
} from '../../contracts/autoDashboard'
import {
  onNetworkFeatureDisabled,
  useNetworkFeaturesStore,
} from '../../state/useNetworkFeaturesStore'
import { useWorkspaceStore } from '../../state/useWorkspaceStore'
import { loadAutoDashboardSettings } from '../../storage/autoDashboardRepository'

/**
 * Rebuilds the Auto workspace when it is opened and older than the chosen
 * refresh interval. Only uses permissions the user already granted; it
 * never prompts, and does nothing while the Auto dashboard is off in
 * Menu → Privacy. The build code is only loaded when a rebuild is due.
 */
export function useAutoDashboardRefresh() {
  const status = useWorkspaceStore((state) => state.status)
  const activeWorkspaceId = useWorkspaceStore(
    (state) => state.activeWorkspaceId,
  )
  const autoDashboardOn = useNetworkFeaturesStore(
    (state) => state.autoDashboard,
  )

  // Turning the Auto dashboard off also gives back the browser data
  // permissions it was granted.
  useEffect(
    () =>
      onNetworkFeatureDisabled('autoDashboard', () => {
        void import('./browserSignals').then(
          ({ releaseBrowserSignalPermission }) =>
            Promise.all([
              releaseBrowserSignalPermission('history'),
              releaseBrowserSignalPermission('topSites'),
            ]),
        )
      }),
    [],
  )

  useEffect(() => {
    if (status !== 'ready' || !autoDashboardOn) {
      return
    }

    let active = true

    void loadAutoDashboardSettings().then(async (settings) => {
      if (
        !active ||
        settings.workspaceId !== activeWorkspaceId ||
        !isAutoDashboardStale(
          withSetupSwitches(settings, useNetworkFeaturesStore.getState()),
        )
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
  }, [activeWorkspaceId, autoDashboardOn, status])
}
