import { getGroupLayoutSize, type CardGroup } from '../../contracts/cardGroup'
import type { LinkCard } from '../../contracts/linkCard'
import {
  getEntityPixelBounds,
  getGroupsById,
  hasCollapsedGroupInChain,
  isWithinGroupBodyBounds,
  type PixelBounds,
} from './groupUtils'

function getMatchingContainingGroups(
  bounds: PixelBounds,
  groups: CardGroup[],
  gridSize: number,
  excludedGroupId?: string,
) {
  return groups.filter((group) => {
    if (group.id === excludedGroupId) {
      return false
    }

    return isWithinGroupBodyBounds(bounds, group, gridSize)
  })
}

function sortContainingGroups(groups: CardGroup[]) {
  groups.sort((left, right) => {
    const leftArea = left.size.columns * left.size.rows
    const rightArea = right.size.columns * right.size.rows

    if (leftArea !== rightArea) {
      return leftArea - rightArea
    }

    return left.createdAt.localeCompare(right.createdAt)
  })

  return groups
}

export function getContainingGroupId(
  card: LinkCard,
  groups: CardGroup[],
  gridSize: number,
) {
  const cardBounds = getEntityPixelBounds(card, gridSize)

  const matchingGroups = getMatchingContainingGroups(
    cardBounds,
    groups,
    gridSize,
  )

  if (matchingGroups.length === 0) {
    return undefined
  }

  return sortContainingGroups(matchingGroups)[0]?.id
}

export function getContainingParentGroupId(
  group: CardGroup,
  groups: CardGroup[],
  gridSize: number,
) {
  const groupBounds = getEntityPixelBounds(
    {
      positionX: group.positionX,
      positionY: group.positionY,
      size: getGroupLayoutSize(group),
    },
    gridSize,
  )
  const currentParentGroup =
    group.parentGroupId !== undefined
      ? groups.find((candidate) => candidate.id === group.parentGroupId)
      : undefined

  if (
    currentParentGroup &&
    currentParentGroup.id !== group.id &&
    isWithinGroupBodyBounds(groupBounds, currentParentGroup, gridSize)
  ) {
    return currentParentGroup.id
  }

  const matchingGroups = getMatchingContainingGroups(
    groupBounds,
    groups,
    gridSize,
    group.id,
  )

  if (matchingGroups.length === 0) {
    return undefined
  }

  return sortContainingGroups(matchingGroups)[0]?.id
}

export function syncCardGroupMembership(
  cards: LinkCard[],
  groups: CardGroup[],
  gridSize: number,
) {
  const groupsById = getGroupsById(groups)

  return cards.map((card) => {
    if (hasCollapsedGroupInChain(card.groupId, groupsById)) {
      return card
    }

    const groupId = getContainingGroupId(card, groups, gridSize)

    return card.groupId === groupId
      ? card
      : {
          ...card,
          groupId,
          updatedAt: new Date().toISOString(),
        }
  })
}

export function syncSingleCardGroupMembership(
  cards: LinkCard[],
  groups: CardGroup[],
  gridSize: number,
  targetCardId: string,
) {
  const groupsById = getGroupsById(groups)

  return cards.map((card) => {
    if (card.id !== targetCardId) {
      return card
    }

    if (hasCollapsedGroupInChain(card.groupId, groupsById)) {
      return card
    }

    const groupId = getContainingGroupId(card, groups, gridSize)

    return card.groupId === groupId
      ? card
      : {
          ...card,
          groupId,
          updatedAt: new Date().toISOString(),
        }
  })
}

export function syncGroupParentMembership(
  groups: CardGroup[],
  gridSize: number,
) {
  const groupsById = getGroupsById(groups)

  return groups.map((group) => {
    if (hasCollapsedGroupInChain(group.parentGroupId, groupsById)) {
      return group
    }

    const parentGroupId = getContainingParentGroupId(group, groups, gridSize)

    return group.parentGroupId === parentGroupId
      ? group
      : {
          ...group,
          parentGroupId,
          updatedAt: new Date().toISOString(),
        }
  })
}

export function syncGroupParentMembershipForIds(
  groups: CardGroup[],
  gridSize: number,
  groupIds: string[],
) {
  const targetGroupIdSet = new Set(groupIds)

  if (targetGroupIdSet.size === 0) {
    return groups
  }

  const groupsById = getGroupsById(groups)

  return groups.map((group) => {
    if (!targetGroupIdSet.has(group.id)) {
      return group
    }

    if (hasCollapsedGroupInChain(group.parentGroupId, groupsById)) {
      return group
    }

    const parentGroupId = getContainingParentGroupId(group, groups, gridSize)

    return group.parentGroupId === parentGroupId
      ? group
      : {
          ...group,
          parentGroupId,
          updatedAt: new Date().toISOString(),
        }
  })
}

export function getGroupChildCardIds(cards: LinkCard[], groupId: string) {
  return cards.filter((card) => card.groupId === groupId).map((card) => card.id)
}

export function getGroupChildGroupIds(groups: CardGroup[], groupId: string) {
  return groups
    .filter((group) => group.parentGroupId === groupId)
    .map((group) => group.id)
}
