import type { CardSize } from '../../contracts/linkCard'
import type { PlacementGuide } from '../../contracts/placementGuide'
import type { PlaceableItem, PlacementBlockPredicate } from './placementTypes'

const MIN_THRESHOLD_BY_STRENGTH = {
  low: 6,
  medium: 12,
  high: 18,
} as const

const GRID_CELLS_BY_STRENGTH = {
  low: 1,
  medium: 1.75,
  high: 3,
} as const

type SnapOptions = {
  force?: boolean
  cards?: PlaceableItem[]
  excludedCardId?: string
  isOccupiedItemBlocking?: PlacementBlockPredicate
  /**
   * Pre-built occupancy index. When provided, `cards` and `excludedCardId` are
   * ignored and the spiral search queries the index directly. Enables batch
   * pasting where multiple items reuse (and extend) the same index.
   */
  occupancyIndex?: OccupancyIndex
}

type GridRect = {
  x: number
  y: number
  width: number
  height: number
}

function toGridCoordinate(value: number, gridSize: number) {
  return Math.round(value / gridSize)
}

function toGridRect(
  position: { x: number; y: number },
  size: CardSize,
  gridSize: number,
): GridRect {
  return {
    x: toGridCoordinate(position.x, gridSize),
    y: toGridCoordinate(position.y, gridSize),
    width: size.columns,
    height: size.rows,
  }
}

/**
 * Uniform grid index mapping each occupied cell key `"x,y"` to the items that
 * cover it. Built once per snap call so that the spiral search can look up
 * overlap candidates in O(candidate-cells) instead of O(occupied-items).
 */
export type OccupancyIndex = {
  cells: Map<string, PlaceableItem[]>
  gridSize: number
  itemCount: number
}

function cellKey(x: number, y: number) {
  return `${x},${y}`
}

function addItemToIndex(index: OccupancyIndex, item: PlaceableItem) {
  const rect = toGridRect(
    { x: item.positionX, y: item.positionY },
    item.size,
    index.gridSize,
  )

  for (let x = rect.x; x < rect.x + rect.width; x += 1) {
    for (let y = rect.y; y < rect.y + rect.height; y += 1) {
      const key = cellKey(x, y)
      const bucket = index.cells.get(key)

      if (bucket) {
        bucket.push(item)
      } else {
        index.cells.set(key, [item])
      }
    }
  }

  index.itemCount += 1
}

export function createOccupancyIndex(
  items: PlaceableItem[],
  guide: PlacementGuide,
): OccupancyIndex {
  const index: OccupancyIndex = {
    cells: new Map(),
    gridSize: guide.gridSize,
    itemCount: 0,
  }

  for (const item of items) {
    addItemToIndex(index, item)
  }

  return index
}

/**
 * Extends an existing occupancy index with a newly placed item. Use during
 * multi-paste loops so subsequent snap calls see previously placed items
 * without rebuilding the index from scratch.
 */
export function addItemToOccupancyIndex(
  index: OccupancyIndex,
  item: PlaceableItem,
) {
  addItemToIndex(index, item)
}

function getOverlappingItems(
  candidate: GridRect,
  index: OccupancyIndex,
): PlaceableItem[] {
  const seen = new Set<string>()
  const items: PlaceableItem[] = []

  for (let x = candidate.x; x < candidate.x + candidate.width; x += 1) {
    for (let y = candidate.y; y < candidate.y + candidate.height; y += 1) {
      const bucket = index.cells.get(cellKey(x, y))

      if (!bucket) {
        continue
      }

      for (const item of bucket) {
        if (!seen.has(item.id)) {
          seen.add(item.id)
          items.push(item)
        }
      }
    }
  }

  return items
}

function getOccupiedItems(
  cards: PlaceableItem[] | undefined,
  excludedCardId?: string,
) {
  if (!cards?.length) {
    return []
  }

  return cards.filter((card) => card.id !== excludedCardId)
}

function isGridRectFree(
  candidate: GridRect,
  index: OccupancyIndex,
  guide: PlacementGuide,
  isOccupiedItemBlocking?: PlacementBlockPredicate,
) {
  const overlapping = getOverlappingItems(candidate, index)

  if (overlapping.length === 0) {
    return true
  }

  if (!isOccupiedItemBlocking) {
    return false
  }

  const candidateFrame = {
    position: {
      x: candidate.x * guide.gridSize,
      y: candidate.y * guide.gridSize,
    },
    size: {
      columns: candidate.width,
      rows: candidate.height,
    },
  }

  return overlapping.every(
    (occupiedItem) =>
      !isOccupiedItemBlocking(candidateFrame, occupiedItem, guide),
  )
}

