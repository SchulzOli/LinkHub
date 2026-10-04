/**
 * RSS 2.0, RSS 1.0 (RDF) and Atom parsing with the browser's DOMParser.
 * Only http(s) links and image URLs are kept, so feed content can never
 * inject `javascript:` URLs into the canvas.
 */

export type FeedItem = {
  /** Stable key: guid/id, else link, else title + date. */
  id: string
  title: string
  /** Article URL (http/https) or undefined when the item has none. */
  link?: string
  /** Epoch ms, or null when the item has no parsable date. */
  published: number | null
  /** Plain-text summary, HTML removed, trimmed to a short excerpt. */
  summary: string
  author?: string
  imageUrl?: string
  /** URL of the feed this item came from. */
  sourceUrl: string
  /** Title of the feed this item came from. */
  sourceTitle: string
}

export type ParsedFeed = {
  title: string
  /** Website of the feed, if it declares one. */
  siteUrl?: string
  items: FeedItem[]
}

export class FeedParseError extends Error {
  /** Feed URLs found when the response was an HTML page. */
  readonly alternates: string[]

  constructor(message: string, alternates: string[] = []) {
    super(message)
    this.name = 'FeedParseError'
    this.alternates = alternates
  }
}

const SUMMARY_MAX_LENGTH = 280
const MAX_ITEMS_PER_FEED = 200

export function toSafeHttpUrl(
  value: string | null | undefined,
  base?: string,
): string | undefined {
  if (!value) {
    return undefined
  }

  try {
    const url = new URL(value.trim(), base)

    return url.protocol === 'http:' || url.protocol === 'https:'
      ? url.href
      : undefined
  } catch {
    return undefined
  }
}

function children(parent: Element, name: string): Element[] {
  const lower = name.toLowerCase()

  return Array.from(parent.children).filter(
    (child) => child.tagName.toLowerCase() === lower,
  )
}

function child(parent: Element, ...names: string[]): Element | undefined {
  for (const name of names) {
    const found = children(parent, name)[0]

    if (found) {
      return found
    }
  }

  return undefined
}

