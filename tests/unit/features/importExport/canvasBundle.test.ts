import { describe, expect, it } from 'vitest'

import type { ImageAsset } from '../../../../src/contracts/imageAsset'
import type { TemplateDocument } from '../../../../src/contracts/template'
import type { ThemeDocument } from '../../../../src/contracts/theme'
import { createDefaultWorkspace } from '../../../../src/contracts/workspace'
import { createDefaultWorkspaceAnalytics } from '../../../../src/contracts/workspaceAnalytics'
import {
  collectReferencedImageIds,
  createCanvasBundle,
  parseCanvasBundle,
  reconcileImportedCanvasBundle,
} from '../../../../src/features/importExport/canvasBundle'

function createImageAsset(overrides?: Partial<ImageAsset>): ImageAsset {
  return {
    id: 'image-1',
    name: 'Example image',
    originalFilename: 'example.png',
    mimeType: 'image/png',
    byteSize: 4,
    isAnimated: false,
    createdAt: '2026-04-04T00:00:00.000Z',
    updatedAt: '2026-04-04T00:00:00.000Z',
    ...overrides,
  }
}

function createTemplate(
  overrides?: Partial<TemplateDocument>,
): TemplateDocument {
  return {
    format: 'linkhub.template',
    version: 1,
    id: 'template-1',
    name: 'Starter',
    description: 'Starter template',
    previewDataUrl: 'data:image/png;base64,preview',
    createdAt: '2026-04-04T00:00:00.000Z',
    updatedAt: '2026-04-04T00:00:00.000Z',
    content: {
      cards: [
        {
          id: 'template-card-1',
          url: 'https://template.example.com',
          title: 'Template card',
          faviconUrl: '/api/favicon/template.png',
          faviconOverrideImageId: 'template-image-1',
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
          id: 'template-picture-1',
          type: 'picture',
          imageId: 'template-image-1',
          positionX: 48,
          positionY: 96,
          size: { columns: 6, rows: 4 },
          createdAt: '2026-04-04T00:00:00.000Z',
          updatedAt: '2026-04-04T00:00:00.000Z',
        },
      ],
      images: [
        {
          asset: createImageAsset({
            id: 'template-image-1',
            name: 'Template image',
            originalFilename: 'template.png',
          }),
          sourceImageId: 'template-image-1',
        },
      ],
    },
    ...overrides,
  }
}

function createTheme(overrides?: Partial<ThemeDocument>): ThemeDocument {
  return {
    format: 'linkhub.theme',
    version: 1,
    id: 'theme-1',
    name: 'Neon Custom',
    description: 'Saved custom theme',
    author: 'Test',
    createdAt: '2026-04-04T00:00:00.000Z',
    updatedAt: '2026-04-04T00:00:00.000Z',
    content: {
      tokens: {
        light: {
          uiFont: '"Segoe UI", system-ui, sans-serif',
          bgCanvas: '#ffffff',
          bgShell: '#f4f4f4',
          panelBg: '#ffffff',
          panelBorder: '#cccccc',
          panelShadow: '0 1px 2px rgba(0,0,0,0.08)',
          cardBg: '#ffffff',
          cardBorder: '#cccccc',
          inputBg: '#ffffff',
          inputBorder: '#cccccc',
          gridColor: 'rgba(0,0,0,0.08)',
          textPrimary: '#111111',
          textMuted: '#666666',
          accent: '#0090ff',
          accentStrong: '#006ad1',
          buttonHoverBg: '#eeeeee',
          buttonActiveBg: '#e4e4e4',
          menuBg: '#ffffff',
          menuBorder: '#cccccc',
          menuShadow: '0 1px 2px rgba(0,0,0,0.08)',
          menuItemHoverBg: '#eeeeee',
          tabBg: '#efefef',
          tabActiveBg: '#ffffff',
          tabActiveBorder: '#0090ff',
          focusRing: 'rgba(0,144,255,0.2)',
          radiusSm: '0.25rem',
          radiusMd: '0.5rem',
          radiusLg: '0.75rem',
        },
        dark: {
          uiFont: '"Segoe UI", system-ui, sans-serif',
          bgCanvas: '#0a0a0f',
          bgShell: '#101018',
          panelBg: '#111118',
          panelBorder: '#22222e',
          panelShadow: '0 1px 2px rgba(0,0,0,0.24)',
          cardBg: '#111118',
          cardBorder: '#22222e',
          inputBg: '#111118',
          inputBorder: '#22222e',
          gridColor: 'rgba(255,255,255,0.06)',
          textPrimary: '#ededed',
          textMuted: '#999999',
          accent: '#00ff88',
          accentStrong: '#66ffbb',
          buttonHoverBg: '#1b1b24',
          buttonActiveBg: '#22222c',
          menuBg: '#111118',
          menuBorder: '#22222e',
          menuShadow: '0 1px 2px rgba(0,0,0,0.24)',
          menuItemHoverBg: '#1b1b24',
          tabBg: '#171720',
          tabActiveBg: '#111118',
          tabActiveBorder: '#00ff88',
          focusRing: 'rgba(0,255,136,0.2)',
          radiusSm: '0.25rem',
          radiusMd: '0.5rem',
          radiusLg: '0.75rem',
        },
      },
      cardDefaults: {
        defaultCardSize: { columns: 5, rows: 5 },
        defaultCardCornerRadius: 10,
        defaultCardShowTitle: true,
        defaultCardShowImage: true,
        defaultCardOpenInNewTab: true,
        defaultSurfaceTransparency: 0,
        defaultSurfaceShadowStyle: 'soft',
      },
      colorPresets: {
        fillPresetsByTheme: {
          light: ['#ffffff', '#eeeeee', '#dddddd', '#cccccc', '#bbbbbb'],
          dark: ['#111111', '#1a1a1a', '#222222', '#2a2a2a', '#333333'],
        },
        borderPresetsByTheme: {
          light: ['#cccccc', '#999999', '#777777', '#555555', '#333333'],
          dark: ['#333333', '#555555', '#777777', '#999999', '#bbbbbb'],
        },
        defaultFillPresetIndexByTheme: { light: 0, dark: 0 },
        defaultBorderPresetIndexByTheme: { light: 0, dark: 0 },
      },
    },
    ...overrides,
  }
}

