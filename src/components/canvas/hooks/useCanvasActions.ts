import { useCallback, useMemo } from 'react'

import {
  getDefaultGroupSize,
  type CardGroup,
} from '../../../contracts/cardGroup'
import type { ImageAsset } from '../../../contracts/imageAsset'
import type { CardSize, LinkCard } from '../../../contracts/linkCard'
import type { PictureNode } from '../../../contracts/pictureNode'
import type { Viewport, Workspace } from '../../../contracts/workspace'
import { getCardColorsFromAppearance } from '../../../features/appearance/cardColorPalette'
import { getCardPixelDimensions } from '../../../features/appearance/themeTokens'
import { createCardGroup } from '../../../features/groups/groupCreation'
import {
  getGroupPlacementFrames,
  getVisibleCards,
  isGroupPlacementBlockedByVisibleGroup,
  isPlacementBlockedByOccupiedItem,
} from '../../../features/groups/groupLayout'
import { createPictureNode } from '../../../features/images/pictureCreation'
import { createLinkCard } from '../../../features/links/linkCreation'
import { screenPointToCanvas } from '../../../features/placement/canvasMath'
import {
  addItemToOccupancyIndex,
  applySnap,
  createOccupancyIndex,
  isPlacementAvailable,
} from '../../../features/placement/snapEngine'
import type { AutoEditTarget } from '../../../state/workspaceStoreTypes'

type CardFrame = {
  cardId: string
  position: { x: number; y: number }
  size: CardSize
}

type GroupFrame = {
  collapsed?: boolean
  groupId: string
  parentGroupId?: string
  position: { x: number; y: number }
  size: CardSize
}

type UseCanvasActionsArgs = {
  addCard: (card: LinkCard) => void
  addGroup: (group: CardGroup) => void
  addPicture: (picture: PictureNode) => void
  interactionMode: 'edit' | 'view'
  moveCard: (cardId: string, position: { x: number; y: number }) => void
  moveGroup: (
    groupId: string,
    position: { x: number; y: number },
    pictureIds?: string[],
  ) => void
  movePicture: (pictureId: string, position: { x: number; y: number }) => void
  selectedCardIds: string[]
  selectedPictureIds: string[]
  setAutoEditTarget: (target: AutoEditTarget) => void
  toggleInteractionMode: (value?: 'edit' | 'view') => void
  toggleQuickAdd: (value?: boolean) => void
  updateCard: (
    cardId: string,
    updates: Partial<
      Pick<
        LinkCard,
        | 'title'
        | 'url'
        | 'faviconUrl'
        | 'faviconOverrideImageId'
        | 'size'
        | 'cornerRadius'
        | 'showTitle'
        | 'showImage'
        | 'positionX'
        | 'positionY'
        | 'fillPresetIndex'
        | 'borderPresetIndex'
        | 'fillColor'
        | 'borderColor'
        | 'surfaceTransparency'
        | 'shadowStyle'
      >
    >,
  ) => void
  updateCards: (
    updates: Array<{
      cardId: string
      updates: Partial<Pick<LinkCard, 'positionX' | 'positionY'>>
    }>,
  ) => void
  updateGroup: (
    groupId: string,
    updates: Partial<
      Pick<
        CardGroup,
        | 'name'
        | 'size'
        | 'cornerRadius'
        | 'showTitle'
        | 'positionX'
        | 'positionY'
        | 'fillPresetIndex'
        | 'borderPresetIndex'
        | 'fillColor'
        | 'borderColor'
        | 'surfaceTransparency'
        | 'shadowStyle'
      >
    >,
  ) => void
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
  workspace: Workspace
  viewport: Viewport
  workspaceCards: LinkCard[]
  workspaceGroups: CardGroup[]
  workspacePictures: PictureNode[]
}

