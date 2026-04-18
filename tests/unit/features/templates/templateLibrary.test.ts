import { describe, expect, it } from 'vitest'

import type { ImageAsset } from '../../../../src/contracts/imageAsset'
import {
  collectBundleImageIds,
  createTemplateDocument,
  duplicateTemplateDocument,
  materializeTemplateDocument,
} from '../../../../src/features/templates/templateLibrary'

function createImageAsset(
  id: string,
  overrides?: Partial<ImageAsset>,
): ImageAsset {
  return {
    id,
    name: `Image ${id}`,
    originalFilename: `${id}.png`,
    mimeType: 'image/png',
    byteSize: 4,
    isAnimated: false,
    createdAt: '2026-04-04T00:00:00.000Z',
    updatedAt: '2026-04-04T00:00:00.000Z',
    ...overrides,
  }
}

describe('template library', () => {
  it('collects unique image ids from cards and pictures', () => {
    expect(
      collectBundleImageIds({
        cards: [
          {
            id: 'card-1',
            url: 'https://example.com',
            title: 'Card',
            faviconUrl: '/api/favicon/example.png',
            faviconOverrideImageId: 'image-1',
            positionX: 120,
            positionY: 160,
            size: { columns: 5, rows: 5 },
            createdAt: '2026-04-04T00:00:00.000Z',
            updatedAt: '2026-04-04T00:00:00.000Z',
          },
        ],
        groups: [],
        pictures: [
          {
            id: 'picture-1',
            type: 'picture',
            imageId: 'image-1',
            positionX: 220,
            positionY: 260,
            size: { columns: 6, rows: 4 },
            createdAt: '2026-04-04T00:00:00.000Z',
            updatedAt: '2026-04-04T00:00:00.000Z',
          },
        ],
      }),
    ).toEqual(['image-1'])
  })

  it('creates a normalized template document', () => {
    const imageRecord = {
      asset: createImageAsset('image-1'),
      blob: new File(['png'], 'image-1.png', { type: 'image/png' }),
    }
    const template = createTemplateDocument({
      bundle: {
        cards: [
          {
            id: 'card-1',
            url: 'https://example.com',
            title: 'Card',
            faviconUrl: '/api/favicon/example.png',
            faviconOverrideImageId: 'image-1',
            groupId: 'group-1',
            positionX: 120,
            positionY: 144,
            size: { columns: 5, rows: 5 },
            createdAt: '2026-04-04T00:00:00.000Z',
            updatedAt: '2026-04-04T00:00:00.000Z',
          },
        ],
        groups: [
          {
            id: 'group-1',
            name: 'Group',
            positionX: 96,
            positionY: 96,
            size: { columns: 8, rows: 8 },
            createdAt: '2026-04-04T00:00:00.000Z',
            updatedAt: '2026-04-04T00:00:00.000Z',
          },
        ],
        pictures: [
          {
            id: 'picture-1',
            type: 'picture',
            imageId: 'image-1',
            positionX: 216,
            positionY: 192,
            size: { columns: 6, rows: 4 },
            createdAt: '2026-04-04T00:00:00.000Z',
            updatedAt: '2026-04-04T00:00:00.000Z',
          },
        ],
      },
      description: '  Example template  ',
      imageRecords: [imageRecord],
      name: '  Example  ',
      templateId: 'template-1',
      timestamps: {
        createdAt: '2026-04-04T00:00:00.000Z',
        updatedAt: '2026-04-04T00:00:00.000Z',
      },
    })

    expect(template.name).toBe('Example')
    expect(template.description).toBe('Example template')
    expect(template.content.groups[0]?.positionX).toBe(0)
    expect(template.content.groups[0]?.positionY).toBe(0)
    expect(template.content.cards[0]?.positionX).toBe(24)
    expect(template.content.cards[0]?.positionY).toBe(48)
    expect(template.content.pictures[0]?.positionX).toBe(120)
    expect(template.content.pictures[0]?.positionY).toBe(96)
    expect(template.content.images[0]?.asset.id).toBe('image-1')
  })

  it('materializes a template and remaps conflicting images', async () => {
    const imageRecord = {
      asset: createImageAsset('image-1'),
      blob: new File(['incoming'], 'image-1.png', { type: 'image/png' }),
    }
    const template = createTemplateDocument({
      bundle: {
        cards: [
          {
            id: 'card-1',
            url: 'https://example.com',
            title: 'Card',
            faviconUrl: '/api/favicon/example.png',
            faviconOverrideImageId: 'image-1',
            positionX: 0,
            positionY: 0,
            size: { columns: 5, rows: 5 },
            createdAt: '2026-04-04T00:00:00.000Z',
            updatedAt: '2026-04-04T00:00:00.000Z',
          },
        ],
        groups: [],
        pictures: [
          {
            id: 'picture-1',
            type: 'picture',
            imageId: 'image-1',
            positionX: 144,
            positionY: 0,
            size: { columns: 6, rows: 4 },
            createdAt: '2026-04-04T00:00:00.000Z',
            updatedAt: '2026-04-04T00:00:00.000Z',
          },
        ],
      },
      description: '',
      imageRecords: [imageRecord],
      name: 'Example',
      templateId: 'template-1',
      timestamps: {
        createdAt: '2026-04-04T00:00:00.000Z',
        updatedAt: '2026-04-04T00:00:00.000Z',
      },
    })

    const materialized = await materializeTemplateDocument({
      imageRecords: [imageRecord],
      resolveExistingImage: async () => ({
        asset: createImageAsset('image-1', { byteSize: 8 }),
        blob: new File(['existing'], 'image-1.png', { type: 'image/png' }),
      }),
      template,
    })

    expect(materialized.imagesToStore).toHaveLength(1)
    expect(materialized.imagesToStore[0]?.asset.id).not.toBe('image-1')
    expect(materialized.bundle.cards[0]?.id).not.toBe('card-1')
    expect(materialized.bundle.pictures[0]?.id).not.toBe('picture-1')
    expect(materialized.bundle.cards[0]?.faviconOverrideImageId).toBe(
      materialized.imagesToStore[0]?.asset.id,
    )
    expect(materialized.bundle.pictures[0]?.imageId).toBe(
      materialized.imagesToStore[0]?.asset.id,
    )
  })

  it('duplicates template metadata with a new id', () => {
    const duplicated = duplicateTemplateDocument({
      template: createTemplateDocument({
        bundle: { cards: [], groups: [], pictures: [] },
        description: '',
        imageRecords: [],
        name: 'Example',
        templateId: 'template-1',
        timestamps: {
          createdAt: '2026-04-04T00:00:00.000Z',
          updatedAt: '2026-04-04T00:00:00.000Z',
        },
      }),
    })

    expect(duplicated.id).not.toBe('template-1')
    expect(duplicated.name).toBe('Example copy')
  })
})
