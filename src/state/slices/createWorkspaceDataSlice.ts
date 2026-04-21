import type { StateCreator } from 'zustand'

import {
  createDefaultWorkspace,
  replaceAnalytics,
  replaceCards,
  replaceGroups,
  replacePictures,
} from '../../contracts/workspace'
import {
  recordCanvasOpenInAnalytics,
  recordLinkOpenInAnalytics,
} from '../../features/analytics/workspaceAnalytics'
import { getPictureIdsWithinGroupBodies } from '../../features/groups/groupLayout'
import {
  applyGroupCollapseState,
  getGroupSubtreeIds,
  syncCardsForCurrentGroups,
  syncGroupParentsForIds,
  syncSingleCardForCurrentGroups,
  syncWorkspaceGroupMembership,
} from '../../features/groups/groupService'
import {
  commitWorkspaceChange,
  removeGroupSubtreesFromWorkspace,
  removeSelectionFromWorkspace,
  syncWorkspaceGrouping,
} from '../workspaceStoreHelpers'
import type {
  CardUpdateFields,
  GroupUpdateFields,
  WorkspaceDataState,
  WorkspaceState,
} from '../workspaceStoreTypes'

export const createWorkspaceDataSlice: StateCreator<
  WorkspaceState,
  [],
  [],
  WorkspaceDataState
