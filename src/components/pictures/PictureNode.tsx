import { memo, type CSSProperties } from 'react'

import styles from './PictureNode.module.css'

import type { PlacementGuide } from '../../contracts/placementGuide'
import type { Viewport } from '../../contracts/workspace'
import {
  getCardPixelDimensions,
  getOverlayActionMetrics,
} from '../../features/appearance/themeTokens'
import { isPlacementBlockedByOccupiedItem } from '../../features/groups/groupLayout'
import { useImageAssetUrl } from '../../features/images/useImageAssetUrl'
import { getPlaceableItemsSnapshot } from '../../features/placement/placeableItemsSnapshot'
import { useDragPlacement } from '../../features/placement/useDragPlacement'
import {
  useResizePlacement,
  type ResizeDirection,
} from '../../features/placement/useResizePlacement'
import {
  useWorkspaceStore,
  type InteractionMode,
} from '../../state/useWorkspaceStore'
import {
  useCanvasEditActions,
  useCanvasPlacementActions,
  useCanvasSelectionActions,
} from '../canvas/CanvasActionsContext'
import { EditIcon } from '../ui/EditIcon'

type PictureNodeProps = {
  picture: import('../../contracts/pictureNode').PictureNode
  guide: PlacementGuide
  isSelected: boolean
  interactionMode: InteractionMode
  viewport: Viewport
}

export const PictureNode = memo(function PictureNode({
  picture,
  guide,
  isSelected,
  interactionMode,
  viewport,
}: PictureNodeProps) {
  const formatPainter = useWorkspaceStore((state) => state.formatPainter)
  const { onSelectPicture: onSelect } = useCanvasSelectionActions()
  const {
    onRemovePicture: onRemove,
    onRequestPictureImagePicker: onRequestImagePicker,
    onUpdatePicture: onUpdate,
  } = useCanvasEditActions()
  const { onMovePicture: onMove, onPreviewChange } = useCanvasPlacementActions()
  const isEditMode = interactionMode === 'edit'
  const imageUrl = useImageAssetUrl(picture.imageId)
  const size = getCardPixelDimensions(picture.size, guide.gridSize)
  const actionMetrics = getOverlayActionMetrics(size.width, size.height)
  const handlePointerDown = useDragPlacement({
    cardId: picture.id,
    cardSize: picture.size,
    position: { x: picture.positionX, y: picture.positionY },
    getCards: getPlaceableItemsSnapshot,
    enabled: isEditMode,
    guide,
    isOccupiedItemBlocking: (candidate, occupiedItem, currentGuide) =>
      isPlacementBlockedByOccupiedItem({
        candidate,
        gridSize: currentGuide.gridSize,
        occupiedItem,
      }),
    viewport,
    onMove,
    onPreviewChange,
  })
  const createResizePointerDown = useResizePlacement({
    card: {
      id: picture.id,
      positionX: picture.positionX,
      positionY: picture.positionY,
      size: picture.size,
    },
    getCards: getPlaceableItemsSnapshot,
    enabled: isEditMode,
    guide,
    isOccupiedItemBlocking: (candidate, occupiedItem, currentGuide) =>
      isPlacementBlockedByOccupiedItem({
        candidate,
        gridSize: currentGuide.gridSize,
        occupiedItem,
      }),
    viewport,
    onResize: (pictureId, frame) => {
      onUpdate(pictureId, {
        size: frame.size,
        positionX: frame.position.x,
        positionY: frame.position.y,
      })
    },
    onPreviewChange,
  })

  const nodeStyle: CSSProperties & Record<string, string | number> = {
    width: size.width,
    height: size.height,
    ['--action-button-size' as const]: `${actionMetrics.buttonSize}px`,
    ['--action-icon-size' as const]: `${actionMetrics.iconSize}px`,
    ['--action-bar-gap' as const]: `${actionMetrics.gap}px`,
    ['--action-bar-offset' as const]: `${actionMetrics.offset}px`,
    transform: `translate(${(picture.positionX - viewport.x) * viewport.zoom}px, ${(picture.positionY - viewport.y) * viewport.zoom}px) scale(${viewport.zoom})`,
  }
  const resizeHandles: ResizeDirection[] = [
    'n',
    's',
    'e',
    'w',
    'ne',
    'nw',
    'se',
    'sw',
  ]
  const resizeHandleClassNameByDirection: Record<ResizeDirection, string> = {
    n: styles.resizeHandleN,
    s: styles.resizeHandleS,
    e: styles.resizeHandleE,
    w: styles.resizeHandleW,
    ne: styles.resizeHandleNE,
    nw: styles.resizeHandleNW,
    se: styles.resizeHandleSE,
    sw: styles.resizeHandleSW,
  }

  return (
    <article
      className={`${styles.node} ${isEditMode ? styles.nodeEdit : ''} ${isSelected ? styles.nodeSelected : ''}`}
      data-mode={interactionMode}
      data-selected={isSelected}
      data-testid={`picture-node-${picture.id}`}
      style={nodeStyle}
      onPointerDown={(event) => {
        if (event.button !== 0) {
          return
        }

        if (formatPainter) {
          event.preventDefault()
          event.stopPropagation()
          return
        }

        if (isEditMode) {
          onSelect(picture.id, event.metaKey || event.ctrlKey)
        }

        handlePointerDown(event)
      }}
    >
      <div className={styles.frame}>
        {imageUrl ? (
          <img
            alt=""
            className={styles.image}
            draggable={false}
            loading="lazy"
            src={imageUrl}
          />
        ) : (
          <div className={styles.placeholder}>Image unavailable</div>
        )}
      </div>
      {isEditMode ? (
        <div className={styles.actionBar}>
          <button
            aria-label="Edit picture"
            className={styles.actionButton}
            type="button"
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              onRequestImagePicker(picture.id)
            }}
            title="Edit picture"
          >
            <span aria-hidden="true" className={styles.actionIcon}>
              <EditIcon className={styles.actionSvg} />
            </span>
          </button>
          <button
            aria-label="Delete"
            className={`${styles.actionButton} ${styles.actionButtonDanger}`}
            type="button"
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              onRemove(picture.id)
            }}
            title="Delete"
          >
            <span aria-hidden="true" className={styles.actionIcon}>
              <svg
                viewBox="0 0 24 24"
                focusable="false"
                className={styles.actionSvg}
              >
                <path
                  d="M6.7 5.3a1 1 0 0 1 1.4 0L12 9.17l3.9-3.88a1 1 0 1 1 1.4 1.42L13.4 10.6l3.88 3.9a1 1 0 0 1-1.42 1.4L12 12l-3.9 3.9a1 1 0 0 1-1.4-1.42l3.88-3.88-3.9-3.9a1 1 0 0 1 0-1.4Z"
                  fill="currentColor"
                />
              </svg>
            </span>
          </button>
        </div>
      ) : null}
      {isEditMode
        ? resizeHandles.map((direction) => (
            <button
              key={direction}
              aria-label={`Resize picture ${direction}`}
              className={`${styles.resizeHandle} ${resizeHandleClassNameByDirection[direction]}`}
              type="button"
              onPointerDown={createResizePointerDown(direction)}
            />
          ))
        : null}
    </article>
  )
})
