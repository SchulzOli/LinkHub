import type { StateCreator } from 'zustand'

import { saveWorkspaceDirectory } from '../../storage/workspaceRepository'
import { restoreUndoSnapshot } from '../workspaceStoreHelpers'
import type { WorkspaceState, WorkspaceUIState } from '../workspaceStoreTypes'

export const createWorkspaceUISlice: StateCreator<
  WorkspaceState,
  [],
  [],
  WorkspaceUIState
> = (set) => ({
  status: 'loading',
  interactionMode: 'edit',
  quickAddOpen: false,
  optionsMenuOpen: false,
  autoEditTarget: null,
  formatPainter: null,
  setStatus: (status) => set({ status }),
  hydrateWorkspace: (workspace) =>
    set({
      undoStack: [],
      workspace,
      status: 'ready',
      optionsMenuOpen: false,
      quickAddOpen: false,
      selectedCardIds: [],
      selectedGroupIds: [],
      selectedPictureIds: [],
      autoEditTarget: null,
      formatPainter: null,
    }),
  undoWorkspace: () =>
    set((state) => {
      const previousWorkspace = state.undoStack.at(-1)

      if (!previousWorkspace) {
        return state
      }

      return {
        autoEditTarget: null,
        formatPainter: null,
        selectedCardIds: [],
        selectedGroupIds: [],
        selectedPictureIds: [],
        undoStack: state.undoStack.slice(0, -1),
        workspace: restoreUndoSnapshot(state.workspace, previousWorkspace),
      }
    }),
  toggleInteractionMode: (value) =>
    set((state) => {
      const interactionMode =
        value ?? (state.interactionMode === 'edit' ? 'view' : 'edit')

      if (state.workspaceSummaries.length > 0) {
        void saveWorkspaceDirectory({
          activeWorkspaceId: state.activeWorkspaceId,
          interactionMode,
          workspaceRailPinned: state.workspaceRailPinned,
          workspaces: state.workspaceSummaries,
        })
      }

      return {
        interactionMode,
        quickAddOpen: false,
        optionsMenuOpen: false,
        selectedCardIds: [],
        selectedGroupIds: [],
        selectedPictureIds: [],
        autoEditTarget: null,
        formatPainter: null,
      }
    }),
  toggleQuickAdd: (value) =>
    set((state) => ({
      quickAddOpen: value ?? !state.quickAddOpen,
      optionsMenuOpen:
        value === true || (value === undefined && !state.quickAddOpen)
          ? false
          : state.optionsMenuOpen,
    })),
  toggleOptionsMenu: (value) =>
    set((state) => ({
      optionsMenuOpen: value ?? !state.optionsMenuOpen,
      quickAddOpen:
        value === true || (value === undefined && !state.optionsMenuOpen)
          ? false
          : state.quickAddOpen,
    })),
  setAutoEditTarget: (autoEditTarget) => set({ autoEditTarget }),
  clearAutoEditTarget: () => set({ autoEditTarget: null }),
  startFormatPainter: (formatPainter) => set({ formatPainter }),
  clearFormatPainter: () => set({ formatPainter: null }),
})
