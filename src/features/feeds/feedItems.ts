import {
  FEED_TIME_WINDOW_MS,
  type FeedSettings,
  type FeedSort,
} from '../../contracts/feedNode'

import type { FeedItem } from './feedParser'

/** Merges items of several feeds; the same article (link/id) appears once. */
export function mergeFeedItems(lists: FeedItem[][]): FeedItem[] {
  const seen = new Set<string>()
  const merged: FeedItem[] = []

  for (const list of lists) {
    for (const item of list) {
      const key = item.link ?? `${item.sourceUrl}|${item.id}`

      if (!seen.has(key)) {
        seen.add(key)
        merged.push(item)
      }
    }
  }

  return merged
}

function matchesQuery(item: FeedItem, terms: string[]): boolean {
  if (terms.length === 0) {
    return true
  }

  const haystack =
    `${item.title} ${item.summary} ${item.author ?? ''} ${item.sourceTitle}`.toLowerCase()

  return terms.every((term) => haystack.includes(term))
}

/**
 * Applies source visibility, the time window and a free-text query (all
 * words must match; title, summary, author and source are searched).
 */
export function filterFeedItems(
  items: FeedItem[],
  input: {
    settings: Pick<FeedSettings, 'hiddenSources' | 'timeWindow'>
    query: string
    now: number
  },
): FeedItem[] {
  const hidden = new Set(input.settings.hiddenSources)
  const windowMs = FEED_TIME_WINDOW_MS[input.settings.timeWindow]
  const cutoff = windowMs === null ? null : input.now - windowMs
  const terms = input.query.toLowerCase().split(/\s+/).filter(Boolean)

  return items.filter(
    (item) =>
      !hidden.has(item.sourceUrl) &&
      (cutoff === null ||
        (item.published !== null && item.published >= cutoff)) &&
      matchesQuery(item, terms),
  )
}

/** Items without a date go last for both date sorts. */
function compareDates(a: FeedItem, b: FeedItem, direction: 1 | -1): number {
  if (a.published === b.published) {
    return 0
  }

  if (a.published === null) {
    return 1
  }

  if (b.published === null) {
    return -1
  }

  return (a.published - b.published) * direction
}

export function sortFeedItems(items: FeedItem[], sort: FeedSort): FeedItem[] {
  const sorted = [...items]
  const collator = new Intl.Collator(undefined, { sensitivity: 'base' })

  switch (sort) {
    case 'newest':
      return sorted.sort((a, b) => compareDates(a, b, -1))
    case 'oldest':
      return sorted.sort((a, b) => compareDates(a, b, 1))
    case 'title':
      return sorted.sort((a, b) => collator.compare(a.title, b.title))
    case 'source':
      return sorted.sort(
        (a, b) =>
          collator.compare(a.sourceTitle, b.sourceTitle) ||
          compareDates(a, b, -1),
      )
  }
}

const RELATIVE_UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ['year', 365 * 24 * 3600 * 1000],
  ['month', 30 * 24 * 3600 * 1000],
  ['week', 7 * 24 * 3600 * 1000],
  ['day', 24 * 3600 * 1000],
  ['hour', 3600 * 1000],
  ['minute', 60 * 1000],
]

/** "3 hours ago", "yesterday", "just now". */
export function formatRelativeTime(timestamp: number, now: number): string {
  const delta = timestamp - now
  const format = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

  for (const [unit, ms] of RELATIVE_UNITS) {
    if (Math.abs(delta) >= ms) {
      return format.format(Math.round(delta / ms), unit)
    }
  }

  return 'just now'
}

export function formatAbsoluteTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}
