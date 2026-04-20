import { useCallback } from 'react'

import type { ImageAsset } from '../../../contracts/imageAsset'
import type { PictureNode } from '../../../contracts/pictureNode'
import type { Viewport, Workspace } from '../../../contracts/workspace'
import { getCardPixelDimensions } from '../../../features/appearance/themeTokens'
import { isPlacementBlockedByOccupiedItem } from '../../../features/groups/groupLayout'
import { createPictureNode } from '../../../features/images/pictureCreation'
import { screenPointToCanvas } from '../../../features/placement/canvasMath'
import {
  addItemToOccupancyIndex,
  applySnap,
  createOccupancyIndex,
} from '../../../features/placement/snapEngine'

import type { CardFrame, PlacementFrames } from './usePlacementFrames'

type UsePictureActionsArgs = {
  addPicture: (picture: PictureNode) => void
  interactionMode: 'edit' | 'view'
  movePicture: (pictureId: string, position: { x: number; y: number }) => void
  placementFrames: Pick<
    PlacementFrames,
    'canPlaceCardFrames' | 'nodePlacementFrames'
  >
  selectedPictureIds: string[]
  toggleInteractionMode: (value?: 'edit' | 'view') => void
  updatePicture: (
    pictureId: string,
    updates: Partial<
      Pick<PictureNode, 'imageId' | 'positionX' | 'positionY' | 'size'>
    >,
  ) => void
  updatePictures: (
    updates: Array<{
      pictureId: string
      updates: Partial<Pick<PictureNode, 'positionX' | 'positionY'>>
    }>,
  ) => void
  viewport: Viewport
  workspace: Workspace
  workspacePictures: PictureNode[]
}

export function usePictureActions({
  addPicture,
  interactionMode,
  movePicture,
  placementFrames,
  selectedPictureIds,
  toggleInteractionMode,
  updatePicture,
  updatePictures,
  viewport,
  workspace,
  workspacePictures,
}: UsePictureActionsArgs) {
  const { canPlaceCardFrames, nodePlacementFrames } = placementFrames

  const placePictureAssetsAtCanvasPoint = useCallback(
    (
      assets: Array<Pick<ImageAsset, 'height' | 'id' | 'width'>>,
      canvasPoint: { x: number; y: number },
    ) => {
      if (assets.length === 0) {
        return
      }

      if (interactionMode !== 'edit') {
        toggleInteractionMode('edit')
      }

      // Build the occupancy index once and extend it as pictures are placed,
      // so every subsequent snap in this paste sees the prior placements
      // without rebuilding the index (ARCHITECTURE-REVIEW §3.2.3).
      const occupancyIndex = createOccupancyIndex(
        nodePlacementFrames,
        workspace.placementGuide,
      )

      assets.forEach((asset, index) => {
        const picture = createPictureNode({
          image: asset,
          position: { x: 0, y: 0 },
        })
        const pictureSize = getCardPixelDimensions(
          picture.size,
          workspace.placementGuide.gridSize,
        )
        const position = applySnap(
          {
            x:
              canvasPoint.x +
              workspace.placementGuide.gridSize * index -
              pictureSize.width / 2,
            y:
              canvasPoint.y +
              workspace.placementGuide.gridSize * index -
              pictureSize.height / 2,
          },
          workspace.placementGuide,
          picture.size,
          {
            force: true,
            occupancyIndex,
            isOccupiedItemBlocking: (candidate, occupiedItem, guide) =>
              isPlacementBlockedByOccupiedItem({
                candidate,
                gridSize: guide.gridSize,
                occupiedItem,
              }),
          },
        )
        const placedPicture = {
          ...picture,
          positionX: position.x,
          positionY: position.y,
        }

        addPicture(placedPicture)
        addItemToOccupancyIndex(occupancyIndex, placedPicture)
      })
    },
    [
      addPicture,
      interactionMode,
      nodePlacementFrames,
      toggleInteractionMode,
      workspace.placementGuide,
    ],
  )

  const placePictureAssetAtViewportCenter = useCallback(
    (asset: Pick<ImageAsset, 'height' | 'id' | 'width'>) => {
      placePictureAssetsAtCanvasPoint(
        [asset],
        screenPointToCanvas(
          { x: window.innerWidth / 2, y: window.innerHeight / 2 },
          viewport,
        ),
      )
    },
    [placePictureAssetsAtCanvasPoint, viewport],
  )

  const handleUpdatePicture = useCallback<
    UsePictureActionsArgs['updatePicture']
  >(
    (pictureId, updates) => {
      const existingPicture = workspacePictures.find(
        (picture) => picture.id === pictureId,
      )

      if (!existingPicture) {
        return
      }

      const nextSize = updates.size ?? existingPicture.size

      if (updates.positionX !== undefined && updates.positionY !== undefined) {
        updatePicture(pictureId, updates)
        return
      }

      if (updates.size === undefined) {
        updatePicture(pictureId, updates)
        return
      }

      const nextPosition = applySnap(
        {
          x: existingPicture.positionX,
          y: existingPicture.positionY,
        },
        workspace.placementGuide,
        nextSize,
        {
          force: true,
          cards: nodePlacementFrames,
          excludedCardId: pictureId,
          isOccupiedItemBlocking: (candidate, occupiedItem, guide) =>
            isPlacementBlockedByOccupiedItem({
              candidate,
              gridSize: guide.gridSize,
              occupiedItem,
            }),
        },
      )

      updatePicture(pictureId, {
        ...updates,
        positionX: nextPosition.x,
        positionY: nextPosition.y,
      })
    },
    [
      nodePlacementFrames,
      updatePicture,
      workspacePictures,
      workspace.placementGuide,
    ],
  )

  const handleMovePicture = useCallback(
    (pictureId: string, position: { x: number; y: number }) => {
      if (
        !selectedPictureIds.includes(pictureId) ||
        selectedPictureIds.length <= 1
      ) {
        movePicture(pictureId, position)
        return
      }

      const anchorPicture = workspacePictures.find(
        (picture) => picture.id === pictureId,
      )

      if (!anchorPicture) {
        return
      }

      const delta = {
        x: position.x - anchorPicture.positionX,
        y: position.y - anchorPicture.positionY,
      }
      const frames: CardFrame[] = workspacePictures
        .filter((picture) => selectedPictureIds.includes(picture.id))
        .map((picture) => ({
          cardId: picture.id,
          position: {
            x: picture.positionX + delta.x,
            y: picture.positionY + delta.y,
          },
          size: picture.size,
        }))

      if (!canPlaceCardFrames(frames)) {
        return
      }

      updatePictures(
        frames.map((frame) => ({
          pictureId: frame.cardId,
          updates: {
            positionX: frame.position.x,
            positionY: frame.position.y,
          },
        })),
      )
    },
    [
      canPlaceCardFrames,
      movePicture,
      selectedPictureIds,
      updatePictures,
      workspacePictures,
    ],
  )

  return {
    handleMovePicture,
    handleUpdatePicture,
    placePictureAssetAtViewportCenter,
    placePictureAssetsAtCanvasPoint,
  }
}
