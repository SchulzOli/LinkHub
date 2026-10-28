import { useEffect, useState } from 'react'

import { getImageAsset } from '../../storage/imageRepository'
import { isFetchedIconName } from '../favicon/faviconCache'

// An asset never changes its name, so the answer can be kept.
const known = new Map<string, boolean>()

/** Whether a card's image is an icon Linkhaven fetched (not your own). */
export function useIsFetchedIcon(imageId: string | undefined) {
  const [, setVersion] = useState(0)

  useEffect(() => {
    if (!imageId || known.has(imageId)) {
      return
    }

    let active = true

    void getImageAsset(imageId)
      .then((asset) => {
        known.set(imageId, asset !== null && isFetchedIconName(asset.name))
      })
      .catch(() => known.set(imageId, false))
      .finally(() => {
        if (active) {
          setVersion((version) => version + 1)
        }
      })

    return () => {
      active = false
    }
  }, [imageId])

  return imageId ? (known.get(imageId) ?? false) : false
}
