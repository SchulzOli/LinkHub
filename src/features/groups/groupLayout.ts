import {
  getGroupBodyBounds,
  getGroupLayoutSize,
  type CardGroup,
} from '../../contracts/cardGroup'
import type { LinkCard } from '../../contracts/linkCard'
import type { PictureNode } from '../../contracts/pictureNode'
import type { PlaceableItem } from '../placement/placementTypes'
import {
  getEntityPixelBounds,
  getGroupsById,
  hasCollapsedGroupInChain,
  isWithinGroupBodyBounds,
} from './groupUtils'

type LayoutEntity = Pick<PlaceableItem, 'positionX' | 'positionY' | 'size'>

type GroupVisibilityFrame = CardGroup & {
  kind: 'group'
  size: CardGroup['size']
}

export function getGroupDepth(groups: CardGroup[], groupId: string) {
  const groupsById = getGroupsById(groups)
  let currentGroupId = groupsById.get(groupId)?.parentGroupId
  let depth = 0

  while (currentGroupId) {
    depth += 1
    currentGroupId = groupsById.get(currentGroupId)?.parentGroupId
  }

  return depth
}

export function getGroupDescendantIds(groups: CardGroup[], groupId: string) {
  const descendantIds: string[] = []
  const queue = groups
    .filter((group) => group.parentGroupId === groupId)
    .map((group) => group.id)

  while (queue.length > 0) {
    const currentGroupId = queue.shift()

    if (!currentGroupId) {
      continue
    }

    descendantIds.push(currentGroupId)

    for (const childGroup of groups) {
      if (childGroup.parentGroupId === currentGroupId) {
        queue.push(childGroup.id)
      }
    }
  }

  return descendantIds
}

export function getGroupSubtreeGroupIds(groups: CardGroup[], groupId: string) {
  return [groupId, ...getGroupDescendantIds(groups, groupId)]
}

export function getRootSelectedGroupIds(
  groups: CardGroup[],
  selectedGroupIds: string[],
) {
  const selectedGroupIdSet = new Set(selectedGroupIds)
  const groupsById = getGroupsById(groups)

  return selectedGroupIds.filter((groupId) => {
    let currentGroupId = groupsById.get(groupId)?.parentGroupId

    while (currentGroupId) {
      if (selectedGroupIdSet.has(currentGroupId)) {
        return false
      }

      currentGroupId = groupsById.get(currentGroupId)?.parentGroupId
    }

    return true
  })
}

export function getSelectedGroupSubtree(input: {
  cards: LinkCard[]
  groups: CardGroup[]
  selectedGroupIds: string[]
}) {
  const rootGroupIds = getRootSelectedGroupIds(
    input.groups,
    input.selectedGroupIds,
  )
  const subtreeGroupIds = Array.from(
    new Set(
      rootGroupIds.flatMap((groupId) =>
        getGroupSubtreeGroupIds(input.groups, groupId),
      ),
    ),
  )
  const subtreeGroupIdSet = new Set(subtreeGroupIds)
  const subtreeCardIds = input.cards
    .filter((card) => card.groupId && subtreeGroupIdSet.has(card.groupId))
    .map((card) => card.id)

  return {
    cardIds: subtreeCardIds,
    groupIds: subtreeGroupIds,
    rootGroupIds,
  }
}

export function getGroupSubtreeCardIds(
  cards: LinkCard[],
  groups: CardGroup[],
  groupId: string,
) {
  const subtreeGroupIds = new Set([
    groupId,
    ...getGroupDescendantIds(groups, groupId),
  ])

  return cards
    .filter((card) => card.groupId && subtreeGroupIds.has(card.groupId))
    .map((card) => card.id)
}

export function getVisibleGroups(groups: CardGroup[]) {
  const groupsById = getGroupsById(groups)

  return groups
    .filter(
      (group) => !hasCollapsedGroupInChain(group.parentGroupId, groupsById),
    )
    .sort((left, right) => {
      const leftDepth = getGroupDepth(groups, left.id)
      const rightDepth = getGroupDepth(groups, right.id)

      if (leftDepth !== rightDepth) {
        return leftDepth - rightDepth
      }

      return left.createdAt.localeCompare(right.createdAt)
    })
}

export function getCollapsedGroupIds(
  groups: Array<Pick<CardGroup, 'id' | 'collapsed'>>,
) {
  return new Set(
    groups.filter((group) => group.collapsed === true).map((group) => group.id),
  )
}

