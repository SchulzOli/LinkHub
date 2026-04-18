import { beforeEach, describe, expect, it } from 'vitest'

import { createDefaultWorkspace } from '../../../../src/contracts/workspace'
import { useWorkspaceStore } from '../../../../src/state/useWorkspaceStore'

describe('appearance store', () => {
  beforeEach(() => {
    useWorkspaceStore.getState().hydrateWorkspace(createDefaultWorkspace())
  })

  it('updates theme mode', () => {
    useWorkspaceStore.getState().setThemeMode('light')

    expect(useWorkspaceStore.getState().workspace.appearance.themeMode).toBe(
      'light',
    )
  })

  it('updates the default card size', () => {
    useWorkspaceStore.getState().setDefaultCardSize({ columns: 4, rows: 6 })

    expect(
      useWorkspaceStore.getState().workspace.appearance.defaultCardSize,
    ).toEqual({ columns: 4, rows: 6 })
  })

  it('updates and resets non-color appearance options', () => {
    useWorkspaceStore.getState().setThemeMode('light')
    useWorkspaceStore.getState().setStylePreset('blueprint')
    useWorkspaceStore.getState().setDefaultCardSize({ columns: 4, rows: 6 })
    useWorkspaceStore.getState().setDefaultCardCornerRadius(22)
    useWorkspaceStore.getState().setDefaultCardShowTitle(false)
    useWorkspaceStore.getState().setDefaultCardShowImage(false)
    useWorkspaceStore.getState().setDefaultCardOpenInNewTab(false)
    useWorkspaceStore.getState().setDefaultSurfaceTransparency(42)
    useWorkspaceStore.getState().setDefaultSurfaceShadowStyle('long')
    useWorkspaceStore
      .getState()
      .setFillPresets(['#111111', '#222222', '#333333', '#444444', '#555555'])

    useWorkspaceStore.getState().resetAppearanceOptions()

    expect(useWorkspaceStore.getState().workspace.appearance.themeMode).toBe(
      'dark',
    )
    expect(useWorkspaceStore.getState().workspace.appearance.stylePreset).toBe(
      'excalidraw',
    )
    expect(
      useWorkspaceStore.getState().workspace.appearance.defaultCardSize,
    ).toEqual({ columns: 5, rows: 5 })
    expect(
      useWorkspaceStore.getState().workspace.appearance.defaultCardCornerRadius,
    ).toBe(10)
    expect(
      useWorkspaceStore.getState().workspace.appearance.defaultCardShowTitle,
    ).toBe(true)
    expect(
      useWorkspaceStore.getState().workspace.appearance.defaultCardShowImage,
    ).toBe(true)
    expect(
      useWorkspaceStore.getState().workspace.appearance.defaultCardOpenInNewTab,
    ).toBe(true)
    expect(
      useWorkspaceStore.getState().workspace.appearance
        .defaultSurfaceTransparency,
    ).toBe(0)
    expect(
      useWorkspaceStore.getState().workspace.appearance
        .defaultSurfaceShadowStyle,
    ).toBe('soft')
    expect(
      useWorkspaceStore.getState().workspace.appearance.fillPresetsByTheme
        .light,
    ).toEqual(['#111111', '#222222', '#333333', '#444444', '#555555'])
  })

  it('updates default card visibility options', () => {
    useWorkspaceStore.getState().setDefaultCardShowTitle(false)
    useWorkspaceStore.getState().setDefaultCardShowImage(false)
    useWorkspaceStore.getState().setDefaultCardOpenInNewTab(false)

    expect(
      useWorkspaceStore.getState().workspace.appearance.defaultCardShowTitle,
    ).toBe(false)
    expect(
      useWorkspaceStore.getState().workspace.appearance.defaultCardShowImage,
    ).toBe(false)
    expect(
      useWorkspaceStore.getState().workspace.appearance.defaultCardOpenInNewTab,
    ).toBe(false)
  })

  it('updates default surface effects', () => {
    useWorkspaceStore.getState().setDefaultSurfaceTransparency(28)
    useWorkspaceStore.getState().setDefaultSurfaceShadowStyle('hard')

    expect(
      useWorkspaceStore.getState().workspace.appearance
        .defaultSurfaceTransparency,
    ).toBe(28)
    expect(
      useWorkspaceStore.getState().workspace.appearance
        .defaultSurfaceShadowStyle,
    ).toBe('hard')
  })

  it('updates color presets and default preset selections', () => {
    useWorkspaceStore
      .getState()
      .setFillPresets(['#111111', '#222222', '#333333', '#444444', '#555555'])
    useWorkspaceStore
      .getState()
      .setBorderPresets(['#aaaaaa', '#bbbbbb', '#cccccc', '#dddddd', '#eeeeee'])
    useWorkspaceStore.getState().setDefaultFillPresetIndex(2)
    useWorkspaceStore.getState().setDefaultBorderPresetIndex(4)

    expect(
      useWorkspaceStore.getState().workspace.appearance.fillPresetsByTheme.dark,
    ).toEqual(['#111111', '#222222', '#333333', '#444444', '#555555'])
    expect(
      useWorkspaceStore.getState().workspace.appearance.borderPresetsByTheme
        .dark,
    ).toEqual(['#aaaaaa', '#bbbbbb', '#cccccc', '#dddddd', '#eeeeee'])
    expect(
      useWorkspaceStore.getState().workspace.appearance
        .defaultFillPresetIndexByTheme.dark,
    ).toBe(2)
    expect(
      useWorkspaceStore.getState().workspace.appearance
        .defaultBorderPresetIndexByTheme.dark,
    ).toBe(4)

    useWorkspaceStore.getState().setThemeMode('light')
    useWorkspaceStore
      .getState()
      .setFillPresets(['#aaaa11', '#bbbb22', '#cccc33', '#dddd44', '#eeee55'])
    useWorkspaceStore.getState().setDefaultFillPresetIndex(1)

    expect(
      useWorkspaceStore.getState().workspace.appearance.fillPresetsByTheme
        .light,
    ).toEqual(['#aaaa11', '#bbbb22', '#cccc33', '#dddd44', '#eeee55'])
    expect(
      useWorkspaceStore.getState().workspace.appearance
        .defaultFillPresetIndexByTheme.light,
    ).toBe(1)
    expect(
      useWorkspaceStore.getState().workspace.appearance.fillPresetsByTheme.dark,
    ).toEqual(['#111111', '#222222', '#333333', '#444444', '#555555'])
  })

  it('updates style preset', () => {
    useWorkspaceStore.getState().setStylePreset('blueprint')

    expect(useWorkspaceStore.getState().workspace.appearance.stylePreset).toBe(
      'blueprint',
    )
  })

  it('undoes the previous workspace change', () => {
    useWorkspaceStore.getState().setThemeMode('light')
    useWorkspaceStore.getState().setDefaultCardSize({ columns: 4, rows: 6 })

    expect(useWorkspaceStore.getState().workspace.appearance.themeMode).toBe(
      'light',
    )
    expect(
      useWorkspaceStore.getState().workspace.appearance.defaultCardSize,
    ).toEqual({ columns: 4, rows: 6 })

    useWorkspaceStore.getState().undoWorkspace()

    expect(
      useWorkspaceStore.getState().workspace.appearance.defaultCardSize,
    ).toEqual({ columns: 5, rows: 5 })
    expect(useWorkspaceStore.getState().workspace.appearance.themeMode).toBe(
      'light',
    )

    useWorkspaceStore.getState().undoWorkspace()

    expect(useWorkspaceStore.getState().workspace.appearance.themeMode).toBe(
      'dark',
    )
  })

  it('toggles the interaction mode', () => {
    useWorkspaceStore.getState().toggleInteractionMode()

    expect(useWorkspaceStore.getState().interactionMode).toBe('view')

    useWorkspaceStore.getState().toggleInteractionMode('edit')

    expect(useWorkspaceStore.getState().interactionMode).toBe('edit')
  })

  it('updates and removes cards', () => {
    const workspace = createDefaultWorkspace({
      cards: [
        {
          id: 'card-1',
          url: 'https://example.com/',
          title: 'Example',
          faviconUrl: 'https://example.com/favicon.ico',
          positionX: 24,
          positionY: 48,
          size: { columns: 5, rows: 5 },
          createdAt: '2026-04-02T00:00:00.000Z',
          updatedAt: '2026-04-02T00:00:00.000Z',
        },
      ],
    })

    useWorkspaceStore.getState().hydrateWorkspace(workspace)
    useWorkspaceStore.getState().updateCard('card-1', {
      title: 'Updated',
      url: 'https://updated.example.com/',
      faviconUrl: 'https://updated.example.com/favicon.ico',
      size: { columns: 4, rows: 6 },
      cornerRadius: 18,
      showTitle: false,
      showImage: false,
      fillColor: '#334455',
      borderColor: '#ddeeff',
      surfaceTransparency: 42,
      shadowStyle: 'long',
    })

    expect(useWorkspaceStore.getState().workspace.cards[0]?.title).toBe(
      'Updated',
    )
    expect(useWorkspaceStore.getState().workspace.cards[0]?.size).toEqual({
      columns: 4,
      rows: 6,
    })
    expect(useWorkspaceStore.getState().workspace.cards[0]?.cornerRadius).toBe(
      18,
    )
    expect(useWorkspaceStore.getState().workspace.cards[0]?.showTitle).toBe(
      false,
    )
    expect(useWorkspaceStore.getState().workspace.cards[0]?.showImage).toBe(
      false,
    )
    expect(useWorkspaceStore.getState().workspace.cards[0]?.fillColor).toBe(
      '#334455',
    )
    expect(useWorkspaceStore.getState().workspace.cards[0]?.borderColor).toBe(
      '#ddeeff',
    )
    expect(
      useWorkspaceStore.getState().workspace.cards[0]?.surfaceTransparency,
    ).toBe(42)
    expect(useWorkspaceStore.getState().workspace.cards[0]?.shadowStyle).toBe(
      'long',
    )

    useWorkspaceStore.getState().removeCard('card-1')

    expect(useWorkspaceStore.getState().workspace.cards).toHaveLength(0)
  })

  it('tracks selection and batch operations', () => {
    const workspace = createDefaultWorkspace({
      cards: [
        {
          id: 'card-1',
          url: 'https://example.com/',
          title: 'One',
          faviconUrl: 'https://example.com/favicon.ico',
          positionX: 24,
          positionY: 48,
          size: { columns: 5, rows: 5 },
          createdAt: '2026-04-02T00:00:00.000Z',
          updatedAt: '2026-04-02T00:00:00.000Z',
        },
        {
          id: 'card-2',
          url: 'https://example.org/',
          title: 'Two',
          faviconUrl: 'https://example.org/favicon.ico',
          positionX: 144,
          positionY: 48,
          size: { columns: 5, rows: 5 },
          createdAt: '2026-04-02T00:00:00.000Z',
          updatedAt: '2026-04-02T00:00:00.000Z',
        },
      ],
    })

    useWorkspaceStore.getState().hydrateWorkspace(workspace)
    useWorkspaceStore.getState().selectCardExclusive('card-1')
    useWorkspaceStore.getState().toggleCardSelection('card-2')

    expect(useWorkspaceStore.getState().selectedCardIds).toEqual([
      'card-1',
      'card-2',
    ])

    useWorkspaceStore.getState().updateCards([
      {
        cardId: 'card-1',
        updates: { positionX: 48 },
      },
      {
        cardId: 'card-2',
        updates: { positionY: 72 },
      },
    ])

    expect(useWorkspaceStore.getState().workspace.cards[0]?.positionX).toBe(48)
    expect(useWorkspaceStore.getState().workspace.cards[1]?.positionY).toBe(72)

    useWorkspaceStore.getState().removeCards(['card-1', 'card-2'])

    expect(useWorkspaceStore.getState().workspace.cards).toHaveLength(0)
    expect(useWorkspaceStore.getState().selectedCardIds).toEqual([])

    useWorkspaceStore.getState().undoWorkspace()

    expect(useWorkspaceStore.getState().workspace.cards).toHaveLength(2)
  })
})
