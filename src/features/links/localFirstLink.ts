/**
 * Cards can carry a second, local address (e.g. `http://192.168.1.10:8123`
 * next to `https://home.example.com`). On a click Linkhaven checks briefly
 * whether the local address answers and opens it when it does, otherwise
 * the card's main address. Nothing is checked until the card is clicked.
 */

/** How long a click waits for the local address before going remote. */
export const LOCAL_PROBE_TIMEOUT_MS = 900

const REACHABLE_TTL_MS = 60_000
const UNREACHABLE_TTL_MS = 15_000

const probeCache = new Map<string, { reachable: boolean; until: number }>()

if (typeof window !== 'undefined') {
  // A new network (home Wi-Fi, mobile data) may change the answer.
  window.addEventListener('online', () => probeCache.clear())
  window.addEventListener('offline', () => probeCache.clear())
}

/**
 * Local addresses are usually plain http on an IP or a `.local` name, so a
 * missing scheme means http here (the main link defaults to https).
 */
export function normalizeLocalUrl(input: string) {
  const value = input.trim()

  if (!value) {
    return null
  }

  // Another scheme (ftp://, smb://, …) isn't a web link.
  if (/^[a-z][a-z\d+.-]*:\/\//i.test(value) && !/^https?:\/\//i.test(value)) {
    return null
  }

  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `http://${value}`)

    return url.protocol === 'http:' || url.protocol === 'https:'
      ? url.toString()
      : null
  } catch {
    return null
  }
}

/**
 * True when something answers at the address. `no-cors` gets an opaque
 * response from any web server, and fails only when the host can't be
 * reached (or the browser blocks the request, e.g. http from an https
 * page). Results are kept for a short while so repeated clicks are instant.
 */
export async function isLocalUrlReachable(
  url: string,
  options: {
    timeoutMs?: number
    fetch?: typeof fetch
    now?: () => number
  } = {},
) {
  const now = options.now ?? Date.now
  const origin = new URL(url).origin
  const cached = probeCache.get(origin)

  if (cached && cached.until > now()) {
    return cached.reachable
  }

  const controller = new AbortController()
  const timer = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? LOCAL_PROBE_TIMEOUT_MS,
  )
  let reachable: boolean

  try {
    await (options.fetch ?? fetch)(url, {
      mode: 'no-cors',
      cache: 'no-store',
      credentials: 'omit',
      signal: controller.signal,
    })
    reachable = true
  } catch {
    reachable = false
  } finally {
    clearTimeout(timer)
  }

  probeCache.set(origin, {
    reachable,
    until: now() + (reachable ? REACHABLE_TTL_MS : UNREACHABLE_TTL_MS),
  })

  return reachable
}

export function clearLocalProbeCache() {
  probeCache.clear()
}

/**
 * Opens the local address when it answers, else the main one. A new tab
 * is opened right away (still inside the click, so it isn't blocked as a
 * popup) and pointed at the chosen address once the check is done.
 */
export async function openLocalFirst(input: {
  url: string
  localUrl: string
  newTab: boolean
}) {
  const tab = input.newTab ? window.open('about:blank', '_blank') : null

  if (tab) {
    // Like rel="noreferrer": the opened site can't reach back to Linkhaven.
    tab.opener = null
  }

  const target = (await isLocalUrlReachable(input.localUrl))
    ? input.localUrl
    : input.url

  if (!input.newTab) {
    window.location.assign(target)
  } else if (tab) {
    tab.location.replace(target)
  } else {
    window.open(target, '_blank', 'noreferrer')
  }

  return target
}
