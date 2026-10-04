/** Attribute marking engine-owned elements that count as canvas background. */
export const CANVAS_BACKGROUND_ATTRIBUTE = 'data-canvas-background'

export const canvasBackgroundProps = {
  [CANVAS_BACKGROUND_ATTRIBUTE]: '',
} as Record<string, string>

/**
 * True when a pointer/mouse event hit the empty canvas: either the root
 * element itself or one of the engine's surface/world/canvas layers.
 */
export function isCanvasBackgroundTarget(event: {
  target: EventTarget | null
  currentTarget: EventTarget | null
}) {
  if (event.target === event.currentTarget) {
    return true
  }

  return (
    event.target instanceof Element &&
    event.target.hasAttribute(CANVAS_BACKGROUND_ATTRIBUTE)
  )
}
