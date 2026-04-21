import { useEffect, useState } from 'react'

import {
  acquireImageObjectUrl,
  releaseImageObjectUrl,
  type ImageObjectUrlVariant,
} from './imageObjectUrlCache'

export function useImageAssetUrl(
  imageId: string | undefined,
  variant: ImageObjectUrlVariant = 'thumbnail',
) {
  const [assetState, setAssetState] = useState<{
    imageId: string | null
    url: string | null
    variant: ImageObjectUrlVariant | null
  }>({
    imageId: null,
    url: null,
    variant: null,
  })

  useEffect(() => {
    if (!imageId) {
      return
    }

    let active = true

    void acquireImageObjectUrl(imageId, variant)
      .then((url) => {
        if (active) {
          setAssetState({ imageId, url, variant })
        }
      })
      .catch(() => {
        if (active) {
          setAssetState({ imageId, url: null, variant })
        }
      })

    return () => {
      active = false
      releaseImageObjectUrl(imageId, variant)
    }
  }, [imageId, variant])

  return assetState.imageId === imageId && assetState.variant === variant
    ? assetState.url
    : null
}
