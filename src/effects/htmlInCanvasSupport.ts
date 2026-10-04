/**
 * Detection for html-in-canvas (https://github.com/WICG/html-in-canvas).
 * Currently only in Chromium behind `chrome://flags/#canvas-draw-element`.
 * Used exclusively by the optional card effects layer.
 */

function hasPrototypeMember(
  ctor: { prototype: object } | undefined,
  name: string,
) {
  return Boolean(ctor && name in ctor.prototype)
}

/** True when DOM snapshots can be uploaded into WebGL textures. */
export function isHtmlInCanvasSupported() {
  if (typeof window === 'undefined') {
    return false
  }

  const webgl2 = window.WebGL2RenderingContext
  const texUpload =
    hasPrototypeMember(webgl2, 'texElementSubImage2D') ||
    hasPrototypeMember(webgl2, 'texElementImage2D')

  return (
    hasPrototypeMember(window.HTMLCanvasElement, 'requestPaint') && texUpload
  )
}

export function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}
