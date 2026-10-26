import { describe, expect, it } from 'vitest'

import { MAX_ZOOM, worldToScreen } from '../../../src/engine/camera'
import {
  doubleTapViewport,
  pinchViewport,
} from '../../../src/engine/touchGestures'

const start = { x: 0, y: 0, zoom: 1 }

describe('touch gestures', () => {
  it('keeps the content under the fingers while pinching', () => {
    const anchor = { x: 200, y: 100 }
    // Fingers spread to twice the distance and move 30 px right together.
    const next = pinchViewport(start, anchor, 100, { x: 230, y: 100 }, 200)

    expect(next.zoom).toBe(2)
    // The world point that was under the midpoint follows the midpoint.
    expect(worldToScreen({ x: 200, y: 100 }, next)).toEqual({ x: 230, y: 100 })
  })

  it('stays within the zoom limits', () => {
    const next = pinchViewport(start, { x: 0, y: 0 }, 10, { x: 0, y: 0 }, 1000)

    expect(next.zoom).toBe(MAX_ZOOM)
  })

  it('zooms in on a double tap and back to 100 % on the next', () => {
    const point = { x: 120, y: 80 }
    const zoomedIn = doubleTapViewport(start, point)

    expect(zoomedIn.zoom).toBe(2)
    expect(worldToScreen({ x: 120, y: 80 }, zoomedIn)).toEqual(point)
    expect(doubleTapViewport(zoomedIn, point).zoom).toBe(1)
  })
})
