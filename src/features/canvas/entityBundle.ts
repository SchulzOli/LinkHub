import type { CardGroup } from '../../contracts/cardGroup'
import type { LinkCard } from '../../contracts/linkCard'
import type { PictureNode } from '../../contracts/pictureNode'
import type { Workspace } from '../../contracts/workspace'
import { createId } from '../../utils/id'
import { getGroupPlacementFrames, getVisibleCards } from '../groups/groupLayout'

export type CanvasEntityBundle = {
  cards: LinkCard[]
  groups: CardGroup[]
  pictures: PictureNode[]
}

type PlaceableNode = Pick<
  LinkCard | PictureNode,
  'positionX' | 'positionY' | 'size'
>

export function createEmptyCanvasEntityBundle(): CanvasEntityBundle {
  return {
    cards: [],
    groups: [],
    pictures: [],
  }
}

export function isCanvasEntityBundleEmpty(bundle: CanvasEntityBundle) {
  return (
    bundle.cards.length === 0 &&
    bundle.groups.length === 0 &&
    bundle.pictures.length === 0
  )
}

export function getSelectedCanvasEntityBundle(input: {
  workspace: Workspace
  selectedCardIds: string[]
  selectedGroupIds: string[]
  selectedPictureIds: string[]
}) {
  const selectedGroupIdSet = new Set(input.selectedGroupIds)
  const groupsByParentId = new Map<string | undefined, CardGroup[]>()

  input.workspace.groups.forEach((group) => {
    const siblings = groupsByParentId.get(group.parentGroupId) ?? []
    siblings.push(group)
    groupsByParentId.set(group.parentGroupId, siblings)
  })

  const selectedGroupTreeIds = new Set<string>()
  const rootGroupIds: string[] = []

  const visitGroupTree = (groupId: string) => {
    if (selectedGroupTreeIds.has(groupId)) {
      return
    }

    selectedGroupTreeIds.add(groupId)

    const children = groupsByParentId.get(groupId) ?? []

    children.forEach((child) => visitGroupTree(child.id))
  }

  input.selectedGroupIds.forEach((groupId) => {
    const group = input.workspace.groups.find(
      (candidate) => candidate.id === groupId,
    )

    if (!group) {
      return
    }

    if (!group.parentGroupId || !selectedGroupIdSet.has(group.parentGroupId)) {
      rootGroupIds.push(group.id)
    }

    visitGroupTree(group.id)
  })

  const selectedCardIdSet = new Set([
    ...input.selectedCardIds,
    ...input.workspace.cards
      .filter((card) => card.groupId && selectedGroupTreeIds.has(card.groupId))
      .map((card) => card.id),
  ])
  const selectedPictureIdSet = new Set(input.selectedPictureIds)

  return {
    bundle: {
      cards: input.workspace.cards.filter((card) =>
        selectedCardIdSet.has(card.id),
      ),
      groups: input.workspace.groups.filter((group) =>
        selectedGroupTreeIds.has(group.id),
      ),
      pictures: input.workspace.pictures.filter((picture) =>
        selectedPictureIdSet.has(picture.id),
      ),
    } satisfies CanvasEntityBundle,
    cardIds: [...selectedCardIdSet],
    groupIds: [...selectedGroupTreeIds],
    pictureIds: [...selectedPictureIdSet],
    rootGroupIds,
  }
}

export function getCanvasEntityBundleBounds(bundle: CanvasEntityBundle) {
  const nodes: PlaceableNode[] = [
    ...bundle.cards,
    ...bundle.groups,
    ...bundle.pictures,
  ]

  if (nodes.length === 0) {
    return null
  }

  const left = Math.min(...nodes.map((node) => node.positionX))
  const top = Math.min(...nodes.map((node) => node.positionY))

  return {
    left,
    top,
  }
}

export function getCanvasEntityBundlePixelBounds(
  bundle: CanvasEntityBundle,
  gridSize: number,
) {
  const bounds = getCanvasEntityBundleBounds(bundle)

  if (!bounds) {
    return null
  }

  const nodes: PlaceableNode[] = [
    ...bundle.cards,
    ...bundle.groups,
    ...bundle.pictures,
  ]
  const right = Math.max(
    ...nodes.map((node) => node.positionX + node.size.columns * gridSize),
  )
  const bottom = Math.max(
    ...nodes.map((node) => node.positionY + node.size.rows * gridSize),
  )

  return {
    ...bounds,
    right,
    bottom,
    width: right - bounds.left,
    height: bottom - bounds.top,
  }
}

export function normalizeCanvasEntityBundle(bundle: CanvasEntityBundle) {
  const bounds = getCanvasEntityBundleBounds(bundle)

  if (!bounds) {
    return {
      bounds: null,
      bundle,
    }
  }

  return {
    bounds,
    bundle: offsetCanvasEntityBundle(bundle, {
      x: -bounds.left,
      y: -bounds.top,
    }),
  }
}

export function offsetCanvasEntityBundle(
  bundle: CanvasEntityBundle,
  offset: { x: number; y: number },
): CanvasEntityBundle {
  return {
    cards: bundle.cards.map((card) => ({
      ...card,
      positionX: card.positionX + offset.x,
      positionY: card.positionY + offset.y,
    })),
    groups: bundle.groups.map((group) => ({
      ...group,
      positionX: group.positionX + offset.x,
      positionY: group.positionY + offset.y,
    })),
    pictures: bundle.pictures.map((picture) => ({
      ...picture,
      positionX: picture.positionX + offset.x,
      positionY: picture.positionY + offset.y,
    })),
  }
}

export function duplicateCanvasEntityBundle(input: {
  bundle: CanvasEntityBundle
  imageIdMap?: Map<string, string>
  now?: string
  offset?: { x: number; y: number }
}) {
  const now = input.now ?? new Date().toISOString()
  const groupIdMap = new Map(
    input.bundle.groups.map((group) => [group.id, createId()]),
  )
  const offset = input.offset ?? { x: 0, y: 0 }

  return {
    cards: input.bundle.cards.map((card) => ({
      ...card,
      id: createId(),
      groupId: card.groupId
        ? (groupIdMap.get(card.groupId) ?? card.groupId)
        : undefined,
      faviconOverrideImageId: card.faviconOverrideImageId
        ? (input.imageIdMap?.get(card.faviconOverrideImageId) ??
          card.faviconOverrideImageId)
        : undefined,
      positionX: card.positionX + offset.x,
      positionY: card.positionY + offset.y,
      createdAt: now,
      updatedAt: now,
    })),
    groups: input.bundle.groups.map((group) => ({
      ...group,
      id: groupIdMap.get(group.id) ?? createId(),
      parentGroupId: group.parentGroupId
        ? (groupIdMap.get(group.parentGroupId) ?? group.parentGroupId)
        : undefined,
      positionX: group.positionX + offset.x,
      positionY: group.positionY + offset.y,
      createdAt: now,
      updatedAt: now,
    })),
    pictures: input.bundle.pictures.map((picture) => ({
      ...picture,
      id: createId(),
      imageId: input.imageIdMap?.get(picture.imageId) ?? picture.imageId,
      positionX: picture.positionX + offset.x,
      positionY: picture.positionY + offset.y,
      createdAt: now,
      updatedAt: now,
    })),
  } satisfies CanvasEntityBundle
}

export function getVisibleCanvasEntityBundleNodes(bundle: CanvasEntityBundle) {
  return {
    visibleCards: getVisibleCards(bundle.cards, bundle.groups),
    visibleGroups: getGroupPlacementFrames(bundle.groups),
  }
}
