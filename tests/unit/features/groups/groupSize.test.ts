import { describe, expect, it } from 'vitest'

import {
  getDefaultGroupSize,
  getGroupBodyBounds,
  getGroupCornerRadii,
  parseGroupSizeDraft,
} from '../../../../src/contracts/cardGroup'
import { DEFAULT_CARD_SIZE } from '../../../../src/contracts/linkCard'

describe('parseGroupSizeDraft', () => {
  it('allows groups larger than the card max size', () => {
    expect(parseGroupSizeDraft('20', '14')).toEqual({
      columns: 20,
      rows: 14,
    })
  })

  it('rejects groups smaller than 2x2', () => {
    expect(parseGroupSizeDraft('1', '2')).toBeNull()
    expect(parseGroupSizeDraft('2', '1')).toBeNull()
  })

  it('creates a default group size with usable snapped body slots for a default card', () => {
    const gridSize = 24
    const groupSize = getDefaultGroupSize(DEFAULT_CARD_SIZE, gridSize)
    const bodyBounds = getGroupBodyBounds(
      {
        positionX: 0,
        positionY: 0,
        size: groupSize,
      },
      gridSize,
    )
    const cardWidth = DEFAULT_CARD_SIZE.columns * gridSize
    const cardHeight = DEFAULT_CARD_SIZE.rows * gridSize
    const minColumn = Math.ceil(bodyBounds.left / gridSize)
    const maxColumn = Math.floor((bodyBounds.right - cardWidth) / gridSize)
    const minRow = Math.ceil(bodyBounds.top / gridSize)
    const maxRow = Math.floor((bodyBounds.bottom - cardHeight) / gridSize)

    expect(maxColumn - minColumn + 1).toBeGreaterThanOrEqual(2)
    expect(maxRow - minRow + 1).toBeGreaterThanOrEqual(2)
  })

  it('caps the shell top radius once the header radius is saturated', () => {
    const size = { columns: 12, rows: 8 }
    const gridSize = 24
    const lowRadius = getGroupCornerRadii({
      size,
      gridSize,
      cornerRadius: 20,
    })
    const highRadius = getGroupCornerRadii({
      size,
      gridSize,
      cornerRadius: 80,
    })

    expect(highRadius.shellTopRadius).toBe(lowRadius.shellTopRadius)
    expect(highRadius.shellBottomRadius).toBeGreaterThan(
      lowRadius.shellBottomRadius,
    )
  })
})
