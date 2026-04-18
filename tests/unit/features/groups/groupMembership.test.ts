import { describe, expect, it } from 'vitest'

import {
  getGroupBodyBounds,
  type CardGroup,
} from '../../../../src/contracts/cardGroup'
import type { LinkCard } from '../../../../src/contracts/linkCard'
import {
  getContainingGroupId,
  getContainingParentGroupId,
  syncCardGroupMembership,
  syncGroupParentMembership,
  syncGroupParentMembershipForIds,
} from '../../../../src/features/groups/groupMembership'

function createCard(overrides: Partial<LinkCard> = {}): LinkCard {
  return {
    id: 'card-1',
    url: 'https://example.com',
    title: 'Example',
    faviconUrl: 'https://example.com/favicon.ico',
    positionX: 24,
    positionY: 24,
    size: { columns: 5, rows: 5 },
    createdAt: '2026-04-03T00:00:00.000Z',
    updatedAt: '2026-04-03T00:00:00.000Z',
    ...overrides,
  }
}

function createGroup(overrides: Partial<CardGroup> = {}): CardGroup {
  return {
    id: 'group-1',
    name: 'Group',
    positionX: 0,
    positionY: 0,
    size: { columns: 8, rows: 8 },
    createdAt: '2026-04-03T00:00:00.000Z',
    updatedAt: '2026-04-03T00:00:00.000Z',
    ...overrides,
  }
}

describe('groupMembership', () => {
  it('assigns a card to the smallest fully containing group', () => {
    const largeGroup = createGroup({
      id: 'large',
      size: { columns: 10, rows: 10 },
    })
    const smallGroup = createGroup({
      id: 'small',
      size: { columns: 7, rows: 7 },
    })
    const smallBodyBounds = getGroupBodyBounds(smallGroup, 24)
    const card = createCard({
      positionX: smallBodyBounds.left,
      positionY: smallBodyBounds.top,
      size: { columns: 2, rows: 2 },
    })

    expect(getContainingGroupId(card, [largeGroup, smallGroup], 24)).toBe(
      'small',
    )
  })

  it('assigns a group to the smallest fully containing parent group', () => {
    const largeGroup = createGroup({
      id: 'large',
      size: { columns: 14, rows: 14 },
    })
    const smallGroup = createGroup({
      id: 'small',
      size: { columns: 10, rows: 10 },
    })
    const smallBodyBounds = getGroupBodyBounds(smallGroup, 24)
    const childGroup = createGroup({
      id: 'child',
      positionX: smallBodyBounds.left,
      positionY: smallBodyBounds.top,
      size: { columns: 3, rows: 3 },
    })

    expect(
      getContainingParentGroupId(
        childGroup,
        [largeGroup, smallGroup, childGroup],
        24,
      ),
    ).toBe('small')
  })

  it('keeps an existing parent group when a sibling also fully contains the child', () => {
    const parentGroup = createGroup({
      id: 'parent',
      size: { columns: 14, rows: 14 },
    })
    const childGroup = createGroup({
      id: 'child',
      parentGroupId: parentGroup.id,
      positionX: parentGroup.positionX + 24,
      positionY: parentGroup.positionY + 72,
      size: { columns: 4, rows: 4 },
    })
    const siblingGroup = createGroup({
      id: 'sibling',
      positionX: childGroup.positionX,
      positionY: childGroup.positionY - 48,
      size: { columns: 8, rows: 8 },
    })

    const [, nextChildGroup] = syncGroupParentMembership(
      [parentGroup, childGroup, siblingGroup],
      24,
    )

    expect(nextChildGroup?.parentGroupId).toBe(parentGroup.id)
  })

  it('removes group membership when a card leaves every group', () => {
    const card = createCard({
      groupId: 'group-1',
      positionX: 240,
      positionY: 240,
    })
    const group = createGroup()

    const [nextCard] = syncCardGroupMembership([card], [group], 24)

    expect(nextCard.groupId).toBeUndefined()
  })

  it('removes parent group membership when a group leaves every group', () => {
    const parentGroup = createGroup({
      id: 'parent',
      size: { columns: 14, rows: 14 },
    })
    const childGroup = createGroup({
      id: 'child',
      parentGroupId: parentGroup.id,
      positionX: 24 * 16,
      positionY: 24 * 16,
    })

    const [, nextChildGroup] = syncGroupParentMembership(
      [parentGroup, childGroup],
      24,
    )

    expect(nextChildGroup?.parentGroupId).toBeUndefined()
  })

  it('only reparents the moved root group when parent syncing is scoped', () => {
    const parentGroup = createGroup({
      id: 'parent',
      size: { columns: 18, rows: 18 },
    })
    const parentBodyBounds = getGroupBodyBounds(parentGroup, 24)
    const movedGroup = createGroup({
      id: 'moved',
      positionX: parentBodyBounds.left,
      positionY: parentBodyBounds.top,
      size: { columns: 8, rows: 8 },
    })
    const movedBodyBounds = getGroupBodyBounds(movedGroup, 24)
    const stationaryGroup = createGroup({
      id: 'stationary',
      positionX: movedBodyBounds.left,
      positionY: movedBodyBounds.top,
      size: { columns: 3, rows: 3 },
    })

    const [, nextMovedGroup, nextStationaryGroup] =
      syncGroupParentMembershipForIds(
        [parentGroup, movedGroup, stationaryGroup],
        24,
        [movedGroup.id],
      )

    expect(nextMovedGroup?.parentGroupId).toBe(parentGroup.id)
    expect(nextStationaryGroup?.parentGroupId).toBeUndefined()
  })

  it('does not assign a card that sits only in the group header zone', () => {
    const group = createGroup()
    const bodyBounds = getGroupBodyBounds(group, 24)
    const card = createCard({
      positionX: group.positionX + 24,
      positionY: group.positionY + 8,
      size: { columns: 1, rows: 1 },
    })

    expect(card.positionY + card.size.rows * 24).toBeLessThan(bodyBounds.top)
    expect(getContainingGroupId(card, [group], 24)).toBeUndefined()
  })

  it('does not assign a card that crosses the dashed body boundary', () => {
    const group = createGroup()
    const bodyBounds = getGroupBodyBounds(group, 24)
    const card = createCard({
      positionX: bodyBounds.left - 1,
      positionY: bodyBounds.top,
      size: { columns: 2, rows: 2 },
    })

    expect(card.positionX).toBeLessThan(bodyBounds.left)
    expect(getContainingGroupId(card, [group], 24)).toBeUndefined()
  })

  it('does not assign cards into a collapsed group', () => {
    const group = createGroup({ collapsed: true })
    const card = createCard({
      positionX: group.positionX + 24,
      positionY: group.positionY + 24,
      size: { columns: 2, rows: 2 },
    })

    expect(getContainingGroupId(card, [group], 24)).toBeUndefined()
  })
})
