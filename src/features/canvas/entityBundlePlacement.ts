import type { Workspace } from '../../contracts/workspace'
import {
  getGroupPlacementFrames,
  getVisibleCards,
  isGroupPlacementBlockedByVisibleGroup,
  isPlacementBlockedByOccupiedItem,
} from '../groups/groupLayout'
import { isPlacementAvailable } from '../placement/snapEngine'
import {
  getCanvasEntityBundlePixelBounds,
  getVisibleCanvasEntityBundleNodes,
  normalizeCanvasEntityBundle,
  offsetCanvasEntityBundle,
  type CanvasEntityBundle,
} from './entityBundle'

type NodeFrame = {
  id: string
  position: { x: number; y: number }
  size: { columns: number; rows: number }
}

function toGridCell(value: number, gridSize: number) {
  return Math.round(value / gridSize)
}

function getWorkspacePlaceableNodes(workspace: Workspace) {
  return [
    ...getVisibleCards(workspace.cards, workspace.groups),
    ...workspace.pictures,
  ]
}

function canPlaceNodeFrames(input: {
  frames: NodeFrame[]
  workspace: Workspace
}) {
  const stationaryNodes = getWorkspacePlaceableNodes(input.workspace)
  const stationaryGroups = getGroupPlacementFrames(input.workspace.groups)
  const movingIds = new Set(input.frames.map((frame) => frame.id))
  const availableNodes = stationaryNodes.filter(
    (item) => !movingIds.has(item.id),
  )

  return input.frames.every((frame, _, allFrames) => {
    const siblingFrames = allFrames
      .filter((candidate) => candidate.id !== frame.id)
      .map((candidate) => ({
        id: candidate.id,
        positionX: candidate.position.x,
        positionY: candidate.position.y,
        size: candidate.size,
      }))

    return isPlacementAvailable(
      frame.position,
      frame.size,
      input.workspace.placementGuide,
      {
        cards: [...availableNodes, ...stationaryGroups, ...siblingFrames],
        isOccupiedItemBlocking: (candidate, occupiedItem, guide) =>
          isPlacementBlockedByOccupiedItem({
            candidate,
            gridSize: guide.gridSize,
            occupiedItem,
          }),
      },
    )
  })
}

function canPlaceGroupFrames(input: {
  frames: Array<{
    collapsed?: boolean
    groupId: string
    parentGroupId?: string
    position: { x: number; y: number }
    size: { columns: number; rows: number }
  }>
  workspace: Workspace
}) {
  const movingIds = new Set(input.frames.map((frame) => frame.groupId))
  const rootFrames = input.frames.filter(
    (frame) => !frame.parentGroupId || !movingIds.has(frame.parentGroupId),
  )
  const stationaryGroups = getGroupPlacementFrames(
    input.workspace.groups,
  ).filter((group) => !movingIds.has(group.id))

  return rootFrames.every((frame, _, allFrames) => {
    const siblingFrames = allFrames
      .filter((candidate) => candidate.groupId !== frame.groupId)
      .map((candidate) => ({
        collapsed: candidate.collapsed,
        id: candidate.groupId,
        kind: 'group' as const,
        parentGroupId: candidate.parentGroupId,
        positionX: candidate.position.x,
        positionY: candidate.position.y,
        size: candidate.size,
      }))

    return isPlacementAvailable(
      frame.position,
      frame.size,
      input.workspace.placementGuide,
      {
        cards: [...stationaryGroups, ...siblingFrames],
        isOccupiedItemBlocking: (candidate, occupiedItem, guide) =>
          isGroupPlacementBlockedByVisibleGroup({
            candidate,
            gridSize: guide.gridSize,
            occupiedGroup: occupiedItem,
          }),
      },
    )
  })
}

function getCandidateRing(radius: number) {
  if (radius === 0) {
    return [{ x: 0, y: 0 }]
  }

  const candidates: Array<{ x: number; y: number }> = []

  for (let deltaX = -radius; deltaX <= radius; deltaX += 1) {
    for (let deltaY = -radius; deltaY <= radius; deltaY += 1) {
      if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) !== radius) {
        continue
      }

      candidates.push({ x: deltaX, y: deltaY })
    }
  }

  return candidates.sort((left, right) => {
    const leftDistance = Math.abs(left.x) + Math.abs(left.y)
    const rightDistance = Math.abs(right.x) + Math.abs(right.y)

    if (leftDistance !== rightDistance) {
      return leftDistance - rightDistance
    }

    if (Math.abs(left.y) !== Math.abs(right.y)) {
      return Math.abs(left.y) - Math.abs(right.y)
    }

    if (Math.abs(left.x) !== Math.abs(right.x)) {
      return Math.abs(left.x) - Math.abs(right.x)
    }

    if (left.y !== right.y) {
      return left.y - right.y
    }

    return left.x - right.x
  })
}

export function placeCanvasEntityBundleNearPoint(input: {
  bundle: CanvasEntityBundle
  point: { x: number; y: number }
  workspace: Workspace
}) {
  const normalizedBundle = normalizeCanvasEntityBundle(input.bundle).bundle
  const normalizedBounds = getCanvasEntityBundlePixelBounds(
    normalizedBundle,
    input.workspace.placementGuide.gridSize,
  )

  if (!normalizedBounds) {
    return null
  }

  const gridSize = input.workspace.placementGuide.gridSize
  const targetTopLeft = {
    x: input.point.x - normalizedBounds.width / 2,
    y: input.point.y - normalizedBounds.height / 2,
  }
  const baseCell = {
    x: toGridCell(targetTopLeft.x, gridSize),
    y: toGridCell(targetTopLeft.y, gridSize),
  }

  for (let radius = 0; radius <= 24; radius += 1) {
    const ring = getCandidateRing(radius)

    for (const cellOffset of ring) {
      const candidateBundle = offsetCanvasEntityBundle(normalizedBundle, {
        x: (baseCell.x + cellOffset.x) * gridSize,
        y: (baseCell.y + cellOffset.y) * gridSize,
      })
      const visibleCandidate =
        getVisibleCanvasEntityBundleNodes(candidateBundle)
      const visibleNodeFrames = [
        ...visibleCandidate.visibleCards.map((card) => ({
          id: card.id,
          position: { x: card.positionX, y: card.positionY },
          size: card.size,
        })),
        ...candidateBundle.pictures.map((picture) => ({
          id: picture.id,
          position: { x: picture.positionX, y: picture.positionY },
          size: picture.size,
        })),
      ]
      const visibleGroupFrames = visibleCandidate.visibleGroups.map(
        (group) => ({
          collapsed: group.collapsed,
          groupId: group.id,
          parentGroupId: group.parentGroupId,
          position: { x: group.positionX, y: group.positionY },
          size: group.size,
        }),
      )

      if (
        canPlaceNodeFrames({
          frames: visibleNodeFrames,
          workspace: input.workspace,
        }) &&
        canPlaceGroupFrames({
          frames: visibleGroupFrames,
          workspace: input.workspace,
        })
      ) {
        return {
          bounds: getCanvasEntityBundlePixelBounds(candidateBundle, gridSize),
          bundle: candidateBundle,
        }
      }
    }
  }

  return null
}
