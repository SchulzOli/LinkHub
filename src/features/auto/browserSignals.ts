/**
 * Read-only access to the browser's own "what does the user open" data.
 * Only exists in the extension build; the hosted web app has neither API,
 * so every function here degrades to "unavailable" there.
 *
 * Both permissions are optional in the manifest and are requested from a
 * click on the matching switch, never at install time.
 */

export type BrowserSignalPermission = 'history' | 'topSites'

export type BrowserVisit = {
  url: string
  title: string
  visitCount: number
  /** ms since epoch; 0 when the browser doesn't say. */
  lastVisitTime: number
}

type HistoryItem = {
  url?: string
  title?: string
  visitCount?: number
  typedCount?: number
  lastVisitTime?: number
}

type MostVisitedUrl = { url: string; title?: string }

type ExtensionApi = {
  permissions?: {
    contains: (input: { permissions: string[] }) => Promise<boolean>
    request: (input: { permissions: string[] }) => Promise<boolean>
    remove: (input: { permissions: string[] }) => Promise<boolean>
  }
  history?: {
    search: (query: {
      text: string
      startTime?: number
      maxResults?: number
    }) => Promise<HistoryItem[]>
  }
  topSites?: { get: () => Promise<MostVisitedUrl[]> }
}

const HISTORY_MAX_RESULTS = 2000

function getExtensionApi(): ExtensionApi | null {
  const scope = globalThis as {
    browser?: ExtensionApi
    chrome?: ExtensionApi
  }

  // Firefox exposes `browser` (promise based); Chrome MV3's `chrome.*`
  // returns promises too.
  const api = scope.browser ?? scope.chrome

  return api?.permissions ? api : null
}

/** True in the browser extension, where the optional permissions exist. */
export function canUseBrowserSignals() {
  return getExtensionApi() !== null
}

export async function hasBrowserSignalPermission(
  permission: BrowserSignalPermission,
) {
  const api = getExtensionApi()

  if (!api?.permissions) {
    return false
  }

  try {
    return await api.permissions.contains({ permissions: [permission] })
  } catch {
    return false
  }
}

/** Must run inside a click handler: browsers only prompt on a user gesture. */
export async function requestBrowserSignalPermission(
  permission: BrowserSignalPermission,
) {
  const api = getExtensionApi()

  if (!api?.permissions) {
    return false
  }

  try {
    return await api.permissions.request({ permissions: [permission] })
  } catch {
    return false
  }
}

/** Gives the permission back when the user turns a source off. */
export async function releaseBrowserSignalPermission(
  permission: BrowserSignalPermission,
) {
  const api = getExtensionApi()

  if (!api?.permissions) {
    return
  }

  try {
    await api.permissions.remove({ permissions: [permission] })
  } catch {
    // Not granted, or already removed: nothing to give back.
  }
}

export async function readTopSites(): Promise<BrowserVisit[]> {
  const api = getExtensionApi()

  if (!api?.topSites || !(await hasBrowserSignalPermission('topSites'))) {
    return []
  }

  const sites = await api.topSites.get()
  const count = sites.length

  // topSites has no counts, only an order. Turn the rank into a pseudo
  // count so it can be merged with real visit counts.
  return sites.map((site, index) => ({
    url: site.url,
    title: site.title ?? '',
    visitCount: Math.max(1, (count - index) * 2),
    lastVisitTime: 0,
  }))
}

export async function readHistory(
  days: number,
  now = Date.now(),
): Promise<BrowserVisit[]> {
  const api = getExtensionApi()

  if (!api?.history || !(await hasBrowserSignalPermission('history'))) {
    return []
  }

  const items = await api.history.search({
    text: '',
    startTime: now - days * 24 * 3600 * 1000,
    maxResults: HISTORY_MAX_RESULTS,
  })

  return items.flatMap((item) =>
    item.url
      ? [
          {
            url: item.url,
            title: item.title ?? '',
            // A typed visit says more about intent than a click-through.
            visitCount: (item.visitCount ?? 1) + (item.typedCount ?? 0),
            lastVisitTime: item.lastVisitTime ?? 0,
          },
        ]
      : [],
  )
}
