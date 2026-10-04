import { lazy, Suspense } from 'react'

import { useCanvasEffectsEnabled } from './effectsSettings'
import {
  isHtmlInCanvasSupported,
  prefersReducedMotion,
} from './htmlInCanvasSupport'

// three.js is only downloaded when effects are actually turned on.
const CardEffectsLayer = lazy(() =>
  import('./CardEffectsLayer').then((module) => ({
    default: module.CardEffectsLayer,
  })),
)

/**
 * Mounts the optional card effects when the user enabled them in the
 * settings, the browser supports html-in-canvas and motion is not reduced.
 * Renders nothing otherwise; the canvas engine works the same either way.
 */
export function OptionalCardEffects({
  rootRef,
}: {
  rootRef: React.RefObject<HTMLElement | null>
}) {
  const enabled = useCanvasEffectsEnabled()

  if (!enabled || !isHtmlInCanvasSupported() || prefersReducedMotion()) {
    return null
  }

  return (
    <Suspense fallback={null}>
      <CardEffectsLayer rootRef={rootRef} />
    </Suspense>
  )
}
