/**
 * Throttled, deduplicated link checker.
 *
 * Groups cards by URL so each unique URL is fetched only once, then
 * broadcasts the result to all cards sharing that URL. Requests are
 * throttled per host (one concurrent request per host).
 */

const TIMEOUT_MS = 5_000
const HOST_DELAY_MS = 300

type LinkCheckResult = 'ok' | 'broken'

type HostQueue = {
  active: boolean
  queue: string[]  // unique URLs to check for this host
}

const hostQueues = new Map<string, HostQueue>()

function getHost(urlString: string): string | null {
  try {
    return new URL(urlString).hostname
  } catch {
    return null
  }
}

async function checkSingleUrl(url: string): Promise<LinkCheckResult> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    await fetch(url, {
      method: 'HEAD',
      mode: 'no-cors',
      signal: controller.signal,
    })

    // With 'no-cors' the response status is always 0, so we treat any
    // successful fetch as "ok" – the server at least responded.
    return 'ok'
  } catch {
    return 'broken'
  } finally {
    clearTimeout(timer)
  }
}

function processHostQueue(
  host: string,
  onUrlResult: (url: string, result: LinkCheckResult) => void,
  onHostComplete: () => void,
) {
  const entry = hostQueues.get(host)

  if (!entry || entry.queue.length === 0) {
    hostQueues.set(host, { active: false, queue: [] })
    onHostComplete()
    return
  }

  entry.active = true
  const url = entry.queue.shift()!

  checkSingleUrl(url)
    .then((result) => {
      onUrlResult(url, result)
    })
    .catch(() => {
      onUrlResult(url, 'broken')
    })
    .finally(() => {
      setTimeout(() => {
        processHostQueue(host, onUrlResult, onHostComplete)
      }, HOST_DELAY_MS)
    })
}

/**
 * Start checking all link cards. Deduplicates by URL so each unique URL
 * is checked only once; the result is then broadcast to every card that
 * uses that URL.
 *
 * @param cards     - Array of { cardId, url } to check.
 * @param onResult  - Called once per card with (cardId, result).
 * @param onComplete - Called after every unique URL has been checked.
 */
export function checkLinks(
  cards: Array<{ cardId: string; url: string }>,
  onResult: (cardId: string, result: LinkCheckResult) => void,
  onComplete: () => void,
): void {
  hostQueues.clear()

  // 1. Group cards by URL
  const cardsByUrl = new Map<string, string[]>()
  const invalidCardIds: string[] = []

  for (const card of cards) {
    const host = getHost(card.url)

    if (!host) {
      invalidCardIds.push(card.cardId)
      continue
    }

    let ids = cardsByUrl.get(card.url)

    if (!ids) {
      ids = []
      cardsByUrl.set(card.url, ids)
    }

    ids.push(card.cardId)
  }

  // Invalid URLs → broken immediately
  for (const cardId of invalidCardIds) {
    onResult(cardId, 'broken')
  }

  if (cardsByUrl.size === 0) {
    onComplete()
    return
  }

  // 2. Enqueue unique URLs by host
  for (const url of cardsByUrl.keys()) {
    const host = getHost(url)!

    let entry = hostQueues.get(host)

    if (!entry) {
      entry = { active: false, queue: [] }
      hostQueues.set(host, entry)
    }

    entry.queue.push(url)
  }

  // 3. Process queues – broadcast result to every card sharing the URL
  let completedHosts = 0
  const totalHosts = hostQueues.size

  const handleHostComplete = () => {
    completedHosts++

    if (completedHosts >= totalHosts) {
      onComplete()
    }
  }

  const handleUrlResult = (url: string, result: LinkCheckResult) => {
    const ids = cardsByUrl.get(url)

    if (!ids) {
      return
    }

    for (const cardId of ids) {
      onResult(cardId, result)
    }
  }

  for (const host of hostQueues.keys()) {
    processHostQueue(host, handleUrlResult, handleHostComplete)
  }
}