import { PixelGridCanvas } from '@grida/pixel-grid'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'

import type { Viewport } from '../../contracts/workspace'
import { viewportToTransform } from '../camera'
import { getAdaptiveGridStep, type GridOptions } from '../grid'
import { useResolvedCssValue } from './useResolvedCssValue'

function canUse2DCanvas() {
  try {
    return Boolean(document.createElement('canvas').getContext('2d'))
  } catch {
    return false
  }
}

/**
 * Infinite grid drawn by `@grida/pixel-grid` from the camera transform.
 * Falls back to nothing when no 2D canvas is available (e.g. jsdom).
 */
export function CanvasGrid({
  viewport,
  grid,
}: {
  viewport: Viewport
  grid: GridOptions
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const gridRef = useRef<PixelGridCanvas | null>(null)
  const [supported] = useState(canUse2DCanvas)
  const color = useResolvedCssValue(grid.color)
  const step = getAdaptiveGridStep(grid.size, viewport.zoom)

  // (Re)create the grid painter when its static options change.
  useLayoutEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !supported || !grid.visible) {
      return
    }

    const painter = new PixelGridCanvas(canvas, {
      transform: viewportToTransform(viewport),
      color,
      steps: [step, step],
    })
    gridRef.current = painter

    const resize = () => {
      const rect = canvas.parentElement?.getBoundingClientRect()
      painter.setSize(rect?.width ?? 0, rect?.height ?? 0)
      painter.draw()
    }
    resize()

    const observer =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize)
    if (canvas.parentElement) {
      observer?.observe(canvas.parentElement)
    }

    return () => {
      observer?.disconnect()
      gridRef.current = null
    }
    // viewport is applied by the effect below; recreate only for options.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [color, grid.visible, step, supported])

  // Camera moves only redraw.
  useEffect(() => {
    const painter = gridRef.current
    if (!painter) {
      return
    }

    painter.updateTransform(viewportToTransform(viewport))
    painter.draw()
  }, [viewport])

  if (!supported || !grid.visible) {
    return null
  }

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      data-canvas-background=""
      data-testid="canvas-grid"
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
      }}
    />
  )
}
