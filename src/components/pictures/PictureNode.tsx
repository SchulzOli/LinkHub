import { memo, type CSSProperties } from 'react'

import styles from './PictureNode.module.css'

import type { ImagePictureNode } from '../../contracts/pictureNode'
import type { PlacementGuide } from '../../contracts/placementGuide'
import type { Viewport } from '../../contracts/workspace'
import {
  getCardPixelDimensions,
  getOverlayActionMetrics,
} from '../../features/appearance/themeTokens'
import { useImageAssetUrl } from '../../features/images/useImageAssetUrl'
import type { InteractionMode } from '../../state/useWorkspaceStore'
import {
  useCanvasEditActions,
  useCanvasSelectionActions,
} from '../canvas/CanvasActionsContext'
import {
  NodeActionBar,
  NodeActionButton,
  NodeResizeHandles,
} from '../nodes/NodeChrome'
import { NODE_CHROME_HOST, NODE_SURFACE } from '../nodes/nodeClasses'

import { useNodePlacement } from './useNodePlacement'

type PictureNodeProps = {
  picture: ImagePictureNode
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
  const { onSelectPicture: onSelect } = useCanvasSelectionActions()
  const {
    onRemovePicture: onRemove,
    onRequestPictureImagePicker: onRequestImagePicker,
  } = useCanvasEditActions()
  const isEditMode = interactionMode === 'edit'
  const imageUrl = useImageAssetUrl(picture.imageId)
  const size = getCardPixelDimensions(picture.size, guide.gridSize)
  const actionMetrics = getOverlayActionMetrics(size.width, size.height)
  const { handlePointerDown, createResizePointerDown } = useNodePlacement({
    node: picture,
    guide,
    viewport,
    enabled: isEditMode,
  })

  const nodeStyle: CSSProperties & Record<string, string | number> = {
    width: size.width,
    height: size.height,
    ['--action-button-size' as const]: `${actionMetrics.buttonSize}px`,
    ['--action-icon-size' as const]: `${actionMetrics.iconSize}px`,
    ['--action-bar-gap' as const]: `${actionMetrics.gap}px`,
    ['--action-bar-offset' as const]: `${actionMetrics.offset}px`,
    transform: `translate(${picture.positionX}px, ${picture.positionY}px)`,
  }
  return (
    <article
      className={`${NODE_SURFACE} ${NODE_CHROME_HOST}`}
      data-entity-id={picture.id}
      data-entity-kind="picture"
      data-mode={interactionMode}
      data-selected={isSelected}
      data-testid={`picture-node-${picture.id}`}
      style={nodeStyle}
      onPointerDown={(event) => {
        if (event.button !== 0) {
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
        <>
          <NodeActionBar>
            <NodeActionButton
              kind="edit"
              label="Edit picture"
              onClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
                onRequestImagePicker(picture.id)
              }}
            />
            <NodeActionButton
              kind="delete"
              label="Delete"
              onClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
                onRemove(picture.id)
              }}
            />
          </NodeActionBar>
          <NodeResizeHandles
            label={(direction) => `Resize picture ${direction}`}
            onPointerDown={createResizePointerDown}
          />
        </>
      ) : null}
    </article>
  )
})
