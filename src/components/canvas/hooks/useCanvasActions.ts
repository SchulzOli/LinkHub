import type { CardGroup } from '../../../contracts/cardGroup'
import type { LinkCard } from '../../../contracts/linkCard'
import type { PictureNode } from '../../../contracts/pictureNode'
import type { Viewport, Workspace } from '../../../contracts/workspace'
import type { AutoEditTarget } from '../../../state/workspaceStoreTypes'

import { useCardActions } from './useCardActions'
import { useGroupActions } from './useGroupActions'
import { usePictureActions } from './usePictureActions'
import { usePlacementFrames } from './usePlacementFrames'

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
  updateCard: Parameters<typeof useCardActions>[0]['updateCard']
  updateCards: Parameters<typeof useCardActions>[0]['updateCards']
  updateGroup: Parameters<typeof useGroupActions>[0]['updateGroup']
  updatePicture: Parameters<typeof usePictureActions>[0]['updatePicture']
  updatePictures: Parameters<typeof usePictureActions>[0]['updatePictures']
  workspace: Workspace
  viewport: Viewport
  workspaceCards: LinkCard[]
  workspaceGroups: CardGroup[]
  workspacePictures: PictureNode[]
}

export function useCanvasActions(args: UseCanvasActionsArgs) {
  const {
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
    viewport,
    workspace,
    workspaceCards,
    workspaceGroups,
    workspacePictures,
  } = args

  const placementFrames = usePlacementFrames({
    placementGuide: workspace.placementGuide,
    workspaceCards,
    workspaceGroups,
    workspacePictures,
  })

  const cardActions = useCardActions({
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
  })

  const groupActions = useGroupActions({
    addGroup,
    interactionMode,
    moveGroup,
    placementFrames,
    toggleInteractionMode,
    updateGroup,
    viewport,
    workspace,
    workspaceGroups,
  })

  const pictureActions = usePictureActions({
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
  })

  return {
    canPlaceCardFrames: placementFrames.canPlaceCardFrames,
    canPlaceGroupFrames: placementFrames.canPlaceGroupFrames,
    createAtViewportCenter: cardActions.createAtViewportCenter,
    createGroupAtViewportCenter: groupActions.createGroupAtViewportCenter,
    handleMoveCard: cardActions.handleMoveCard,
    handleMoveGroup: groupActions.handleMoveGroup,
    handleMovePicture: pictureActions.handleMovePicture,
    handleUpdateCard: cardActions.handleUpdateCard,
    handleUpdateGroup: groupActions.handleUpdateGroup,
    handleUpdatePicture: pictureActions.handleUpdatePicture,
    placePictureAssetAtViewportCenter:
      pictureActions.placePictureAssetAtViewportCenter,
    placePictureAssetsAtCanvasPoint:
      pictureActions.placePictureAssetsAtCanvasPoint,
  }
}
