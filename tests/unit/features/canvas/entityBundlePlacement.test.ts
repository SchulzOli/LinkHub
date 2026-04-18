import { describe, expect, it } from 'vitest'

import { createDefaultWorkspace } from '../../../../src/contracts/workspace'
import { placeCanvasEntityBundleNearPoint } from '../../../../src/features/canvas/entityBundlePlacement'
import { isPlacementAvailable } from '../../../../src/features/placement/snapEngine'

const TIMESTAMP = '2026-04-04T00:00:00.000Z'

describe('entity bundle placement', () => {
  it('finds a free spot when the target area is occupied', () => {
    const workspace = createDefaultWorkspace({
      cards: [
        {
          id: 'existing-card',
          url: 'https://example.com',
          title: 'Existing',
          faviconUrl: '/api/favicon/example.png',
          positionX: 0,
          positionY: 0,
          size: { columns: 5, rows: 5 },
          createdAt: TIMESTAMP,
          updatedAt: TIMESTAMP,
        },
      ],
    })
    const placed = placeCanvasEntityBundleNearPoint({
      bundle: {
        cards: [
          {
            id: 'candidate-card',
            url: 'https://candidate.example.com',
            title: 'Candidate',
            faviconUrl: '/api/favicon/candidate.png',
            positionX: 0,
            positionY: 0,
            size: { columns: 5, rows: 5 },
            createdAt: TIMESTAMP,
            updatedAt: TIMESTAMP,
          },
        ],
        groups: [],
        pictures: [],
      },
      point: { x: 0, y: 0 },
      workspace,
    })

    expect(placed).not.toBeNull()
    expect(placed?.bundle.cards[0]?.positionX).not.toBe(0)
    expect(placed?.bundle.cards[0]?.positionY).not.toBe(0)
    expect(
      isPlacementAvailable(
        {
          x: placed?.bundle.cards[0]?.positionX ?? 0,
          y: placed?.bundle.cards[0]?.positionY ?? 0,
        },
        placed?.bundle.cards[0]?.size ?? { columns: 5, rows: 5 },
        workspace.placementGuide,
        {
          cards: workspace.cards,
        },
      ),
    ).toBe(true)
  })

  it('returns null for an empty bundle', () => {
    const workspace = createDefaultWorkspace()
    const placed = placeCanvasEntityBundleNearPoint({
      bundle: { cards: [], groups: [], pictures: [] },
      point: { x: 0, y: 0 },
      workspace,
    })

    expect(placed).toBeNull()
  })

  it('places a bundle directly at the target point on an empty workspace', () => {
    const workspace = createDefaultWorkspace()
    const placed = placeCanvasEntityBundleNearPoint({
      bundle: {
        cards: [
          {
            id: 'card-1',
            url: 'https://example.com',
            title: 'Example',
            faviconUrl: '/favicon.png',
            positionX: 0,
            positionY: 0,
            size: { columns: 5, rows: 5 },
            createdAt: TIMESTAMP,
            updatedAt: TIMESTAMP,
          },
        ],
        groups: [],
        pictures: [],
      },
      point: { x: 240, y: 240 },
      workspace,
    })

    expect(placed).not.toBeNull()
    expect(placed?.bundle.cards[0]).toBeDefined()
  })

  it('places a multi-card bundle and keeps all cards non-overlapping with existing cards', () => {
    const workspace = createDefaultWorkspace({
      cards: [
        {
          id: 'existing-1',
          url: 'https://existing.com',
          title: 'Existing',
          faviconUrl: '/favicon.png',
          positionX: 0,
          positionY: 0,
          size: { columns: 5, rows: 5 },
          createdAt: TIMESTAMP,
          updatedAt: TIMESTAMP,
        },
      ],
    })
    const placed = placeCanvasEntityBundleNearPoint({
      bundle: {
        cards: [
          {
            id: 'new-1',
            url: 'https://a.com',
            title: 'A',
            faviconUrl: '',
            positionX: 0,
            positionY: 0,
            size: { columns: 3, rows: 3 },
            createdAt: TIMESTAMP,
            updatedAt: TIMESTAMP,
          },
          {
            id: 'new-2',
            url: 'https://b.com',
            title: 'B',
            faviconUrl: '',
            positionX: 72,
            positionY: 0,
            size: { columns: 3, rows: 3 },
            createdAt: TIMESTAMP,
            updatedAt: TIMESTAMP,
          },
        ],
        groups: [],
        pictures: [],
      },
      point: { x: 0, y: 0 },
      workspace,
    })

    expect(placed).not.toBeNull()
    expect(placed?.bundle.cards).toHaveLength(2)

    for (const card of placed?.bundle.cards ?? []) {
      expect(
        isPlacementAvailable(
          { x: card.positionX, y: card.positionY },
          card.size,
          workspace.placementGuide,
          { cards: workspace.cards },
        ),
      ).toBe(true)
    }
  })

  it('places a bundle containing a group with cards', () => {
    const workspace = createDefaultWorkspace()
    const placed = placeCanvasEntityBundleNearPoint({
      bundle: {
        cards: [
          {
            id: 'grouped-card',
            url: 'https://example.com',
            title: 'Grouped',
            faviconUrl: '',
            positionX: 24,
            positionY: 24,
            size: { columns: 3, rows: 3 },
            groupId: 'group-1',
            createdAt: TIMESTAMP,
            updatedAt: TIMESTAMP,
          },
        ],
        groups: [
          {
            id: 'group-1',
            name: 'Group',
            positionX: 0,
            positionY: 0,
            size: { columns: 8, rows: 8 },
            createdAt: TIMESTAMP,
            updatedAt: TIMESTAMP,
          },
        ],
        pictures: [],
      },
      point: { x: 120, y: 120 },
      workspace,
    })

    expect(placed).not.toBeNull()
    expect(placed?.bundle.groups).toHaveLength(1)
    expect(placed?.bundle.cards).toHaveLength(1)
  })

  it('places a picture bundle on an empty workspace', () => {
    const workspace = createDefaultWorkspace()
    const placed = placeCanvasEntityBundleNearPoint({
      bundle: {
        cards: [],
        groups: [],
        pictures: [
          {
            id: 'pic-1',
            type: 'picture',
            imageId: 'img-1',
            positionX: 0,
            positionY: 0,
            size: { columns: 4, rows: 4 },
            createdAt: TIMESTAMP,
            updatedAt: TIMESTAMP,
          },
        ],
      },
      point: { x: 0, y: 0 },
      workspace,
    })

    expect(placed).not.toBeNull()
    expect(placed?.bundle.pictures).toHaveLength(1)
  })
})
