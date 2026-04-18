import { beforeEach, describe, expect, it } from 'vitest'

import type { CardGroup } from '../../../src/contracts/cardGroup'
import type { LinkCard } from '../../../src/contracts/linkCard'
import type { PictureNode } from '../../../src/contracts/pictureNode'
import { createDefaultWorkspace } from '../../../src/contracts/workspace'
import { createFormatPainterFromCard } from '../../../src/features/appearance/formatPainter'
import { useWorkspaceStore } from '../../../src/state/useWorkspaceStore'

function createCard(overrides: Partial<LinkCard> = {}): LinkCard {
  return {
    id: 'card-1',
    url: 'https://example.com/',
    title: 'Example',
    faviconUrl: 'https://example.com/favicon.ico',
    positionX: 24,
    positionY: 24,
    size: { columns: 5, rows: 5 },
    createdAt: '2026-04-04T00:00:00.000Z',
    updatedAt: '2026-04-04T00:00:00.000Z',
    ...overrides,
  }
}

function createGroup(overrides: Partial<CardGroup> = {}): CardGroup {
  return {
    id: 'group-1',
    name: 'Group',
    positionX: 0,
    positionY: 0,
    size: { columns: 10, rows: 10 },
    createdAt: '2026-04-04T00:00:00.000Z',
    updatedAt: '2026-04-04T00:00:00.000Z',
    ...overrides,
  }
}

function createPicture(overrides: Partial<PictureNode> = {}): PictureNode {
  return {
    id: 'picture-1',
    type: 'picture',
    imageId: 'image-1',
    positionX: 48,
    positionY: 48,
    size: { columns: 5, rows: 5 },
    createdAt: '2026-04-04T00:00:00.000Z',
    updatedAt: '2026-04-04T00:00:00.000Z',
    ...overrides,
  }
}