export function useCanvasActions({
  addCard,
  addGroup,
  addPicture,
  interactionMode,
  moveCard,
  moveGroup,
  movePicture,
  selectedCardIds,
  selectedPictureIds,
  setAutoEditTarget,
  toggleInteractionMode,
  toggleQuickAdd,
  updateCard,
  updateCards,
  updateGroup,
  updatePicture,
  updatePictures,
  workspace,
  viewport,
  workspaceCards,
  workspaceGroups,
  workspacePictures,
}: UseCanvasActionsArgs) {
  const visibleCards = useMemo(
    () => getVisibleCards(workspaceCards, workspaceGroups),
    [workspaceCards, workspaceGroups],
  )
  const visiblePlaceableNodes = useMemo(
    () => [...visibleCards, ...workspacePictures],
    [visibleCards, workspacePictures],
  )
  const groupPlacementFrames = useMemo(
    () => getGroupPlacementFrames(workspaceGroups),
    [workspaceGroups],
  )
  const nodePlacementFrames = useMemo(
    () => [...visiblePlaceableNodes, ...groupPlacementFrames],
    [groupPlacementFrames, visiblePlaceableNodes],
  )

  const canPlaceCardFrames = useCallback(
    (frames: CardFrame[]) => {
      const movingIds = new Set(frames.map((frame) => frame.cardId))
      const stationaryCards = nodePlacementFrames.filter(
        (item) => !movingIds.has(item.id),
      )

      return frames.every((frame, _, allFrames) => {
        const siblingFrames = allFrames
          .filter((candidate) => candidate.cardId !== frame.cardId)
          .map((candidate) => ({
            id: candidate.cardId,
            positionX: candidate.position.x,
            positionY: candidate.position.y,
            size: candidate.size,
          }))

        return isPlacementAvailable(
          frame.position,
          frame.size,
          workspace.placementGuide,
          {
            cards: [...stationaryCards, ...siblingFrames],
            isOccupiedItemBlocking: (candidate, occupiedItem, guide) =>
              isPlacementBlockedByOccupiedItem({
                candidate,
                gridSize: guide.gridSize,
                occupiedItem,
              }),
          },
        )
      })
    },
    [nodePlacementFrames, workspace.placementGuide],
  )

  const canPlaceGroupFrames = useCallback(
    (frames: GroupFrame[]) => {
      const movingIds = new Set(frames.map((frame) => frame.groupId))
      const rootFrames = frames.filter(
        (frame) => !frame.parentGroupId || !movingIds.has(frame.parentGroupId),
      )
      const stationaryGroups = groupPlacementFrames.filter(
        (group) => !movingIds.has(group.id),
      )

      return rootFrames.every((frame, _, allFrames) => {
        const siblingFrames = allFrames
          .filter((candidate) => candidate.groupId !== frame.groupId)
          .map((candidate) => ({
            collapsed: candidate.collapsed,
            id: candidate.groupId,
            kind: 'group' as const,
            parentGroupId: candidate.parentGroupId,
            positionX: candidate.position.x,
            positionY: candidate.position.y,
            size: candidate.size,
          }))

        return isPlacementAvailable(
          frame.position,
          frame.size,
          workspace.placementGuide,
          {
            cards: [...stationaryGroups, ...siblingFrames],
            isOccupiedItemBlocking: (candidate, occupiedItem, guide) =>
              isGroupPlacementBlockedByVisibleGroup({
                candidate,
                gridSize: guide.gridSize,
                occupiedGroup: occupiedItem,
              }),
          },
        )
      })
    },
    [groupPlacementFrames, workspace.placementGuide],
  )

  const createAtViewportCenter = useCallback(
    (url: string, title = '') => {
      const center = screenPointToCanvas(
        { x: window.innerWidth / 2, y: window.innerHeight / 2 },
        viewport,
      )
      const cardSize = getCardPixelDimensions(
        workspace.appearance.defaultCardSize,
        workspace.placementGuide.gridSize,
      )
      const position = applySnap(
        {
          x: center.x - cardSize.width / 2,
          y: center.y - cardSize.height / 2,
        },
        workspace.placementGuide,
        workspace.appearance.defaultCardSize,
        {
          force: true,
          cards: nodePlacementFrames,
          isOccupiedItemBlocking: (candidate, occupiedItem, guide) =>
            isPlacementBlockedByOccupiedItem({
              candidate,
              gridSize: guide.gridSize,
              occupiedItem,
            }),
        },
      )
      const card = createLinkCard({
        url,
        title,
        position,
        size: workspace.appearance.defaultCardSize,
        ...getCardColorsFromAppearance(workspace.appearance),
      })

      if (!card) {
        return
      }

      if (interactionMode !== 'edit') {
        toggleInteractionMode('edit')
      }

      addCard(card)
      setAutoEditTarget({
        kind: 'card',
        id: card.id,
      })
      toggleQuickAdd(false)
    },
    [
      addCard,
      interactionMode,
      toggleQuickAdd,
      toggleInteractionMode,
      nodePlacementFrames,
      setAutoEditTarget,
      workspace.appearance,
      workspace.placementGuide,
      viewport,
    ],
  )

  const createGroupAtViewportCenter = useCallback(() => {
    const center = screenPointToCanvas(
      { x: window.innerWidth / 2, y: window.innerHeight / 2 },
      viewport,
    )
    const groupSize = getDefaultGroupSize(
      workspace.appearance.defaultCardSize,
      workspace.placementGuide.gridSize,
    )
    const groupDimensions = getCardPixelDimensions(
      groupSize,
      workspace.placementGuide.gridSize,
    )
    const position = applySnap(
      {
        x: center.x - groupDimensions.width / 2,
        y: center.y - groupDimensions.height / 2,
      },
      workspace.placementGuide,
      groupSize,
      {
        force: true,
        cards: groupPlacementFrames,
      },
    )

    const group = createCardGroup({
      name: `Group ${workspaceGroups.length + 1}`,
      position,
      size: groupSize,
      ...getCardColorsFromAppearance(workspace.appearance),
    })

    if (interactionMode !== 'edit') {
      toggleInteractionMode('edit')
    }

    addGroup(group)
  }, [
    addGroup,
    groupPlacementFrames,
    interactionMode,
    toggleInteractionMode,
    workspace.appearance,
    workspace.placementGuide,
    viewport,
    workspaceGroups.length,
  ])

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

  const handleUpdateCard = useCallback(
    (
      cardId: string,
      updates: Partial<
        Pick<
          LinkCard,
          | 'title'
          | 'url'
          | 'faviconUrl'
          | 'faviconOverrideImageId'
          | 'size'
          | 'cornerRadius'
          | 'showTitle'
          | 'showImage'
          | 'positionX'
          | 'positionY'
          | 'fillPresetIndex'
          | 'borderPresetIndex'
          | 'fillColor'
          | 'borderColor'
          | 'surfaceTransparency'
          | 'shadowStyle'
        >
      >,
    ) => {
      const existingCard = workspaceCards.find((card) => card.id === cardId)

      if (!existingCard) {
        return
      }

      const nextSize = updates.size ?? existingCard.size

      if (updates.positionX !== undefined && updates.positionY !== undefined) {
        updateCard(cardId, updates)
        return
      }

      if (updates.size === undefined) {
        updateCard(cardId, updates)
        return
      }

      const nextPosition = applySnap(
        {
          x: existingCard.positionX,
          y: existingCard.positionY,
        },
        workspace.placementGuide,
        nextSize,
        {
          force: true,
          cards: nodePlacementFrames,
          excludedCardId: cardId,
          isOccupiedItemBlocking: (candidate, occupiedItem, guide) =>
            isPlacementBlockedByOccupiedItem({
              candidate,
              gridSize: guide.gridSize,
              occupiedItem,
            }),
        },
      )

      updateCard(cardId, {
        ...updates,
        positionX: nextPosition.x,
        positionY: nextPosition.y,
      })
    },
    [nodePlacementFrames, updateCard, workspaceCards, workspace.placementGuide],
  )

  const handleMoveCard = useCallback(
    (cardId: string, position: { x: number; y: number }) => {
      if (!selectedCardIds.includes(cardId) || selectedCardIds.length <= 1) {
        moveCard(cardId, position)
        return
      }

      const anchorCard = workspaceCards.find((card) => card.id === cardId)

      if (!anchorCard) {
        return
      }

      const delta = {
        x: position.x - anchorCard.positionX,
        y: position.y - anchorCard.positionY,
      }
      const frames = workspaceCards
        .filter((card) => selectedCardIds.includes(card.id))
        .map((card) => ({
          cardId: card.id,
          position: {
            x: card.positionX + delta.x,
            y: card.positionY + delta.y,
          },
          size: card.size,
        }))

      if (!canPlaceCardFrames(frames)) {
        return
      }

      updateCards(
        frames.map((frame) => ({
          cardId: frame.cardId,
          updates: {
            positionX: frame.position.x,
            positionY: frame.position.y,
          },
        })),
      )
    },
    [
      canPlaceCardFrames,
      moveCard,
      selectedCardIds,
      updateCards,
      workspaceCards,
    ],
  )

  const handleUpdateGroup = useCallback(
    (
      groupId: string,
      updates: Partial<
        Pick<
          CardGroup,
          | 'name'
          | 'size'
          | 'cornerRadius'
          | 'showTitle'
          | 'positionX'
          | 'positionY'
          | 'fillPresetIndex'
          | 'borderPresetIndex'
          | 'fillColor'
          | 'borderColor'
          | 'surfaceTransparency'
          | 'shadowStyle'
        >
      >,
    ) => {
      const existingGroup = workspaceGroups.find(
        (group) => group.id === groupId,
      )

      if (!existingGroup) {
        return
      }

      if (updates.positionX !== undefined && updates.positionY !== undefined) {
        updateGroup(groupId, updates)
        return
      }

      updateGroup(groupId, {
        ...updates,
        positionX: updates.positionX ?? existingGroup.positionX,
        positionY: updates.positionY ?? existingGroup.positionY,
      })
    },
    [updateGroup, workspaceGroups],
  )

  const handleMoveGroup = useCallback(
    (
      groupId: string,
      position: { x: number; y: number },
      pictureIds?: string[],
    ) => {
      moveGroup(groupId, position, pictureIds)
    },
    [moveGroup],
  )

  const handleUpdatePicture = useCallback(
    (
      pictureId: string,
      updates: Partial<
        Pick<PictureNode, 'imageId' | 'positionX' | 'positionY' | 'size'>
      >,
    ) => {
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
      const frames = workspacePictures
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
    canPlaceCardFrames,
    canPlaceGroupFrames,
    createAtViewportCenter,
    createGroupAtViewportCenter,
    handleMoveCard,
    handleMoveGroup,
    handleMovePicture,
    handleUpdateCard,
    handleUpdateGroup,
    handleUpdatePicture,
    placePictureAssetAtViewportCenter,
    placePictureAssetsAtCanvasPoint,
  }
}
