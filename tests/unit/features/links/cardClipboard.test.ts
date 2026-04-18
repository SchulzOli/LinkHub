import { describe, expect, it } from 'vitest'

import {
  CARD_CLIPBOARD_PREFIX,
  parseCardClipboard,
  parseSelectionClipboard,
  SELECTION_CLIPBOARD_PREFIX,
  serializeCardClipboard,
  serializeSelectionClipboard,
} from '../../../../src/features/links/cardClipboard'

describe('card clipboard', () => {
  it('serializes and parses copied cards', () => {
    const serialized = serializeCardClipboard([
      {
        id: 'card-1',
        url: 'https://example.com/',
        title: 'Example',
        faviconUrl: 'https://example.com/favicon.ico',
        positionX: 24,
        positionY: 48,
        size: { columns: 5, rows: 6 },
        cornerRadius: 12,
        showTitle: true,
        showImage: false,
        fillPresetIndex: 1,
        borderPresetIndex: 2,
        createdAt: '2026-04-03T00:00:00.000Z',
        updatedAt: '2026-04-03T00:00:00.000Z',
      },
    ])

    expect(serialized.startsWith(CARD_CLIPBOARD_PREFIX)).toBe(true)
    expect(parseCardClipboard(serialized)).toEqual({
      version: 1,
      cards: [
        {
          id: 'card-1',
          url: 'https://example.com/',
          title: 'Example',
          faviconUrl: 'https://example.com/favicon.ico',
          positionX: 24,
          positionY: 48,
          size: { columns: 5, rows: 6 },
          cornerRadius: 12,
          showTitle: true,
          showImage: false,
          fillPresetIndex: 1,
          borderPresetIndex: 2,
          createdAt: '2026-04-03T00:00:00.000Z',
          updatedAt: '2026-04-03T00:00:00.000Z',
        },
      ],
    })
  })

  it('rejects non-LinkHub clipboard text', () => {
    expect(parseCardClipboard('https://example.com/')).toBeNull()
  })

  it('serializes and parses copied selections with groups', () => {
    const serialized = serializeSelectionClipboard({
      cards: [
        {
          id: 'card-1',
          url: 'https://example.com/',
          title: 'Example',
          faviconUrl: 'https://example.com/favicon.ico',
          positionX: 24,
          positionY: 48,
          size: { columns: 5, rows: 6 },
          cornerRadius: 12,
          showTitle: true,
          showImage: false,
          fillPresetIndex: 1,
          borderPresetIndex: 2,
          createdAt: '2026-04-03T00:00:00.000Z',
          updatedAt: '2026-04-03T00:00:00.000Z',
          groupId: 'group-1',
        },
      ],
      groups: [
        {
          id: 'group-1',
          name: 'Group',
          positionX: 0,
          positionY: 0,
          size: { columns: 8, rows: 8 },
          collapsed: false,
          createdAt: '2026-04-03T00:00:00.000Z',
          updatedAt: '2026-04-03T00:00:00.000Z',
        },
      ],
    })

    expect(serialized.startsWith(SELECTION_CLIPBOARD_PREFIX)).toBe(true)
    expect(parseSelectionClipboard(serialized)).toEqual({
      version: 2,
      cards: [
        {
          id: 'card-1',
          url: 'https://example.com/',
          title: 'Example',
          faviconUrl: 'https://example.com/favicon.ico',
          positionX: 24,
          positionY: 48,
          size: { columns: 5, rows: 6 },
          cornerRadius: 12,
          showTitle: true,
          showImage: false,
          fillPresetIndex: 1,
          borderPresetIndex: 2,
          createdAt: '2026-04-03T00:00:00.000Z',
          updatedAt: '2026-04-03T00:00:00.000Z',
          groupId: 'group-1',
        },
      ],
      groups: [
        {
          id: 'group-1',
          name: 'Group',
          positionX: 0,
          positionY: 0,
          size: { columns: 8, rows: 8 },
          collapsed: false,
          createdAt: '2026-04-03T00:00:00.000Z',
          updatedAt: '2026-04-03T00:00:00.000Z',
        },
      ],
    })
  })

  it('parses legacy card clipboard text as a selection payload', () => {
    const serialized = serializeCardClipboard([
      {
        id: 'card-1',
        url: 'https://example.com/',
        title: 'Example',
        faviconUrl: 'https://example.com/favicon.ico',
        positionX: 24,
        positionY: 48,
        size: { columns: 5, rows: 6 },
        cornerRadius: 12,
        showTitle: true,
        showImage: false,
        fillPresetIndex: 1,
        borderPresetIndex: 2,
        createdAt: '2026-04-03T00:00:00.000Z',
        updatedAt: '2026-04-03T00:00:00.000Z',
      },
    ])

    expect(parseSelectionClipboard(serialized)).toEqual({
      version: 2,
      cards: [
        {
          id: 'card-1',
          url: 'https://example.com/',
          title: 'Example',
          faviconUrl: 'https://example.com/favicon.ico',
          positionX: 24,
          positionY: 48,
          size: { columns: 5, rows: 6 },
          cornerRadius: 12,
          showTitle: true,
          showImage: false,
          fillPresetIndex: 1,
          borderPresetIndex: 2,
          createdAt: '2026-04-03T00:00:00.000Z',
          updatedAt: '2026-04-03T00:00:00.000Z',
        },
      ],
      groups: [],
    })
  })

  it('rejects card clipboard with invalid JSON after prefix', () => {
    expect(parseCardClipboard(`${CARD_CLIPBOARD_PREFIX}{not-json`)).toBeNull()
  })

  it('rejects card clipboard with wrong version number', () => {
    expect(
      parseCardClipboard(
        `${CARD_CLIPBOARD_PREFIX}${JSON.stringify({ version: 99, cards: [] })}`,
      ),
    ).toBeNull()
  })

  it('rejects card clipboard with empty cards array', () => {
    expect(
      parseCardClipboard(
        `${CARD_CLIPBOARD_PREFIX}${JSON.stringify({ version: 1, cards: [] })}`,
      ),
    ).toBeNull()
  })

  it('rejects card clipboard with missing required card fields', () => {
    expect(
      parseCardClipboard(
        `${CARD_CLIPBOARD_PREFIX}${JSON.stringify({ version: 1, cards: [{ id: 'card-1' }] })}`,
      ),
    ).toBeNull()
  })

  it('rejects selection clipboard with invalid JSON after prefix', () => {
    expect(
      parseSelectionClipboard(`${SELECTION_CLIPBOARD_PREFIX}broken!!!`),
    ).toBeNull()
  })

  it('rejects selection clipboard with empty cards and empty groups', () => {
    expect(
      parseSelectionClipboard(
        `${SELECTION_CLIPBOARD_PREFIX}${JSON.stringify({ version: 2, cards: [], groups: [] })}`,
      ),
    ).toBeNull()
  })

  it('accepts selection clipboard with only groups and no cards', () => {
    const serialized = serializeSelectionClipboard({
      cards: [],
      groups: [
        {
          id: 'group-1',
          name: 'Solo group',
          positionX: 0,
          positionY: 0,
          size: { columns: 8, rows: 8 },
          collapsed: false,
          createdAt: '2026-04-03T00:00:00.000Z',
          updatedAt: '2026-04-03T00:00:00.000Z',
        },
      ],
    })

    const parsed = parseSelectionClipboard(serialized)

    expect(parsed).toEqual({
      version: 2,
      cards: [],
      groups: [expect.objectContaining({ id: 'group-1', name: 'Solo group' })],
    })
  })

  it('returns null for plain text that is not a linkhub format', () => {
    expect(parseSelectionClipboard('just some random text')).toBeNull()
    expect(parseCardClipboard('https://example.com/')).toBeNull()
  })

  it('roundtrips multiple cards through card clipboard', () => {
    const cards = [
      {
        id: 'card-1',
        url: 'https://a.example.com/',
        title: 'A',
        faviconUrl: '',
        positionX: 0,
        positionY: 0,
        size: { columns: 5, rows: 5 },
        createdAt: '2026-04-03T00:00:00.000Z',
        updatedAt: '2026-04-03T00:00:00.000Z',
      },
      {
        id: 'card-2',
        url: 'https://b.example.com/',
        title: 'B',
        faviconUrl: '',
        positionX: 120,
        positionY: 0,
        size: { columns: 4, rows: 4 },
        createdAt: '2026-04-03T00:00:00.000Z',
        updatedAt: '2026-04-03T00:00:00.000Z',
      },
    ]

    const serialized = serializeCardClipboard(cards)
    const parsed = parseCardClipboard(serialized)

    expect(parsed?.cards).toHaveLength(2)
    expect(parsed?.cards[0]?.id).toBe('card-1')
    expect(parsed?.cards[1]?.id).toBe('card-2')
  })

  it('roundtrips nested groups with parentGroupId through selection clipboard', () => {
    const serialized = serializeSelectionClipboard({
      cards: [
        {
          id: 'card-1',
          url: 'https://example.com/',
          title: 'Nested',
          faviconUrl: '',
          positionX: 24,
          positionY: 24,
          size: { columns: 3, rows: 3 },
          groupId: 'child-group',
          createdAt: '2026-04-03T00:00:00.000Z',
          updatedAt: '2026-04-03T00:00:00.000Z',
        },
      ],
      groups: [
        {
          id: 'parent-group',
          name: 'Parent',
          positionX: 0,
          positionY: 0,
          size: { columns: 10, rows: 10 },
          createdAt: '2026-04-03T00:00:00.000Z',
          updatedAt: '2026-04-03T00:00:00.000Z',
        },
        {
          id: 'child-group',
          name: 'Child',
          positionX: 24,
          positionY: 24,
          size: { columns: 6, rows: 6 },
          parentGroupId: 'parent-group',
          createdAt: '2026-04-03T00:00:00.000Z',
          updatedAt: '2026-04-03T00:00:00.000Z',
        },
      ],
    })

    const parsed = parseSelectionClipboard(serialized)

    expect(parsed?.groups).toHaveLength(2)
    expect(parsed?.groups[1]?.parentGroupId).toBe('parent-group')
    expect(parsed?.cards[0]?.groupId).toBe('child-group')
  })
})
