/**
 * Legacy canvas math API. Kept as a thin facade over the canvas engine
 * camera so existing callers keep working; new code should import from
 * `src/engine` directly.
 */
export {
  getVisibleWorldRect as getVisibleCanvasBounds,
  isWorldRectVisible as isRectInBounds,
  screenDeltaToWorld as screenDeltaToCanvas,
  screenToWorld as screenPointToCanvas,
  type WorldRect as CanvasBounds,
} from '../../engine/camera'
