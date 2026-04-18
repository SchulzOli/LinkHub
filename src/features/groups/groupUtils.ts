import { getGroupBodyBounds, type CardGroup } from '../../contracts/cardGroup'

export type PixelBounds = {
  left: number
  top: number
  right: number
  bottom: number
}

export function getGroupsById(groups: CardGroup[]) {
  return new Map(groups.map((group) => [group.id, group]))
}

export function hasCollapsedGroupInChain(
  groupId: string | undefined,
  groupsById: Map<string, CardGroup>,
) {
  let currentGroupId = groupId

  while (currentGroupId) {
    const currentGroup = groupsById.get(currentGroupId)

    if (!currentGroup) {
      return false
    }

    if (currentGroup.collapsed) {
      return true
    }

    currentGroupId = currentGroup.parentGroupId
  }

  return false
}

export function getEntityPixelBounds(
  entity: {
    positionX: number
    positionY: number
    size: { columns: number; rows: number }
  },
  gridSize: number,
): PixelBounds {
  return {
    left: entity.positionX,
    top: entity.positionY,
    right: entity.positionX + entity.size.columns * gridSize,
    bottom: entity.positionY + entity.size.rows * gridSize,
  }
}

export function isWithinGroupBodyBounds(
  entityBounds: PixelBounds,
  group: Pick<CardGroup, 'collapsed' | 'positionX' | 'positionY' | 'size'>,
  gridSize: number,
  useExpandedBody = false,
) {
  const groupBodyBounds = getGroupBodyBounds(
    useExpandedBody ? { ...group, collapsed: undefined } : group,
    gridSize,
  )

  return (
    entityBounds.left >= groupBodyBounds.left &&
    entityBounds.top >= groupBodyBounds.top &&
    entityBounds.right <= groupBodyBounds.right &&
    entityBounds.bottom <= groupBodyBounds.bottom
  )
}
