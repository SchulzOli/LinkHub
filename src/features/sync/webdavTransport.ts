/**
 * Talks to a WebDAV folder the user owns (Nextcloud, ownCloud, a NAS,
 * Box, any WebDAV server). Only GET, PUT, DELETE and MKCOL are used, with
 * ETags so two devices never overwrite each other's upload unseen.
 */

export type SyncFetch = typeof fetch

export type SyncFile = { data: Uint8Array; etag: string | null }

export type SyncTransport = {
  /** The folder URL, for display and permissions. */
  url: string
  read: (path: string) => Promise<SyncFile | null>
  /**
   * Writes a file. With `ifMatch` the write only happens while the file
   * still has that ETag; `null` means it must not exist yet.
   */
  write: (
    path: string,
    data: Uint8Array,
    options?: { ifMatch?: string | null },
  ) => Promise<void>
  remove: (path: string) => Promise<void>
  ensureFolder: (path: string) => Promise<void>
}

export class SyncHttpError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'SyncHttpError'
    this.status = status
  }
}

/** Another device wrote the file first; read it again and merge. */
export class SyncWriteConflictError extends Error {
  constructor() {
    super('The sync file changed on the server.')
    this.name = 'SyncWriteConflictError'
  }
}

export function normalizeSyncFolderUrl(value: string) {
  const url = new URL(value.trim())

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('Use an https:// WebDAV address.')
  }

  url.hash = ''
  url.search = ''

  if (!url.pathname.endsWith('/')) {
    url.pathname = `${url.pathname}/`
  }

  return url.toString()
}

function describeStatus(status: number) {
  if (status === 401 || status === 403) {
    return 'The server refused the login. Check user name and app password.'
  }

  if (status === 404 || status === 409) {
    return 'The folder was not found on the server.'
  }

  if (status === 507) {
    return 'The server has no space left.'
  }

  return `The server answered with status ${status}.`
}

export function createWebDavTransport(input: {
  url: string
  username: string
  password: string
  fetch?: SyncFetch
}): SyncTransport {
  const folderUrl = normalizeSyncFolderUrl(input.url)
  const doFetch = input.fetch ?? ((...args) => fetch(...args))
  const authorization =
    input.username || input.password
      ? `Basic ${btoa(
          unescape(encodeURIComponent(`${input.username}:${input.password}`)),
        )}`
      : null

  const request = async (
    method: string,
    path: string,
    init: { body?: Uint8Array; headers?: Record<string, string> } = {},
  ) => {
    const headers: Record<string, string> = { ...init.headers }

    if (authorization) {
      headers.Authorization = authorization
    }

    try {
      return await doFetch(new URL(path, folderUrl).toString(), {
        method,
        headers,
        body: init.body as BodyInit | undefined,
        cache: 'no-store',
        credentials: 'omit',
      })
    } catch {
      throw new SyncHttpError(
        0,
        'The server could not be reached. Check the address; in a browser tab the server must also allow this site (CORS).',
      )
    }
  }

  return {
    url: folderUrl,
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
    ensureFolder: async (path) => {
      const response = await request('MKCOL', path)

      // 405: it already exists.
      if (!response.ok && response.status !== 405) {
        throw new SyncHttpError(
          response.status,
          describeStatus(response.status),
        )
      }
    },
  }
}