export function getVisibleCards(cards: LinkCard[], groups: CardGroup[]) {
  const groupsById = getGroupsById(groups)

  return cards.filter((card) => {
    let currentGroupId = card.groupId

    while (currentGroupId) {
      const currentGroup = groupsById.get(currentGroupId)

      if (!currentGroup) {
        return true
      }

      if (currentGroup.collapsed) {
        return false
      }

      currentGroupId = currentGroup.parentGroupId
    }

    return true
  })
}

export function getGroupPlacementFrames(groups: CardGroup[]) {
  return getVisibleGroups(groups).map((group) => ({
    ...group,
    kind: 'group' as const,
    size: getGroupLayoutSize(group),
  })) satisfies GroupVisibilityFrame[]
}

function isWithinHorizontalRange(
  entity: LayoutEntity,
  range: { left: number; right: number },
  gridSize: number,
) {
  const entityRight = entity.positionX + entity.size.columns * gridSize

  return entity.positionX >= range.left && entityRight <= range.right
}

export function getPictureIdsWithinGroupBodies(
  pictures: PictureNode[],
  groups: CardGroup[],
  gridSize: number,
  options?: {
    useExpandedBody?: boolean
  },
) {
  if (pictures.length === 0 || groups.length === 0) {
    return [] as string[]
  }

  const useExpandedBody = options?.useExpandedBody === true

  return pictures
    .filter((picture) =>
      groups.some((group) =>
        isWithinGroupBodyBounds(
          getEntityPixelBounds(picture, gridSize),
          group,
          gridSize,
          useExpandedBody,
        ),
      ),
    )
    .map((picture) => picture.id)
}

/**
 * Applies a collapse/expand toggle to one group and reflows the visible
 * siblings below it on the same hierarchy level. Descendant groups and cards
 * move together so the canvas keeps its vertical stacking intact.
 */
export function applyGroupCollapseLayout(input: {
  cards: LinkCard[]
  collapsed: boolean
  gridSize: number
  groupId: string
  groups: CardGroup[]
  pictures: PictureNode[]
}) {
  const { cards, collapsed, gridSize, groupId, groups, pictures } = input
  const targetGroup = groups.find((group) => group.id === groupId)

  if (!targetGroup) {
    return {
      cards,
      clearedSelectedCardIds: [] as string[],
      groups,
      pictures,
    }
  }

  const nextCollapsed = collapsed ? true : undefined

  if (targetGroup.collapsed === nextCollapsed) {
    return {
      cards,
      clearedSelectedCardIds: [] as string[],
      groups,
      pictures,
    }
  }

  const now = new Date().toISOString()
  const nextGroups = groups.map((group) =>
    group.id === groupId
      ? {
          ...group,
          collapsed: nextCollapsed,
          updatedAt: now,
        }
      : group,
  )
  const nextTargetGroup = nextGroups.find((group) => group.id === groupId)

  if (!nextTargetGroup) {
    return {
      cards,
      clearedSelectedCardIds: [] as string[],
      groups,
      pictures,
    }
  }

  const previousSize = getGroupLayoutSize(targetGroup)
  const nextSize = getGroupLayoutSize(nextTargetGroup)
  const deltaY = (nextSize.rows - previousSize.rows) * gridSize
  const descendantGroupIdSet = new Set(getGroupDescendantIds(groups, groupId))
  const childCardIdSet = new Set(getGroupSubtreeCardIds(cards, groups, groupId))

  if (deltaY === 0) {
    return {
      cards,
      clearedSelectedCardIds: [...childCardIdSet],
      hiddenGroupIds: collapsed ? [...descendantGroupIdSet] : [],
      groups: nextGroups,
      pictures,
    }
  }

  const sourceBottom = targetGroup.positionY + previousSize.rows * gridSize
  const horizontalRange = {
    left: targetGroup.positionX,
    right:
      targetGroup.positionX +
      Math.max(previousSize.columns, nextSize.columns) * gridSize,
  }
  const affectedRootGroupIds = new Set<string>()
  const affectedGroupIds = new Set<string>()
  const affectedCardIds = new Set<string>()
  const candidateGroups = getGroupPlacementFrames(groups).filter(
    (group) =>
      group.id !== groupId &&
      !descendantGroupIdSet.has(group.id) &&
      group.parentGroupId === targetGroup.parentGroupId,
  )
  const candidateCards = getVisibleCards(cards, groups).filter(
    (card) => !card.groupId && !childCardIdSet.has(card.id),
  )
  const candidatePictures = pictures.filter(
    (picture) =>
      !groups.some((group) =>
        isWithinGroupBodyBounds(
          getEntityPixelBounds(picture, gridSize),
          group,
          gridSize,
          true,
        ),
      ),
  )

  for (const group of candidateGroups) {
    if (group.positionY < sourceBottom) {
      continue
    }

    if (!isWithinHorizontalRange(group, horizontalRange, gridSize)) {
      continue
    }

    affectedRootGroupIds.add(group.id)
  }

  for (const rootGroupId of affectedRootGroupIds) {
    for (const affectedGroupId of getGroupSubtreeGroupIds(
      groups,
      rootGroupId,
    )) {
      affectedGroupIds.add(affectedGroupId)
    }
  }

  for (const card of candidateCards) {
    if (card.positionY < sourceBottom) {
      continue
    }

    if (!isWithinHorizontalRange(card, horizontalRange, gridSize)) {
      continue
    }

    affectedCardIds.add(card.id)
  }

  const affectedPictureIds = new Set(
    getPictureIdsWithinGroupBodies(
      pictures,
      groups.filter((group) => affectedGroupIds.has(group.id)),
      gridSize,
      { useExpandedBody: true },
    ),
  )

  for (const picture of candidatePictures) {
    if (picture.positionY < sourceBottom) {
      continue
    }

    if (!isWithinHorizontalRange(picture, horizontalRange, gridSize)) {
      continue
    }

    affectedPictureIds.add(picture.id)
  }

  const nextCards = cards.map((card) => {
    if (
      affectedCardIds.has(card.id) ||
      (card.groupId && affectedGroupIds.has(card.groupId))
    ) {
      return {
        ...card,
        positionY: card.positionY + deltaY,
        updatedAt: now,
      }
    }

    return card
  })

  const nextPictures = pictures.map((picture) => {
    if (!affectedPictureIds.has(picture.id)) {
      return picture
    }

    return {
      ...picture,
      positionY: picture.positionY + deltaY,
      updatedAt: now,
    }
  })

  return {
    cards: nextCards,
    clearedSelectedCardIds: [...childCardIdSet],
    hiddenGroupIds: collapsed ? [...descendantGroupIdSet] : [],
    groups: nextGroups.map((group) =>
      affectedGroupIds.has(group.id)
        ? {
            ...group,
            positionY: group.positionY + deltaY,
            updatedAt: now,
          }
        : group,
    ),
    pictures: nextPictures,
  }
}

