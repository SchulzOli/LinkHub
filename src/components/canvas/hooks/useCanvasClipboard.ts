import { useCallback, useEffect, useMemo, useRef } from 'react'

import type { CardGroup } from '../../../contracts/cardGroup'
import type { CardSize, LinkCard } from '../../../contracts/linkCard'
import type { Workspace } from '../../../contracts/workspace'
import {
  createFormatPainterFromCard,
  createFormatPainterFromGroup,
} from '../../../features/appearance/formatPainter'
import { getSelectedCanvasEntityBundle } from '../../../features/canvas/entityBundle'
import {
  getGroupPlacementFrames,
  getVisibleCards,
} from '../../../features/groups/groupLayout'
import {
  parseSelectionClipboard,
  serializeSelectionClipboard,
  type SelectionClipboardPayload,
} from '../../../features/links/cardClipboard'
import { useWorkspaceStore } from '../../../state/useWorkspaceStore'
import type {
  CardBatchUpdate,
  PictureBatchUpdate,
} from '../../../state/workspaceStoreTypes'
import { createId } from '../../../utils/id'

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

type UseCanvasClipboardArgs = {
  addGroupsAndCards: (input: {
    cards: LinkCard[]
    groups: CardGroup[]
    selectedCardIds?: string[]
    selectedGroupIds?: string[]
  }) => void
  canPlaceCardFrames: (frames: CardFrame[]) => boolean
  canPlaceGroupFrames: (frames: GroupFrame[]) => boolean
  createAtViewportCenter: (url: string, title?: string) => void
  interactionMode: 'edit' | 'view'
  moveGroup: (groupId: string, position: { x: number; y: number }) => void
  removeSelection: (input: {
    cardIds: string[]
    groupIds: string[]
    pictureIds: string[]
  }) => void
  selectedCardIds: string[]
  selectedGroupIds: string[]
  selectedPictureIds: string[]
  undoWorkspace: () => void
  updateCards: (updates: CardBatchUpdate[]) => void
  updatePictures: (updates: PictureBatchUpdate[]) => void
  workspace: Workspace
}

