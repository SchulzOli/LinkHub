import { createContext, useContext, type ReactNode } from 'react'

import type { CardSize } from '../../contracts/linkCard'
import type {
  AutoEditTarget,
  CardUpdateFields,
  GroupUpdateFields,
  PictureUpdateFields,
} from '../../state/workspaceStoreTypes'

export type CanvasDragPreview = {
  cardId: string
  size: CardSize
  position: { x: number; y: number }
}

export type CanvasSelectionActions = {
  autoEditTarget: AutoEditTarget
  onClearAutoEditTarget: () => void
  onSelectCard: (cardId: string, additive: boolean) => void
  onSelectGroup: (groupId: string, additive: boolean) => void
  onSelectPicture: (pictureId: string, additive: boolean) => void
}

export type CanvasEditActions = {
  onRecordLinkOpen: (cardId: string) => void
  onRemoveCard: (cardId: string) => void
  onRemoveGroup: (groupId: string) => void
  onRemovePicture: (pictureId: string) => void
  onRequestCardImageOverridePicker: (cardId: string) => void
  onRequestPictureImagePicker: (pictureId: string) => void
  onUpdateCard: (cardId: string, updates: CardUpdateFields) => void
  onUpdateGroup: (groupId: string, updates: GroupUpdateFields) => void
  onUpdatePicture: (pictureId: string, updates: PictureUpdateFields) => void
}

export type CanvasPlacementActions = {
  onMoveCard: (cardId: string, position: { x: number; y: number }) => void
  onMoveGroup: (
    groupId: string,
    position: { x: number; y: number },
    pictureIds?: string[],
  ) => void
  onMovePicture: (pictureId: string, position: { x: number; y: number }) => void
  onPreviewChange: (preview: CanvasDragPreview | null) => void
}

const CanvasSelectionActionsContext =
  createContext<CanvasSelectionActions | null>(null)
const CanvasEditActionsContext = createContext<CanvasEditActions | null>(null)
const CanvasPlacementActionsContext =
  createContext<CanvasPlacementActions | null>(null)

type CanvasActionsProviderProps = {
  children: ReactNode
  selection: CanvasSelectionActions
  edit: CanvasEditActions
  placement: CanvasPlacementActions
}

export function CanvasActionsProvider({
  children,
  selection,
  edit,
  placement,
}: CanvasActionsProviderProps) {
  return (
    <CanvasSelectionActionsContext.Provider value={selection}>
      <CanvasEditActionsContext.Provider value={edit}>
        <CanvasPlacementActionsContext.Provider value={placement}>
          {children}
        </CanvasPlacementActionsContext.Provider>
      </CanvasEditActionsContext.Provider>
    </CanvasSelectionActionsContext.Provider>
  )
}

export function useCanvasSelectionActions() {
  const value = useContext(CanvasSelectionActionsContext)

  if (!value) {
    throw new Error(
      'useCanvasSelectionActions must be used within a CanvasActionsProvider.',
    )
  }

  return value
}

export function useCanvasEditActions() {
  const value = useContext(CanvasEditActionsContext)

  if (!value) {
    throw new Error(
      'useCanvasEditActions must be used within a CanvasActionsProvider.',
    )
  }

  return value
}

export function useCanvasPlacementActions() {
  const value = useContext(CanvasPlacementActionsContext)

  if (!value) {
    throw new Error(
      'useCanvasPlacementActions must be used within a CanvasActionsProvider.',
    )
  }

  return value
}