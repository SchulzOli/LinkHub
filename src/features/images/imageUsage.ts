import type { LinkCard } from '../../contracts/linkCard'
import type { PictureNode } from '../../contracts/pictureNode'
import type { Workspace } from '../../contracts/workspace'

export type ImageUsageSummary = {
  cardOverrideCount: number
  cardOverrideIds: string[]
  imageId: string
  pictureCount: number
  pictureIds: string[]
  totalCount: number
}

function createEmptyImageUsageSummary(imageId: string): ImageUsageSummary {
  return {
    imageId,
    pictureIds: [],
    pictureCount: 0,
    cardOverrideIds: [],
    cardOverrideCount: 0,
    totalCount: 0,
  }
}

function getOrCreateImageUsageSummary(
  usageById: Record<string, ImageUsageSummary>,
  imageId: string,
) {
  return (usageById[imageId] ??= createEmptyImageUsageSummary(imageId))
}

export function getImageUsageSummaryMapForEntities(
  cards: LinkCard[],
  pictures: PictureNode[],
  imageIds: string[] = [],
): Record<string, ImageUsageSummary> {
  const usageById = Object.fromEntries(
    imageIds.map((imageId) => [imageId, createEmptyImageUsageSummary(imageId)]),
  ) as Record<string, ImageUsageSummary>

  for (const card of cards) {
    if (!card.faviconOverrideImageId) {
      continue
    }

    const summary = getOrCreateImageUsageSummary(
      usageById,
      card.faviconOverrideImageId,
    )

    summary.cardOverrideIds.push(card.id)
    summary.cardOverrideCount += 1
    summary.totalCount += 1
  }

  for (const picture of pictures) {
    const summary = getOrCreateImageUsageSummary(usageById, picture.imageId)

    summary.pictureIds.push(picture.id)
    summary.pictureCount += 1
    summary.totalCount += 1
  }

  return usageById
}

export function getImageUsageSummaryForEntities(
  cards: LinkCard[],
  pictures: PictureNode[],
  imageId: string,
): ImageUsageSummary {
  return (
    getImageUsageSummaryMapForEntities(cards, pictures, [imageId])[imageId] ??
    createEmptyImageUsageSummary(imageId)
  )
}

export function getImageUsageSummary(
  workspace: Workspace,
  imageId: string,
): ImageUsageSummary {
  return getImageUsageSummaryForEntities(
    workspace.cards,
    workspace.pictures,
    imageId,
  )
}

export function formatImageDeleteConfirmation(summary: ImageUsageSummary) {
  if (summary.totalCount === 0) {
    return 'Delete this image from the gallery?'
  }

  const sources: string[] = []
  const effects: string[] = []

  if (summary.pictureCount > 0) {
    sources.push(
      `${summary.pictureCount} picture node${summary.pictureCount === 1 ? '' : 's'}`,
    )
    effects.push(
      `remove ${summary.pictureCount} picture node${summary.pictureCount === 1 ? '' : 's'}`,
    )
  }

  if (summary.cardOverrideCount > 0) {
    sources.push(
      `${summary.cardOverrideCount} link card override${summary.cardOverrideCount === 1 ? '' : 's'}`,
    )
    effects.push(
      `clear ${summary.cardOverrideCount} link card override${summary.cardOverrideCount === 1 ? '' : 's'}`,
    )
  }

  return `This image is currently used by ${sources.join(' and ')}. Deleting it will ${effects.join(' and ')}. Continue?`
}
