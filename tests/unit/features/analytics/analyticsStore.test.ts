import { beforeEach, describe, expect, it } from 'vitest'

import type { LinkCard } from '../../../../src/contracts/linkCard'
import { createDefaultWorkspace } from '../../../../src/contracts/workspace'
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

describe('analytics store', () => {
  beforeEach(() => {
    useWorkspaceStore.getState().hydrateWorkspace(
      createDefaultWorkspace({
        cards: [createCard()],
      }),
    )
  })

  it('records link opens without polluting undo history', () => {
    useWorkspaceStore.getState().recordLinkOpen('card-1')

    expect(
      useWorkspaceStore.getState().workspace.analytics.totals,
    ).toMatchObject({
      canvasOpens: 0,
      linkOpens: 1,
      linkOpensByCardId: {
        'card-1': 1,
      },
    })
    expect(useWorkspaceStore.getState().undoStack).toEqual([])

    useWorkspaceStore.getState().setThemeMode('light')
    useWorkspaceStore.getState().undoWorkspace()

    expect(
      useWorkspaceStore.getState().workspace.analytics.totals.linkOpens,
    ).toBe(1)
  })

  it('records canvas opens without polluting undo history', () => {
    useWorkspaceStore.getState().recordCanvasOpen('initial')
    useWorkspaceStore.getState().recordCanvasOpen('resume')

    expect(
      useWorkspaceStore.getState().workspace.analytics.totals.canvasOpens,
    ).toBe(2)
    expect(useWorkspaceStore.getState().undoStack).toEqual([])
  })
})
