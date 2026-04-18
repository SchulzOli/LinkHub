import { describe, expect, it } from 'vitest'

import { createDefaultWorkspace } from '../../../../src/contracts/workspace'
import {
  formatImageDeleteConfirmation,
  getImageUsageSummary,
  getImageUsageSummaryMapForEntities,
} from '../../../../src/features/images/imageUsage'

describe('image usage', () => {
  it('counts picture nodes and card overrides independently', () => {
    const workspace = createDefaultWorkspace({
      cards: [
        {
          id: 'card-1',
          url: 'https://example.com/',
          title: 'Example',
          faviconUrl: '/api/favicon/assets/example/128.png',
          faviconOverrideImageId: 'image-1',
          positionX: 0,
          positionY: 0,
          size: { columns: 5, rows: 5 },
          createdAt: '2026-04-03T00:00:00.000Z',
          updatedAt: '2026-04-03T00:00:00.000Z',
        },
      ],
      pictures: [
        {
          id: 'picture-1',
          type: 'picture',
          imageId: 'image-1',
          positionX: 32,
          positionY: 64,
          size: { columns: 6, rows: 4 },
          createdAt: '2026-04-03T00:00:00.000Z',
          updatedAt: '2026-04-03T00:00:00.000Z',
        },
      ],
    })

    expect(getImageUsageSummary(workspace, 'image-1')).toEqual({
      imageId: 'image-1',
      pictureIds: ['picture-1'],
      pictureCount: 1,
      cardOverrideIds: ['card-1'],
      cardOverrideCount: 1,
      totalCount: 2,
    })
  })

  it('builds usage summaries for all requested image ids in one pass', () => {
    const workspace = createDefaultWorkspace({
      cards: [
        {
          id: 'card-1',
          url: 'https://example.com/',
          title: 'Example',
          faviconUrl: '/api/favicon/assets/example/128.png',
          faviconOverrideImageId: 'image-1',
          positionX: 0,
          positionY: 0,
          size: { columns: 5, rows: 5 },
          createdAt: '2026-04-03T00:00:00.000Z',
          updatedAt: '2026-04-03T00:00:00.000Z',
        },
      ],
      pictures: [
        {
          id: 'picture-1',
          type: 'picture',
          imageId: 'image-2',
          positionX: 32,
          positionY: 64,
          size: { columns: 6, rows: 4 },
          createdAt: '2026-04-03T00:00:00.000Z',
          updatedAt: '2026-04-03T00:00:00.000Z',
        },
      ],
    })

    expect(
      getImageUsageSummaryMapForEntities(workspace.cards, workspace.pictures, [
        'image-1',
        'image-2',
        'image-3',
      ]),
    ).toEqual({
      'image-1': {
        imageId: 'image-1',
        pictureIds: [],
        pictureCount: 0,
        cardOverrideIds: ['card-1'],
        cardOverrideCount: 1,
        totalCount: 1,
      },
      'image-2': {
        imageId: 'image-2',
        pictureIds: ['picture-1'],
        pictureCount: 1,
        cardOverrideIds: [],
        cardOverrideCount: 0,
        totalCount: 1,
      },
      'image-3': {
        imageId: 'image-3',
        pictureIds: [],
        pictureCount: 0,
        cardOverrideIds: [],
        cardOverrideCount: 0,
        totalCount: 0,
      },
    })
  })

  it('formats a destructive confirmation message for in-use images', () => {
    expect(
      formatImageDeleteConfirmation({
        imageId: 'image-1',
        pictureIds: ['picture-1', 'picture-2'],
        pictureCount: 2,
        cardOverrideIds: ['card-1'],
        cardOverrideCount: 1,
        totalCount: 3,
      }),
    ).toContain('used by 2 picture nodes and 1 link card override')
  })
})
