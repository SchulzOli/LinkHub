import { describe, expect, it } from 'vitest'

import type { CardGroup } from '../../../../src/contracts/cardGroup'
import type { LinkCard } from '../../../../src/contracts/linkCard'
import type { PictureNode } from '../../../../src/contracts/pictureNode'
import { createDefaultWorkspace } from '../../../../src/contracts/workspace'
import {
  createEmptyCanvasEntityBundle,
  duplicateCanvasEntityBundle,
  getCanvasEntityBundleBounds,
  getCanvasEntityBundlePixelBounds,
  getSelectedCanvasEntityBundle,
  isCanvasEntityBundleEmpty,
  normalizeCanvasEntityBundle,
  offsetCanvasEntityBundle,
  type CanvasEntityBundle,
} from '../../../../src/features/canvas/entityBundle'

const TIMESTAMP = '2026-04-04T00:00:00.000Z'

function createCard(overrides?: Partial<LinkCard>): LinkCard {
  return {
    id: 'card-1',
    url: 'https://example.com',
    title: 'Example',
    faviconUrl: '/favicon.png',
    positionX: 48,
    positionY: 96,
    size: { columns: 5, rows: 5 },
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
    ...overrides,
  }
}

function createGroup(overrides?: Partial<CardGroup>): CardGroup {
  return {
    id: 'group-1',
    name: 'Group',
    positionX: 0,
    positionY: 0,
    size: { columns: 10, rows: 10 },
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
    ...overrides,
  }
}

function createPicture(overrides?: Partial<PictureNode>): PictureNode {
  return {
    id: 'picture-1',
    type: 'picture',
    imageId: 'image-1',
    positionX: 200,
    positionY: 200,
    size: { columns: 6, rows: 4 },
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
    ...overrides,
  }
}

describe('createEmptyCanvasEntityBundle', () => {
  it('returns a bundle with empty arrays', () => {
    const bundle = createEmptyCanvasEntityBundle()

    expect(bundle).toEqual({ cards: [], groups: [], pictures: [] })
  })
})

describe('isCanvasEntityBundleEmpty', () => {
  it('returns true for an empty bundle', () => {
    expect(
      isCanvasEntityBundleEmpty({ cards: [], groups: [], pictures: [] }),
    ).toBe(true)
  })

  it('returns false when cards are present', () => {
    expect(
      isCanvasEntityBundleEmpty({
        cards: [createCard()],
        groups: [],
        pictures: [],
      }),
    ).toBe(false)
  })

  it('returns false when only groups are present', () => {
    expect(
      isCanvasEntityBundleEmpty({
        cards: [],
        groups: [createGroup()],
        pictures: [],
      }),
    ).toBe(false)
  })

  it('returns false when only pictures are present', () => {
    expect(
      isCanvasEntityBundleEmpty({
        cards: [],
        groups: [],
        pictures: [createPicture()],
      }),
    ).toBe(false)
  })
})

describe('getCanvasEntityBundleBounds', () => {
  it('returns null for an empty bundle', () => {
    expect(
      getCanvasEntityBundleBounds({ cards: [], groups: [], pictures: [] }),
    ).toBeNull()
  })

  it('returns top-left corner of a single card', () => {
    const bounds = getCanvasEntityBundleBounds({
      cards: [createCard({ positionX: 48, positionY: 96 })],
      groups: [],
      pictures: [],
    })

    expect(bounds).toEqual({ left: 48, top: 96 })
  })

  it('returns the minimum position across cards, groups, and pictures', () => {
    const bounds = getCanvasEntityBundleBounds({
      cards: [createCard({ positionX: 100, positionY: 200 })],
      groups: [createGroup({ positionX: 50, positionY: 300 })],
      pictures: [createPicture({ positionX: 150, positionY: 10 })],
    })

    expect(bounds).toEqual({ left: 50, top: 10 })
  })
})

describe('getCanvasEntityBundlePixelBounds', () => {
  it('returns null for an empty bundle', () => {
    expect(
      getCanvasEntityBundlePixelBounds(
        { cards: [], groups: [], pictures: [] },
        24,
      ),
    ).toBeNull()
  })

  it('computes correct pixel bounds for a single card', () => {
    const bounds = getCanvasEntityBundlePixelBounds(
      {
        cards: [
          createCard({
            positionX: 48,
            positionY: 96,
            size: { columns: 5, rows: 4 },
          }),
        ],
        groups: [],
        pictures: [],
      },
      24,
    )

    expect(bounds).toEqual({
      left: 48,
      top: 96,
      right: 48 + 5 * 24,
      bottom: 96 + 4 * 24,
      width: 5 * 24,
      height: 4 * 24,
    })
  })
})

