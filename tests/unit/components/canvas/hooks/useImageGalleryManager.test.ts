import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useImageGalleryManager } from '../../../../../src/components/canvas/hooks/useImageGalleryManager'
import type { ImageAsset } from '../../../../../src/contracts/imageAsset'
import { listImageAssets } from '../../../../../src/storage/imageRepository'

vi.mock('../../../../../src/storage/imageRepository', () => ({
  deleteImageAsset: vi.fn(),
  listImageAssets: vi.fn(),
  saveImageAsset: vi.fn(),
  updateImageAsset: vi.fn(),
}))

const TEST_ASSET: ImageAsset = {
  id: 'image-1',
  name: 'Gallery Image',
  originalFilename: 'gallery-image.png',
  mimeType: 'image/png',
  byteSize: 1024,
  width: 1200,
  height: 800,
  isAnimated: false,
  createdAt: '2026-04-06T00:00:00.000Z',
  updatedAt: '2026-04-06T00:00:00.000Z',
}

describe('useImageGalleryManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(listImageAssets).mockResolvedValue([])
  })

  it('closes the gallery after creating a picture node from browse mode', async () => {
    const onPlaceAssetAtViewportCenter = vi.fn()

    const { result } = renderHook(() =>
      useImageGalleryManager({
        cards: [],
        getLatestUsageSummary: (imageId) => ({
          cardOverrideCount: 0,
          cardOverrideIds: [],
          imageId,
          pictureCount: 0,
          pictureIds: [],
          totalCount: 0,
        }),
        onClearCardImageOverrides: vi.fn(),
        onPlaceAssetAtViewportCenter,
        onRemovePictures: vi.fn(),
        onSetCardImageOverride: vi.fn(),
        onSetPictureImage: vi.fn(),
        openPromptDialog: vi.fn(),
        pictures: [],
        showNotice: vi.fn(),
        status: 'loading',
      }),
    )

    await act(async () => {
      result.current.openImageGallery()
    })

    await waitFor(() => {
      expect(result.current.imageGalleryState).toEqual({ mode: 'browse' })
    })

    act(() => {
      result.current.handleSelectGalleryAsset(TEST_ASSET)
    })

    expect(onPlaceAssetAtViewportCenter).toHaveBeenCalledWith(TEST_ASSET)
    expect(result.current.imageGalleryState).toBeNull()
  })
})
