import type { Viewport } from '../contracts/workspace'
import { clampZoom, panByScreenDelta, zoomAtScreenPoint } from './camera'

type Point = { x: number; y: number }

/** How far a finger may move before a tap becomes a drag (CSS px). */
export const TOUCH_TAP_SLOP = 8
/** Two taps closer than this (ms and px) are a double tap. */
export const DOUBLE_TAP_MS = 300
export const DOUBLE_TAP_DISTANCE = 32
/** Zoom a double tap toggles to, and back from. */
export const DOUBLE_TAP_ZOOM = 2

export function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

export function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

/**
 * The viewport for a two-finger pinch: zooms by how far the fingers spread
 * since the gesture started, around where they started, and pans with the
 * fingers' midpoint, so the content stays under the fingers.
 */
export function pinchViewport(
  start: Viewport,
  startMidpoint: Point,
  startDistance: number,
  currentMidpoint: Point,
  currentDistance: number,
): Viewport {
  const scale = startDistance > 0 ? currentDistance / startDistance : 1
  const zoomed = zoomAtScreenPoint(
    start,
    startMidpoint,
    clampZoom(start.zoom * scale),
  )

  return panByScreenDelta(
    zoomed,
    currentMidpoint.x - startMidpoint.x,
    currentMidpoint.y - startMidpoint.y,
  )
}

/** Double tap: zoom in around the tap, or back to 100 % when zoomed in. */
export function doubleTapViewport(viewport: Viewport, point: Point) {
  return zoomAtScreenPoint(
    viewport,
    point,
    viewport.zoom < DOUBLE_TAP_ZOOM - 0.01 ? DOUBLE_TAP_ZOOM : 1,
  )
}
