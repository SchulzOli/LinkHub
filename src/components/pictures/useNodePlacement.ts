import type { PictureNode } from '../../contracts/pictureNode'
import type { PlacementGuide } from '../../contracts/placementGuide'
import type { Viewport } from '../../contracts/workspace'
import { isPlacementBlockedByOccupiedItem } from '../../features/groups/groupLayout'
import { getPlaceableItemsSnapshot } from '../../features/placement/placeableItemsSnapshot'
import { useDragPlacement } from '../../features/placement/useDragPlacement'
import {
  useResizePlacement,
  type ResizeDirection,
} from '../../features/placement/useResizePlacement'
import {
  useCanvasEditActions,
  useCanvasPlacementActions,
} from '../canvas/CanvasActionsContext'

export const NODE_RESIZE_HANDLES: ResizeDirection[] = [
  'n',
  's',
  'e',
  'w',
  'ne',
  'nw',
  'se',
  'sw',
]

/**
 * Drag + resize wiring shared by every free-floating node kind (images,
 * charts), so they snap, collide and move with groups identically.
 */
export function useNodePlacement(input: {
  node: Pick<PictureNode, 'id' | 'positionX' | 'positionY' | 'size'>
  guide: PlacementGuide
  viewport: Viewport
  enabled: boolean
}) {
  const { node, guide, viewport, enabled } = input
  const { onUpdatePicture: onUpdate } = useCanvasEditActions()
  const { onMovePicture: onMove, onPreviewChange } = useCanvasPlacementActions()
  const isOccupiedItemBlocking = (
    candidate: Parameters<
      typeof isPlacementBlockedByOccupiedItem
    >[0]['candidate'],
    occupiedItem: Parameters<
      typeof isPlacementBlockedByOccupiedItem
    >[0]['occupiedItem'],
    currentGuide: PlacementGuide,
  ) =>
    isPlacementBlockedByOccupiedItem({
      candidate,
      gridSize: currentGuide.gridSize,
      occupiedItem,
    })

  const handlePointerDown = useDragPlacement({
    cardId: node.id,
    cardSize: node.size,
    position: { x: node.positionX, y: node.positionY },
    getCards: getPlaceableItemsSnapshot,
    enabled,
    guide,
    isOccupiedItemBlocking,
    viewport,
    onMove,
    onPreviewChange,
  })
  const createResizePointerDown = useResizePlacement({
    card: {
      id: node.id,
      positionX: node.positionX,
      positionY: node.positionY,
      size: node.size,
    },
    getCards: getPlaceableItemsSnapshot,
    enabled,
    guide,
    isOccupiedItemBlocking,
    viewport,
    onResize: (nodeId, frame) => {
      onUpdate(nodeId, {
        size: frame.size,
        positionX: frame.position.x,
        positionY: frame.position.y,
      })
    },
    onPreviewChange,
  })

  return { handlePointerDown, createResizePointerDown }
}