export function useCanvasClipboard({
  addGroupsAndCards,
  canPlaceCardFrames,
  canPlaceGroupFrames,
  createAtViewportCenter,
  interactionMode,
  moveGroup,
  removeSelection,
  selectedCardIds,
  selectedGroupIds,
  selectedPictureIds,
  undoWorkspace,
  updateCards,
  updatePictures,
  workspace,
}: UseCanvasClipboardArgs) {
  const clipboardTextRef = useRef<string | null>(null)
  const formatPainter = useWorkspaceStore((state) => state.formatPainter)
  const startFormatPainter = useWorkspaceStore(
    (state) => state.startFormatPainter,
  )
  const clearFormatPainter = useWorkspaceStore(
    (state) => state.clearFormatPainter,
  )

  const selectedCards = useMemo(
    () => workspace.cards.filter((card) => selectedCardIds.includes(card.id)),
    [selectedCardIds, workspace.cards],
  )
  const selectedGroups = useMemo(
    () =>
      workspace.groups.filter((group) => selectedGroupIds.includes(group.id)),
    [selectedGroupIds, workspace.groups],
  )
  const selectedPictures = useMemo(
    () =>
      workspace.pictures.filter((picture) =>
        selectedPictureIds.includes(picture.id),
      ),
    [selectedPictureIds, workspace.pictures],
  )

  const getSelectedEntitySelection = useCallback(() => {
    return getSelectedCanvasEntityBundle({
      workspace,
      selectedCardIds,
      selectedGroupIds,
      selectedPictureIds,
    })
  }, [selectedCardIds, selectedGroupIds, selectedPictureIds, workspace])

  const pasteClipboardSelection = useCallback(
    (payload: SelectionClipboardPayload) => {
      if (payload.cards.length === 0 && payload.groups.length === 0) {
        return false
      }

      const now = new Date().toISOString()
      let nextOffset = 1
      let nextSelection: {
        cards: LinkCard[]
        groups: CardGroup[]
      } | null = null

      while (nextOffset <= 24 && !nextSelection) {
        const offset = workspace.placementGuide.gridSize * nextOffset
        const groupIdMap = new Map(
          payload.groups.map((group) => [group.id, createId()]),
        )
        const candidateGroups = payload.groups.map((group) => ({
          ...group,
          id: groupIdMap.get(group.id) ?? createId(),
          parentGroupId: group.parentGroupId
            ? (groupIdMap.get(group.parentGroupId) ?? group.parentGroupId)
            : undefined,
          positionX: group.positionX + offset,
          positionY: group.positionY + offset,
          createdAt: now,
          updatedAt: now,
        }))
        const candidateCards = payload.cards.map((card) => ({
          ...card,
          id: createId(),
          groupId: card.groupId
            ? (groupIdMap.get(card.groupId) ?? card.groupId)
            : undefined,
          positionX: card.positionX + offset,
          positionY: card.positionY + offset,
          createdAt: now,
          updatedAt: now,
        }))
        const visibleCandidateCards = getVisibleCards(
          candidateCards,
          candidateGroups,
        )
        const visibleCandidateGroups = getGroupPlacementFrames(candidateGroups)

        if (
          canPlaceCardFrames(
            visibleCandidateCards.map((card) => ({
              cardId: card.id,
              position: { x: card.positionX, y: card.positionY },
              size: card.size,
            })),
          ) &&
          canPlaceGroupFrames(
            visibleCandidateGroups.map((group) => ({
              collapsed: group.collapsed,
              groupId: group.id,
              parentGroupId: group.parentGroupId,
              position: { x: group.positionX, y: group.positionY },
              size: group.size,
            })),
          )
        ) {
          nextSelection = {
            cards: candidateCards,
            groups: candidateGroups,
          }
        }

        nextOffset += 1
      }

      if (!nextSelection) {
        return false
      }

      addGroupsAndCards({
        cards: nextSelection.cards,
        groups: nextSelection.groups,
        selectedCardIds: nextSelection.cards.map((card) => card.id),
        selectedGroupIds: nextSelection.groups.map((group) => group.id),
      })
      return true
    },
    [
      addGroupsAndCards,
      canPlaceCardFrames,
      canPlaceGroupFrames,
      workspace.placementGuide.gridSize,
    ],
  )

  const copySelectedSelectionToClipboard = useCallback(
    async (mode: 'copy' | 'cut') => {
      const selection = getSelectedEntitySelection()

      if (
        selection.bundle.cards.length === 0 &&
        selection.bundle.groups.length === 0
      ) {
        return
      }

      const clipboardText = serializeSelectionClipboard({
        cards: selection.bundle.cards,
        groups: selection.bundle.groups,
      })
      clipboardTextRef.current = clipboardText

      try {
        await navigator.clipboard?.writeText(clipboardText)
      } catch {
        // Keep the in-memory clipboard as a fallback for environments that block writes.
      }

      if (mode === 'cut') {
        removeSelection({
          cardIds: selection.cardIds,
          groupIds: selection.rootGroupIds,
          pictureIds: selection.pictureIds,
        })
      }
    },
    [getSelectedEntitySelection, removeSelection],
  )

  const handlePastedText = useCallback(
    (text: string) => {
      const payload = parseSelectionClipboard(text)

      if (payload) {
        pasteClipboardSelection(payload)
        return
      }

      createAtViewportCenter(text)
    },
    [createAtViewportCenter, pasteClipboardSelection],
  )

  const deleteSelectedSelection = useCallback(() => {
    const selection = getSelectedEntitySelection()

    if (
      selection.cardIds.length === 0 &&
      selection.rootGroupIds.length === 0 &&
      selection.pictureIds.length === 0
    ) {
      return
    }

    removeSelection({
      cardIds: selection.cardIds,
      groupIds: selection.rootGroupIds,
      pictureIds: selection.pictureIds,
    })
  }, [getSelectedEntitySelection, removeSelection])

  useEffect(() => {
    if (interactionMode !== 'edit') {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (formatPainter && event.key === 'Escape') {
        event.preventDefault()
        clearFormatPainter()
        return
      }

      const target = event.target as HTMLElement | null
      const isTypingTarget =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.tagName === 'SELECT' ||
        target?.isContentEditable

      if (isTypingTarget) {
        return
      }

      if (
        event.key === 'Delete' &&
        (selectedCardIds.length > 0 ||
          selectedGroupIds.length > 0 ||
          selectedPictureIds.length > 0)
      ) {
        event.preventDefault()
        deleteSelectedSelection()
        return
      }

      const modifierPressed = event.ctrlKey || event.metaKey

      if (
        modifierPressed &&
        event.shiftKey &&
        event.key.toLowerCase() === 'c'
      ) {
        event.preventDefault()

        if (
          selectedPictures.length > 0 ||
          selectedCards.length + selectedGroups.length !== 1
        ) {
          return
        }

        if (selectedCards.length === 1 && selectedGroups.length === 0) {
          startFormatPainter(createFormatPainterFromCard(selectedCards[0]))
          return
        }

        if (selectedGroups.length === 1 && selectedCards.length === 0) {
          startFormatPainter(createFormatPainterFromGroup(selectedGroups[0]))
        }

        return
      }

      if (
        modifierPressed &&
        event.key.toLowerCase() === 'z' &&
        !event.shiftKey
      ) {
        event.preventDefault()
        undoWorkspace()
        return
      }

      if (modifierPressed && event.key.toLowerCase() === 'c') {
        event.preventDefault()
        void copySelectedSelectionToClipboard('copy')
        return
      }

      if (modifierPressed && event.key.toLowerCase() === 'x') {
        event.preventDefault()
        void copySelectedSelectionToClipboard('cut')
        return
      }

      const deltaByKey: Record<string, { x: number; y: number }> = {
        ArrowDown: { x: 0, y: workspace.placementGuide.gridSize },
        ArrowLeft: { x: -workspace.placementGuide.gridSize, y: 0 },
        ArrowRight: { x: workspace.placementGuide.gridSize, y: 0 },
        ArrowUp: { x: 0, y: -workspace.placementGuide.gridSize },
      }
      const delta = deltaByKey[event.key]

      if (!delta) {
        return
      }

      if (selectedGroups.length > 0 && selectedCards.length === 0) {
        event.preventDefault()
        selectedGroups.forEach((group) =>
          moveGroup(group.id, {
            x: group.positionX + delta.x,
            y: group.positionY + delta.y,
          }),
        )
        return
      }

      if (selectedPictures.length > 0 && selectedCards.length === 0) {
        const frames = selectedPictures.map((picture) => ({
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

        event.preventDefault()
        updatePictures(
          frames.map((frame) => ({
            pictureId: frame.cardId,
            updates: {
              positionX: frame.position.x,
              positionY: frame.position.y,
            },
          })),
        )
        return
      }

      if (selectedCards.length === 0) {
        return
      }

      const frames = selectedCards.map((card) => ({
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

      event.preventDefault()
      updateCards(
        frames.map((frame) => ({
          cardId: frame.cardId,
          updates: {
            positionX: frame.position.x,
            positionY: frame.position.y,
          },
        })),
      )
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [
    canPlaceCardFrames,
    clearFormatPainter,
    copySelectedSelectionToClipboard,
    deleteSelectedSelection,
    formatPainter,
    interactionMode,
    moveGroup,
    selectedCardIds.length,
    selectedCards,
    selectedGroupIds.length,
    selectedGroups,
    selectedPictureIds.length,
    selectedPictures,
    startFormatPainter,
    undoWorkspace,
    updateCards,
    updatePictures,
    workspace.placementGuide.gridSize,
  ])

  const getFallbackText = useCallback(() => clipboardTextRef.current, [])

  return {
    getFallbackText,
    handlePastedText,
  }
}
