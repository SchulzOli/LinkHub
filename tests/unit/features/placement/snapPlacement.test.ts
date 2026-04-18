import { describe, expect, it } from 'vitest'

import { applySnap } from '../../../../src/features/placement/snapEngine'

describe('snap placement', () => {
  it('snaps close positions to single grid cells when enabled', () => {
    const position = applySnap(
      { x: 49, y: 50 },
      {
        gridVisible: true,
        snapEnabled: true,
        snapStrength: 'medium',
        gridSize: 24,
      },
      { columns: 5, rows: 5 },
    )

    expect(position).toEqual({ x: 48, y: 48 })
  })

  it('preserves self-chosen positions when snap is disabled', () => {
    const position = applySnap(
      { x: 49, y: 50 },
      {
        gridVisible: true,
        snapEnabled: false,
        snapStrength: 'high',
        gridSize: 24,
      },
      { columns: 5, rows: 5 },
    )

    expect(position).toEqual({ x: 49, y: 50 })
  })

  it('forces positions onto single grid cells when requested', () => {
    const position = applySnap(
      { x: 90, y: 110 },
      {
        gridVisible: true,
        snapEnabled: true,
        snapStrength: 'low',
        gridSize: 24,
      },
      { columns: 5, rows: 5 },
      { force: true },
    )

    expect(position).toEqual({ x: 96, y: 120 })
  })

  it('skips occupied cells and resolves to the nearest free placement', () => {
    const position = applySnap(
      { x: 49, y: 50 },
      {
        gridVisible: true,
        snapEnabled: true,
        snapStrength: 'high',
        gridSize: 24,
      },
      { columns: 5, rows: 5 },
      {
        force: true,
        cards: [
          {
            id: 'occupied-center',
            url: 'https://example.com/',
            title: 'Center',
            faviconUrl: 'https://example.com/favicon.ico',
            positionX: 48,
            positionY: 48,
            size: { columns: 5, rows: 5 },
            createdAt: '2026-04-02T00:00:00.000Z',
            updatedAt: '2026-04-02T00:00:00.000Z',
          },
          {
            id: 'occupied-left',
            url: 'https://left.example.com/',
            title: 'Left',
            faviconUrl: 'https://left.example.com/favicon.ico',
            positionX: -72,
            positionY: 48,
            size: { columns: 5, rows: 5 },
            createdAt: '2026-04-02T00:00:00.000Z',
            updatedAt: '2026-04-02T00:00:00.000Z',
          },
        ],
      },
    )

    expect(position).toEqual({ x: 168, y: 48 })
  })
})