> = (set, get) => ({
  undoStack: [],
  workspace: createDefaultWorkspace(),
  addGroup: (group) =>
    set((state) => {
      const nextWorkspace = syncWorkspaceGrouping(
        replaceGroups(state.workspace, [...state.workspace.groups, group]),
      )

      return {
        ...commitWorkspaceChange(state, nextWorkspace, {
          selectedCardIds: [],
          selectedGroupIds: [group.id],
          selectedPictureIds: [],
        }),
      }
    }),
  addEntityBundle: ({
    cards,
    groups,
    pictures,
    selectedCardIds,
    selectedGroupIds,
    selectedPictureIds,
  }) =>
    set((state) => {
      if (cards.length === 0 && groups.length === 0 && pictures.length === 0) {
        return state
      }

      const nextWorkspace = replacePictures(
        syncWorkspaceGrouping(
          replaceCards(
            replaceGroups(state.workspace, [
              ...state.workspace.groups,
              ...groups,
            ]),
            [...state.workspace.cards, ...cards],
          ),
        ),
        [...state.workspace.pictures, ...pictures],
      )

      return {
        ...commitWorkspaceChange(state, nextWorkspace, {
          selectedCardIds: selectedCardIds ?? state.selectedCardIds,
          selectedGroupIds: selectedGroupIds ?? state.selectedGroupIds,
          selectedPictureIds: selectedPictureIds ?? state.selectedPictureIds,
        }),
      }
    }),
  addGroupsAndCards: ({ cards, groups, selectedCardIds, selectedGroupIds }) =>
    get().addEntityBundle({
      cards,
      groups,
      pictures: [],
      selectedCardIds,
      selectedGroupIds,
      selectedPictureIds: [],
    }),
  updateGroup: (groupId, updates: GroupUpdateFields) =>
    set((state) => {
      const nextGroups = state.workspace.groups.map((group) =>
        group.id === groupId
          ? {
              ...group,
              ...updates,
              updatedAt: new Date().toISOString(),
            }
          : group,
      )
      const updatedGroup = nextGroups.find((group) => group.id === groupId)

      const shouldRecomputeMembership =
        (updates.size !== undefined ||
          updates.positionX !== undefined ||
          updates.positionY !== undefined) &&
        !updatedGroup?.collapsed

      if (!shouldRecomputeMembership) {
        return {
          ...commitWorkspaceChange(
            state,
            replaceGroups(state.workspace, nextGroups),
          ),
        }
      }

      const syncedGroups = syncWorkspaceGrouping(
        replaceGroups(state.workspace, nextGroups),
      )

      return {
        ...commitWorkspaceChange(state, syncedGroups),
      }
    }),
  removeGroup: (groupId) => get().removeGroups([groupId]),
  removeGroups: (groupIds) =>
    set((state) => {
      if (groupIds.length === 0) {
        return state
      }

      const {
        workspace: nextWorkspace,
        removedCardIds,
        removedGroupIds,
      } = removeGroupSubtreesFromWorkspace(state.workspace, groupIds)
      const removedCardIdSet = new Set(removedCardIds)
      const removedGroupIdSet = new Set(removedGroupIds)

      return {
        ...commitWorkspaceChange(state, nextWorkspace, {
          selectedCardIds: state.selectedCardIds.filter(
            (id) => !removedCardIdSet.has(id),
          ),
          selectedGroupIds: state.selectedGroupIds.filter(
            (id) => !removedGroupIdSet.has(id),
          ),
          selectedPictureIds: state.selectedPictureIds,
          autoEditTarget:
            (state.autoEditTarget?.kind === 'card' &&
              removedCardIdSet.has(state.autoEditTarget.id)) ||
            (state.autoEditTarget?.kind === 'group' &&
              removedGroupIdSet.has(state.autoEditTarget.id))
              ? null
              : state.autoEditTarget,
        }),
      }
    }),
  removeSelection: ({ cardIds, groupIds, pictureIds }) =>
    set((state) => {
      if (
        cardIds.length === 0 &&
        groupIds.length === 0 &&
        pictureIds.length === 0
      ) {
        return state
      }

      const {
        workspace: nextWorkspace,
        removedCardIds,
        removedGroupIds,
        removedPictureIds,
      } = removeSelectionFromWorkspace(state.workspace, {
        cardIds,
        groupIds,
        pictureIds,
      })
      const removedCardIdSet = new Set(removedCardIds)
      const removedGroupIdSet = new Set(removedGroupIds)
      const removedPictureIdSet = new Set(removedPictureIds)

      return {
        ...commitWorkspaceChange(state, nextWorkspace, {
          selectedCardIds: state.selectedCardIds.filter(
            (id) => !removedCardIdSet.has(id),
          ),
          selectedGroupIds: state.selectedGroupIds.filter(
            (id) => !removedGroupIdSet.has(id),
          ),
          selectedPictureIds: state.selectedPictureIds.filter(
            (id) => !removedPictureIdSet.has(id),
          ),
          autoEditTarget:
            (state.autoEditTarget?.kind === 'card' &&
              removedCardIdSet.has(state.autoEditTarget.id)) ||
            (state.autoEditTarget?.kind === 'group' &&
              removedGroupIdSet.has(state.autoEditTarget.id))
              ? null
              : state.autoEditTarget,
        }),
      }
    }),
  moveGroup: (groupId, position, pictureIds) =>
    set((state) => {
      const group = state.workspace.groups.find(
        (candidate) => candidate.id === groupId,
      )

      if (!group) {
        return state
      }

      const delta = {
        x: position.x - group.positionX,
        y: position.y - group.positionY,
      }

      if (delta.x === 0 && delta.y === 0) {
        return state
      }

      const affectedGroupIds = new Set(
        getGroupSubtreeIds(state.workspace, groupId),
      )
      const now = new Date().toISOString()

      // Precompute which cards and pictures belong to the moved subtree so we
      // can skip rewriting arrays that have no affected items — key insight
      // from ARCHITECTURE-REVIEW §3.2 (membership check once, rewrite only
      // the actual members).
      const affectedCardIds = new Set<string>()
      for (const card of state.workspace.cards) {
        if (card.groupId && affectedGroupIds.has(card.groupId)) {
          affectedCardIds.add(card.id)
        }
      }

      const affectedPictureIdSet = new Set(
        pictureIds ??
          (state.workspace.pictures.length === 0
            ? []
            : getPictureIdsWithinGroupBodies(
                state.workspace.pictures,
                state.workspace.groups.filter((candidate) =>
                  affectedGroupIds.has(candidate.id),
                ),
                state.workspace.placementGuide.gridSize,
                { useExpandedBody: true },
              )),
      )

      const movedGroups = state.workspace.groups.map((candidate) =>
        affectedGroupIds.has(candidate.id)
          ? {
              ...candidate,
              positionX: candidate.positionX + delta.x,
              positionY: candidate.positionY + delta.y,
              updatedAt: now,
            }
          : candidate,
      )
      const movedCards =
        affectedCardIds.size === 0
          ? state.workspace.cards
          : state.workspace.cards.map((card) =>
              affectedCardIds.has(card.id)
                ? {
                    ...card,
                    positionX: card.positionX + delta.x,
                    positionY: card.positionY + delta.y,
                    updatedAt: now,
                  }
                : card,
            )
      const movedPictures =
        affectedPictureIdSet.size === 0
          ? state.workspace.pictures
          : state.workspace.pictures.map((picture) =>
              affectedPictureIdSet.has(picture.id)
                ? {
                    ...picture,
                    positionX: picture.positionX + delta.x,
                    positionY: picture.positionY + delta.y,
                    updatedAt: now,
                  }
                : picture,
            )
      const syncedGroups = syncGroupParentsForIds(
        state.workspace,
        [groupId],
        movedGroups,
      )

      let nextWorkspace = replaceGroups(state.workspace, syncedGroups)

      if (movedCards !== state.workspace.cards) {
        nextWorkspace = replaceCards(nextWorkspace, movedCards)
      }

      if (movedPictures !== state.workspace.pictures) {
        nextWorkspace = replacePictures(nextWorkspace, movedPictures)
      }

      return {
        ...commitWorkspaceChange(state, nextWorkspace),
      }
    }),
  toggleGroupCollapsed: (groupId) =>
    set((state) => {
      const group = state.workspace.groups.find(
        (candidate) => candidate.id === groupId,
      )

      if (!group) {
        return state
      }

      const nextCollapsed = group.collapsed !== true
      const {
        cards,
        clearedSelectedCardIds,
        hiddenGroupIds,
        groups,
        pictures,
      } = applyGroupCollapseState({
        cards: state.workspace.cards,
        collapsed: nextCollapsed,
        gridSize: state.workspace.placementGuide.gridSize,
        groupId,
        groups: state.workspace.groups,
        pictures: state.workspace.pictures,
      })
      const clearedCardIdSet = new Set(clearedSelectedCardIds)
      const hiddenGroupIdSet = new Set(hiddenGroupIds)

      return {
        ...commitWorkspaceChange(
          state,
          replacePictures(
            replaceCards(replaceGroups(state.workspace, groups), cards),
            pictures,
          ),
          {
            autoEditTarget:
              nextCollapsed &&
              ((state.autoEditTarget?.kind === 'card' &&
                clearedCardIdSet.has(state.autoEditTarget.id)) ||
                (state.autoEditTarget?.kind === 'group' &&
                  hiddenGroupIdSet.has(state.autoEditTarget.id)))
                ? null
                : state.autoEditTarget,
            selectedCardIds: nextCollapsed
              ? state.selectedCardIds.filter(
                  (cardId) => !clearedCardIdSet.has(cardId),
                )
              : state.selectedCardIds,
            selectedGroupIds: nextCollapsed
              ? state.selectedGroupIds.filter(
                  (candidateGroupId) => !hiddenGroupIdSet.has(candidateGroupId),
                )
              : state.selectedGroupIds,
          },
        ),
      }
    }),
  addCard: (card) =>
    set((state) => ({
      ...commitWorkspaceChange(
        state,
        replaceCards(state.workspace, [...state.workspace.cards, card]),
        {
          selectedCardIds: [card.id],
          selectedGroupIds: [],
          selectedPictureIds: [],
        },
      ),
    })),
  addCards: (cards) =>
    set((state) => ({
      ...commitWorkspaceChange(
        state,
        syncWorkspaceGroupMembership(
          replaceCards(state.workspace, [...state.workspace.cards, ...cards]),
        ),
      ),
    })),
  addPicture: (picture) =>
    get().addEntityBundle({
      cards: [],
      groups: [],
      pictures: [picture],
      selectedCardIds: [],
      selectedGroupIds: [],
      selectedPictureIds: [picture.id],
    }),
  updateCard: (cardId, updates: CardUpdateFields) =>
    set((state) => {
      const nextRawCards = state.workspace.cards.map((card) =>
        card.id === cardId
          ? {
              ...card,
              ...updates,
              updatedAt: new Date().toISOString(),
            }
          : card,
      )

      const shouldRecomputeMembership =
        updates.size !== undefined ||
        updates.positionX !== undefined ||
        updates.positionY !== undefined

      const nextCards = shouldRecomputeMembership
        ? syncCardsForCurrentGroups({
            ...state.workspace,
            cards: nextRawCards,
          })
        : nextRawCards

      return {
        ...commitWorkspaceChange(
          state,
          replaceCards(state.workspace, nextCards),
        ),
      }
    }),
  updateCards: (batchUpdates) =>
    set((state) => {
      if (batchUpdates.length === 0) {
        return state
      }

      const updatesById = new Map(
        batchUpdates.map((entry) => [entry.cardId, entry.updates]),
      )

      return {
        ...commitWorkspaceChange(
          state,
          replaceCards(
            state.workspace,
            syncCardsForCurrentGroups({
              ...state.workspace,
              cards: state.workspace.cards.map((card) => {
                const updates = updatesById.get(card.id)

                return updates
                  ? {
                      ...card,
                      ...updates,
                      updatedAt: new Date().toISOString(),
                    }
                  : card
              }),
            }),
          ),
        ),
      }
    }),
  updatePicture: (pictureId, updates) =>
    set((state) => ({
      ...commitWorkspaceChange(
        state,
        replacePictures(
          state.workspace,
          state.workspace.pictures.map((picture) =>
            picture.id === pictureId
              ? {
                  ...picture,
                  ...updates,
                  updatedAt: new Date().toISOString(),
                }
              : picture,
          ),
        ),
      ),
    })),
  updatePictures: (batchUpdates) =>
    set((state) => {
      if (batchUpdates.length === 0) {
        return state
      }

      const updatesById = new Map(
        batchUpdates.map((entry) => [entry.pictureId, entry.updates]),
      )

      return {
        ...commitWorkspaceChange(
          state,
          replacePictures(
            state.workspace,
            state.workspace.pictures.map((picture) => {
              const updates = updatesById.get(picture.id)

              return updates
                ? {
                    ...picture,
                    ...updates,
                    updatedAt: new Date().toISOString(),
                  }
                : picture
            }),
          ),
        ),
      }
    }),
  removeCard: (cardId) =>
    set((state) => ({
      ...commitWorkspaceChange(
        state,
        replaceCards(
          state.workspace,
          state.workspace.cards.filter((card) => card.id !== cardId),
        ),
        {
          selectedCardIds: state.selectedCardIds.filter((id) => id !== cardId),
        },
      ),
    })),
  removeCards: (cardIds) =>
    set((state) => {
      const cardIdSet = new Set(cardIds)

      return {
        ...commitWorkspaceChange(
          state,
          replaceCards(
            state.workspace,
            state.workspace.cards.filter((card) => !cardIdSet.has(card.id)),
          ),
          {
            selectedCardIds: state.selectedCardIds.filter(
              (id) => !cardIdSet.has(id),
            ),
          },
        ),
      }
    }),
  removePicture: (pictureId) =>
    set((state) => ({
      ...commitWorkspaceChange(
        state,
        replacePictures(
          state.workspace,
          state.workspace.pictures.filter(
            (picture) => picture.id !== pictureId,
          ),
        ),
        {
          selectedPictureIds: state.selectedPictureIds.filter(
            (id) => id !== pictureId,
          ),
        },
      ),
    })),
  removePictures: (pictureIds) =>
    set((state) => {
      const pictureIdSet = new Set(pictureIds)

      return {
        ...commitWorkspaceChange(
          state,
          replacePictures(
            state.workspace,
            state.workspace.pictures.filter(
              (picture) => !pictureIdSet.has(picture.id),
            ),
          ),
          {
            selectedPictureIds: state.selectedPictureIds.filter(
              (id) => !pictureIdSet.has(id),
            ),
          },
        ),
      }
    }),
  moveCard: (cardId, position) =>
    set((state) => {
      const nextCards = syncSingleCardForCurrentGroups(
        {
          ...state.workspace,
          cards: state.workspace.cards.map((card) =>
            card.id === cardId
              ? {
                  ...card,
                  positionX: position.x,
                  positionY: position.y,
                  updatedAt: new Date().toISOString(),
                }
              : card,
          ),
        },
        cardId,
      )

      return {
        ...commitWorkspaceChange(
          state,
          replaceCards(state.workspace, nextCards),
        ),
      }
    }),
  movePicture: (pictureId, position) =>
    set((state) => ({
      ...commitWorkspaceChange(
        state,
        replacePictures(
          state.workspace,
          state.workspace.pictures.map((picture) =>
            picture.id === pictureId
              ? {
                  ...picture,
                  positionX: position.x,
                  positionY: position.y,
                  updatedAt: new Date().toISOString(),
                }
              : picture,
          ),
        ),
      ),
    })),
  recordCanvasOpen: (source) =>
    set((state) => {
      void source

      return {
        ...commitWorkspaceChange(
          state,
          replaceAnalytics(
            state.workspace,
            recordCanvasOpenInAnalytics(state.workspace.analytics),
          ),
        ),
      }
    }),
  recordLinkOpen: (cardId) =>
    set((state) => ({
      ...commitWorkspaceChange(
        state,
        replaceAnalytics(
          state.workspace,
          recordLinkOpenInAnalytics(state.workspace.analytics, cardId),
        ),
      ),
    })),
})
