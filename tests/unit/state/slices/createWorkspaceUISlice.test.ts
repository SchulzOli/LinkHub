import { beforeEach, describe, expect, it, vi } from 'vitest'
import { create, type StoreApi } from 'zustand'

import { createDefaultWorkspace } from '../../../../src/contracts/workspace'
import { createWorkspaceUISlice } from '../../../../src/state/slices/createWorkspaceUISlice'
import type { WorkspaceState } from '../../../../src/state/workspaceStoreTypes'

vi.mock('../../../../src/storage/workspaceRepository', async () => {
  const actual = await vi.importActual<
    typeof import('../../../../src/storage/workspaceRepository')
  >('../../../../src/storage/workspaceRepository')

  return {
    ...actual,
    saveWorkspaceDirectory: vi.fn(async () => undefined),
  }
})

import { saveWorkspaceDirectory } from '../../../../src/storage/workspaceRepository'

type UIStore = StoreApi<WorkspaceState>

function createStore(overrides?: Partial<WorkspaceState>): UIStore {
  return create<WorkspaceState>(
    (set, get, api) =>
      ({
        // Baseline fields the slice reads from state. Cast because we only need
        // the subset used by createWorkspaceUISlice internals.
        workspace: createDefaultWorkspace(),
        undoStack: [],
        viewport: createDefaultWorkspace().viewport,
        activeWorkspaceId: 'default',
        workspaceSummaries: [],
        workspaceRailPinned: false,
        selectedCardIds: [],
        selectedGroupIds: [],
        selectedPictureIds: [],
        ...(createWorkspaceUISlice(
          set as never,
          get as never,
          api as never,
        ) as Record<string, unknown>),
        ...overrides,
      }) as unknown as WorkspaceState,
  )
}

let store: UIStore

beforeEach(() => {
  store = createStore()
  vi.mocked(saveWorkspaceDirectory).mockClear()
})

describe('createWorkspaceUISlice', () => {
  it('hydrateWorkspace replaces the workspace and clears transient UI state', () => {
    const workspace = createDefaultWorkspace({
      id: 'ws-1',
      name: 'Hydrated',
    })

    store.getState().hydrateWorkspace(workspace)

    const state = store.getState()
    expect(state.status).toBe('ready')
    expect(state.workspace.id).toBe('ws-1')
    expect(state.viewport).toEqual(workspace.viewport)
    expect(state.undoStack).toEqual([])
    expect(state.selectedCardIds).toEqual([])
    expect(state.quickAddOpen).toBe(false)
    expect(state.optionsMenuOpen).toBe(false)
    expect(state.autoEditTarget).toBeNull()
    expect(state.formatPainter).toBeNull()
  })

  it('undoWorkspace is a no-op when the undo stack is empty', () => {
    const before = store.getState().workspace

    store.getState().undoWorkspace()

    expect(store.getState().workspace).toBe(before)
  })

  it('toggleQuickAdd flips or sets the value and closes options menu', () => {
    store.getState().toggleQuickAdd()
    expect(store.getState().quickAddOpen).toBe(true)

    store.getState().toggleQuickAdd()
    expect(store.getState().quickAddOpen).toBe(false)

    store.getState().toggleQuickAdd(true)
    expect(store.getState().quickAddOpen).toBe(true)
  })

  it('toggleOptionsMenu flips or sets the value and closes quick add', () => {
    store.getState().toggleOptionsMenu()
    expect(store.getState().optionsMenuOpen).toBe(true)

    store.getState().toggleOptionsMenu(false)
    expect(store.getState().optionsMenuOpen).toBe(false)
  })

  it('setAutoEditTarget/clearAutoEditTarget manage the edit hint target', () => {
    store.getState().setAutoEditTarget({ type: 'card', id: 'c-1' })
    expect(store.getState().autoEditTarget).toEqual({ type: 'card', id: 'c-1' })

    store.getState().clearAutoEditTarget()
    expect(store.getState().autoEditTarget).toBeNull()
  })

  it('startFormatPainter/clearFormatPainter toggle the active painter', () => {
    const painter = { source: 'card' as const, cardId: 'c-1' }

    store.getState().startFormatPainter(painter as never)
    expect(store.getState().formatPainter).toEqual(painter)

    store.getState().clearFormatPainter()
    expect(store.getState().formatPainter).toBeNull()
  })

  it('setStatus updates the status field', () => {
    store.getState().setStatus('ready')
    expect(store.getState().status).toBe('ready')
  })

  it('toggleInteractionMode flips edit<->view and persists when summaries exist', () => {
    store = createStore({
      workspaceSummaries: [
        {
          id: 'default',
          name: 'Default',
          updatedAt: '2026-04-01T00:00:00.000Z',
        } as never,
      ],
    })
    vi.mocked(saveWorkspaceDirectory).mockClear()

    store.getState().toggleInteractionMode()
    expect(store.getState().interactionMode).toBe('view')
    expect(vi.mocked(saveWorkspaceDirectory)).toHaveBeenCalledTimes(1)

    store.getState().toggleInteractionMode('edit')
    expect(store.getState().interactionMode).toBe('edit')
  })

  it('toggleInteractionMode does not persist when there are no summaries', () => {
    store.getState().toggleInteractionMode()
    expect(vi.mocked(saveWorkspaceDirectory)).not.toHaveBeenCalled()
  })
})
