import { useEffect, useRef } from 'react'

import { WorkspaceScreen } from './components/canvas/WorkspaceScreen'
import { applyAppearanceStyle } from './features/appearance/stylePresets'
import { useWorkspaceStore } from './state/useWorkspaceStore'
import {
  loadWorkspaceSession,
  saveWorkspace,
  saveWorkspaceSnapshot,
} from './storage/workspaceRepository'

let workspaceLoadPromise: ReturnType<typeof loadWorkspaceSession> | null = null

function App() {
  const initializeWorkspaceSession = useWorkspaceStore(
    (state) => state.initializeWorkspaceSession,
  )
  const recordCanvasOpen = useWorkspaceStore((state) => state.recordCanvasOpen)
  const setStatus = useWorkspaceStore((state) => state.setStatus)
  const workspace = useWorkspaceStore((state) => state.workspace)
  const status = useWorkspaceStore((state) => state.status)
  const hydratedRef = useRef(false)
  const resumePendingRef = useRef(false)
  const workspaceRef = useRef(workspace)

  useEffect(() => {
    workspaceRef.current = workspace
  }, [workspace])

  useEffect(() => {
    if (status !== 'ready' || !hydratedRef.current) {
      return
    }

    const flushWorkspace = () => {
      void saveWorkspace(workspaceRef.current)
      saveWorkspaceSnapshot(workspaceRef.current)
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
    if (status !== 'ready' || !hydratedRef.current) {
      return
    }

    const snapshotHandle = window.setTimeout(() => {
      saveWorkspaceSnapshot(workspaceRef.current)
    }, 100)

    const dbHandle = window.setTimeout(() => {
      void saveWorkspace(workspaceRef.current)
    }, 300)

    return () => {
      window.clearTimeout(snapshotHandle)
      window.clearTimeout(dbHandle)
    }
  }, [status, workspace])

  return <WorkspaceScreen />
}

export default App