function text(element: Element | undefined): string {
  return element?.textContent?.trim() ?? ''
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

/** Text content of an HTML fragment plus its first image, if any. */
function readHtml(html: string): { text: string; imageUrl?: string } {
  if (!html) {
    return { text: '' }
  }

  // Plain text (no tags/entities): skip the HTML parser.
  if (!/[<&]/.test(html)) {
    return { text: collapseWhitespace(html) }
  }

  const doc = new DOMParser().parseFromString(html, 'text/html')
  const image = doc.querySelector('img[src]')?.getAttribute('src')

  doc.querySelectorAll('script, style').forEach((node) => node.remove())

  return {
    text: collapseWhitespace(doc.body?.textContent ?? ''),
    imageUrl: image ?? undefined,
  }
}

/**
 * Titles are plain text, but some feeds double-escape entities
 * ("&amp;amp;"). Decode leftover entities without interpreting tags.
 */
function decodeTitle(value: string): string {
  if (!/&(#\d+|#x[0-9a-f]+|[a-z]+);/i.test(value)) {
    return collapseWhitespace(value)
  }

  const doc = new DOMParser().parseFromString(
    `<textarea>${value.replace(/<\/textarea/gi, '')}</textarea>`,
    'text/html',
  )

  return collapseWhitespace(doc.querySelector('textarea')?.value ?? value)
}

function excerpt(value: string): string {
  if (value.length <= SUMMARY_MAX_LENGTH) {
    return value
  }

  const cut = value.slice(0, SUMMARY_MAX_LENGTH)
  const lastSpace = cut.lastIndexOf(' ')

  return `${(lastSpace > SUMMARY_MAX_LENGTH * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`
}

export function parseFeedDate(value: string): number | null {
  if (!value) {
    return null
  }

  const parsed = Date.parse(value.trim())

  return Number.isFinite(parsed) ? parsed : null
}

/** media:content / media:thumbnail / enclosure / itunes:image. */
function readMediaImage(item: Element): string | undefined {
  for (const element of Array.from(item.getElementsByTagName('*'))) {
    const tag = element.tagName.toLowerCase()
    const url = element.getAttribute('url') ?? element.getAttribute('href')

    if (!url) {
      continue
    }

    if (tag === 'media:thumbnail' || tag === 'itunes:image') {
      return url
    }

    if (tag === 'media:content' || tag === 'enclosure') {
      const type = element.getAttribute('type') ?? ''
      const medium = element.getAttribute('medium') ?? ''

      if (
        type.startsWith('image/') ||
        medium === 'image' ||
        (!type && /\.(avif|gif|jpe?g|png|webp)(\?|$)/i.test(url))
      ) {
        return url
      }
    }
  }

  return undefined
}

function buildItem(input: {
  guid: string
  title: string
  link?: string
  date: string
  html: string
  author: string
  mediaImage?: string
  sourceUrl: string
  sourceTitle: string
}): FeedItem {
  const content = readHtml(input.html)
  const link = toSafeHttpUrl(input.link, input.sourceUrl)
  const published = parseFeedDate(input.date)
  const title =
    decodeTitle(input.title) ||
    excerpt(content.text).slice(0, 120) ||
    'Untitled'

  return {
    id: input.guid || link || `${title}|${published ?? ''}`,
    title,
    ...(link ? { link } : {}),
    published,
    summary: excerpt(content.text),
    ...(input.author ? { author: collapseWhitespace(input.author) } : {}),
    ...(() => {
      const imageUrl = toSafeHttpUrl(
        input.mediaImage ?? content.imageUrl,
        link ?? input.sourceUrl,
      )

      return imageUrl ? { imageUrl } : {}
    })(),
    sourceUrl: input.sourceUrl,
    sourceTitle: input.sourceTitle,
  }
}

function parseRssItems(
  items: Element[],
  sourceUrl: string,
  sourceTitle: string,
): FeedItem[] {
  return items.map((item) =>
    buildItem({
      guid: text(child(item, 'guid')),
      title: text(child(item, 'title')),
      link:
        text(child(item, 'link')) ||
        child(item, 'atom:link')?.getAttribute('href') ||
        (child(item, 'guid')?.getAttribute('isPermaLink') !== 'false'
          ? text(child(item, 'guid'))
          : undefined),
      date: text(child(item, 'pubDate', 'dc:date', 'published', 'updated')),
      html: text(child(item, 'content:encoded', 'description')),
      author: text(child(item, 'dc:creator', 'author')),
      mediaImage: readMediaImage(item),
      sourceUrl,
      sourceTitle,
    }),
  )
}

function atomLink(entry: Element): string | undefined {
  const links = children(entry, 'link')
  const alternate =
    links.find(
      (link) => (link.getAttribute('rel') ?? 'alternate') === 'alternate',
    ) ?? links[0]

  return alternate?.getAttribute('href') ?? undefined
}

function parseAtomEntries(
  entries: Element[],
  sourceUrl: string,
  sourceTitle: string,
): FeedItem[] {
  return entries.map((entry) => {
    const author = child(entry, 'author')

    return buildItem({
      guid: text(child(entry, 'id')),
      title: text(child(entry, 'title')),
      link: atomLink(entry),
      date: text(child(entry, 'published', 'updated', 'issued')),
      html: text(child(entry, 'summary', 'content')),
      author: author ? text(child(author, 'name')) || text(author) : '',
      mediaImage:
        readMediaImage(entry) ??
        children(entry, 'link')
          .find(
            (link) =>
              link.getAttribute('rel') === 'enclosure' &&
              (link.getAttribute('type') ?? '').startsWith('image/'),
          )
          ?.getAttribute('href') ??
        undefined,
      sourceUrl,
      sourceTitle,
    })
  })
}

/** `<link rel="alternate" type="application/rss+xml">` URLs of an HTML page. */
export function findFeedLinksInHtml(html: string, pageUrl: string): string[] {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const urls = Array.from(
    doc.querySelectorAll<HTMLLinkElement>('link[rel~="alternate"][href]'),
  )
    .filter((link) =>
      /(rss|atom)\+xml|application\/(rss|atom|feed)/i.test(
        link.getAttribute('type') ?? '',
      ),
    )
    .map((link) => toSafeHttpUrl(link.getAttribute('href'), pageUrl))
    .filter((url): url is string => Boolean(url))

  return Array.from(new Set(urls))
}

function looksLikeHtml(body: string): boolean {
  return /^\s*(<!doctype html|<html[\s>])/i.test(body)
}

/**
 * Parses an RSS/Atom document. Throws `FeedParseError`; for HTML pages the
 * error lists the feeds the page links to, so callers can follow them.
 */
export function parseFeed(body: string, sourceUrl: string): ParsedFeed {
  if (looksLikeHtml(body)) {
    const alternates = findFeedLinksInHtml(body, sourceUrl)

    throw new FeedParseError(
      alternates.length
        ? 'This is a web page; it links to a feed.'
        : 'This is a web page without a linked feed. Enter the RSS or Atom URL.',
      alternates,
    )
  }

  const doc = new DOMParser().parseFromString(
    body.replace(/^\uFEFF/, ''),
    'application/xml',
  )

  if (doc.getElementsByTagName('parsererror').length > 0) {
    throw new FeedParseError('The response is not valid RSS or Atom XML.')
  }

  const root = doc.documentElement
  const rootName = root.tagName.toLowerCase()

  if (rootName === 'feed') {
    const title = text(child(root, 'title')) || hostOf(sourceUrl)
    const siteUrl = toSafeHttpUrl(atomLink(root), sourceUrl)

    return {
      title: collapseWhitespace(title),
      ...(siteUrl ? { siteUrl } : {}),
      items: parseAtomEntries(children(root, 'entry'), sourceUrl, title).slice(
        0,
        MAX_ITEMS_PER_FEED,
      ),
    }
  }

  if (rootName === 'rss' || rootName === 'rdf:rdf') {
    const channel = child(root, 'channel')
    const title =
      collapseWhitespace(text(channel && child(channel, 'title'))) ||
      hostOf(sourceUrl)
    const siteUrl = toSafeHttpUrl(
      text(channel && child(channel, 'link')),
      sourceUrl,
    )
    // RSS 2.0 nests items in <channel>; RSS 1.0 puts them next to it.
    const items = [
      ...(channel ? children(channel, 'item') : []),
      ...children(root, 'item'),
    ]

    return {
      title,
      ...(siteUrl ? { siteUrl } : {}),
      items: parseRssItems(items, sourceUrl, title).slice(
        0,
        MAX_ITEMS_PER_FEED,
      ),
    }
  }

  throw new FeedParseError(`Unsupported feed format <${root.tagName}>.`)
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}
