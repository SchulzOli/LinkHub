import { resetAppearanceNonColorOptions as resetAppearanceNonColorOptionsValue } from '../contracts/appearanceProfile'
import { type Workspace } from '../contracts/workspace'
import {
  removeGroupSubtrees,
  removeSelectionWithGroups,
  syncWorkspaceGroupMembership,
} from '../features/groups/groupService'
import type {
  WorkspaceState,
  WorkspaceUndoSnapshot,
} from './workspaceStoreTypes'

export const MAX_UNDO_HISTORY = 100

/**
 * Returns the workspace merged with the current session viewport, so
 * persistence layers see the latest pan/zoom without the viewport being
 * part of the hot-path workspace reference.
 */
export function getPersistedWorkspace(state: WorkspaceState): Workspace {
  return { ...state.workspace, viewport: state.viewport }
}

export function createUndoSnapshot(
  workspace: Workspace,
): WorkspaceUndoSnapshot {
  return {
    id: workspace.id,
    name: workspace.name,
    appearance: workspace.appearance,
    placementGuide: workspace.placementGuide,
    groups: workspace.groups,
    cards: workspace.cards,
    pictures: workspace.pictures,
    createdAt: workspace.createdAt,
  }
}

export function restoreUndoSnapshot(
  currentWorkspace: Workspace,
  snapshot: WorkspaceUndoSnapshot,
): Workspace {
  return {
    ...currentWorkspace,
    ...snapshot,
    viewport: currentWorkspace.viewport,
    updatedAt: new Date().toISOString(),
  }
}

export function areUndoSnapshotsEqual(left: Workspace, right: Workspace) {
  return (
    left.id === right.id &&
    left.name === right.name &&
    left.appearance === right.appearance &&
    left.placementGuide === right.placementGuide &&
    left.groups === right.groups &&
    left.cards === right.cards &&
    left.pictures === right.pictures &&
    left.createdAt === right.createdAt
  )
}

export function commitWorkspaceChange(
  state: WorkspaceState,
  nextWorkspace: Workspace,
  overrides?: Partial<WorkspaceState>,
) {
  if (areUndoSnapshotsEqual(state.workspace, nextWorkspace)) {
    return {
      ...overrides,
      workspace: nextWorkspace,
    }
  }

  const undoStack = [
    ...state.undoStack,
    createUndoSnapshot(state.workspace),
  ].slice(-MAX_UNDO_HISTORY)

  return {
    ...overrides,
    undoStack,
    workspace: nextWorkspace,
  }
}

export function syncWorkspaceGrouping(workspace: Workspace) {
  return syncWorkspaceGroupMembership(workspace)
}

export function removeGroupSubtreesFromWorkspace(
  workspace: Workspace,
  groupIds: string[],
) {
  return removeGroupSubtrees(workspace, groupIds)
}

export function removeSelectionFromWorkspace(
  workspace: Workspace,
  input: { cardIds: string[]; groupIds: string[]; pictureIds: string[] },
) {
  return removeSelectionWithGroups(workspace, input)
}

export function resetAppearanceNonColorOptions(workspace: Workspace) {
  return {
    ...workspace,
    appearance: resetAppearanceNonColorOptionsValue(workspace.appearance),
  }
}