describe('normalizeCanvasEntityBundle', () => {
  it('returns the bundle unchanged when empty', () => {
    const bundle: CanvasEntityBundle = { cards: [], groups: [], pictures: [] }
    const result = normalizeCanvasEntityBundle(bundle)

    expect(result.bounds).toBeNull()
    expect(result.bundle).toEqual(bundle)
  })

  it('shifts all positions so the top-left is at the origin', () => {
    const bundle: CanvasEntityBundle = {
      cards: [createCard({ positionX: 120, positionY: 240 })],
      groups: [createGroup({ positionX: 48, positionY: 96 })],
      pictures: [],
    }

    const result = normalizeCanvasEntityBundle(bundle)

    expect(result.bounds).toEqual({ left: 48, top: 96 })
    expect(result.bundle.groups[0]?.positionX).toBe(0)
    expect(result.bundle.groups[0]?.positionY).toBe(0)
    expect(result.bundle.cards[0]?.positionX).toBe(72)
    expect(result.bundle.cards[0]?.positionY).toBe(144)
  })
})

describe('offsetCanvasEntityBundle', () => {
  it('adds the offset to all entity positions', () => {
    const bundle: CanvasEntityBundle = {
      cards: [createCard({ positionX: 0, positionY: 0 })],
      groups: [createGroup({ positionX: 10, positionY: 20 })],
      pictures: [createPicture({ positionX: 30, positionY: 40 })],
    }

    const result = offsetCanvasEntityBundle(bundle, { x: 100, y: 200 })

    expect(result.cards[0]?.positionX).toBe(100)
    expect(result.cards[0]?.positionY).toBe(200)
    expect(result.groups[0]?.positionX).toBe(110)
    expect(result.groups[0]?.positionY).toBe(220)
    expect(result.pictures[0]?.positionX).toBe(130)
    expect(result.pictures[0]?.positionY).toBe(240)
  })

  it('handles negative offsets', () => {
    const result = offsetCanvasEntityBundle(
      {
        cards: [createCard({ positionX: 100, positionY: 100 })],
        groups: [],
        pictures: [],
      },
      { x: -50, y: -30 },
    )

    expect(result.cards[0]?.positionX).toBe(50)
    expect(result.cards[0]?.positionY).toBe(70)
  })
})

describe('getSelectedCanvasEntityBundle', () => {
  it('returns empty bundle when nothing is selected', () => {
    const workspace = createDefaultWorkspace({
      cards: [createCard()],
      groups: [createGroup()],
    })

    const result = getSelectedCanvasEntityBundle({
      workspace,
      selectedCardIds: [],
      selectedGroupIds: [],
      selectedPictureIds: [],
    })

    expect(result.bundle.cards).toHaveLength(0)
    expect(result.bundle.groups).toHaveLength(0)
    expect(result.bundle.pictures).toHaveLength(0)
    expect(result.cardIds).toHaveLength(0)
    expect(result.rootGroupIds).toHaveLength(0)
  })

  it('includes cards belonging to a selected group tree', () => {
    const workspace = createDefaultWorkspace({
      cards: [
        createCard({ id: 'card-in-group', groupId: 'group-1' }),
        createCard({
          id: 'card-outside',
          positionX: 300,
          positionY: 300,
          url: 'https://other.com',
        }),
      ],
      groups: [createGroup({ id: 'group-1' })],
    })

    const result = getSelectedCanvasEntityBundle({
      workspace,
      selectedCardIds: [],
      selectedGroupIds: ['group-1'],
      selectedPictureIds: [],
    })

    expect(result.bundle.cards).toHaveLength(1)
    expect(result.bundle.cards[0]?.id).toBe('card-in-group')
    expect(result.cardIds).toContain('card-in-group')
    expect(result.rootGroupIds).toEqual(['group-1'])
  })

  it('expands nested child groups when a parent group is selected', () => {
    const workspace = createDefaultWorkspace({
      cards: [createCard({ id: 'card-nested', groupId: 'child-group' })],
      groups: [
        createGroup({ id: 'parent-group' }),
        createGroup({
          id: 'child-group',
          name: 'Child',
          parentGroupId: 'parent-group',
          positionX: 24,
          positionY: 24,
          size: { columns: 6, rows: 6 },
        }),
      ],
    })

    const result = getSelectedCanvasEntityBundle({
      workspace,
      selectedCardIds: [],
      selectedGroupIds: ['parent-group'],
      selectedPictureIds: [],
    })

    expect(result.bundle.groups).toHaveLength(2)
    expect(result.groupIds).toContain('child-group')
    expect(result.bundle.cards).toHaveLength(1)
    expect(result.rootGroupIds).toEqual(['parent-group'])
  })

  it('does not count a child group as a root when both parent and child are selected', () => {
    const workspace = createDefaultWorkspace({
      groups: [
        createGroup({ id: 'parent-group' }),
        createGroup({
          id: 'child-group',
          name: 'Child',
          parentGroupId: 'parent-group',
          positionX: 24,
          positionY: 24,
          size: { columns: 6, rows: 6 },
        }),
      ],
    })

    const result = getSelectedCanvasEntityBundle({
      workspace,
      selectedCardIds: [],
      selectedGroupIds: ['parent-group', 'child-group'],
      selectedPictureIds: [],
    })

    expect(result.rootGroupIds).toEqual(['parent-group'])
  })

  it('includes selected pictures', () => {
    const workspace = createDefaultWorkspace({
      pictures: [createPicture({ id: 'pic-1' })],
    })

    const result = getSelectedCanvasEntityBundle({
      workspace,
      selectedCardIds: [],
      selectedGroupIds: [],
      selectedPictureIds: ['pic-1'],
    })

    expect(result.bundle.pictures).toHaveLength(1)
    expect(result.pictureIds).toEqual(['pic-1'])
  })
})

