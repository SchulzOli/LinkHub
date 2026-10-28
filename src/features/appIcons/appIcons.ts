/**
 * Icons for self-hosted apps (Jellyfin, Radarr, Home Assistant, …) from the
 * dashboard-icons collection (homarr-labs/dashboard-icons, Apache-2.0).
 *
 * Homelab links rarely get an icon the usual way: they sit on local
 * addresses no favicon service knows, often on plain http. Instead a card
 * is matched to an icon by its title or address, entirely on the device
 * (the list of names ships with the app), and only that one icon is loaded
 * from the jsDelivr CDN, then kept on the device like any other icon.
 */

export const APP_ICON_CDN =
  'https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons'

export type AppIcon = { name: string; url: string }

type AppIconCard = { title: string; url: string; localUrl?: string }

/** The default port of an app, for links that are just an IP and a port. */
export const APP_DEFAULT_PORTS: Record<number, string> = {
  1880: 'node-red',
  2283: 'immich',
  2342: 'photoprism',
  3001: 'uptime-kuma',
  3579: 'ombi',
  4533: 'navidrome',
  5001: 'synology-dsm',
  5055: 'jellyseerr',
  5076: 'nzbhydra2',
  5678: 'n8n',
  6767: 'bazarr',
  6789: 'nzbget',
  6875: 'bookstack',
  7575: 'homarr',
  7878: 'radarr',
  8006: 'proxmox',
  8065: 'mattermost',
  8086: 'influxdb',
  8090: 'beszel',
  8096: 'jellyfin',
  8112: 'deluge',
  8123: 'home-assistant',
  8181: 'tautulli',
  8188: 'comfyui',
  8200: 'duplicati',
  8265: 'tdarr',
  8384: 'syncthing',
  8686: 'lidarr',
  8920: 'jellyfin',
  8971: 'frigate',
  8989: 'sonarr',
  9091: 'transmission',
  9117: 'jackett',
  9443: 'portainer',
  9696: 'prowlarr',
  9925: 'mealie',
  11434: 'ollama',
  13378: 'audiobookshelf',
  19999: 'netdata',
  32400: 'plex',
  61208: 'glances',
}

/** "Open WebUI", "open-webui" and "OpenWebUI" all become "openwebui". */
export function normalizeAppName(value: string) {
  return value
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

type IconEntry = { name: string; format: 'svg' | 'png' }

let indexPromise: Promise<Map<string, IconEntry>> | null = null

/** The name list is its own chunk, loaded the first time it's needed. */
function loadIndex() {
  indexPromise ??= import('./appIconNames').then(({ APP_ICON_NAMES }) => {
    const index = new Map<string, IconEntry>()

    for (const raw of APP_ICON_NAMES.split(' ')) {
      const pngOnly = raw.endsWith('*')
      const name = pngOnly ? raw.slice(0, -1) : raw
      const key = normalizeAppName(name)

      // "home-assistant" before "homeassistant-…": the first name wins.
      if (!index.has(key)) {
        index.set(key, { name, format: pngOnly ? 'png' : 'svg' })
      }
    }

    return index
  })

  return indexPromise
}

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/

/** Host labels and paths that say nothing about the app. */
const GENERIC_PARTS = new Set([
  'admin',
  'api',
  'app',
  'apps',
  'auth',
  'blog',
  'cloud',
  'dashboard',
  'de',
  'docs',
  'en',
  'files',
  'home',
  'index',
  'localhost',
  'login',
  'm',
  'mail',
  'media',
  'mobile',
  'my',
  'portal',
  'server',
  'shop',
  'static',
  'status',
  'ui',
  'web',
  'www',
])

function parseUrl(value: string | undefined) {
  if (!value) {
    return null
  }

  try {
    return new URL(value)
  } catch {
    return null
  }
}

function addressCandidates(url: URL) {
  const candidates: string[] = []
  const host = url.hostname.toLowerCase()

  // jellyfin.home.lan → jellyfin (not for IPs).
  if (!IPV4.test(host) && !host.includes(':')) {
    candidates.push(host.split('.')[0] ?? '')
  }

  // Apps behind a reverse proxy path: nas.lan/sonarr/
  candidates.push(url.pathname.split('/').find(Boolean) ?? '')

  return candidates.filter(
    (part) => part !== '' && !GENERIC_PARTS.has(part.toLowerCase()),
  )
}

/** What a card could be called, most telling first. */
export function appIconCandidates(card: AppIconCard): string[] {
  const title = card.title.trim()
  const bare = title
    // "Jellyfin (remote)", "Sonarr [4K]"
    .replace(/\s*[([{].*?[)\]}]\s*/g, ' ')
    // "Radarr - Filme", "Home Assistant | Haus", "Grafana: Server"
    .split(/\s+[-–|:·]\s+/)[0]
    .trim()
  const urls = [parseUrl(card.url), parseUrl(card.localUrl)].filter(
    (url): url is URL => url !== null,
  )
  const candidates = [
    title,
    bare,
    ...urls.flatMap(addressCandidates),
    // "Jellyfin Remote": its first word.
    bare.split(/\s+/)[0] ?? '',
  ]

  for (const url of urls) {
    const port = Number(url.port)

    if (APP_DEFAULT_PORTS[port]) {
      candidates.push(APP_DEFAULT_PORTS[port])
    }
  }

  return [
    ...new Set(
      candidates.map(normalizeAppName).filter((key) => key.length >= 2),
    ),
  ]
}

/** The icon that fits a card, or null. Works offline; loads nothing. */
export async function findAppIcon(card: AppIconCard): Promise<AppIcon | null> {
  const index = await loadIndex()

  for (const key of appIconCandidates(card)) {
    const entry = index.get(key)

    if (entry) {
      return {
        name: entry.name,
        url: `${APP_ICON_CDN}/${entry.format}/${entry.name}.${entry.format}`,
      }
    }
  }

  return null
}

/** Loads one icon; null when it fails. */
export async function fetchAppIcon(
  icon: AppIcon,
  fetchFn: typeof globalThis.fetch = globalThis.fetch,
): Promise<Blob | null> {
  try {
    const response = await fetchFn(icon.url, {
      cache: 'force-cache',
      signal: AbortSignal.timeout(8000),
    })

    if (!response.ok) {
      return null
    }

    const blob = await response.blob()

    return blob.size > 0 ? blob : null
  } catch {
    return null
  }
}

/** Finds and loads a card's app icon; null when none fits or it fails. */
export async function fetchAppIconBlob(
  card: AppIconCard,
  fetchFn: typeof globalThis.fetch = globalThis.fetch,
): Promise<{ icon: AppIcon; blob: Blob } | null> {
  const icon = await findAppIcon(card)
  const blob = icon ? await fetchAppIcon(icon, fetchFn) : null

  return icon && blob ? { icon, blob } : null
}
