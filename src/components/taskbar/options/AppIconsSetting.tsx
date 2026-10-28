import { useState } from 'react'

import type { LinkCard } from '../../../contracts/linkCard'
import { fetchAppIcon, findAppIcon } from '../../../features/appIcons/appIcons'
import {
  isFetchedIconName,
  storeFaviconAsImageAsset,
} from '../../../features/favicon/faviconCache'
import { useNetworkFeaturesStore } from '../../../state/useNetworkFeaturesStore'
import { useWorkspaceStore } from '../../../state/useWorkspaceStore'
import type { CardBatchUpdate } from '../../../state/workspaceStoreTypes'
import { getImageAsset } from '../../../storage/imageRepository'
import { SettingRow } from '../../ui/panel/Panel'
import panelStyles from '../../ui/panel/Panel.module.css'

type FinderStatus =
  | { kind: 'idle' }
  | { kind: 'busy'; done: number; total: number }
  | { kind: 'done'; found: number; total: number }

/** Icons Linkhaven fetched itself may be replaced; your own images stay. */
async function hasOwnImage(card: LinkCard) {
  if (!card.faviconOverrideImageId) {
    return false
  }

  const asset = await getImageAsset(card.faviconOverrideImageId)

  return asset !== null && !isFetchedIconName(asset.name)
}

/**
 * Gives the cards on this board their self-hosted app icon (Jellyfin,
 * Radarr, …) where one fits. One undo step; your own images stay.
 */
export function AppIconsSetting() {
  const enabled = useNetworkFeaturesStore((state) => state.appIcons)
  const cardCount = useWorkspaceStore((state) => state.workspace.cards.length)
  const [status, setStatus] = useState<FinderStatus>({ kind: 'idle' })

  const findIcons = async () => {
    const cards = useWorkspaceStore.getState().workspace.cards
    const updates: CardBatchUpdate[] = []
    // Several cards for one app (Jellyfin, Jellyfin remote) share one image.
    const stored = new Map<string, string | null>()
    let done = 0

    setStatus({ kind: 'busy', done, total: cards.length })

    for (const card of cards) {
      if (!useNetworkFeaturesStore.getState().appIcons) {
        break
      }

      if (!(await hasOwnImage(card))) {
        const icon = await findAppIcon(card)

        if (icon) {
          let imageId = stored.get(icon.name)

          if (imageId === undefined) {
            const blob = await fetchAppIcon(icon)

            imageId = blob
              ? await storeFaviconAsImageAsset(icon.name, blob, 'app')
              : null
            stored.set(icon.name, imageId)
          }

          if (imageId && imageId !== card.faviconOverrideImageId) {
            updates.push({
              cardId: card.id,
              updates: { faviconOverrideImageId: imageId },
            })
          }
        }
      }

      done += 1
      setStatus({ kind: 'busy', done, total: cards.length })
    }

    if (updates.length > 0) {
      useWorkspaceStore.getState().updateCards(updates)
    }

    setStatus({ kind: 'done', found: updates.length, total: cards.length })
  }

  return (
    <SettingRow
      hint={
        !enabled
          ? 'Off: turn on App icons in Menu → Privacy to give homelab links (Jellyfin, Radarr, Home Assistant, …) their app icon.'
          : status.kind === 'done'
            ? `${status.found} of ${status.total} cards got an app icon. Cards with your own image keep it.`
            : 'Matches each card on this board to a self-hosted app by its name or address and loads that icon. Cards with your own image keep it.'
      }
      label="App icons"
    >
      <button
        className={panelStyles.button}
        data-testid="find-app-icons"
        disabled={!enabled || status.kind === 'busy' || cardCount === 0}
        onClick={() => void findIcons()}
        type="button"
      >
        {status.kind === 'busy'
          ? `Searching ${status.done}/${status.total}…`
          : 'Find app icons'}
      </button>
    </SettingRow>
  )
}