describe('duplicateCanvasEntityBundle', () => {
  it('assigns new ids to all entities', () => {
    const bundle: CanvasEntityBundle = {
      cards: [createCard({ id: 'card-1' })],
      groups: [createGroup({ id: 'group-1' })],
      pictures: [createPicture({ id: 'picture-1' })],
    }

    const duplicated = duplicateCanvasEntityBundle({ bundle })

    expect(duplicated.cards[0]?.id).not.toBe('card-1')
    expect(duplicated.groups[0]?.id).not.toBe('group-1')
    expect(duplicated.pictures[0]?.id).not.toBe('picture-1')
  })

  it('applies offset to duplicated entity positions', () => {
    const bundle: CanvasEntityBundle = {
      cards: [createCard({ positionX: 10, positionY: 20 })],
      groups: [],
      pictures: [],
    }

    const duplicated = duplicateCanvasEntityBundle({
      bundle,
      offset: { x: 100, y: 200 },
    })

    expect(duplicated.cards[0]?.positionX).toBe(110)
    expect(duplicated.cards[0]?.positionY).toBe(220)
  })

  it('remaps group references for cards and nested groups', () => {
    const bundle: CanvasEntityBundle = {
      cards: [createCard({ id: 'card-1', groupId: 'group-1' })],
      groups: [
        createGroup({ id: 'group-1' }),
        createGroup({
          id: 'group-2',
          name: 'Child',
          parentGroupId: 'group-1',
          positionX: 24,
          positionY: 24,
          size: { columns: 6, rows: 6 },
        }),
      ],
      pictures: [],
    }

    const duplicated = duplicateCanvasEntityBundle({ bundle })
    const newParentId = duplicated.groups[0]?.id
    const newChildId = duplicated.groups[1]?.id

    expect(newParentId).toBeDefined()
    expect(newChildId).toBeDefined()
    expect(duplicated.groups[1]?.parentGroupId).toBe(newParentId)
    expect(duplicated.cards[0]?.groupId).toBe(newParentId)
  })

  it('remaps image ids when imageIdMap is provided', () => {
    const bundle: CanvasEntityBundle = {
      cards: [createCard({ faviconOverrideImageId: 'img-old' })],
      groups: [],
      pictures: [createPicture({ imageId: 'img-old' })],
    }

    const duplicated = duplicateCanvasEntityBundle({
      bundle,
      imageIdMap: new Map([['img-old', 'img-new']]),
    })

    expect(duplicated.cards[0]?.faviconOverrideImageId).toBe('img-new')
    expect(duplicated.pictures[0]?.imageId).toBe('img-new')
  })

  it('sets createdAt and updatedAt to the provided timestamp', () => {
    const bundle: CanvasEntityBundle = {
      cards: [createCard()],
      groups: [createGroup()],
      pictures: [createPicture()],
    }
    const now = '2099-01-01T00:00:00.000Z'

    const duplicated = duplicateCanvasEntityBundle({ bundle, now })

    expect(duplicated.cards[0]?.createdAt).toBe(now)
    expect(duplicated.groups[0]?.createdAt).toBe(now)
    expect(duplicated.pictures[0]?.createdAt).toBe(now)
  })
})
