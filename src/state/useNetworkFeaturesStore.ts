import { create } from 'zustand'

import {
  coerceNetworkFeatures,
  type NetworkFeatureKey,
  type NetworkFeatures,
} from '../contracts/networkFeatures'

// localStorage, read synchronously at startup: a chart or feed must know
// whether it may connect before it renders for the first time.
export const NETWORK_FEATURES_STORAGE_KEY = 'linkhub.network-features'

function readStoredFeatures(): NetworkFeatures {
  try {
    const raw = window.localStorage.getItem(NETWORK_FEATURES_STORAGE_KEY)

    return coerceNetworkFeatures(raw ? JSON.parse(raw) : null)
  } catch {
    return coerceNetworkFeatures(null)
  }
}

function writeStoredFeatures(features: NetworkFeatures) {
  try {
    window.localStorage.setItem(
      NETWORK_FEATURES_STORAGE_KEY,
      JSON.stringify(features),
    )
  } catch {
    // Quota or private mode: the switch still applies for this session.
  }
}

type NetworkFeaturesState = NetworkFeatures & {
  setFeature: (key: NetworkFeatureKey, enabled: boolean) => void
}

export const useNetworkFeaturesStore = create<NetworkFeaturesState>(
  (set, get) => ({
    ...readStoredFeatures(),
    setFeature: (key, enabled) => {
      set({ [key]: enabled })

      const { googleFavicons, chartsAndFeeds, linkCheck } = get()

      writeStoredFeatures({ googleFavicons, chartsAndFeeds, linkCheck })
    },
  }),
)

/**
 * Favicons stay offline-only (never Google) unless both the app-wide switch
 * allows Google and the workspace doesn't ask for offline-only.
 */
export function resolveFaviconsOfflineOnly(workspaceOfflineOnly: boolean) {
  return (
    workspaceOfflineOnly || !useNetworkFeaturesStore.getState().googleFavicons
  )
}

export function useFaviconsOfflineOnly(workspaceOfflineOnly: boolean) {
  const googleFavicons = useNetworkFeaturesStore(
    (state) => state.googleFavicons,
  )

  return workspaceOfflineOnly || !googleFavicons
}
