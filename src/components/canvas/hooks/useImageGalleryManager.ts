import { useCallback, useEffect, useMemo, useState } from 'react'

import type { ImageAsset } from '../../../contracts/imageAsset'
import type { LinkCard } from '../../../contracts/linkCard'
import type { PictureNode } from '../../../contracts/pictureNode'
import { invalidateImageObjectUrl } from '../../../features/images/imageObjectUrlCache'
import {
  formatImageDeleteConfirmation,
  getImageUsageSummaryMapForEntities,
  type ImageUsageSummary,
} from '../../../features/images/imageUsage'
import {
  deleteImageAsset,
  listImageAssets,
  saveImageAsset,
  updateImageAsset,
} from '../../../storage/imageRepository'
import type { PromptDialogOptions } from './usePromptDialogManager'

type ImageGalleryState =
  | {
      mode: 'browse'
    }
  | {
      cardId: string
      mode: 'pick-card-image'
    }
  | {
      mode: 'pick-picture-image'
      pictureId: string
    }
  | null

type UseImageGalleryManagerArgs = {
  cards: LinkCard[]
  getLatestUsageSummary: (imageId: string) => ImageUsageSummary
  onClearCardImageOverrides: (cardIds: string[]) => void
  onPlaceAssetAtViewportCenter: (
    asset: Pick<ImageAsset, 'height' | 'id' | 'width'>,
  ) => void
  onRemovePictures: (pictureIds: string[]) => void
  onSetCardImageOverride: (cardId: string, imageId: string) => void
  onSetPictureImage: (pictureId: string, imageId: string) => void
  openPromptDialog: (dialog: PromptDialogOptions) => void
  pictures: PictureNode[]
  showNotice: (title: string, description: string) => void
  status: 'error' | 'loading' | 'ready'
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

export function useImageGalleryManager({
  cards,
  getLatestUsageSummary,
  onClearCardImageOverrides,
  onPlaceAssetAtViewportCenter,
  onRemovePictures,
  onSetCardImageOverride,
  onSetPictureImage,
  openPromptDialog,
  pictures,
  showNotice,
  status,
}: UseImageGalleryManagerArgs) {
  const [imageAssets, setImageAssets] = useState<ImageAsset[]>([])
  const [imageGalleryState, setImageGalleryState] =
    useState<ImageGalleryState>(null)

  const refreshImageAssets = useCallback(async () => {
    setImageAssets(await listImageAssets())
  }, [])

  useEffect(() => {
    if (status !== 'ready') {
      return
    }

    let cancelled = false

    void listImageAssets()
      .then((assets) => {
        if (cancelled) {
          return
        }

        setImageAssets(assets)
      })
      .catch((error) => {
        showNotice(
          'Image library refresh failed',
          getErrorMessage(error, 'Image library refresh failed.'),
        )
      })

    return () => {
      cancelled = true
    }
  }, [showNotice, status])

  const closeImageGallery = useCallback(() => {
    setImageGalleryState(null)
  }, [])

  const openImageGallery = useCallback(() => {
    void refreshImageAssets()
    setImageGalleryState({ mode: 'browse' })
  }, [refreshImageAssets])

  const openCardImageOverridePicker = useCallback(
    (cardId: string) => {
      void refreshImageAssets()
      setImageGalleryState({ mode: 'pick-card-image', cardId })
    },
    [refreshImageAssets],
  )

  const openPictureImagePicker = useCallback(
    (pictureId: string) => {
      void refreshImageAssets()
      setImageGalleryState({ mode: 'pick-picture-image', pictureId })
    },
    [refreshImageAssets],
  )

  const activeCardOverrideImageId = useMemo(() => {
    if (imageGalleryState?.mode === 'pick-card-image') {
      return cards.find((card) => card.id === imageGalleryState.cardId)
        ?.faviconOverrideImageId
    }

    if (imageGalleryState?.mode === 'pick-picture-image') {
      return pictures.find(
        (picture) => picture.id === imageGalleryState.pictureId,
      )?.imageId
    }

    return undefined
  }, [cards, imageGalleryState, pictures])

  const imageUsageById = useMemo<Record<string, ImageUsageSummary>>(() => {
    if (imageGalleryState === null || imageAssets.length === 0) {
      return {}
    }

    return getImageUsageSummaryMapForEntities(
      cards,
      pictures,
      imageAssets.map((asset) => asset.id),
    )
  }, [cards, imageAssets, imageGalleryState, pictures])

  const handleDeleteImageAsset = useCallback(
    (asset: ImageAsset) => {
      const usage = imageUsageById[asset.id] ?? getLatestUsageSummary(asset.id)

      openPromptDialog({
        description: formatImageDeleteConfirmation(usage),
        eyebrow: 'Image Library',
        onPrimaryAction: () => {
          void (async () => {
            const latestUsage = getLatestUsageSummary(asset.id)

            if (latestUsage.cardOverrideIds.length > 0) {
              onClearCardImageOverrides(latestUsage.cardOverrideIds)
            }

            if (latestUsage.pictureIds.length > 0) {
              onRemovePictures(latestUsage.pictureIds)
            }

            await deleteImageAsset(asset.id)
            invalidateImageObjectUrl(asset.id)
            await refreshImageAssets()
          })().catch((error) => {
            showNotice(
              'Image delete failed',
              getErrorMessage(error, 'Image delete failed.'),
            )
          })
        },
        primaryLabel: 'Delete image',
        role: 'alertdialog',
        secondaryLabel: 'Cancel',
        title: 'Delete image?',
        tone: 'danger',
      })
    },
    [
      getLatestUsageSummary,
      imageUsageById,
      onClearCardImageOverrides,
      onRemovePictures,
      openPromptDialog,
      refreshImageAssets,
      showNotice,
    ],
  )

  const handleRenameImageAsset = useCallback(
    async (asset: ImageAsset, name: string) => {
      try {
        await updateImageAsset(asset.id, { name })
        await refreshImageAssets()
      } catch (error) {
        showNotice(
          'Image title update failed',
          getErrorMessage(error, 'Image title update failed.'),
        )
        throw error
      }
    },
    [refreshImageAssets, showNotice],
  )

  const handleImportImageAsset = useCallback(
    (file: File) => {
      void (async () => {
        await saveImageAsset({ file })
        await refreshImageAssets()
      })().catch((error) => {
        showNotice(
          'Image upload failed',
          getErrorMessage(error, 'Image upload failed.'),
        )
      })
    },
    [refreshImageAssets, showNotice],
  )

  const handleSelectGalleryAsset = useCallback(
    (asset: ImageAsset) => {
      if (imageGalleryState?.mode === 'pick-card-image') {
        onSetCardImageOverride(imageGalleryState.cardId, asset.id)
        closeImageGallery()
        return
      }

      if (imageGalleryState?.mode === 'pick-picture-image') {
        onSetPictureImage(imageGalleryState.pictureId, asset.id)
        closeImageGallery()
        return
      }

      onPlaceAssetAtViewportCenter(asset)
      closeImageGallery()
    },
    [
      closeImageGallery,
      imageGalleryState,
      onPlaceAssetAtViewportCenter,
      onSetCardImageOverride,
      onSetPictureImage,
    ],
  )

  return {
    activeCardOverrideImageId,
    closeImageGallery,
    handleDeleteImageAsset,
    handleImportImageAsset,
    handleRenameImageAsset,
    handleSelectGalleryAsset,
    imageAssets,
    imageGalleryState,
    imageUsageById,
    openCardImageOverridePicker,
    openImageGallery,
    openPictureImagePicker,
    refreshImageAssets,
  }
}
