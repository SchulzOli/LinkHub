/**
 * The sync API of the Linkhaven server. Devices store end-to-end encrypted
 * files in a vault; the server never sees a key or anything readable.
 *
 *   GET    /sync/v1/info
 *   POST   /sync/v1/vaults/<vaultId>/devices           join token: add a device
 *   GET    /sync/v1/vaults/<vaultId>/devices           the device list
 *   DELETE /sync/v1/vaults/<vaultId>/devices/<deviceId> remove a device
 *   PUT    /sync/v1/vaults/<vaultId>/join-token        new sync code's token
 *   GET    /sync/v1/vaults/<vaultId>/files/<path>      → 200 + ETag | 404
 *   PUT    /sync/v1/vaults/<vaultId>/files/<path>      If-Match / If-None-Match: *
 *   DELETE /sync/v1/vaults/<vaultId>/files/<path>
 *   DELETE /sync/v1/vaults/<vaultId>                   the whole vault
 *
 * Requests carry `Authorization: Bearer <token>`: the device's own token,
 * or the join token from the sync code to add a device. The file routes are
 * the same small subset of WebDAV the app speaks, so one sync engine serves
 * both.
 */
import { createRateLimiter } from './rateLimit.mjs'
import {
  createVaultStore,
  isValidDeviceId,
  isValidFilePath,
  isValidVaultId,
  VaultError,
} from './vaultStore.mjs'

const PREFIX = '/sync/v1'
const MAX_JSON_BYTES = 8 * 1024

function sendJson(response, status, body) {
  response.writeHead(status, {
    'content-type': 'application/json',
    'cache-control': 'no-store',
  })
  response.end(JSON.stringify(body))
}

function noContent(response, status = 204, headers = {}) {
  response.writeHead(status, headers)
  response.end()
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

async function readJson(request) {
  try {
    return JSON.parse((await readBody(request, MAX_JSON_BYTES)).toString())
  } catch (error) {
    if (error instanceof VaultError) {
      throw error
    }

    throw new VaultError(400, 'Invalid JSON.')
  }
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

  const route = async (request, response, url, ip) => {
    if (url.pathname === `${PREFIX}/info` && request.method === 'GET') {
      sendJson(response, 200, {
        ok: true,
        version: 2,
        maxVaultBytes,
        maxFileBytes,
      })
      return
    }

    const match =
      /^\/sync\/v1\/vaults\/([^/]+)(?:\/(devices|join-token|files)(?:\/(.+))?)?$/.exec(
        url.pathname,
      )
    const vaultId = match?.[1]

    if (!match || !isValidVaultId(vaultId)) {
      sendJson(response, 404, { error: 'Not found' })
      return
    }

    const [, , section, rest] = match
    const token = bearerToken(request)

    if (!token) {
      sendJson(response, 401, { error: 'Missing access token.' })
      return
    }

    if (!section) {
      if (request.method !== 'DELETE') {
        sendJson(response, 405, { error: 'Use DELETE to remove a sync.' })
        return
      }

      await store.destroy(vaultId, token)
      noContent(response)
      return
    }

    if (section === 'devices' && !rest) {
      if (request.method === 'GET') {
        sendJson(response, 200, {
          devices: await store.listDevices(vaultId, token),
        })
        return
      }

      if (request.method === 'POST') {
        const body = await readJson(request)

        if (body?.create === true && !newVaults.take(ip)) {
          sendJson(response, 429, {
            error: 'Too many new syncs. Try again later.',
          })
          return
        }

        const result = await store.registerDevice(vaultId, token, {
          deviceId: body?.deviceId,
          deviceToken: body?.deviceToken,
          publicKey: body?.publicKey,
          label: body?.label ?? '',
          create: body?.create === true,
        })

        noContent(response, result.created ? 201 : 204)
        return
      }
    }

    if (section === 'devices' && rest && request.method === 'DELETE') {
      if (!isValidDeviceId(rest)) {
        sendJson(response, 404, { error: 'Not found' })
        return
      }

      const removed = await store.removeDevice(vaultId, token, rest)

      noContent(response, removed ? 204 : 404)
      return
    }

    if (section === 'join-token' && !rest && request.method === 'PUT') {
      const body = await readJson(request)

      await store.setJoinToken(vaultId, token, body?.joinToken)
      noContent(response)
      return
    }

    if (section === 'files' && rest) {
      let path

      try {
        path = decodeURIComponent(rest)
      } catch {
        path = null
      }

      if (!isValidFilePath(path)) {
        sendJson(response, 404, { error: 'Not found' })
        return
      }

      if (request.method === 'GET') {
        const file = await store.read(vaultId, path, token)

        if (!file) {
          sendJson(response, 404, { error: 'No such file.' })
          return
        }

        response.writeHead(200, {
          'content-type': 'application/octet-stream',
          'cache-control': 'no-store',
          etag: file.etag,
        })
        response.end(file.data)
        return
      }

      if (request.method === 'PUT') {
        const data = await readBody(request, maxFileBytes)
        const ifMatch = request.headers['if-match']
        const result = await store.write(vaultId, path, token, data, {
          ifMatch: typeof ifMatch === 'string' ? ifMatch : undefined,
          ifNoneMatch:
            request.headers['if-none-match'] === '*' ? '*' : undefined,
        })

        noContent(response, result.created ? 201 : 204, { etag: result.etag })
        return
      }

      if (request.method === 'DELETE') {
        const removed = await store.remove(vaultId, path, token)

        noContent(response, removed ? 204 : 404)
        return
      }
    }

    sendJson(response, 405, { error: 'Method not allowed' })
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
        'GET, POST, PUT, DELETE, OPTIONS',
      )
      response.setHeader('access-control-expose-headers', 'etag')
      response.setHeader('access-control-max-age', '600')
    }

    if (request.method === 'OPTIONS') {
      noContent(response)
      return true
    }

    const ip = clientIp(request)

    if (!requests.take(ip)) {
      response.setHeader('retry-after', '60')
      sendJson(response, 429, { error: 'Too many requests. Try again soon.' })
      return true
    }

    try {
      await route(request, response, url, ip)
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
