import cmath from '@grida/cmath'

import type { Viewport } from '../contracts/workspace'

/**
 * Camera model of the canvas engine.
 *
 * A `Viewport` ({ x, y, zoom }) is the persisted form: `x`/`y` is the world
 * point shown at the top-left screen corner and `zoom` the uniform scale.
 * Internally the engine works with the equivalent 2x3 affine world→screen
 * transform (grida cmath convention, CSS/Canvas2D semantics):
 *
 *   [[zoom, 0, -x * zoom],
 *    [0, zoom, -y * zoom]]
 */

export const MIN_ZOOM = 0.1
export const MAX_ZOOM = 2.5
export const ZOOM_STEP = 0.1

export type Point = { x: number; y: number }

export type WorldRect = {
  left: number
  top: number
  right: number
  bottom: number
}

export function clampZoom(zoom: number) {
  return cmath.clamp(zoom, MIN_ZOOM, MAX_ZOOM)
}

export function viewportToTransform(viewport: Viewport): cmath.Transform {
  const { x, y, zoom } = viewport

  return [
    [zoom, 0, -x * zoom],
    [0, zoom, -y * zoom],
  ]
}

export function transformToViewport(transform: cmath.Transform): Viewport {
  const zoom = transform[0][0]

  return {
    x: -transform[0][2] / zoom,
    y: -transform[1][2] / zoom,
    zoom,
  }
}

export function screenDeltaToWorld(delta: number, zoom: number) {
  return delta / zoom
}

export function screenToWorld(point: Point, viewport: Viewport): Point {
  return {
    x: viewport.x + point.x / viewport.zoom,
    y: viewport.y + point.y / viewport.zoom,
  }
}

export function worldToScreen(point: Point, viewport: Viewport): Point {
  return {
    x: (point.x - viewport.x) * viewport.zoom,
    y: (point.y - viewport.y) * viewport.zoom,
  }
}

/** Pans the camera by a screen-space delta (content follows the pointer). */
export function panByScreenDelta(
  viewport: Viewport,
  deltaX: number,
  deltaY: number,
): Viewport {
  return transformToViewport(
    cmath.transform.translate(viewportToTransform(viewport), [deltaX, deltaY]),
  )
}

/**
 * Zooms around a fixed screen point: the world point under `screenPoint`
 * stays under it after the zoom.
 */
export function zoomAtScreenPoint(
  viewport: Viewport,
  screenPoint: Point,
  nextZoom: number,
): Viewport {
  const zoom = clampZoom(nextZoom)

  if (zoom === viewport.zoom) {
    return viewport
  }

  const scaled = cmath.transform.scale(
    viewportToTransform(viewport),
    zoom / viewport.zoom,
    [screenPoint.x, screenPoint.y],
  )
  const next = transformToViewport(scaled)

  return { ...next, zoom }
}

/** Next zoom level for one wheel notch, snapped to the zoom step grid. */
export function getWheelZoom(zoom: number, deltaY: number) {
  const direction = deltaY > 0 ? -1 : 1

  return clampZoom(Number((zoom + direction * ZOOM_STEP).toFixed(2)))
}

/**
 * Visible world rectangle, expanded by `margin` screen pixels on every side
 * so elements entering the viewport are not popped in abruptly.
 */
export function getVisibleWorldRect(
  viewport: Viewport,
  screenWidth: number,
  screenHeight: number,
  margin = 200,
): WorldRect {
  return {
    left: viewport.x - margin / viewport.zoom,
    top: viewport.y - margin / viewport.zoom,
    right: viewport.x + (screenWidth + margin) / viewport.zoom,
    bottom: viewport.y + (screenHeight + margin) / viewport.zoom,
  }
}

export function isWorldRectVisible(
  x: number,
  y: number,
  width: number,
  height: number,
  bounds: WorldRect,
) {
  return (
    x + width > bounds.left &&
    x < bounds.right &&
    y + height > bounds.top &&
    y < bounds.bottom
  )
}

/** CSS `transform` value that maps world space onto the screen. */
export function toCssMatrix(viewport: Viewport) {
  const [[a, c, e], [b, d, f]] = viewportToTransform(viewport)

  return `matrix(${a}, ${b}, ${c}, ${d}, ${e}, ${f})`
}
