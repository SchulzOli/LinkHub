import {
  SyncHttpError,
  SyncWriteConflictError,
  type SyncFetch,
  type SyncTransport,
} from './webdavTransport'

/**
 * Talks to a Linkhaven server's sync API (server/sync/syncHandler.mjs).
 * It mirrors the WebDAV transport, so the same engine syncs through both.
 */

/**
 * The public Linkhaven sync server, set at build time with
 * VITE_SYNC_SERVER_URL; empty means users enter a server themselves.
 */
export const DEFAULT_SYNC_SERVER_URL = String(
  import.meta.env.VITE_SYNC_SERVER_URL ?? '',
).trim()

export function normalizeSyncServerUrl(value: string) {
  const url = new URL(
    /^https?:\/\//i.test(value.trim())
      ? value.trim()
      : `https://${value.trim()}`,
  )

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('Use an https:// server address.')
  }

  url.hash = ''
  url.search = ''

  if (!url.pathname.endsWith('/')) {
    url.pathname = `${url.pathname}/`
  }

  return url.toString()
}

function describeStatus(status: number) {
  switch (status) {
    case 401:
    case 403:
      return 'The server refused this sync code.'
    case 413:
      return 'An image is too large for the sync server.'
    case 429:
      return 'The sync server is busy. Linkhaven will try again later.'
    case 507:
      return 'Your sync space on the server is full.'
    default:
      return `The sync server answered with status ${status}.`
  }
}

export function createServerTransport(input: {
  serverUrl: string
  vaultId: string
  token: string
  fetch?: SyncFetch
}): SyncTransport & { destroyVault: () => Promise<void> } {
  const base = new URL(
    `sync/v1/vaults/${input.vaultId}/`,
    normalizeSyncServerUrl(input.serverUrl),
  ).toString()
  const doFetch = input.fetch ?? ((...args) => fetch(...args))

  const request = async (
    method: string,
    path: string,
    init: { body?: Uint8Array; headers?: Record<string, string> } = {},
  ) => {
    try {
      return await doFetch(
        path
          ? new URL(`files/${encodeURIComponent(path)}`, base).toString()
          : base.replace(/\/$/, ''),
        {
          method,
          headers: { Authorization: `Bearer ${input.token}`, ...init.headers },
          body: init.body as BodyInit | undefined,
          cache: 'no-store',
          credentials: 'omit',
        },
      )
    } catch {
      throw new SyncHttpError(
        0,
        'The sync server could not be reached. Check the address and your connection.',
      )
    }
  }

  return {
    url: base,
    read: async (path) => {
      const response = await request('GET', path)

      if (response.status === 404) {
        return null
      }

      if (!response.ok) {
        throw new SyncHttpError(
          response.status,
          describeStatus(response.status),
        )
      }

      return {
        data: new Uint8Array(await response.arrayBuffer()),
        etag: response.headers.get('ETag'),
      }
    },
    write: async (path, data, options = {}) => {
      const headers: Record<string, string> = {
        'Content-Type': 'application/octet-stream',
      }

      if (options.ifMatch === null) {
        headers['If-None-Match'] = '*'
      } else if (options.ifMatch) {
        headers['If-Match'] = options.ifMatch
      }

      const response = await request('PUT', path, { body: data, headers })

      if (response.status === 412) {
        throw new SyncWriteConflictError()
      }

      if (!response.ok) {
        throw new SyncHttpError(
          response.status,
          describeStatus(response.status),
        )
      }
    },
    remove: async (path) => {
      const response = await request('DELETE', path)

      if (!response.ok && response.status !== 404) {
        throw new SyncHttpError(
          response.status,
          describeStatus(response.status),
        )
      }
    },
    // The server has no folders.
    ensureFolder: async () => undefined,
    destroyVault: async () => {
      const response = await request('DELETE', '')

      if (!response.ok && response.status !== 404) {
        throw new SyncHttpError(
          response.status,
          describeStatus(response.status),
        )
      }
    },
  }
}
