import { useCallback, useMemo } from 'react'

import type { CardGroup } from '../../../contracts/cardGroup'
import type { CardSize, LinkCard } from '../../../contracts/linkCard'
import type { PictureNode } from '../../../contracts/pictureNode'
import type { PlacementGuide } from '../../../contracts/placementGuide'
import {
  getGroupPlacementFrames,
  getVisibleCards,
  isGroupPlacementBlockedByVisibleGroup,
  isPlacementBlockedByOccupiedItem,
} from '../../../features/groups/groupLayout'
import {
  createOccupancyIndex,
  isPlacementAvailable,
} from '../../../features/placement/snapEngine'

export type CardFrame = {
  cardId: string
  position: { x: number; y: number }
  size: CardSize
}

export type GroupFrame = {
  collapsed?: boolean
  groupId: string
  parentGroupId?: string
  position: { x: number; y: number }
  size: CardSize
}

type UsePlacementFramesArgs = {
  placementGuide: PlacementGuide
  workspaceCards: LinkCard[]
  workspaceGroups: CardGroup[]
  workspacePictures: PictureNode[]
}

export function usePlacementFrames({
  placementGuide,
  workspaceCards,
  workspaceGroups,
  workspacePictures,
}: UsePlacementFramesArgs) {
  const visibleCards = useMemo(
    () => getVisibleCards(workspaceCards, workspaceGroups),
    [workspaceCards, workspaceGroups],
  )
  const visiblePlaceableNodes = useMemo(
    () => [...visibleCards, ...workspacePictures],
    [visibleCards, workspacePictures],
  )
  const groupPlacementFrames = useMemo(
    () => getGroupPlacementFrames(workspaceGroups),
    [workspaceGroups],
  )
  const nodePlacementFrames = useMemo(
    () => [...visiblePlaceableNodes, ...groupPlacementFrames],
    [groupPlacementFrames, visiblePlaceableNodes],
  )

  const canPlaceCardFrames = useCallback(
    (frames: CardFrame[]) => {
      const movingIds = new Set(frames.map((frame) => frame.cardId))
      const stationaryCards = nodePlacementFrames.filter(
        (item) => !movingIds.has(item.id),
      )
      const frameItems = frames.map((candidate) => ({
        id: candidate.cardId,
        positionX: candidate.position.x,
        positionY: candidate.position.y,
        size: candidate.size,
      }))
      // Occupancy-Index einmal pro Aufruf bauen statt pro Frame in
      // `isPlacementAvailable`. Das Self-Overlap des jeweiligen
      // Frames wird ueber `isOccupiedItemBlocking` ausgefiltert.
      const occupancyIndex = createOccupancyIndex(
        [...stationaryCards, ...frameItems],
        placementGuide,
      )

      return frames.every((frame) =>
        isPlacementAvailable(frame.position, frame.size, placementGuide, {
          occupancyIndex,
          isOccupiedItemBlocking: (candidate, occupiedItem, guide) => {
            if (occupiedItem.id === frame.cardId) {
              return false
            }

            return isPlacementBlockedByOccupiedItem({
              candidate,
              gridSize: guide.gridSize,
              occupiedItem,
            })
          },
        }),
      )
    },
    [nodePlacementFrames, placementGuide],
  )

  const canPlaceGroupFrames = useCallback(
    (frames: GroupFrame[]) => {
      const movingIds = new Set(frames.map((frame) => frame.groupId))
      const rootFrames = frames.filter(
        (frame) => !frame.parentGroupId || !movingIds.has(frame.parentGroupId),
      )
      const stationaryGroups = groupPlacementFrames.filter(
        (group) => !movingIds.has(group.id),
      )
      const frameItems = rootFrames.map((candidate) => ({
        collapsed: candidate.collapsed,
        id: candidate.groupId,
        kind: 'group' as const,
        parentGroupId: candidate.parentGroupId,
        positionX: candidate.position.x,
        positionY: candidate.position.y,
        size: candidate.size,
      }))
      const occupancyIndex = createOccupancyIndex(
        [...stationaryGroups, ...frameItems],
        placementGuide,
      )

      return rootFrames.every((frame) =>
        isPlacementAvailable(frame.position, frame.size, placementGuide, {
          occupancyIndex,
          isOccupiedItemBlocking: (candidate, occupiedItem, guide) => {
            if (occupiedItem.id === frame.groupId) {
              return false
            }

            return isGroupPlacementBlockedByVisibleGroup({
              candidate,
              gridSize: guide.gridSize,
              occupiedGroup: occupiedItem,
            })
          },
        }),
      )
    },
    [groupPlacementFrames, placementGuide],
  )

  return {
    canPlaceCardFrames,
    canPlaceGroupFrames,
    groupPlacementFrames,
    nodePlacementFrames,
    visibleCards,
    visiblePlaceableNodes,
  }
}

export type PlacementFrames = ReturnType<typeof usePlacementFrames>
