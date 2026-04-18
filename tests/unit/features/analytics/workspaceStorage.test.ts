import { describe, expect, it } from 'vitest'

import type { TemplateDocument } from '../../../../src/contracts/template'
import type { ThemeDocument } from '../../../../src/contracts/theme'
import { createDefaultWorkspace } from '../../../../src/contracts/workspace'
import {
  createWorkspaceStorageSnapshot,
  estimateSerializedByteSize,
} from '../../../../src/features/analytics/workspaceStorage'

function createStoredImageAssetRecord(input: {
  blobText: string
  id: string
  name: string
}) {
  const blob = new Blob([input.blobText], { type: 'image/png' })

  return {
    asset: {
      byteSize: blob.size,
      createdAt: '2026-04-04T00:00:00.000Z',
      description: undefined,
      height: 120,
      id: input.id,
      isAnimated: false,
      mimeType: 'image/png',
      name: input.name,
      originalFilename: `${input.name}.png`,
      updatedAt: '2026-04-04T00:00:00.000Z',
      width: 120,
    },
    blob,
  }
}

describe('workspaceStorage', () => {
  it('returns zero-sized logical buckets for empty board content', () => {
    const workspace = createDefaultWorkspace()

    const snapshot = createWorkspaceStorageSnapshot({
      galleryImageRecords: [],
      localStorageSnapshotBytes: 512,
      storageEstimate: null,
      templates: [],
      themes: [],
      workspace,
      workspaceImageRecords: [],
    })

    expect(snapshot.buckets.groups.bytes).toBe(0)
    expect(snapshot.buckets.cards.bytes).toBe(0)
    expect(snapshot.buckets.gallery.bytes).toBe(0)
    expect(snapshot.buckets.pictures.bytes).toBe(0)
    expect(snapshot.buckets.themes.bytes).toBe(0)
    expect(snapshot.buckets.templates.bytes).toBe(0)
    expect(snapshot.currentBoardBytes).toBe(0)
    expect(snapshot.originUsageBytes).toBeNull()
    expect(snapshot.originQuotaBytes).toBeNull()
  })

  it('builds logical byte totals for board content, images, and templates', () => {
    const pictureImageRecord = createStoredImageAssetRecord({
      blobText: 'picture-bytes',
      id: 'image-picture-1',
      name: 'Picture image',
    })
    const cardImageRecord = createStoredImageAssetRecord({
      blobText: 'card-bytes-go-here',
      id: 'image-card-1',
      name: 'Card image',
    })
    const templateImageRecord = createStoredImageAssetRecord({
      blobText: 'template-image-binary',
      id: 'template-image-1',
      name: 'Template image',
    })
    const galleryOnlyImageRecord = createStoredImageAssetRecord({
      blobText: 'gallery-only-bits',
      id: 'gallery-image-1',
      name: 'Gallery image',
    })
    const workspace = createDefaultWorkspace({
      cards: [
        {
          borderPresetIndex: 0,
          createdAt: '2026-04-04T00:00:00.000Z',
          faviconOverrideImageId: cardImageRecord.asset.id,
          faviconUrl: 'https://one.example.com/favicon.ico',
          id: 'card-1',
          positionX: 120,
          positionY: 40,
          size: { columns: 5, rows: 5 },
          title: 'Card One',
          updatedAt: '2026-04-04T00:00:00.000Z',
          url: 'https://one.example.com',
        },
      ],
      groups: [
        {
          createdAt: '2026-04-04T00:00:00.000Z',
          id: 'group-1',
          name: 'Group One',
          positionX: 0,
          positionY: 0,
          size: { columns: 8, rows: 8 },
          updatedAt: '2026-04-04T00:00:00.000Z',
        },
      ],
      pictures: [
        {
          createdAt: '2026-04-04T00:00:00.000Z',
          id: 'picture-1',
          imageId: pictureImageRecord.asset.id,
          positionX: 320,
          positionY: 80,
          size: { columns: 6, rows: 6 },
          type: 'picture',
          updatedAt: '2026-04-04T00:00:00.000Z',
        },
      ],
    })
    const template: TemplateDocument = {
      content: {
        cards: [],
        groups: [],
        images: [
          {
            asset: templateImageRecord.asset,
            sourceImageId: templateImageRecord.asset.id,
          },
        ],
        pictures: [],
      },
      createdAt: '2026-04-04T00:00:00.000Z',
      format: 'linkhub.template',
      id: 'template-1',
      name: 'Template One',
      updatedAt: '2026-04-04T00:00:00.000Z',
      version: 1,
    }
    const theme: ThemeDocument = {
      content: {
        cardDefaults: {
          defaultCardCornerRadius: 12,
          defaultCardShowImage: true,
          defaultCardShowTitle: true,
          defaultCardOpenInNewTab: true,
          defaultCardSize: { columns: 5, rows: 5 },
          defaultSurfaceShadowStyle: 'soft',
          defaultSurfaceTransparency: 0,
        },
        colorPresets: {
          borderPresetsByTheme: {
            dark: ['#111111', '#222222'],
            light: ['#dddddd', '#cccccc'],
          },
          defaultBorderPresetIndexByTheme: {
            dark: 0,
            light: 0,
          },
          defaultFillPresetIndexByTheme: {
            dark: 0,
            light: 0,
          },
          fillPresetsByTheme: {
            dark: ['#000000', '#111111'],
            light: ['#ffffff', '#f5f5f5'],
          },
        },
        tokens: {
          dark: {
            accent: '#00ff88',
            accentStrong: '#33ffaa',
            bgCanvas: '#0a0a0f',
            bgShell: '#101018',
            buttonActiveBg: '#22222c',
            buttonHoverBg: '#1b1b24',
            cardBg: '#111118',
            cardBorder: '#22222e',
            focusRing: 'rgba(0,255,136,0.2)',
            gridColor: 'rgba(255,255,255,0.06)',
            inputBg: '#111118',
            inputBorder: '#22222e',
            menuBg: '#111118',
            menuBorder: '#22222e',
            menuItemHoverBg: '#1b1b24',
            menuShadow: '0 1px 2px rgba(0,0,0,0.24)',
            panelBg: '#111118',
            panelBorder: '#22222e',
            panelShadow: '0 1px 2px rgba(0,0,0,0.24)',
            radiusLg: '0.75rem',
            radiusMd: '0.5rem',
            radiusSm: '0.25rem',
            tabActiveBg: '#111118',
            tabActiveBorder: '#00ff88',
            tabBg: '#171720',
            textMuted: '#999999',
            textPrimary: '#ededed',
            uiFont: '"Segoe UI", system-ui, sans-serif',
          },
          light: {
            accent: '#0090ff',
            accentStrong: '#006ad1',
            bgCanvas: '#ffffff',
            bgShell: '#f4f4f4',
            buttonActiveBg: '#e4e4e4',
            buttonHoverBg: '#eeeeee',
            cardBg: '#ffffff',
            cardBorder: '#cccccc',
            focusRing: 'rgba(0,144,255,0.2)',
            gridColor: 'rgba(0,0,0,0.08)',
            inputBg: '#ffffff',
            inputBorder: '#cccccc',
            menuBg: '#ffffff',
            menuBorder: '#cccccc',
            menuItemHoverBg: '#eeeeee',
            menuShadow: '0 1px 2px rgba(0,0,0,0.08)',
            panelBg: '#ffffff',
            panelBorder: '#cccccc',
            panelShadow: '0 1px 2px rgba(0,0,0,0.08)',
            radiusLg: '0.75rem',
            radiusMd: '0.5rem',
            radiusSm: '0.25rem',
            tabActiveBg: '#ffffff',
            tabActiveBorder: '#0090ff',
            tabBg: '#efefef',
            textMuted: '#666666',
            textPrimary: '#111111',
            uiFont: '"Segoe UI", system-ui, sans-serif',
          },
        },
      },
      createdAt: '2026-04-04T00:00:00.000Z',
      format: 'linkhub.theme',
      id: 'theme-1',
      name: 'Theme One',
      updatedAt: '2026-04-04T00:00:00.000Z',
      version: 1,
    }

    const snapshot = createWorkspaceStorageSnapshot({
      galleryImageRecords: [galleryOnlyImageRecord, galleryOnlyImageRecord],
      localStorageSnapshotBytes: 4096,
      storageEstimate: {
        quota: 16384,
        usage: 8192,
      },
      templates: [
        {
          imageRecords: [templateImageRecord, templateImageRecord],
          template,
        },
      ],
      themes: [theme],
      workspace,
      workspaceImageRecords: [
        pictureImageRecord,
        cardImageRecord,
        pictureImageRecord,
      ],
    })
    const expectedGroupsBytes = estimateSerializedByteSize(workspace.groups)
    const expectedCardsBytes = estimateSerializedByteSize(workspace.cards)
    const expectedPicturesBytes =
      estimateSerializedByteSize(workspace.pictures) +
      estimateSerializedByteSize(pictureImageRecord.asset) +
      pictureImageRecord.blob.size +
      estimateSerializedByteSize(cardImageRecord.asset) +
      cardImageRecord.blob.size
    const expectedTemplatesBytes =
      estimateSerializedByteSize(template) +
      estimateSerializedByteSize(template.content.images[0]) +
      templateImageRecord.blob.size
    const expectedGalleryBytes =
      estimateSerializedByteSize(galleryOnlyImageRecord.asset) +
      galleryOnlyImageRecord.blob.size
    const expectedThemesBytes = estimateSerializedByteSize([theme])

    expect(snapshot.buckets.groups.bytes).toBe(expectedGroupsBytes)
    expect(snapshot.buckets.cards.bytes).toBe(expectedCardsBytes)
    expect(snapshot.buckets.gallery.bytes).toBe(expectedGalleryBytes)
    expect(snapshot.buckets.gallery.itemCount).toBe(1)
    expect(snapshot.buckets.pictures.bytes).toBe(expectedPicturesBytes)
    expect(snapshot.buckets.pictures.linkedAssetCount).toBe(2)
    expect(snapshot.buckets.themes.bytes).toBe(expectedThemesBytes)
    expect(snapshot.buckets.themes.itemCount).toBe(1)
    expect(snapshot.buckets.templates.bytes).toBe(expectedTemplatesBytes)
    expect(snapshot.buckets.templates.itemCount).toBe(1)
    expect(snapshot.buckets.templates.linkedAssetCount).toBe(1)
    expect(snapshot.currentBoardBytes).toBe(
      expectedGroupsBytes + expectedCardsBytes + expectedPicturesBytes,
    )
    expect(snapshot.localStorageSnapshotBytes).toBe(4096)
    expect(snapshot.originUsageBytes).toBe(8192)
    expect(snapshot.originQuotaBytes).toBe(16384)
  })
})
