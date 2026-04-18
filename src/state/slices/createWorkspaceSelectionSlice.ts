import type { StateCreator } from 'zustand'

import type {
  WorkspaceSelectionState,
  WorkspaceState,
} from '../workspaceStoreTypes'

export const createWorkspaceSelectionSlice: StateCreator<
  WorkspaceState,
  [],
  [],
  WorkspaceSelectionState
> = (set) => ({
  selectedCardIds: [],
  selectedGroupIds: [],
  selectedPictureIds: [],
  setSelectedCardIds: (selectedCardIds) =>
    set({ selectedCardIds, selectedGroupIds: [], selectedPictureIds: [] }),
  setSelectedGroupIds: (selectedGroupIds) =>
    set({ selectedGroupIds, selectedCardIds: [], selectedPictureIds: [] }),
  setSelectedPictureIds: (selectedPictureIds) =>
    set({ selectedPictureIds, selectedCardIds: [], selectedGroupIds: [] }),
  setSelection: ({ cardIds, groupIds, pictureIds }) =>
    set({
      selectedCardIds: cardIds,
      selectedGroupIds: groupIds,
      selectedPictureIds: pictureIds,
    }),
  selectCardExclusive: (cardId) =>
    set({
      selectedCardIds: [cardId],
      selectedGroupIds: [],
      selectedPictureIds: [],
    }),
  selectGroupExclusive: (groupId) =>
    set({
      selectedCardIds: [],
      selectedGroupIds: [groupId],
      selectedPictureIds: [],
    }),
  selectPictureExclusive: (pictureId) =>
    set({
      selectedCardIds: [],
      selectedGroupIds: [],
      selectedPictureIds: [pictureId],
    }),
  toggleCardSelection: (cardId) =>
    set((state) => ({
      selectedGroupIds: [],
      selectedPictureIds: [],
      selectedCardIds: state.selectedCardIds.includes(cardId)
        ? state.selectedCardIds.filter((id) => id !== cardId)
        : [...state.selectedCardIds, cardId],
    })),
  toggleGroupSelection: (groupId) =>
    set((state) => ({
      selectedCardIds: [],
      selectedPictureIds: [],
      selectedGroupIds: state.selectedGroupIds.includes(groupId)
        ? state.selectedGroupIds.filter((id) => id !== groupId)
        : [...state.selectedGroupIds, groupId],
    })),
  togglePictureSelection: (pictureId) =>
    set((state) => ({
      selectedCardIds: [],
      selectedGroupIds: [],
      selectedPictureIds: state.selectedPictureIds.includes(pictureId)
        ? state.selectedPictureIds.filter((id) => id !== pictureId)
        : [...state.selectedPictureIds, pictureId],
    })),
  clearSelectedCards: () => set({ selectedCardIds: [] }),
  clearSelectedGroups: () => set({ selectedGroupIds: [] }),
  clearSelectedPictures: () => set({ selectedPictureIds: [] }),
  clearSelection: () =>
    set({ selectedCardIds: [], selectedGroupIds: [], selectedPictureIds: [] }),
})
