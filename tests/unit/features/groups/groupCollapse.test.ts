import { beforeEach, describe, expect, it } from 'vitest'

import {
  getGroupBodyBounds,
  getGroupLayoutSize,
  type CardGroup,
} from '../../../../src/contracts/cardGroup'
import type { LinkCard } from '../../../../src/contracts/linkCard'
import type { PictureNode } from '../../../../src/contracts/pictureNode'
import { createDefaultWorkspace } from '../../../../src/contracts/workspace'
import { isPlacementBlockedByOccupiedItem } from '../../../../src/features/groups/groupLayout'
import { useWorkspaceStore } from '../../../../src/state/useWorkspaceStore'

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

function createPicture(overrides: Partial<PictureNode> = {}): PictureNode {
  return {
    id: 'picture-1',
    type: 'picture',
    imageId: 'image-1',
    positionX: 24,
    positionY: 24,
    size: { columns: 5, rows: 5 },
    createdAt: '2026-04-03T00:00:00.000Z',
    updatedAt: '2026-04-03T00:00:00.000Z',
    ...overrides,
  }
}

describe('group collapse', () => {
  beforeEach(() => {
    useWorkspaceStore.getState().hydrateWorkspace(createDefaultWorkspace())
  })

  it('collapses a group, clears hidden card selection, and reflows lower cards and pictures', () => {
    const gridSize =
      useWorkspaceStore.getState().workspace.placementGuide.gridSize
    const group = createGroup()
    const bodyBounds = getGroupBodyBounds(group, gridSize)
    const childCard = createCard({
      id: 'child-card',
      groupId: group.id,
      positionX: bodyBounds.left,
      positionY: bodyBounds.top,
      size: { columns: 2, rows: 2 },
      title: 'Child',
    })
    const lowerCard = createCard({
      id: 'lower-card',
      positionX: group.positionX,
      positionY: group.positionY + group.size.rows * gridSize + gridSize,
      title: 'Below',
    })
    const lowerPicture = createPicture({
      id: 'lower-picture',
      positionX: group.positionX,
      positionY: group.positionY + group.size.rows * gridSize + gridSize * 2,
    })
    const collapsedRows = getGroupLayoutSize({
      ...group,
      collapsed: true,
    }).rows
    const collapseDelta = (group.size.rows - collapsedRows) * gridSize

    useWorkspaceStore.getState().hydrateWorkspace(
      createDefaultWorkspace({
        cards: [childCard, lowerCard],
        groups: [group],
        pictures: [lowerPicture],
      }),
    )
    useWorkspaceStore.getState().setSelectedCardIds([childCard.id])

    useWorkspaceStore.getState().toggleGroupCollapsed(group.id)

    expect(useWorkspaceStore.getState().workspace.groups[0]?.collapsed).toBe(
      true,
    )
    expect(
      useWorkspaceStore
        .getState()
        .workspace.cards.find((card) => card.id === childCard.id)?.groupId,
    ).toBe(group.id)
    expect(useWorkspaceStore.getState().selectedCardIds).toEqual([])
    expect(
      useWorkspaceStore
        .getState()
        .workspace.cards.find((card) => card.id === lowerCard.id)?.positionY,
    ).toBe(lowerCard.positionY - collapseDelta)
    expect(
      useWorkspaceStore
        .getState()
        .workspace.pictures.find((picture) => picture.id === lowerPicture.id)
        ?.positionY,
    ).toBe(lowerPicture.positionY - collapseDelta)

    useWorkspaceStore.getState().toggleGroupCollapsed(group.id)

    expect(
      useWorkspaceStore.getState().workspace.groups[0]?.collapsed,
    ).toBeUndefined()
    expect(
      useWorkspaceStore
        .getState()
        .workspace.cards.find((card) => card.id === lowerCard.id)?.positionY,
    ).toBe(lowerCard.positionY)
    expect(
      useWorkspaceStore
        .getState()
        .workspace.pictures.find((picture) => picture.id === lowerPicture.id)
        ?.positionY,
    ).toBe(lowerPicture.positionY)
  })

  it('does not move downstream groups that extend beyond the source group width', () => {
    const gridSize =
      useWorkspaceStore.getState().workspace.placementGuide.gridSize
    const sourceGroup = createGroup({
      positionX: gridSize * 8,
    })
    const containedGroup = createGroup({
      id: 'group-2',
      name: 'Contained',
      positionX: sourceGroup.positionX + gridSize,
      positionY:
        sourceGroup.positionY + sourceGroup.size.rows * gridSize + gridSize,
      size: { columns: 6, rows: 4 },
    })
    const overhangingGroup = createGroup({
      id: 'group-3',
      name: 'Overhanging',
      positionX: sourceGroup.positionX - gridSize * 2,
      positionY:
        sourceGroup.positionY + sourceGroup.size.rows * gridSize + gridSize * 2,
      size: { columns: 6, rows: 4 },
    })
    const collapsedRows = getGroupLayoutSize({
      ...sourceGroup,
      collapsed: true,
    }).rows
    const collapseDelta = (sourceGroup.size.rows - collapsedRows) * gridSize

    useWorkspaceStore.getState().hydrateWorkspace(
      createDefaultWorkspace({
        cards: [],
        groups: [sourceGroup, containedGroup, overhangingGroup],
      }),
    )

    useWorkspaceStore.getState().toggleGroupCollapsed(sourceGroup.id)

    expect(
      useWorkspaceStore
        .getState()
        .workspace.groups.find((group) => group.id === containedGroup.id)
        ?.positionY,
    ).toBe(containedGroup.positionY - collapseDelta)
    expect(
      useWorkspaceStore
        .getState()
        .workspace.groups.find((group) => group.id === overhangingGroup.id)
        ?.positionY,
    ).toBe(overhangingGroup.positionY)
  })

  it('moves affected groups together with their child cards and pictures during collapse reflow', () => {
    const gridSize =
      useWorkspaceStore.getState().workspace.placementGuide.gridSize
    const sourceGroup = createGroup()
    const downstreamGroup = createGroup({
      id: 'group-2',
      name: 'Downstream',
      positionY:
        sourceGroup.positionY + sourceGroup.size.rows * gridSize + gridSize,
    })
    const downstreamBodyBounds = getGroupBodyBounds(downstreamGroup, gridSize)
    const downstreamChild = createCard({
      id: 'downstream-child',
      groupId: downstreamGroup.id,
      positionX: downstreamBodyBounds.left,
      positionY: downstreamBodyBounds.top,
      size: { columns: 2, rows: 2 },
      title: 'Nested',
    })
    const downstreamPicture = createPicture({
      id: 'downstream-picture',
      positionX: downstreamBodyBounds.left + gridSize,
      positionY: downstreamBodyBounds.top + gridSize,
      size: { columns: 2, rows: 2 },
    })
    const collapsedRows = getGroupLayoutSize({
      ...sourceGroup,
      collapsed: true,
    }).rows
    const collapseDelta = (sourceGroup.size.rows - collapsedRows) * gridSize

    useWorkspaceStore.getState().hydrateWorkspace(
      createDefaultWorkspace({
        cards: [downstreamChild],
        groups: [sourceGroup, downstreamGroup],
        pictures: [downstreamPicture],
      }),
    )

    useWorkspaceStore.getState().toggleGroupCollapsed(sourceGroup.id)

    expect(
      useWorkspaceStore
        .getState()
        .workspace.groups.find((group) => group.id === downstreamGroup.id)
        ?.positionY,
    ).toBe(downstreamGroup.positionY - collapseDelta)
    expect(
      useWorkspaceStore
        .getState()
        .workspace.cards.find((card) => card.id === downstreamChild.id)
        ?.positionY,
    ).toBe(downstreamChild.positionY - collapseDelta)
    expect(
      useWorkspaceStore
        .getState()
        .workspace.pictures.find(
          (picture) => picture.id === downstreamPicture.id,
        )?.positionY,
    ).toBe(downstreamPicture.positionY - collapseDelta)
  })

  it('does not move nested groups from a different parent subtree during collapse reflow', () => {
    const gridSize =
      useWorkspaceStore.getState().workspace.placementGuide.gridSize
    const sourceGroup = createGroup()
    const downstreamGroup = createGroup({
      id: 'group-2',
      name: 'Downstream',
      positionY:
        sourceGroup.positionY + sourceGroup.size.rows * gridSize + gridSize,
    })
    const foreignParentGroup = createGroup({
      id: 'group-3',
      name: 'Foreign parent',
      positionX: sourceGroup.positionX - gridSize * 2,
      positionY: downstreamGroup.positionY,
      size: { columns: 12, rows: 8 },
    })
    const foreignParentBodyBounds = getGroupBodyBounds(
      foreignParentGroup,
      gridSize,
    )
    const foreignChildGroup = createGroup({
      id: 'group-4',
      name: 'Foreign child',
      parentGroupId: foreignParentGroup.id,
      positionX: sourceGroup.positionX + gridSize,
      positionY: foreignParentBodyBounds.top,
      size: { columns: 4, rows: 4 },
    })
    const collapsedRows = getGroupLayoutSize({
      ...sourceGroup,
      collapsed: true,
    }).rows
    const collapseDelta = (sourceGroup.size.rows - collapsedRows) * gridSize

    useWorkspaceStore.getState().hydrateWorkspace(
      createDefaultWorkspace({
        cards: [],
        groups: [
          sourceGroup,
          downstreamGroup,
          foreignParentGroup,
          foreignChildGroup,
        ],
      }),
    )

    useWorkspaceStore.getState().toggleGroupCollapsed(sourceGroup.id)

    expect(
      useWorkspaceStore
        .getState()
        .workspace.groups.find((group) => group.id === downstreamGroup.id)
        ?.positionY,
    ).toBe(downstreamGroup.positionY - collapseDelta)
    expect(
      useWorkspaceStore
        .getState()
        .workspace.groups.find((group) => group.id === foreignParentGroup.id)
        ?.positionY,
    ).toBe(foreignParentGroup.positionY)
    expect(
      useWorkspaceStore
        .getState()
        .workspace.groups.find((group) => group.id === foreignChildGroup.id),
    ).toMatchObject({
      parentGroupId: foreignParentGroup.id,
      positionY: foreignChildGroup.positionY,
    })
  })

  it('moves nested groups, cards, and pictures together when the parent group moves', () => {
    const gridSize =
      useWorkspaceStore.getState().workspace.placementGuide.gridSize
    const parentGroup = createGroup({
      id: 'group-parent',
      size: { columns: 12, rows: 12 },
    })
    const parentBodyBounds = getGroupBodyBounds(parentGroup, gridSize)
    const childGroup = createGroup({
      id: 'group-child',
      parentGroupId: parentGroup.id,
      positionX: parentBodyBounds.left,
      positionY: parentBodyBounds.top,
      size: { columns: 4, rows: 4 },
    })
    const childBodyBounds = getGroupBodyBounds(childGroup, gridSize)
    const childCard = createCard({
      id: 'nested-card',
      groupId: childGroup.id,
      positionX: childBodyBounds.left,
      positionY: childBodyBounds.top,
      size: { columns: 2, rows: 2 },
    })
    const childPicture = createPicture({
      id: 'nested-picture',
      positionX: childBodyBounds.left + gridSize,
      positionY: childBodyBounds.top + gridSize,
      size: { columns: 2, rows: 2 },
    })
    const delta = { x: gridSize * 2, y: gridSize * 3 }

    useWorkspaceStore.getState().hydrateWorkspace(
      createDefaultWorkspace({
        cards: [childCard],
        groups: [parentGroup, childGroup],
        pictures: [childPicture],
      }),
    )

    useWorkspaceStore.getState().moveGroup(parentGroup.id, {
      x: parentGroup.positionX + delta.x,
      y: parentGroup.positionY + delta.y,
    })

    expect(
      useWorkspaceStore
        .getState()
        .workspace.groups.find((group) => group.id === childGroup.id),
    ).toMatchObject({
      parentGroupId: parentGroup.id,
      positionX: childGroup.positionX + delta.x,
      positionY: childGroup.positionY + delta.y,
    })
    expect(
      useWorkspaceStore
        .getState()
        .workspace.cards.find((card) => card.id === childCard.id),
    ).toMatchObject({
      groupId: childGroup.id,
      positionX: childCard.positionX + delta.x,
      positionY: childCard.positionY + delta.y,
    })
    expect(
      useWorkspaceStore
        .getState()
        .workspace.pictures.find((picture) => picture.id === childPicture.id),
    ).toMatchObject({
      positionX: childPicture.positionX + delta.x,
      positionY: childPicture.positionY + delta.y,
    })
  })

  it('does not reassign cards between nested sibling groups when one sibling moves over the other', () => {
    const gridSize =
      useWorkspaceStore.getState().workspace.placementGuide.gridSize
    const parentGroup = createGroup({
      id: 'group-parent',
      size: { columns: 16, rows: 12 },
    })
    const parentBodyBounds = getGroupBodyBounds(parentGroup, gridSize)
    const occupiedGroup = createGroup({
      id: 'group-occupied',
      parentGroupId: parentGroup.id,
      positionX: parentBodyBounds.left,
      positionY: parentBodyBounds.top,
      size: { columns: 4, rows: 4 },
    })
    const movingGroup = createGroup({
      id: 'group-moving',
      parentGroupId: parentGroup.id,
      positionX: parentBodyBounds.left + gridSize * 5,
      positionY: parentBodyBounds.top,
      size: { columns: 4, rows: 4 },
    })
    const occupiedBodyBounds = getGroupBodyBounds(occupiedGroup, gridSize)
    const childCard = createCard({
      id: 'occupied-card',
      groupId: occupiedGroup.id,
      positionX: occupiedBodyBounds.left,
      positionY: occupiedBodyBounds.top,
      size: { columns: 2, rows: 2 },
    })

    useWorkspaceStore.getState().hydrateWorkspace(
      createDefaultWorkspace({
        cards: [childCard],
        groups: [parentGroup, occupiedGroup, movingGroup],
      }),
    )

    useWorkspaceStore.getState().moveGroup(movingGroup.id, {
      x: occupiedGroup.positionX,
      y: occupiedGroup.positionY,
    })

    expect(
      useWorkspaceStore
        .getState()
        .workspace.cards.find((card) => card.id === childCard.id),
    ).toMatchObject({
      groupId: occupiedGroup.id,
      positionX: childCard.positionX,
      positionY: childCard.positionY,
    })
  })

  it('allows node placement inside a group body', () => {
    const gridSize = 24
    const group = createGroup({ size: { columns: 10, rows: 10 } })
    const bodyBounds = getGroupBodyBounds(group, gridSize)

    expect(
      isPlacementBlockedByOccupiedItem({
        candidate: {
          position: {
            x: bodyBounds.left,
            y: bodyBounds.top,
          },
          size: { columns: 2, rows: 2 },
        },
        gridSize,
        occupiedItem: {
          ...group,
          kind: 'group',
        },
      }),
    ).toBe(false)
  })

  it('blocks node placement on a group header', () => {
    const gridSize = 24
    const group = createGroup({ size: { columns: 10, rows: 10 } })
    const bodyBounds = getGroupBodyBounds(group, gridSize)

    expect(
      isPlacementBlockedByOccupiedItem({
        candidate: {
          position: {
            x: group.positionX + gridSize,
            y: group.positionY,
          },
          size: { columns: 1, rows: 1 },
        },
        gridSize,
        occupiedItem: {
          ...group,
          kind: 'group',
        },
      }),
    ).toBe(true)
    expect(group.positionY + gridSize).toBeLessThan(bodyBounds.top)
  })

  it('collapsing a parent group clears nested group selection and keeps descendants attached', () => {
    const gridSize =
      useWorkspaceStore.getState().workspace.placementGuide.gridSize
    const parentGroup = createGroup({
      id: 'group-parent',
      size: { columns: 12, rows: 12 },
    })
    const parentBodyBounds = getGroupBodyBounds(parentGroup, gridSize)
    const childGroup = createGroup({
      id: 'group-child',
      parentGroupId: parentGroup.id,
      positionX: parentBodyBounds.left,
      positionY: parentBodyBounds.top,
      size: { columns: 4, rows: 4 },
    })
    const childBodyBounds = getGroupBodyBounds(childGroup, gridSize)
    const childCard = createCard({
      id: 'nested-card',
      groupId: childGroup.id,
      positionX: childBodyBounds.left,
      positionY: childBodyBounds.top,
      size: { columns: 2, rows: 2 },
    })

    useWorkspaceStore.getState().hydrateWorkspace(
      createDefaultWorkspace({
        cards: [childCard],
        groups: [parentGroup, childGroup],
      }),
    )
    useWorkspaceStore.getState().setSelectedGroupIds([childGroup.id])
    useWorkspaceStore.getState().setAutoEditTarget({
      kind: 'group',
      id: childGroup.id,
    })

    useWorkspaceStore.getState().toggleGroupCollapsed(parentGroup.id)

    expect(useWorkspaceStore.getState().selectedGroupIds).toEqual([])
    expect(useWorkspaceStore.getState().autoEditTarget).toBeNull()
    expect(
      useWorkspaceStore
        .getState()
        .workspace.groups.find((group) => group.id === childGroup.id)
        ?.parentGroupId,
    ).toBe(parentGroup.id)
    expect(
      useWorkspaceStore
        .getState()
        .workspace.cards.find((card) => card.id === childCard.id)?.groupId,
    ).toBe(childGroup.id)
  })
})
