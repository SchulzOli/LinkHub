import { useCallback } from 'react'

import {
  getDefaultGroupSize,
  type CardGroup,
} from '../../../contracts/cardGroup'
import type { Viewport, Workspace } from '../../../contracts/workspace'
import { getCardColorsFromAppearance } from '../../../features/appearance/cardColorPalette'
import { getCardPixelDimensions } from '../../../features/appearance/themeTokens'
import { createCardGroup } from '../../../features/groups/groupCreation'
import { screenPointToCanvas } from '../../../features/placement/canvasMath'
import { applySnap } from '../../../features/placement/snapEngine'

import type { PlacementFrames } from './usePlacementFrames'

type UseGroupActionsArgs = {
  addGroup: (group: CardGroup) => void
  interactionMode: 'edit' | 'view'
  moveGroup: (
    groupId: string,
    position: { x: number; y: number },
    pictureIds?: string[],
  ) => void
  placementFrames: Pick<PlacementFrames, 'groupPlacementFrames'>
  toggleInteractionMode: (value?: 'edit' | 'view') => void
  updateGroup: (
    groupId: string,
    updates: Partial<
      Pick<
        CardGroup,
        | 'name'
        | 'size'
        | 'cornerRadius'
        | 'showTitle'
        | 'positionX'
        | 'positionY'
        | 'fillPresetIndex'
        | 'borderPresetIndex'
        | 'fillColor'
        | 'borderColor'
        | 'surfaceTransparency'
        | 'shadowStyle'
      >
    >,
  ) => void
  viewport: Viewport
  workspace: Workspace
  workspaceGroups: CardGroup[]
}

export function useGroupActions({
  addGroup,
  interactionMode,
  moveGroup,
  placementFrames,
  toggleInteractionMode,
  updateGroup,
  viewport,
  workspace,
  workspaceGroups,
}: UseGroupActionsArgs) {
  const { groupPlacementFrames } = placementFrames

  const createGroupAtViewportCenter = useCallback(() => {
    const center = screenPointToCanvas(
      { x: window.innerWidth / 2, y: window.innerHeight / 2 },
      viewport,
    )
    const groupSize = getDefaultGroupSize(
      workspace.appearance.defaultCardSize,
      workspace.placementGuide.gridSize,
    )
    const groupDimensions = getCardPixelDimensions(
      groupSize,
      workspace.placementGuide.gridSize,
    )
    const position = applySnap(
      {
        x: center.x - groupDimensions.width / 2,
        y: center.y - groupDimensions.height / 2,
      },
      workspace.placementGuide,
      groupSize,
      {
        force: true,
        cards: groupPlacementFrames,
      },
    )

    const group = createCardGroup({
      name: `Group ${workspaceGroups.length + 1}`,
      position,
      size: groupSize,
      ...getCardColorsFromAppearance(workspace.appearance),
    })

    if (interactionMode !== 'edit') {
      toggleInteractionMode('edit')
    }

    addGroup(group)
  }, [
    addGroup,
    groupPlacementFrames,
    interactionMode,
    toggleInteractionMode,
    workspace.appearance,
    workspace.placementGuide,
    viewport,
    workspaceGroups.length,
  ])

  const handleUpdateGroup = useCallback<UseGroupActionsArgs['updateGroup']>(
    (groupId, updates) => {
      const existingGroup = workspaceGroups.find(
        (group) => group.id === groupId,
      )

      if (!existingGroup) {
        return
      }

      if (updates.positionX !== undefined && updates.positionY !== undefined) {
        updateGroup(groupId, updates)
        return
      }

      updateGroup(groupId, {
        ...updates,
        positionX: updates.positionX ?? existingGroup.positionX,
        positionY: updates.positionY ?? existingGroup.positionY,
      })
    },
    [updateGroup, workspaceGroups],
  )

  const handleMoveGroup = useCallback(
    (
      groupId: string,
      position: { x: number; y: number },
      pictureIds?: string[],
    ) => {
      moveGroup(groupId, position, pictureIds)
    },
    [moveGroup],
  )

  return {
    createGroupAtViewportCenter,
    handleMoveGroup,
    handleUpdateGroup,
  }
}
