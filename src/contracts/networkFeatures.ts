import { z } from 'zod'

/**
 * App-wide switches for every feature that talks to the network. Linkhaven
 * works fully offline; each feature here only contacts anything once the
 * user turns it on. All are off by default.
 */
export const NetworkFeaturesSchema = z.object({
  /** Ask Google's favicon service for icons a site doesn't serve itself. */
  googleFavicons: z.boolean(),
  /** Chart nodes (price feed) and news feed nodes (RSS proxy). */
  chartsAndFeeds: z.boolean(),
  /** "Check links": one request per saved link, when the user starts it. */
  linkCheck: z.boolean(),
})

export type NetworkFeatures = z.infer<typeof NetworkFeaturesSchema>
export type NetworkFeatureKey = keyof NetworkFeatures

export const DEFAULT_NETWORK_FEATURES: NetworkFeatures = {
  googleFavicons: false,
  chartsAndFeeds: false,
  linkCheck: false,
}

export const NETWORK_FEATURE_KEYS = Object.keys(
  NetworkFeaturesSchema.shape,
) as NetworkFeatureKey[]

/** Shown by chart and feed nodes while the switch is off. */
export const CHARTS_AND_FEEDS_OFF_MESSAGE =
  'Charts and news feeds are off. Turn them on in Menu → Privacy.'

export function coerceNetworkFeatures(value: unknown): NetworkFeatures {
  const raw =
    typeof value === 'object' && value !== null
      ? (value as Record<string, unknown>)
      : {}

  return Object.fromEntries(
    NETWORK_FEATURE_KEYS.map((key) => [
      key,
      typeof raw[key] === 'boolean' ? raw[key] : DEFAULT_NETWORK_FEATURES[key],
    ]),
  ) as NetworkFeatures
}
