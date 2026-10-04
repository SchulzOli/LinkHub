import type { ReactNode } from 'react'

import type { Viewport } from '../../contracts/workspace'
import { toCssMatrix } from '../camera'
import type { GridOptions } from '../grid'
import { canvasBackgroundProps } from './canvasBackground'
import styles from './CanvasEngineSurface.module.css'
import { CanvasGrid } from './CanvasGrid'

type CanvasEngineSurfaceProps = {
  viewport: Viewport
  grid: GridOptions
  /** World-space content (entities positioned in world coordinates). */
  children: ReactNode
}

/**
 * Canvas engine surface (built on grida: `@grida/cmath` camera math and
 * `@grida/pixel-grid` grid rendering).
 *
 * World-space entities live in one layer that carries the camera as a single
 * CSS matrix, so pan/zoom never recomputes per-entity screen positions.
 */
export function CanvasEngineSurface({
  viewport,
  grid,
  children,
}: CanvasEngineSurfaceProps) {
  return (
    <div {...canvasBackgroundProps} className={styles.surface}>
      <CanvasGrid viewport={viewport} grid={grid} />
      <div
        {...canvasBackgroundProps}
        className={styles.world}
        data-testid="canvas-world"
        style={{ transform: toCssMatrix(viewport) }}
      >
        {children}
      </div>
    </div>
  )
}