describe('useWorkspaceStore', () => {
  beforeEach(() => {
    useWorkspaceStore.getState().hydrateWorkspace(createDefaultWorkspace())
  })

  it('hydrates a workspace and resets transient UI state', () => {
    useWorkspaceStore.getState().toggleQuickAdd(true)
    useWorkspaceStore.getState().setSelectedCardIds(['card-1'])
    useWorkspaceStore.getState().setAutoEditTarget({
      kind: 'card',
      id: 'card-1',
    })
    useWorkspaceStore
      .getState()
      .startFormatPainter(createFormatPainterFromCard(createCard()))
    useWorkspaceStore.getState().setThemeMode('light')

    const hydratedWorkspace = createDefaultWorkspace({
      name: 'Hydrated workspace',
    })

    useWorkspaceStore.getState().hydrateWorkspace(hydratedWorkspace)

    expect(useWorkspaceStore.getState().workspace.name).toBe(
      'Hydrated workspace',
    )
    expect(useWorkspaceStore.getState().status).toBe('ready')
    expect(useWorkspaceStore.getState().quickAddOpen).toBe(false)
    expect(useWorkspaceStore.getState().optionsMenuOpen).toBe(false)
    expect(useWorkspaceStore.getState().selectedCardIds).toEqual([])
    expect(useWorkspaceStore.getState().selectedGroupIds).toEqual([])
    expect(useWorkspaceStore.getState().selectedPictureIds).toEqual([])
    expect(useWorkspaceStore.getState().autoEditTarget).toBeNull()
    expect(useWorkspaceStore.getState().formatPainter).toBeNull()
    expect(useWorkspaceStore.getState().undoStack).toEqual([])
  })

  it('keeps quick add and options menu mutually exclusive', () => {
    useWorkspaceStore.getState().toggleQuickAdd(true)

    expect(useWorkspaceStore.getState().quickAddOpen).toBe(true)
    expect(useWorkspaceStore.getState().optionsMenuOpen).toBe(false)

    useWorkspaceStore.getState().toggleOptionsMenu(true)

    expect(useWorkspaceStore.getState().optionsMenuOpen).toBe(true)
    expect(useWorkspaceStore.getState().quickAddOpen).toBe(false)
  })

  it('adds an entity bundle and applies the provided selection', () => {
    const group = createGroup()
    const card = createCard({ groupId: group.id })
    const picture = createPicture()

    useWorkspaceStore.getState().addEntityBundle({
      cards: [card],
      groups: [group],
      pictures: [picture],
      selectedCardIds: [card.id],
      selectedGroupIds: [group.id],
      selectedPictureIds: [picture.id],
    })

    expect(useWorkspaceStore.getState().workspace.cards).toHaveLength(1)
    expect(useWorkspaceStore.getState().workspace.groups).toHaveLength(1)
    expect(useWorkspaceStore.getState().workspace.pictures).toHaveLength(1)
    expect(useWorkspaceStore.getState().selectedCardIds).toEqual([card.id])
    expect(useWorkspaceStore.getState().selectedGroupIds).toEqual([group.id])
    expect(useWorkspaceStore.getState().selectedPictureIds).toEqual([
      picture.id,
    ])
  })

  it('removes group subtrees and pictures from the selection while clearing auto edit targets', () => {
    const parentGroup = createGroup({ id: 'group-parent' })
    const childGroup = createGroup({
      id: 'group-child',
      parentGroupId: parentGroup.id,
      positionX: 24,
      positionY: 24,
      size: { columns: 6, rows: 6 },
    })
    const groupedCard = createCard({
      id: 'card-child',
      groupId: childGroup.id,
      positionX: 48,
      positionY: 48,
    })
    const picture = createPicture({ id: 'picture-remove' })

    useWorkspaceStore.getState().hydrateWorkspace(
      createDefaultWorkspace({
        cards: [groupedCard],
        groups: [parentGroup, childGroup],
        pictures: [picture],
      }),
    )
    useWorkspaceStore.getState().setSelection({
      cardIds: [groupedCard.id],
      groupIds: [parentGroup.id, childGroup.id],
      pictureIds: [picture.id],
    })
    useWorkspaceStore.getState().setAutoEditTarget({
      kind: 'group',
      id: childGroup.id,
    })

    useWorkspaceStore.getState().removeSelection({
      cardIds: [],
      groupIds: [parentGroup.id],
      pictureIds: [picture.id],
    })

    expect(useWorkspaceStore.getState().workspace.groups).toEqual([])
    expect(useWorkspaceStore.getState().workspace.cards).toEqual([])
    expect(useWorkspaceStore.getState().workspace.pictures).toEqual([])
    expect(useWorkspaceStore.getState().selectedCardIds).toEqual([])
    expect(useWorkspaceStore.getState().selectedGroupIds).toEqual([])
    expect(useWorkspaceStore.getState().selectedPictureIds).toEqual([])
    expect(useWorkspaceStore.getState().autoEditTarget).toBeNull()
  })

  it('undoes workspace changes and clears transient selection state', () => {
    const card = createCard()

    useWorkspaceStore.getState().addCard(card)
    useWorkspaceStore.getState().setSelectedCardIds([card.id])
    useWorkspaceStore.getState().setAutoEditTarget({
      kind: 'card',
      id: card.id,
    })
    useWorkspaceStore
      .getState()
      .startFormatPainter(createFormatPainterFromCard(card))
    useWorkspaceStore.getState().updateCard(card.id, {
      title: 'Updated title',
    })

    expect(useWorkspaceStore.getState().workspace.cards[0]?.title).toBe(
      'Updated title',
    )

    useWorkspaceStore.getState().undoWorkspace()

    expect(useWorkspaceStore.getState().workspace.cards[0]?.title).toBe(
      'Example',
    )
    expect(useWorkspaceStore.getState().selectedCardIds).toEqual([])
    expect(useWorkspaceStore.getState().autoEditTarget).toBeNull()
    expect(useWorkspaceStore.getState().formatPainter).toBeNull()
  })

  it('clears format painter when interaction mode changes', () => {
    const card = createCard()

    useWorkspaceStore
      .getState()
      .startFormatPainter(createFormatPainterFromCard(card))

    useWorkspaceStore.getState().toggleInteractionMode('view')

    expect(useWorkspaceStore.getState().formatPainter).toBeNull()
    expect(useWorkspaceStore.getState().interactionMode).toBe('view')
  })

  it('does not collect outside pictures while a group is dragged across them', () => {
    const group = createGroup({
      id: 'group-drag',
      size: { columns: 8, rows: 8 },
    })
    const insidePicture = createPicture({
      id: 'picture-inside',
      positionX: 48,
      positionY: 48,
      size: { columns: 2, rows: 2 },
    })
    const outsidePicture = createPicture({
      id: 'picture-outside',
      positionX: 48,
      positionY: 192,
      size: { columns: 2, rows: 2 },
    })

    useWorkspaceStore.getState().hydrateWorkspace(
      createDefaultWorkspace({
        groups: [group],
        pictures: [insidePicture, outsidePicture],
      }),
    )

    useWorkspaceStore
      .getState()
      .moveGroup(group.id, { x: group.positionX, y: 96 }, [insidePicture.id])
    useWorkspaceStore
      .getState()
      .moveGroup(group.id, { x: group.positionX, y: 144 }, [insidePicture.id])

    expect(
      useWorkspaceStore
        .getState()
        .workspace.pictures.find((picture) => picture.id === insidePicture.id),
    ).toMatchObject({
      positionX: insidePicture.positionX,
      positionY: insidePicture.positionY + 144,
    })
    expect(
      useWorkspaceStore
        .getState()
        .workspace.pictures.find((picture) => picture.id === outsidePicture.id),
    ).toMatchObject({
      positionX: outsidePicture.positionX,
      positionY: outsidePicture.positionY,
    })
  })
})
