import { useCallback, useState } from 'react'

import type { WorkspaceSummary } from '../../../contracts/workspaceDirectory'
import type { DataStatus, OpenPromptDialog } from './optionsMenuShared'

export type WorkspaceEditorState = {
  name: string
  workspaceId: string
}

type UseWorkspaceDirectoryEditorInput = {
  activeWorkspaceId: string
  deleteWorkspace: (workspaceId: string) => Promise<void>
  moveWorkspace: (workspaceId: string, direction: -1 | 1) => Promise<void>
  openPromptDialog: OpenPromptDialog
  renameWorkspace: (workspaceId: string, name: string) => Promise<void>
}

/**
 * Owns the workspace directory editor state for the Options Menu "Data" tab:
 * inline edit name, reorder, delete with confirmation dialog, and the
 * surrounding `DataStatus` messaging.
 */
export function useWorkspaceDirectoryEditor({
  activeWorkspaceId,
  deleteWorkspace,
  moveWorkspace,
  openPromptDialog,
  renameWorkspace,
}: UseWorkspaceDirectoryEditorInput) {
  const [workspaceEditor, setWorkspaceEditor] =
    useState<WorkspaceEditorState | null>(null)
  const [workspaceStatus, setWorkspaceStatus] = useState<DataStatus>({
    kind: 'idle',
    message: '',
  })

  const resetEditor = useCallback(() => {
    setWorkspaceEditor(null)
  }, [])

  const handleStartWorkspaceEdit = useCallback(
    (workspaceSummary: WorkspaceSummary) => {
      setWorkspaceEditor({
        name: workspaceSummary.name,
        workspaceId: workspaceSummary.id,
      })
      setWorkspaceStatus({ kind: 'idle', message: '' })
    },
    [],
  )

  const handleCancelWorkspaceEdit = useCallback(() => {
    setWorkspaceEditor(null)
    setWorkspaceStatus({ kind: 'idle', message: '' })
  }, [])

  const handleUpdateWorkspaceEditorName = useCallback((name: string) => {
    setWorkspaceEditor((current) =>
      current
        ? {
            ...current,
            name,
          }
        : current,
    )
  }, [])

  const handleSubmitWorkspaceEditor = useCallback(() => {
    if (!workspaceEditor) {
      return
    }

    const trimmedName = workspaceEditor.name.trim()

    if (!trimmedName) {
      setWorkspaceStatus({
        kind: 'error',
        message: 'Workspace names cannot be empty.',
      })
      return
    }

    setWorkspaceStatus({
      kind: 'busy',
      message: `Updating “${trimmedName}”…`,
    })

    void (async () => {
      try {
        await renameWorkspace(workspaceEditor.workspaceId, trimmedName)
        setWorkspaceEditor(null)
        setWorkspaceStatus({
          kind: 'success',
          message: `Updated workspace “${trimmedName}”.`,
        })
      } catch (error) {
        setWorkspaceStatus({
          kind: 'error',
          message:
            error instanceof Error ? error.message : 'Workspace update failed.',
        })
      }
    })()
  }, [renameWorkspace, workspaceEditor])

  const handleMoveWorkspace = useCallback(
    (workspaceSummary: WorkspaceSummary, direction: -1 | 1) => {
      setWorkspaceStatus({
        kind: 'busy',
        message: `Moving “${workspaceSummary.name}”…`,
      })

      void (async () => {
        try {
          await moveWorkspace(workspaceSummary.id, direction)
          setWorkspaceStatus({
            kind: 'success',
            message: `Moved “${workspaceSummary.name}”.`,
          })
        } catch (error) {
          setWorkspaceStatus({
            kind: 'error',
            message:
              error instanceof Error
                ? error.message
                : 'Workspace reorder failed.',
          })
        }
      })()
    },
    [moveWorkspace],
  )

  const handleDeleteWorkspace = useCallback(
    (workspaceSummary: WorkspaceSummary) => {
      openPromptDialog({
        description:
          workspaceSummary.id === activeWorkspaceId
            ? `“${workspaceSummary.name}” will be removed and the next available workspace will be opened.`
            : `“${workspaceSummary.name}” will be removed from this device.`,
        eyebrow: 'Workspaces',
        onPrimaryAction: () => {
          setWorkspaceStatus({
            kind: 'busy',
            message: `Deleting “${workspaceSummary.name}”…`,
          })

          setWorkspaceEditor((current) =>
            current?.workspaceId === workspaceSummary.id ? null : current,
          )

          void (async () => {
            try {
              await deleteWorkspace(workspaceSummary.id)
              setWorkspaceStatus({
                kind: 'success',
                message: `Deleted workspace “${workspaceSummary.name}”.`,
              })
            } catch (error) {
              setWorkspaceStatus({
                kind: 'error',
                message:
                  error instanceof Error
                    ? error.message
                    : 'Workspace delete failed.',
              })
            }
          })()
        },
        primaryLabel: 'Delete workspace',
        role: 'alertdialog',
        secondaryLabel: 'Cancel',
        title: 'Delete workspace?',
        tone: 'danger',
      })
    },
    [activeWorkspaceId, deleteWorkspace, openPromptDialog],
  )

  return {
    handleCancelWorkspaceEdit,
    handleDeleteWorkspace,
    handleMoveWorkspace,
    handleStartWorkspaceEdit,
    handleSubmitWorkspaceEditor,
    handleUpdateWorkspaceEditorName,
    resetEditor,
    workspaceEditor,
    workspaceStatus,
  }
}