describe('canvas bundle', () => {
  it('collects referenced image ids from pictures and card overrides without duplicates', () => {
    const workspace = createDefaultWorkspace({
      cards: [
        {
          id: 'card-1',
          url: 'https://example.com',
          title: 'Example',
          faviconUrl: '/api/favicon/example.png',
          faviconOverrideImageId: 'image-1',
          positionX: 0,
          positionY: 0,
          size: { columns: 5, rows: 5 },
          createdAt: '2026-04-04T00:00:00.000Z',
          updatedAt: '2026-04-04T00:00:00.000Z',
        },
      ],
      pictures: [
        {
          id: 'picture-1',
          type: 'picture',
          imageId: 'image-1',
          positionX: 48,
          positionY: 96,
          size: { columns: 6, rows: 4 },
          createdAt: '2026-04-04T00:00:00.000Z',
          updatedAt: '2026-04-04T00:00:00.000Z',
        },
        {
          id: 'picture-2',
          type: 'picture',
          imageId: 'image-2',
          positionX: 144,
          positionY: 96,
          size: { columns: 6, rows: 4 },
          createdAt: '2026-04-04T00:00:00.000Z',
          updatedAt: '2026-04-04T00:00:00.000Z',
        },
      ],
    })

    expect(collectReferencedImageIds(workspace)).toEqual(['image-1', 'image-2'])
  })

  it('exports and parses a canvas bundle while resetting analytics', async () => {
    const workspace = createDefaultWorkspace({
      analytics: {
        dailyBuckets: {
          '2026-04-04': {
            canvasOpens: 4,
            linkOpens: 2,
            linkOpensByCardId: { 'card-1': 2 },
          },
        },
        totals: {
          canvasOpens: 4,
          linkOpens: 2,
          linkOpensByCardId: { 'card-1': 2 },
        },
      },
      cards: [
        {
          id: 'card-1',
          url: 'https://example.com',
          title: 'Example',
          faviconUrl: '/api/favicon/example.png',
          faviconOverrideImageId: 'image-1',
          positionX: 0,
          positionY: 0,
          size: { columns: 5, rows: 5 },
          createdAt: '2026-04-04T00:00:00.000Z',
          updatedAt: '2026-04-04T00:00:00.000Z',
        },
      ],
      pictures: [
        {
          id: 'picture-1',
          type: 'picture',
          imageId: 'image-1',
          positionX: 48,
          positionY: 96,
          size: { columns: 6, rows: 4 },
          createdAt: '2026-04-04T00:00:00.000Z',
          updatedAt: '2026-04-04T00:00:00.000Z',
        },
      ],
    })
    const imageRecord = {
      asset: createImageAsset(),
      blob: new File(['png!'], 'example.png', { type: 'image/png' }),
    }
    const extraGalleryImageRecord = {
      asset: createImageAsset({
        id: 'image-2',
        name: 'Unused image',
        originalFilename: 'unused.png',
      }),
      blob: new File(['unused'], 'unused.png', { type: 'image/png' }),
    }
    const template = createTemplate()
    const templateImageRecord = {
      asset: createImageAsset({
        id: 'template-image-1',
        name: 'Template image',
        originalFilename: 'template.png',
      }),
      blob: new File(['template'], 'template.png', { type: 'image/png' }),
    }
    const theme = createTheme()

    const bundle = await createCanvasBundle(
      workspace,
      [imageRecord, extraGalleryImageRecord],
      {
        imageScope: 'gallery',
        themes: [theme],
        templates: [{ template, images: [templateImageRecord] }],
      },
    )
    const parsed = await parseCanvasBundle(bundle)

    expect(parsed.workspace.cards[0]?.faviconOverrideImageId).toBe('image-1')
    expect(parsed.workspace.pictures[0]?.imageId).toBe('image-1')
    expect(parsed.images).toHaveLength(2)
    expect(parsed.images[0]?.asset.id).toBe('image-1')
    expect(parsed.images[1]?.asset.id).toBe('image-2')
    expect(parsed.manifest.imageScope).toBe('gallery')
    expect(parsed.manifest.templates).toEqual({
      count: 1,
      imageCount: 1,
    })
    expect(parsed.manifest.themes).toEqual({ count: 1 })
    expect(parsed.templates).toHaveLength(1)
    expect(parsed.themes).toHaveLength(1)
    expect(parsed.themes[0]?.name).toBe('Neon Custom')
    expect(parsed.templates[0]?.template.name).toBe('Starter')
    expect(parsed.templates[0]?.template.previewDataUrl).toBe(
      'data:image/png;base64,preview',
    )
    expect(parsed.templates[0]?.images[0]?.asset.id).toBe('template-image-1')
    expect(parsed.workspace.analytics).toEqual(
      createDefaultWorkspaceAnalytics(),
    )
  })

  it('remaps conflicting imported image ids and rewrites workspace references', async () => {
    const bundle = {
      manifest: {
        format: 'linkhub.canvas-bundle',
        version: 1,
        exportedAt: '2026-04-04T00:00:00.000Z',
        workspace: {
          id: 'default',
          name: 'Home',
          cardCount: 1,
          groupCount: 0,
          pictureCount: 1,
        },
        images: [],
      },
      workspace: createDefaultWorkspace({
        cards: [
          {
            id: 'card-1',
            url: 'https://example.com',
            title: 'Example',
            faviconUrl: '/api/favicon/example.png',
            faviconOverrideImageId: 'image-1',
            positionX: 0,
            positionY: 0,
            size: { columns: 5, rows: 5 },
            createdAt: '2026-04-04T00:00:00.000Z',
            updatedAt: '2026-04-04T00:00:00.000Z',
          },
        ],
        pictures: [
          {
            id: 'picture-1',
            type: 'picture',
            imageId: 'image-1',
            positionX: 48,
            positionY: 96,
            size: { columns: 6, rows: 4 },
            createdAt: '2026-04-04T00:00:00.000Z',
            updatedAt: '2026-04-04T00:00:00.000Z',
          },
        ],
      }),
      templates: [
        {
          template: createTemplate(),
          images: [
            {
              asset: createImageAsset({
                id: 'template-image-1',
                name: 'Template image',
                originalFilename: 'template.png',
              }),
              blob: new File(['template'], 'template.png', {
                type: 'image/png',
              }),
            },
          ],
        },
      ],
      themes: [createTheme()],
      images: [
        {
          asset: createImageAsset(),
          blob: new File(['imported'], 'example.png', { type: 'image/png' }),
        },
      ],
    } as const

    const reconciled = await reconcileImportedCanvasBundle({
      bundle,
      resolveExistingImage: async () => ({
        asset: createImageAsset({ byteSize: 8 }),
        blob: new File(['existing!'], 'example.png', { type: 'image/png' }),
      }),
    })

    expect(reconciled.imagesToStore).toHaveLength(1)
    expect(reconciled.imagesToStore[0]?.asset.id).not.toBe('image-1')
    expect(reconciled.templatesToStore).toHaveLength(1)
    expect(reconciled.templatesToStore[0]?.template.id).toBe('template-1')
    expect(reconciled.themesToStore).toHaveLength(1)
    expect(reconciled.themesToStore[0]?.id).toBe('theme-1')
    expect(reconciled.workspace.cards[0]?.faviconOverrideImageId).toBe(
      reconciled.imagesToStore[0]?.asset.id,
    )
    expect(reconciled.workspace.pictures[0]?.imageId).toBe(
      reconciled.imagesToStore[0]?.asset.id,
    )
  })
})
