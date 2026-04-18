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

function rectsOverlap(a: GridRect, b: GridRect) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  )
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
  occupiedItems: PlaceableItem[],
  guide: PlacementGuide,
  isOccupiedItemBlocking?: PlacementBlockPredicate,
) {
  return occupiedItems.every((occupiedItem) => {
    if (isOccupiedItemBlocking) {
      return !isOccupiedItemBlocking(
        {
          position: {
            x: candidate.x * guide.gridSize,
            y: candidate.y * guide.gridSize,
          },
          size: {
            columns: candidate.width,
            rows: candidate.height,
          },
        },
        occupiedItem,
        guide,
      )
    }

    return !rectsOverlap(
      candidate,
      toGridRect(
        { x: occupiedItem.positionX, y: occupiedItem.positionY },
        occupiedItem.size,
        guide.gridSize,
      ),
    )
  })
}

export function isPlacementAvailable(
  position: { x: number; y: number },
  size: CardSize,
  guide: PlacementGuide,
  options?: Pick<
    SnapOptions,
    'cards' | 'excludedCardId' | 'isOccupiedItemBlocking'
  >,
) {
  const occupiedItems = getOccupiedItems(
    options?.cards,
    options?.excludedCardId,
  )

  return isGridRectFree(
    toGridRect(position, size, guide.gridSize),
    occupiedItems,
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
  occupiedItems: PlaceableItem[],
  guide: PlacementGuide,
  isOccupiedItemBlocking?: PlacementBlockPredicate,
) {
  const targetRect: GridRect = {
    x: targetCell.x,
    y: targetCell.y,
    width: size.columns,
    height: size.rows,
  }

  if (
    isGridRectFree(targetRect, occupiedItems, guide, isOccupiedItemBlocking)
  ) {
    return targetCell
  }

  const maxRadius = Math.max(
    12,
    Math.ceil(Math.sqrt(occupiedItems.length + 1)) * 8,
  )

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
          occupiedItems,
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
  const occupiedItems = getOccupiedItems(
    options?.cards,
    options?.excludedCardId,
  )
  const freeCell = findNearestFreeCell(
    targetCell,
    size,
    occupiedItems,
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
