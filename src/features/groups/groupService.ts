import {
  replaceCards,
  replaceGroups,
  replacePictures,
  type Workspace,
} from '../../contracts/workspace'
import {
  applyGroupCollapseLayout,
  getGroupSubtreeCardIds,
  getGroupSubtreeGroupIds,
} from './groupLayout'
import {
  syncCardGroupMembership,
  syncGroupParentMembership,
  syncGroupParentMembershipForIds,
  syncSingleCardGroupMembership,
} from './groupMembership'

type SelectionRemovalInput = {
  cardIds: string[]
  groupIds: string[]
  pictureIds: string[]
}

export function syncWorkspaceGroupMembership(workspace: Workspace) {
  const groups = syncGroupParentMembership(
    workspace.groups,
    workspace.placementGuide.gridSize,
  )
  const cards = syncCardGroupMembership(
    workspace.cards,
    groups,
    workspace.placementGuide.gridSize,
  )

  return replaceCards(replaceGroups(workspace, groups), cards)
}

export function syncCardsForCurrentGroups(workspace: Workspace) {
  return syncCardGroupMembership(
    workspace.cards,
    workspace.groups,
    workspace.placementGuide.gridSize,
  )
}

export function syncSingleCardForCurrentGroups(
  workspace: Workspace,
  cardId: string,
) {
  return syncSingleCardGroupMembership(
    workspace.cards,
    workspace.groups,
    workspace.placementGuide.gridSize,
    cardId,
  )
}

export function syncGroupParentsForIds(
  workspace: Workspace,
  groupIds: string[],
  groups: typeof workspace.groups,
) {
  return syncGroupParentMembershipForIds(
    groups,
    workspace.placementGuide.gridSize,
    groupIds,
  )
}

export function getGroupSubtreeIds(workspace: Workspace, groupId: string) {
  return getGroupSubtreeGroupIds(workspace.groups, groupId)
}

export function removeGroupSubtrees(workspace: Workspace, groupIds: string[]) {
  const removedGroupIdSet = new Set(
    groupIds.flatMap((groupId) => getGroupSubtreeIds(workspace, groupId)),
  )
  const removedCardIdSet = new Set(
    groupIds.flatMap((groupId) =>
      getGroupSubtreeCardIds(workspace.cards, workspace.groups, groupId),
    ),
  )

  return {
    removedCardIds: [...removedCardIdSet],
    removedGroupIds: [...removedGroupIdSet],
    workspace: syncWorkspaceGroupMembership(
      replaceCards(
        replaceGroups(
          workspace,
          workspace.groups.filter((group) => !removedGroupIdSet.has(group.id)),
        ),
        workspace.cards.filter((card) => !removedCardIdSet.has(card.id)),
      ),
    ),
  }
}

export function removeSelectionWithGroups(
  workspace: Workspace,
  input: SelectionRemovalInput,
) {
  const subtree = removeGroupSubtrees(workspace, input.groupIds)
  const removedGroupIdSet = new Set(subtree.removedGroupIds)
  const removedCardIdSet = new Set([
    ...subtree.removedCardIds,
    ...input.cardIds.filter(
      (cardId) => !subtree.removedCardIds.includes(cardId),
    ),
  ])
  const removedPictureIdSet = new Set(input.pictureIds)

  return {
    removedCardIds: [...removedCardIdSet],
    removedGroupIds: [...removedGroupIdSet],
    removedPictureIds: [...removedPictureIdSet],
    workspace: replacePictures(
      syncWorkspaceGroupMembership(
        replaceCards(
          subtree.workspace,
          subtree.workspace.cards.filter(
            (card) => !removedCardIdSet.has(card.id),
          ),
        ),
      ),
      subtree.workspace.pictures.filter(
        (picture) => !removedPictureIdSet.has(picture.id),
      ),
    ),
  }
}

export function applyGroupCollapseState(input: {
  cards: Workspace['cards']
  collapsed: boolean
  gridSize: number
  groupId: string
  groups: Workspace['groups']
  pictures: Workspace['pictures']
}) {
  return applyGroupCollapseLayout(input)
}