export function isPlacementBlockedByOccupiedItem(input: {
  candidate: {
    position: { x: number; y: number }
    size: { columns: number; rows: number }
  }
  gridSize: number
  occupiedItem: PlaceableItem
}) {
  if (input.occupiedItem.kind === 'group') {
    return isGroupPlacementBlockedByVisibleGroup({
      candidate: input.candidate,
      gridSize: input.gridSize,
      occupiedGroup: input.occupiedItem,
    })
  }

  const candidateBounds = getEntityPixelBounds(
    {
      positionX: input.candidate.position.x,
      positionY: input.candidate.position.y,
      size: input.candidate.size,
    },
    input.gridSize,
  )
  const occupiedBounds = getEntityPixelBounds(
    input.occupiedItem,
    input.gridSize,
  )

  return (
    candidateBounds.left < occupiedBounds.right &&
    candidateBounds.right > occupiedBounds.left &&
    candidateBounds.top < occupiedBounds.bottom &&
    candidateBounds.bottom > occupiedBounds.top
  )
}

/**
 * Determines whether a candidate group placement should be treated as blocked
 * by an already visible group. Overlap inside the occupied group's body is
 * allowed, but overlap with its outer frame remains blocking.
 */
export function isGroupPlacementBlockedByVisibleGroup(input: {
  candidate: {
    position: { x: number; y: number }
    size: { columns: number; rows: number }
  }
  gridSize: number
  occupiedGroup: Pick<
    CardGroup,
    'positionX' | 'positionY' | 'size' | 'collapsed'
  >
}) {
  const candidateBounds = getEntityPixelBounds(
    {
      positionX: input.candidate.position.x,
      positionY: input.candidate.position.y,
      size: input.candidate.size,
    },
    input.gridSize,
  )
  const occupiedBounds = getEntityPixelBounds(
    input.occupiedGroup,
    input.gridSize,
  )
  const overlaps =
    candidateBounds.left < occupiedBounds.right &&
    candidateBounds.right > occupiedBounds.left &&
    candidateBounds.top < occupiedBounds.bottom &&
    candidateBounds.bottom > occupiedBounds.top

  if (!overlaps) {
    return false
  }

  const occupiedBodyBounds = getGroupBodyBounds(
    input.occupiedGroup,
    input.gridSize,
  )

  return !(
    candidateBounds.left >= occupiedBodyBounds.left &&
    candidateBounds.top >= occupiedBodyBounds.top &&
    candidateBounds.right <= occupiedBodyBounds.right &&
    candidateBounds.bottom <= occupiedBodyBounds.bottom
  )
}
