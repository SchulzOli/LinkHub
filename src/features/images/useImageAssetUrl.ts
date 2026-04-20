import { useEffect, useState } from 'react'

import {
  acquireImageObjectUrl,
  releaseImageObjectUrl,
} from './imageObjectUrlCache'

export function useImageAssetUrl(imageId: string | undefined) {
  const [assetState, setAssetState] = useState<{
    imageId: string | null
    url: string | null
  }>({
    imageId: null,
    url: null,
  })

  useEffect(() => {
    if (!imageId) {
      return
    }

    let active = true

    void acquireImageObjectUrl(imageId)
      .then((url) => {
        if (active) {
          setAssetState({ imageId, url })
        }
      })
      .catch(() => {
        if (active) {
          setAssetState({ imageId, url: null })
        }
      })

    return () => {
      active = false
      releaseImageObjectUrl(imageId)
    }
  }, [imageId])

  return assetState.imageId === imageId ? assetState.url : null
}
