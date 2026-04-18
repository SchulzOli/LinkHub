import type { Viewport } from '../../contracts/workspace'

export function screenDeltaToCanvas(delta: number, zoom: number) {
  return delta / zoom
}

export function screenPointToCanvas(
  point: { x: number; y: number },
  viewport: Viewport,
) {
  return {
    x: viewport.x + point.x / viewport.zoom,
    y: viewport.y + point.y / viewport.zoom,
  }
}

export type CanvasBounds = {
  left: number
  top: number
  right: number
  bottom: number
}

/**
 * Returns the visible area in canvas (world) coordinates for the current
 * viewport, expanded by `margin` canvas-pixels on every side so that
 * elements entering the viewport aren't popped in abruptly.
 */
export function getVisibleCanvasBounds(
  viewport: Viewport,
  screenWidth: number,
  screenHeight: number,
  margin = 200,
): CanvasBounds {
  const left = viewport.x - margin / viewport.zoom
  const top = viewport.y - margin / viewport.zoom
  const right = viewport.x + (screenWidth + margin) / viewport.zoom
  const bottom = viewport.y + (screenHeight + margin) / viewport.zoom

  return { left, top, right, bottom }
}

export function isRectInBounds(
  x: number,
  y: number,
  width: number,
  height: number,
  bounds: CanvasBounds,
): boolean {
  return (
    x + width > bounds.left &&
    x < bounds.right &&
    y + height > bounds.top &&
    y < bounds.bottom
  )
}
