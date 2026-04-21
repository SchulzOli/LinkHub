import type { StateCreator } from 'zustand'

import { createDefaultWorkspace } from '../../contracts/workspace'
import { createWorkspaceSummary } from '../../contracts/workspaceDirectory'
import {
  createWorkspaceRecord,
  deleteWorkspaceRecord,
  loadWorkspace,
  saveWorkspace,
  saveWorkspaceDirectory,
  saveWorkspaceSnapshot,
} from '../../storage/workspaceRepository'
import { createId } from '../../utils/id'
import { getPersistedWorkspace } from '../workspaceStoreHelpers'
import type {
  WorkspaceManagementState,
  WorkspaceState,
} from '../workspaceStoreTypes'

function createImportedWorkspaceName(
  name: string,
  workspaceSummaries: WorkspaceState['workspaceSummaries'],
) {
  const baseName = name.trim() || 'Imported workspace'
  const existingNames = new Set(
    workspaceSummaries.map((workspace) => workspace.name.trim().toLowerCase()),
  )

  if (!existingNames.has(baseName.toLowerCase())) {
    return baseName
  }

  let suffix = 2
  let candidateName = `${baseName} (${suffix})`

  while (existingNames.has(candidateName.toLowerCase())) {
    suffix += 1
    candidateName = `${baseName} (${suffix})`
  }

  return candidateName
}

function createWorkspaceSessionState(input: {
  activeWorkspaceId: string
  interactionMode: WorkspaceState['interactionMode']
  workspace: WorkspaceState['workspace']
  workspaceRailPinned: boolean
  workspaceSummaries: WorkspaceState['workspaceSummaries']
}) {
  return {
    activeWorkspaceId: input.activeWorkspaceId,
    autoEditTarget: null,
    formatPainter: null,
    optionsMenuOpen: false,
    quickAddOpen: false,
    selectedCardIds: [],
    selectedGroupIds: [],
    selectedPictureIds: [],
    status: 'ready' as const,
    undoStack: [],
    workspace: input.workspace,
    viewport: input.workspace.viewport,
    workspaceRailOpen: input.workspaceRailPinned,
    workspaceRailPinned: input.workspaceRailPinned,
    workspaceSummaries: input.workspaceSummaries,
    interactionMode: input.interactionMode,
  }
}

export const createWorkspaceManagementSlice: StateCreator<
  WorkspaceState,
  [],
  [],
  WorkspaceManagementState
