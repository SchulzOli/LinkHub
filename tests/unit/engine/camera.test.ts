import { describe, expect, it } from 'vitest'

import {
  clampZoom,
  getWheelZoom,
  MAX_ZOOM,
  MIN_ZOOM,
  panByScreenDelta,
  screenToWorld,
  toCssMatrix,
  transformToViewport,
  viewportToTransform,
  worldToScreen,
  zoomAtScreenPoint,
} from '../../../src/engine/camera'
import { getAdaptiveGridStep } from '../../../src/engine/grid'

const viewport = { x: 100, y: -40, zoom: 2 }

describe('engine camera', () => {
  it('round-trips viewport and affine transform', () => {
    expect(viewportToTransform(viewport)).toEqual([
      [2, 0, -200],
      [0, 2, 80],
    ])
    expect(transformToViewport(viewportToTransform(viewport))).toEqual(viewport)
  })

  it('maps screen <-> world consistently', () => {
    const world = screenToWorld({ x: 50, y: 30 }, viewport)

    expect(world).toEqual({ x: 125, y: -25 })
    expect(worldToScreen(world, viewport)).toEqual({ x: 50, y: 30 })
  })

  it('pans so content follows the pointer', () => {
    const next = panByScreenDelta(viewport, 20, -10)

    expect(next.zoom).toBe(2)
    expect(next.x).toBeCloseTo(90)
    expect(next.y).toBeCloseTo(-35)
  })

  it('zooms around a fixed screen point', () => {
    const anchor = { x: 300, y: 200 }
    const before = screenToWorld(anchor, viewport)
    const next = zoomAtScreenPoint(viewport, anchor, 1.5)
    const after = screenToWorld(anchor, next)

    expect(next.zoom).toBe(1.5)
    expect(after.x).toBeCloseTo(before.x)
    expect(after.y).toBeCloseTo(before.y)
  })

  it('returns the same viewport when zoom does not change', () => {
    const atMax = { x: 0, y: 0, zoom: MAX_ZOOM }

    expect(zoomAtScreenPoint(atMax, { x: 10, y: 10 }, 10)).toBe(atMax)
  })

  it('clamps and steps wheel zoom', () => {
    expect(clampZoom(0)).toBe(MIN_ZOOM)
    expect(getWheelZoom(1, -100)).toBe(1.1)
    expect(getWheelZoom(1, 100)).toBe(0.9)
    expect(getWheelZoom(MIN_ZOOM, 100)).toBe(MIN_ZOOM)
  })

  it('emits a CSS matrix for the world layer', () => {
    expect(toCssMatrix(viewport)).toBe('matrix(2, 0, 0, 2, -200, 80)')
  })
})

describe('engine grid', () => {
  it('keeps the configured step while cells are large enough', () => {
    expect(getAdaptiveGridStep(24, 1)).toBe(24)
  })

  it('doubles the step when cells get too dense on screen', () => {
    expect(getAdaptiveGridStep(24, 0.1)).toBe(96)
  })
})
