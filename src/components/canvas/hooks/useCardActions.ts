import { useCallback } from 'react'

import type { LinkCard } from '../../../contracts/linkCard'
import type { Viewport, Workspace } from '../../../contracts/workspace'
import { getCardColorsFromAppearance } from '../../../features/appearance/cardColorPalette'
import { getCardPixelDimensions } from '../../../features/appearance/themeTokens'
import { isPlacementBlockedByOccupiedItem } from '../../../features/groups/groupLayout'
import { createLinkCard } from '../../../features/links/linkCreation'
import { screenPointToCanvas } from '../../../features/placement/canvasMath'
import { applySnap } from '../../../features/placement/snapEngine'
import type { AutoEditTarget } from '../../../state/workspaceStoreTypes'

import type { CardFrame, PlacementFrames } from './usePlacementFrames'

type UseCardActionsArgs = {
  addCard: (card: LinkCard) => void
  interactionMode: 'edit' | 'view'
  moveCard: (cardId: string, position: { x: number; y: number }) => void
  placementFrames: Pick<
    PlacementFrames,
    'canPlaceCardFrames' | 'nodePlacementFrames'
  >
  selectedCardIds: string[]
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
  viewport: Viewport
  workspace: Workspace
  workspaceCards: LinkCard[]
}

export function useCardActions({
  addCard,
  interactionMode,
  moveCard,
  placementFrames,
  selectedCardIds,
  setAutoEditTarget,
  toggleInteractionMode,
  toggleQuickAdd,
  updateCard,
  updateCards,
  viewport,
  workspace,
  workspaceCards,
}: UseCardActionsArgs) {
  const { canPlaceCardFrames, nodePlacementFrames } = placementFrames

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

  const handleUpdateCard = useCallback<UseCardActionsArgs['updateCard']>(
    (cardId, updates) => {
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
      const frames: CardFrame[] = workspaceCards
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

  return {
    createAtViewportCenter,
    handleMoveCard,
    handleUpdateCard,
  }
}
