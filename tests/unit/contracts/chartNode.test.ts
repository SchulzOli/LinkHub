import { describe, expect, it } from 'vitest'

import { coerceCardGroup } from '../../../src/contracts/cardGroup'
import { coercePictureNode } from '../../../src/contracts/pictureNode'
import {
  WorkspaceSchema,
  createDefaultWorkspace,
} from '../../../src/contracts/workspace'

const NOW = '2026-10-04T12:00:00.000Z'

describe('chart node contracts', () => {
  const rawChart = {
    id: 'chart-1',
    type: 'chart',
    source: { url: 'ws://127.0.0.1:8787/feed', symbol: 'AAPL' },
    settings: { range: '5Y', overlay: 'bogus', live: false },
    positionX: 0,
    positionY: 0,
    size: { columns: 12, rows: 8 },
    createdAt: NOW,
    updatedAt: NOW,
  }

  it('coerces charts and drops invalid setting values', () => {
    expect(coercePictureNode(rawChart)).toEqual({
      ...rawChart,
      settings: { range: '5Y', live: false },
    })
  })

  it('rejects charts without a usable source', () => {
    expect(
      coercePictureNode({ ...rawChart, source: { url: '', symbol: 'A' } }),
    ).toBeNull()
  })

  it('still coerces image pictures', () => {
    expect(
      coercePictureNode({
        id: 'p1',
        type: 'picture',
        imageId: 'img-1',
        positionX: 0,
        positionY: 0,
        createdAt: NOW,
        updatedAt: NOW,
      }),
    ).toMatchObject({ type: 'picture', imageId: 'img-1' })
  })

  it('keeps valid group chart settings', () => {
    const coerced = coerceCardGroup({
      id: 'g1',
      name: 'Stocks',
      positionX: 0,
      positionY: 0,
      size: { columns: 10, rows: 10 },
      chartSettings: { range: 'MAX', scale: 'cubic' },
      createdAt: NOW,
      updatedAt: NOW,
    })

    expect(coerced?.chartSettings).toEqual({ range: 'MAX' })
  })

  it('validates workspaces that mix images and charts', () => {
    const workspace = createDefaultWorkspace({
      pictures: [
        coercePictureNode(rawChart)!,
        {
          id: 'p1',
          type: 'picture',
          imageId: 'img-1',
          positionX: 0,
          positionY: 0,
          size: { columns: 5, rows: 5 },
          createdAt: NOW,
          updatedAt: NOW,
        },
      ],
    })

    expect(WorkspaceSchema.safeParse(workspace).success).toBe(true)
  })
})
