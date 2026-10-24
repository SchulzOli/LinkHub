import { create } from 'zustand'

import {
  coerceNetworkFeatures,
  NETWORK_FEATURE_KEYS,
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

const disableHandlers = new Map<NetworkFeatureKey, Set<() => void>>()

/**
 * Runs `handler` whenever `key` is switched off, here or in another tab,
 * so work already under way (open sockets, queued requests) stops at once
 * instead of finishing after the user opted out.
 */
export function onNetworkFeatureDisabled(
  key: NetworkFeatureKey,
  handler: () => void,
) {
  const handlers = disableHandlers.get(key) ?? new Set()

  handlers.add(handler)
  disableHandlers.set(key, handlers)

  return () => {
    handlers.delete(handler)
  }
}

export function isNetworkFeatureEnabled(key: NetworkFeatureKey) {
  return useNetworkFeaturesStore.getState()[key]
}

function pickFeatures(state: NetworkFeatures): NetworkFeatures {
  return {
    googleFavicons: state.googleFavicons,
    chartsAndFeeds: state.chartsAndFeeds,
    linkCheck: state.linkCheck,
  }
}

/** Applies new values and stops the work of every feature turned off. */
function applyFeatures(next: NetworkFeatures) {
  const previous = pickFeatures(useNetworkFeaturesStore.getState())

  useNetworkFeaturesStore.setState(next)

  for (const key of NETWORK_FEATURE_KEYS) {
    if (previous[key] && !next[key]) {
      for (const handler of disableHandlers.get(key) ?? []) {
        handler()
      }
    }
  }
}

export const useNetworkFeaturesStore = create<NetworkFeaturesState>(
  (_set, get) => ({
    ...readStoredFeatures(),
    setFeature: (key, enabled) => {
      // Re-read first, so a stale tab never writes back an old value for
      // another switch.
      const next = { ...readStoredFeatures(), [key]: enabled }

      writeStoredFeatures(next)
      applyFeatures({ ...pickFeatures(get()), ...next })
    },
  }),
)

// Every open LinkHub tab follows a change made in any of them.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === NETWORK_FEATURES_STORAGE_KEY || event.key === null) {
      applyFeatures(readStoredFeatures())
    }
  })
}

/**
 * Favicons stay offline-only (never Google) unless both the app-wide switch
 * allows Google and the workspace doesn't ask for offline-only.
 */
export function resolveFaviconsOfflineOnly(workspaceOfflineOnly: boolean) {
  return workspaceOfflineOnly || !isNetworkFeatureEnabled('googleFavicons')
}

export function useFaviconsOfflineOnly(workspaceOfflineOnly: boolean) {
  const googleFavicons = useNetworkFeaturesStore(
    (state) => state.googleFavicons,
  )

  return workspaceOfflineOnly || !googleFavicons
}
