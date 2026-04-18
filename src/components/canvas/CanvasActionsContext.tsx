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

export type CanvasActionsContextValue = {
  autoEditTarget: AutoEditTarget
  onClearAutoEditTarget: () => void
  onRecordLinkOpen: (cardId: string) => void
  onMoveCard: (cardId: string, position: { x: number; y: number }) => void
  onMoveGroup: (
    groupId: string,
    position: { x: number; y: number },
    pictureIds?: string[],
  ) => void
  onMovePicture: (pictureId: string, position: { x: number; y: number }) => void
  onPreviewChange: (preview: CanvasDragPreview | null) => void
  onRemoveCard: (cardId: string) => void
  onRemoveGroup: (groupId: string) => void
  onRemovePicture: (pictureId: string) => void
  onRequestCardImageOverridePicker: (cardId: string) => void
  onRequestPictureImagePicker: (pictureId: string) => void
  onSelectCard: (cardId: string, additive: boolean) => void
  onSelectGroup: (groupId: string, additive: boolean) => void
  onSelectPicture: (pictureId: string, additive: boolean) => void
  onUpdateCard: (cardId: string, updates: CardUpdateFields) => void
  onUpdateGroup: (groupId: string, updates: GroupUpdateFields) => void
  onUpdatePicture: (pictureId: string, updates: PictureUpdateFields) => void
}

const CanvasActionsContext = createContext<CanvasActionsContextValue | null>(
  null,
)

type CanvasActionsProviderProps = {
  children: ReactNode
  value: CanvasActionsContextValue
}

export function CanvasActionsProvider({
  children,
  value,
}: CanvasActionsProviderProps) {
  return (
    <CanvasActionsContext.Provider value={value}>
      {children}
    </CanvasActionsContext.Provider>
  )
}

export function useCanvasActionsContext() {
  const value = useContext(CanvasActionsContext)

  if (!value) {
    throw new Error(
      'useCanvasActionsContext must be used within a CanvasActionsProvider.',
    )
  }

  return value
}
