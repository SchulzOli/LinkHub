/**
 * The sync API of the Linkhaven server. Devices store end-to-end encrypted
 * files in a vault; the server never sees a key or anything readable.
 *
 *   GET    /sync/v1/info
 *   GET    /sync/v1/vaults/<vaultId>/files/<path>    → 200 + ETag | 404
 *   PUT    /sync/v1/vaults/<vaultId>/files/<path>    If-Match / If-None-Match: *
 *   DELETE /sync/v1/vaults/<vaultId>/files/<path>
 *   DELETE /sync/v1/vaults/<vaultId>                 the whole vault
 *
 * Every vault request carries `Authorization: Bearer <access token>`. The
 * API speaks the same small subset as WebDAV (GET/PUT/DELETE with ETags),
 * so Linkhaven uses one sync engine for both.
 */
import { createRateLimiter } from './rateLimit.mjs'
import {
  createVaultStore,
  isValidFilePath,
  isValidVaultId,
  VaultError,
} from './vaultStore.mjs'

const PREFIX = '/sync/v1'

function sendJson(response, status, body) {
  response.writeHead(status, {
    'content-type': 'application/json',
    'cache-control': 'no-store',
  })
  response.end(JSON.stringify(body))
}

function readBody(request, limit) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0

    request.on('data', (chunk) => {
      size += chunk.length

      if (size > limit) {
        reject(new VaultError(413, 'This file is too large.'))
        request.destroy()
        return
      }

      chunks.push(chunk)
    })
    request.on('end', () => resolve(Buffer.concat(chunks)))
    request.on('error', reject)
  })
}

function bearerToken(request) {
  const header = request.headers.authorization ?? ''
  const match = /^Bearer ([A-Za-z0-9_-]{32,128})$/.exec(header)

  return match?.[1] ?? null
}

export function createSyncHandler({
  dataDir,
  isAllowedOrigin,
  maxVaultBytes,
  maxFileBytes = 25 * 1024 * 1024,
  trustProxy = false,
  limits = {},
  now,
}) {
  const store = createVaultStore({ dataDir, maxVaultBytes, maxFileBytes, now })
  const requests = createRateLimiter({
    max: limits.requests ?? 900,
    windowMs: limits.requestWindowMs ?? 10 * 60 * 1000,
    now,
  })
  const newVaults = createRateLimiter({
    max: limits.newVaults ?? 20,
    windowMs: 60 * 60 * 1000,
    now,
  })

  const clientIp = (request) => {
    const forwarded = trustProxy
      ? String(request.headers['x-forwarded-for'] ?? '')
          .split(',')[0]
          .trim()
      : ''

    return forwarded || request.socket.remoteAddress || 'unknown'
  }

  const handle = async (request, response, url) => {
    if (!url.pathname.startsWith(`${PREFIX}/`)) {
      return false
    }

    const origin = request.headers.origin

    response.setHeader('vary', 'origin')

    if (origin) {
      if (!isAllowedOrigin(origin)) {
        sendJson(response, 403, { error: 'Origin not allowed' })
        return true
      }

      response.setHeader('access-control-allow-origin', origin)
      response.setHeader(
        'access-control-allow-headers',
        'authorization, content-type, if-match, if-none-match',
      )
      response.setHeader(
        'access-control-allow-methods',
        'GET, PUT, DELETE, OPTIONS',
      )
      response.setHeader('access-control-expose-headers', 'etag')
      response.setHeader('access-control-max-age', '600')
    }

    if (request.method === 'OPTIONS') {
      response.writeHead(204)
      response.end()
      return true
    }

    const ip = clientIp(request)

    if (!requests.take(ip)) {
      response.setHeader('retry-after', '60')
      sendJson(response, 429, { error: 'Too many requests. Try again soon.' })
      return true
    }

    if (url.pathname === `${PREFIX}/info` && request.method === 'GET') {
      sendJson(response, 200, {
        ok: true,
        version: 1,
        maxVaultBytes,
        maxFileBytes,
      })
      return true
    }

    const match = /^\/sync\/v1\/vaults\/([^/]+)(?:\/files\/(.+))?$/.exec(
      url.pathname,
    )
    const vaultId = match?.[1]
    let path = null

    try {
      path = match?.[2] ? decodeURIComponent(match[2]) : null
    } catch {
      path = '\0'
    }

    if (
      !match ||
      !isValidVaultId(vaultId) ||
      (match[2] !== undefined && !isValidFilePath(path))
    ) {
      sendJson(response, 404, { error: 'Not found' })
      return true
    }

    const token = bearerToken(request)

    if (!token) {
      sendJson(response, 401, { error: 'Missing access token.' })
      return true
    }

    try {
      if (!path) {
        if (request.method !== 'DELETE') {
          sendJson(response, 405, { error: 'Use DELETE to remove a vault.' })
          return true
        }

        await store.destroy(vaultId, token)
        response.writeHead(204)
        response.end()
        return true
      }

      if (request.method === 'GET') {
        const file = await store.read(vaultId, path, token)

        if (!file) {
          sendJson(response, 404, { error: 'No such file.' })
          return true
        }

        response.writeHead(200, {
          'content-type': 'application/octet-stream',
          'cache-control': 'no-store',
          etag: file.etag,
        })
        response.end(file.data)
        return true
      }

      if (request.method === 'PUT') {
        const data = await readBody(request, maxFileBytes)
        const ifMatch = request.headers['if-match']
        const ifNoneMatch = request.headers['if-none-match']
        const isNewVault = !(await store.exists(vaultId))

        if (isNewVault && !newVaults.take(ip)) {
          sendJson(response, 429, { error: 'Too many new vaults. Try later.' })
          return true
        }

        const result = await store.write(vaultId, path, token, data, {
          ifMatch: typeof ifMatch === 'string' ? ifMatch : undefined,
          ifNoneMatch: ifNoneMatch === '*' ? '*' : undefined,
        })

        response.writeHead(result.created ? 201 : 204, { etag: result.etag })
        response.end()
        return true
      }

      if (request.method === 'DELETE') {
        const removed = await store.remove(vaultId, path, token)

        response.writeHead(removed ? 204 : 404)
        response.end()
        return true
      }

      sendJson(response, 405, { error: 'Method not allowed' })
    } catch (error) {
      if (error instanceof VaultError) {
        sendJson(response, error.status, { error: error.message })
      } else {
        console.error('[sync]', error)
        sendJson(response, 500, { error: 'Server error' })
      }
    }

    return true
  }

  return { handle, store }
}