export function isPlacementAvailable(
  position: { x: number; y: number },
  size: CardSize,
  guide: PlacementGuide,
  options?: Pick<
    SnapOptions,
    'cards' | 'excludedCardId' | 'isOccupiedItemBlocking' | 'occupancyIndex'
  >,
) {
  const index =
    options?.occupancyIndex ??
    createOccupancyIndex(
      getOccupiedItems(options?.cards, options?.excludedCardId),
      guide,
    )

  return isGridRectFree(
    toGridRect(position, size, guide.gridSize),
    index,
    guide,
    options?.isOccupiedItemBlocking,
  )
}

function toCanvasPosition(cell: { x: number; y: number }, gridSize: number) {
  return {
    x: cell.x * gridSize,
    y: cell.y * gridSize,
  }
}

function findNearestFreeCell(
  targetCell: { x: number; y: number },
  size: CardSize,
  index: OccupancyIndex,
  guide: PlacementGuide,
  isOccupiedItemBlocking?: PlacementBlockPredicate,
) {
  const targetRect: GridRect = {
    x: targetCell.x,
    y: targetCell.y,
    width: size.columns,
    height: size.rows,
  }

  if (isGridRectFree(targetRect, index, guide, isOccupiedItemBlocking)) {
    return targetCell
  }

  const maxRadius = Math.max(12, Math.ceil(Math.sqrt(index.itemCount + 1)) * 8)

  for (let radius = 1; radius <= maxRadius; radius += 1) {
    const candidates: Array<{ x: number; y: number; dx: number; dy: number }> =
      []

    for (let dx = -radius; dx <= radius; dx += 1) {
      for (let dy = -radius; dy <= radius; dy += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) {
          continue
        }

        candidates.push({
          x: targetCell.x + dx,
          y: targetCell.y + dy,
          dx,
          dy,
        })
      }
    }

    candidates.sort((left, right) => {
      const leftManhattan = Math.abs(left.dx) + Math.abs(left.dy)
      const rightManhattan = Math.abs(right.dx) + Math.abs(right.dy)

      if (leftManhattan !== rightManhattan) {
        return leftManhattan - rightManhattan
      }

      const leftDistance = left.dx ** 2 + left.dy ** 2
      const rightDistance = right.dx ** 2 + right.dy ** 2

      if (leftDistance !== rightDistance) {
        return leftDistance - rightDistance
      }

      if (Math.abs(left.dy) !== Math.abs(right.dy)) {
        return Math.abs(left.dy) - Math.abs(right.dy)
      }

      if (Math.abs(left.dx) !== Math.abs(right.dx)) {
        return Math.abs(left.dx) - Math.abs(right.dx)
      }

      if (left.dy !== right.dy) {
        return left.dy - right.dy
      }

      return left.dx - right.dx
    })

    for (const candidate of candidates) {
      if (
        isGridRectFree(
          {
            x: candidate.x,
            y: candidate.y,
            width: size.columns,
            height: size.rows,
          },
          index,
          guide,
          isOccupiedItemBlocking,
        )
      ) {
        return {
          x: candidate.x,
          y: candidate.y,
        }
      }
    }
  }

  return targetCell
}

/**
 * Finds the nearest grid-aligned free position for an entity. The search starts
 * at the target cell and expands ring-by-ring so the chosen fallback stays as
 * close as possible to the user's intended placement.
 */
export function getSnapTargetPosition(
  position: { x: number; y: number },
  guide: PlacementGuide,
  size: CardSize,
  options?: SnapOptions,
) {
  const targetCell = {
    x: toGridCoordinate(position.x, guide.gridSize),
    y: toGridCoordinate(position.y, guide.gridSize),
  }
  const index =
    options?.occupancyIndex ??
    createOccupancyIndex(
      getOccupiedItems(options?.cards, options?.excludedCardId),
      guide,
    )
  const freeCell = findNearestFreeCell(
    targetCell,
    size,
    index,
    guide,
    options?.isOccupiedItemBlocking,
  )

  return toCanvasPosition(freeCell, guide.gridSize)
}

function getSnapThreshold(guide: PlacementGuide) {
  const minThreshold = MIN_THRESHOLD_BY_STRENGTH[guide.snapStrength]
  const gridAlignedThreshold =
    guide.gridSize * GRID_CELLS_BY_STRENGTH[guide.snapStrength]

  return Math.max(minThreshold, gridAlignedThreshold)
}

/**
 * Applies the configured snap policy to a free-form canvas position. Depending
 * on the snap threshold and `force` flag, the result is either the nearest free
 * grid slot or the original unsnapped position.
 */
export function applySnap(
  position: { x: number; y: number },
  guide: PlacementGuide,
  size: CardSize,
  options?: SnapOptions,
) {
  if (!guide.snapEnabled) {
    return position
  }

  const threshold = getSnapThreshold(guide)
  const target = getSnapTargetPosition(position, guide, size, options)

  if (options?.force) {
    return target
  }

  return {
    x: Math.abs(target.x - position.x) <= threshold ? target.x : position.x,
    y: Math.abs(target.y - position.y) <= threshold ? target.y : position.y,
  }
}