> = (set, get) => ({
  activeWorkspaceId: 'default',
  workspaceRailOpen: false,
  workspaceRailPinned: false,
  workspaceSummaries: [],
  initializeWorkspaceSession: (input) =>
    set(() => createWorkspaceSessionState(input)),
  createWorkspace: async () => {
    const state = get()
    const nextWorkspace = createWorkspaceRecord(state.workspaceSummaries)
    const nextWorkspaceSummaries = [
      ...state.workspaceSummaries,
      createWorkspaceSummary(nextWorkspace),
    ]
    const nextDirectory = {
      activeWorkspaceId: nextWorkspace.id,
      interactionMode: state.interactionMode,
      workspaceRailPinned: state.workspaceRailPinned,
      workspaces: nextWorkspaceSummaries,
    }

    await saveWorkspace(getPersistedWorkspace(state))
    await Promise.all([
      saveWorkspace(nextWorkspace),
      saveWorkspaceDirectory(nextDirectory),
    ])

    set((currentState) =>
      createWorkspaceSessionState({
        activeWorkspaceId: nextWorkspace.id,
        interactionMode: currentState.interactionMode,
        workspace: nextWorkspace,
        workspaceRailPinned: nextDirectory.workspaceRailPinned,
        workspaceSummaries: nextWorkspaceSummaries,
      }),
    )
  },
  importWorkspace: async (workspace) => {
    const state = get()
    const now = new Date().toISOString()
    const nextWorkspace = {
      ...workspace,
      id: createId(),
      name: createImportedWorkspaceName(
        workspace.name,
        state.workspaceSummaries,
      ),
      createdAt: now,
      updatedAt: now,
    }
    const nextWorkspaceSummaries = [
      ...state.workspaceSummaries,
      createWorkspaceSummary(nextWorkspace),
    ]
    const nextDirectory = {
      activeWorkspaceId: nextWorkspace.id,
      interactionMode: state.interactionMode,
      workspaceRailPinned: state.workspaceRailPinned,
      workspaces: nextWorkspaceSummaries,
    }

    await saveWorkspace(getPersistedWorkspace(state))
    saveWorkspaceSnapshot(nextWorkspace)

    await Promise.all([
      saveWorkspace(nextWorkspace),
      saveWorkspaceDirectory(nextDirectory),
    ])

    set((currentState) =>
      createWorkspaceSessionState({
        activeWorkspaceId: nextWorkspace.id,
        interactionMode: currentState.interactionMode,
        workspace: nextWorkspace,
        workspaceRailPinned: nextDirectory.workspaceRailPinned,
        workspaceSummaries: nextWorkspaceSummaries,
      }),
    )
  },
  deleteWorkspace: async (workspaceId) => {
    const state = get()

    if (state.workspaceSummaries.length <= 1) {
      return
    }

    const workspaceIndex = state.workspaceSummaries.findIndex(
      (workspace) => workspace.id === workspaceId,
    )

    if (workspaceIndex === -1) {
      return
    }

    const nextWorkspaceSummaries = state.workspaceSummaries.filter(
      (workspace) => workspace.id !== workspaceId,
    )

    if (workspaceId !== state.activeWorkspaceId) {
      await Promise.all([
        deleteWorkspaceRecord(workspaceId),
        saveWorkspaceDirectory({
          activeWorkspaceId: state.activeWorkspaceId,
          interactionMode: state.interactionMode,
          workspaceRailPinned: state.workspaceRailPinned,
          workspaces: nextWorkspaceSummaries,
        }),
      ])

      set({
        workspaceSummaries: nextWorkspaceSummaries,
      })
      return
    }

    const nextWorkspaceSummary =
      nextWorkspaceSummaries[Math.max(0, workspaceIndex - 1)] ??
      nextWorkspaceSummaries[0]

    if (!nextWorkspaceSummary) {
      return
    }

    const nextWorkspace =
      (await loadWorkspace(nextWorkspaceSummary.id)) ??
      createDefaultWorkspace({
        id: nextWorkspaceSummary.id,
        name: nextWorkspaceSummary.name,
      })
    const nextDirectory = {
      activeWorkspaceId: nextWorkspace.id,
      interactionMode: state.interactionMode,
      workspaceRailPinned: state.workspaceRailPinned,
      workspaces: nextWorkspaceSummaries,
    }

    saveWorkspaceSnapshot(nextWorkspace)

    await Promise.all([
      deleteWorkspaceRecord(workspaceId),
      saveWorkspace(nextWorkspace),
      saveWorkspaceDirectory(nextDirectory),
    ])

    set((currentState) =>
      createWorkspaceSessionState({
        activeWorkspaceId: nextWorkspace.id,
        interactionMode: currentState.interactionMode,
        workspace: nextWorkspace,
        workspaceRailPinned: nextDirectory.workspaceRailPinned,
        workspaceSummaries: nextWorkspaceSummaries,
      }),
    )
  },
  moveWorkspace: async (workspaceId, direction) => {
    const state = get()
    const workspaceIndex = state.workspaceSummaries.findIndex(
      (workspace) => workspace.id === workspaceId,
    )

    if (workspaceIndex === -1) {
      return
    }

    const nextIndex = workspaceIndex + direction

    if (nextIndex < 0 || nextIndex >= state.workspaceSummaries.length) {
      return
    }

    const nextWorkspaceSummaries = [...state.workspaceSummaries]
    const [movedWorkspace] = nextWorkspaceSummaries.splice(workspaceIndex, 1)

    nextWorkspaceSummaries.splice(nextIndex, 0, movedWorkspace)

    await saveWorkspaceDirectory({
      activeWorkspaceId: state.activeWorkspaceId,
      interactionMode: state.interactionMode,
      workspaceRailPinned: state.workspaceRailPinned,
      workspaces: nextWorkspaceSummaries,
    })

    set({
      workspaceSummaries: nextWorkspaceSummaries,
    })
  },
  renameWorkspace: async (workspaceId, name) => {
    const state = get()
    const trimmedName = name.trim()

    if (!trimmedName) {
      return
    }

    const nextWorkspaceSummaries = state.workspaceSummaries.map((workspace) =>
      workspace.id === workspaceId
        ? createWorkspaceSummary({
            id: workspace.id,
            name: trimmedName,
          })
        : workspace,
    )
    const nextDirectory = {
      activeWorkspaceId: state.activeWorkspaceId,
      interactionMode: state.interactionMode,
      workspaceRailPinned: state.workspaceRailPinned,
      workspaces: nextWorkspaceSummaries,
    }

    if (workspaceId === state.activeWorkspaceId) {
      const nextWorkspace = {
        ...state.workspace,
        viewport: state.viewport,
        name: trimmedName,
      }

      saveWorkspaceSnapshot(nextWorkspace)

      await Promise.all([
        saveWorkspace(nextWorkspace),
        saveWorkspaceDirectory(nextDirectory),
      ])

      set({
        workspace: nextWorkspace,
        workspaceSummaries: nextWorkspaceSummaries,
      })
      return
    }

    const storedWorkspace = await loadWorkspace(workspaceId)

    await Promise.all([
      storedWorkspace
        ? saveWorkspace({
            ...storedWorkspace,
            name: trimmedName,
          })
        : Promise.resolve(),
      saveWorkspaceDirectory(nextDirectory),
    ])

    set({
      workspaceSummaries: nextWorkspaceSummaries,
    })
  },
  switchWorkspace: async (workspaceId) => {
    const state = get()

    if (workspaceId === state.activeWorkspaceId) {
      set({
        workspaceRailOpen: state.workspaceRailPinned,
      })
      return
    }

    const nextWorkspace = await loadWorkspace(workspaceId)

    if (!nextWorkspace) {
      return
    }

    const nextWorkspaceSummaries = state.workspaceSummaries.some(
      (workspace) => workspace.id === nextWorkspace.id,
    )
      ? state.workspaceSummaries.map((workspace) =>
          workspace.id === nextWorkspace.id
            ? createWorkspaceSummary(nextWorkspace)
            : workspace,
        )
      : [...state.workspaceSummaries, createWorkspaceSummary(nextWorkspace)]
    const nextDirectory = {
      activeWorkspaceId: nextWorkspace.id,
      interactionMode: state.interactionMode,
      workspaceRailPinned: state.workspaceRailPinned,
      workspaces: nextWorkspaceSummaries,
    }

    await saveWorkspace(getPersistedWorkspace(state))
    await saveWorkspaceDirectory(nextDirectory)

    set((currentState) =>
      createWorkspaceSessionState({
        activeWorkspaceId: nextWorkspace.id,
        interactionMode: currentState.interactionMode,
        workspace: nextWorkspace,
        workspaceRailPinned: nextDirectory.workspaceRailPinned,
        workspaceSummaries: nextWorkspaceSummaries,
      }),
    )
  },
  toggleWorkspaceRail: (value) =>
    set((state) => ({
      workspaceRailOpen: value ?? !state.workspaceRailOpen,
    })),
  toggleWorkspaceRailPinned: (value) =>
    set((state) => {
      const workspaceRailPinned = value ?? !state.workspaceRailPinned

      void saveWorkspaceDirectory({
        activeWorkspaceId: state.activeWorkspaceId,
        interactionMode: state.interactionMode,
        workspaceRailPinned,
        workspaces: state.workspaceSummaries,
      })

      return {
        workspaceRailOpen: workspaceRailPinned ? true : state.workspaceRailOpen,
        workspaceRailPinned,
      }
    }),
})
