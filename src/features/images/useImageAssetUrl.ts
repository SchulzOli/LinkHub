import { useEffect, useState } from 'react'

import { getImageBlob } from '../../storage/imageRepository'

export function useImageAssetUrl(imageId: string | undefined) {
  const [assetState, setAssetState] = useState<{
    imageId: string | null
    url: string | null
  }>({
    imageId: null,
    url: null,
  })

  useEffect(() => {
    let active = true
    let currentObjectUrl: string | null = null

    if (
      !imageId ||
      typeof URL === 'undefined' ||
      typeof URL.createObjectURL !== 'function'
    ) {
      return
    }

    void getImageBlob(imageId)
      .then((blob) => {
        if (!active || !blob) {
          if (active) {
            setAssetState({ imageId, url: null })
          }

          return
        }

        currentObjectUrl = URL.createObjectURL(blob)
        setAssetState({ imageId, url: currentObjectUrl })
      })
      .catch(() => {
        if (active) {
          setAssetState({ imageId, url: null })
        }
      })

    return () => {
      active = false

      if (currentObjectUrl) {
        URL.revokeObjectURL(currentObjectUrl)
      }
    }
  }, [imageId])

  return assetState.imageId === imageId ? assetState.url : null
}
