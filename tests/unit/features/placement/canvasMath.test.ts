import { describe, expect, it } from 'vitest'

import {
  getVisibleCanvasBounds,
  isRectInBounds,
  screenDeltaToCanvas,
  screenPointToCanvas,
} from '../../../../src/features/placement/canvasMath'

describe('screenDeltaToCanvas', () => {
  it('divides the delta by zoom', () => {
    expect(screenDeltaToCanvas(200, 2)).toBe(100)
    expect(screenDeltaToCanvas(50, 0.5)).toBe(100)
  })
})

describe('screenPointToCanvas', () => {
  it('translates a screen point into canvas coordinates', () => {
    const viewport = { x: 10, y: 20, zoom: 2 }

    expect(screenPointToCanvas({ x: 40, y: 60 }, viewport)).toEqual({
      x: 10 + 40 / 2,
      y: 20 + 60 / 2,
    })
  })
})

describe('getVisibleCanvasBounds', () => {
  it('expands the viewport by the default margin', () => {
    const bounds = getVisibleCanvasBounds({ x: 0, y: 0, zoom: 1 }, 800, 600)

    expect(bounds).toEqual({
      left: -200,
      top: -200,
      right: 1000,
      bottom: 800,
    })
  })

  it('scales the margin by the zoom factor', () => {
    const bounds = getVisibleCanvasBounds(
      { x: 0, y: 0, zoom: 2 },
      800,
      600,
      100,
    )

    expect(bounds).toEqual({
      left: -50,
      top: -50,
      right: (800 + 100) / 2,
      bottom: (600 + 100) / 2,
    })
  })
})

describe('isRectInBounds', () => {
  const bounds = { left: 0, top: 0, right: 100, bottom: 100 }

  it('returns true for rectangles that overlap the bounds', () => {
    expect(isRectInBounds(10, 10, 20, 20, bounds)).toBe(true)
    expect(isRectInBounds(-5, -5, 10, 10, bounds)).toBe(true)
    expect(isRectInBounds(90, 90, 20, 20, bounds)).toBe(true)
  })

  it('returns false for rectangles outside the bounds', () => {
    expect(isRectInBounds(200, 10, 10, 10, bounds)).toBe(false)
    expect(isRectInBounds(-50, 10, 10, 10, bounds)).toBe(false)
    expect(isRectInBounds(10, 200, 10, 10, bounds)).toBe(false)
    expect(isRectInBounds(10, -50, 10, 10, bounds)).toBe(false)
  })
})
