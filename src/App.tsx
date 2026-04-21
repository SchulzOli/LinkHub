import { useEffect, useRef } from 'react'

import { WorkspaceScreen } from './components/canvas/WorkspaceScreen'
import { applyAppearanceStyle } from './features/appearance/stylePresets'
import { prefetchTemplatePreviewCapture } from './features/templates/templatePreviewCapture'
import { useWorkspaceStore } from './state/useWorkspaceStore'
import { getPersistedWorkspace } from './state/workspaceStoreHelpers'
import {
  loadWorkspaceSession,
  saveWorkspace,
  saveWorkspaceSnapshot,
} from './storage/workspaceRepository'

let workspaceLoadPromise: ReturnType<typeof loadWorkspaceSession> | null = null

type IdleWindow = Window & {
  requestIdleCallback?: (
    callback: () => void,
    options?: { timeout: number },
  ) => number
  cancelIdleCallback?: (handle: number) => void
}

function schedulePostPaintPrefetch(run: () => void) {
  if (typeof window === 'undefined') {
    return () => {}
  }

  const idleWindow = window as IdleWindow

  if (typeof idleWindow.requestIdleCallback === 'function') {
    const handle = idleWindow.requestIdleCallback(run, { timeout: 2000 })

    return () => {
      idleWindow.cancelIdleCallback?.(handle)
    }
  }

  const timeoutHandle = window.setTimeout(run, 1500)

  return () => {
    window.clearTimeout(timeoutHandle)
  }
}

function prefetchLazyBundles() {
  // html-to-image: needed for template-preview capture on first template apply.
  prefetchTemplatePreviewCapture()
  // Taskbar submodules rendered lazily in OptionsMenu.
  void import('./components/taskbar/ThemeGallery')
  void import('./components/taskbar/StatisticsPanel')
  void import('./components/taskbar/OptionsDataSection')
}

function App() {
  const initializeWorkspaceSession = useWorkspaceStore(
    (state) => state.initializeWorkspaceSession,
  )
  const recordCanvasOpen = useWorkspaceStore((state) => state.recordCanvasOpen)
  const setStatus = useWorkspaceStore((state) => state.setStatus)
  const workspace = useWorkspaceStore((state) => state.workspace)
  const viewport = useWorkspaceStore((state) => state.viewport)
  const status = useWorkspaceStore((state) => state.status)
  const hydratedRef = useRef(false)
  const resumePendingRef = useRef(false)

  useEffect(() => {
    if (status !== 'ready' || !hydratedRef.current) {
      return
    }

    const flushWorkspace = () => {
      const persistedWorkspace = getPersistedWorkspace(
        useWorkspaceStore.getState(),
      )

      void saveWorkspace(persistedWorkspace)
      saveWorkspaceSnapshot(persistedWorkspace)
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        resumePendingRef.current = true
        flushWorkspace()
        return
      }

      if (resumePendingRef.current) {
        resumePendingRef.current = false
        recordCanvasOpen('resume')
      }
    }

    const handleBlur = () => {
      resumePendingRef.current = true
    }

    const handleFocus = () => {
      if (document.visibilityState !== 'visible' || !resumePendingRef.current) {
        return
      }

      resumePendingRef.current = false
      recordCanvasOpen('resume')
    }

    window.addEventListener('pagehide', flushWorkspace)
    window.addEventListener('blur', handleBlur)
    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('pagehide', flushWorkspace)
      window.removeEventListener('blur', handleBlur)
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [recordCanvasOpen, status])

  useEffect(() => {
    if (status === 'ready') {
      hydratedRef.current = true
      return
    }

    if (status !== 'loading') {
      return
    }

    let active = true

    workspaceLoadPromise ??= loadWorkspaceSession()

    workspaceLoadPromise
      .then((session) => {
        if (!active) {
          return
        }

        initializeWorkspaceSession(session)
        hydratedRef.current = true
        recordCanvasOpen('initial')
      })
      .catch(() => {
        if (!active) {
          return
        }

        setStatus('error')
      })

    return () => {
      active = false
    }
  }, [initializeWorkspaceSession, recordCanvasOpen, setStatus, status])

  useEffect(() => {
    applyAppearanceStyle(document.documentElement, workspace.appearance)
  }, [workspace.appearance])

  useEffect(() => {
    if (status !== 'ready') {
      return
    }

    return schedulePostPaintPrefetch(prefetchLazyBundles)
  }, [status])

  useEffect(() => {
    if (status !== 'ready' || !hydratedRef.current) {
      return
    }

    const snapshotHandle = window.setTimeout(() => {
      saveWorkspaceSnapshot(getPersistedWorkspace(useWorkspaceStore.getState()))
    }, 400)

    const dbHandle = window.setTimeout(() => {
      void saveWorkspace(getPersistedWorkspace(useWorkspaceStore.getState()))
    }, 400)

    return () => {
      window.clearTimeout(snapshotHandle)
      window.clearTimeout(dbHandle)
    }
  }, [status, workspace, viewport])

  return <WorkspaceScreen />
}

export default App
