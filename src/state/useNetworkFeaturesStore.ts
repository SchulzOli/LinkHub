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

/**
 * Switches turned off in this tab whose change could not be saved (quota,
 * private mode). They stay off whatever storage says, so re-reading it
 * never silently turns a feature back on. Only opt-outs are kept: another
 * tab must still be able to turn a feature off here.
 */
let unsavedOptOuts: Partial<Record<NetworkFeatureKey, false>> = {}

function writeStoredFeatures(
  features: NetworkFeatures,
  changedKey: NetworkFeatureKey,
) {
  unsavedOptOuts = { ...unsavedOptOuts }
  delete unsavedOptOuts[changedKey]

  try {
    window.localStorage.setItem(
      NETWORK_FEATURES_STORAGE_KEY,
      JSON.stringify(features),
    )
    unsavedOptOuts = {}
  } catch {
    // Quota or private mode: the switch still applies for this session.
    if (!features[changedKey]) {
      unsavedOptOuts = { ...unsavedOptOuts, [changedKey]: false }
    }
  }
}

/** Stored switches, with this tab's unsaved opt-outs on top. */
function readEffectiveFeatures(): NetworkFeatures {
  return { ...readStoredFeatures(), ...unsavedOptOuts }
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
      const next = { ...readEffectiveFeatures(), [key]: enabled }

      writeStoredFeatures(next, key)
      applyFeatures({ ...pickFeatures(get()), ...next })
    },
  }),
)

// Every open LinkHub tab follows a change made in any of them.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === NETWORK_FEATURES_STORAGE_KEY || event.key === null) {
      applyFeatures(readEffectiveFeatures())
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
