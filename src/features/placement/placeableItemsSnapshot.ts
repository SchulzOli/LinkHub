import { useWorkspaceStore } from '../../state/useWorkspaceStore'
import { getGroupPlacementFrames, getVisibleCards } from '../groups/groupLayout'
import type { PlaceableItem } from './placementTypes'

/**
 * Reads a fresh snapshot of all placeable items (visible cards + pictures +
 * group placement frames) from the workspace store without subscribing.
 *
 * Used by drag/resize handlers at pointerdown time so that individual node
 * components (`LinkCard`, `PictureNode`, …) do not need the full list as a
 * prop — which would make every sibling re-render whenever any card moves.
 */
export function getPlaceableItemsSnapshot(): PlaceableItem[] {
  const { workspace } = useWorkspaceStore.getState()
  const visibleCards = getVisibleCards(workspace.cards, workspace.groups)
  const groupFrames = getGroupPlacementFrames(workspace.groups)

  return [...visibleCards, ...workspace.pictures, ...groupFrames]
}
