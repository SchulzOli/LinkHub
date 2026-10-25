import { useMemo } from 'react'
import { create } from 'zustand'

import {
  coerceNetworkFeatures,
  NETWORK_FEATURE_KEYS,
  type FaviconSources,
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
    siteFavicons: state.siteFavicons,
    googleFavicons: state.googleFavicons,
    chartsAndFeeds: state.chartsAndFeeds,
    linkCheck: state.linkCheck,
    autoDashboard: state.autoDashboard,
    aiArrangement: state.aiArrangement,
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

// Every open Linkhaven tab follows a change made in any of them.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === NETWORK_FEATURES_STORAGE_KEY || event.key === null) {
      applyFeatures(readEffectiveFeatures())
    }
  })
}

/**
 * Where card icons may load from: the site itself and/or Google, each only
 * with its app-wide switch on. The workspace's "Favicons offline-only"
 * option still rules Google out.
 */
export function resolveFaviconSources(
  workspaceOfflineOnly: boolean,
): FaviconSources {
  const { siteFavicons, googleFavicons } = useNetworkFeaturesStore.getState()

  return { site: siteFavicons, google: googleFavicons && !workspaceOfflineOnly }
}

export function useFaviconSources(workspaceOfflineOnly: boolean) {
  const site = useNetworkFeaturesStore((state) => state.siteFavicons)
  const googleSwitch = useNetworkFeaturesStore((state) => state.googleFavicons)
  const google = googleSwitch && !workspaceOfflineOnly

  return useMemo<FaviconSources>(() => ({ site, google }), [site, google])
}
