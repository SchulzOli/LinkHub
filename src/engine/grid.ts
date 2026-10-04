export type GridOptions = {
  visible: boolean
  /** Grid cell size in world units (CSS px at zoom 1). */
  size: number
  /** Any CSS color, including `var(--token)`. */
  color: string
}

/** Below this on-screen cell size the grid step is doubled (perf + moire). */
const MIN_SCREEN_CELL_PX = 6

export function getAdaptiveGridStep(size: number, zoom: number) {
  let step = Math.max(1, size)
  while (step * zoom < MIN_SCREEN_CELL_PX) {
    step *= 2
  }
  return step
}
