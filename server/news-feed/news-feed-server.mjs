#!/usr/bin/env node
/**
 * Linkhaven news feed proxy.
 *
 * Most RSS/Atom feeds don't send CORS headers, so a browser page can't read
 * them. This proxy fetches a feed server-side and returns it unchanged with
 * `access-control-allow-origin: *`. Linkhaven parses the XML itself.
 *
 *   GET http://127.0.0.1:8788/rss?url=<feed url>
 *   GET http://127.0.0.1:8788/health
 *
 *   npm run feed:news            (PORT / HOST env vars override defaults)
 */
import { createServer } from 'node:http'
import { pathToFileURL } from 'node:url'

import { FeedProxyError, fetchFeed } from './fetchFeed.mjs'
import { isAllowedOrigin } from './origins.mjs'

const PORT = Number(process.env.PORT ?? 8788)
const HOST = process.env.HOST ?? '127.0.0.1'

function sendJson(response, status, body) {
  response.writeHead(status, { 'content-type': 'application/json' })
  response.end(JSON.stringify(body))
}

/**
 * Handles `/rss` (and nothing else). Returns false for other paths, so the
 * combined Linkhaven server (server/linkhaven-server.mjs) can mount it.
 */
export function handleNewsRequest(request, response, url) {
  if (url.pathname !== '/rss') {
    return false
  }

  const origin = request.headers.origin

  response.setHeader('vary', 'origin')

  if (isAllowedOrigin(origin)) {
    response.setHeader('access-control-allow-origin', origin)
    response.setHeader('access-control-allow-headers', 'accept')
  } else if (origin) {
    // A browser page from another site: refuse instead of fetching for it.
    sendJson(response, 403, { error: 'Origin not allowed' })
    return true
  }

  if (request.method === 'OPTIONS') {
    response.writeHead(204)
    response.end()
    return true
  }

  if (request.method !== 'GET') {
    sendJson(response, 404, { error: 'Use GET /rss?url=<feed url>' })
    return true
  }

  const target = url.searchParams.get('url') ?? ''

  fetchFeed(target)
    .then(({ body, contentType, finalUrl }) => {
      response.writeHead(200, {
        'content-type': contentType,
        'cache-control': 'no-store',
        'x-feed-url': encodeURI(finalUrl),
      })
      response.end(body)
    })
    .catch((error) => {
      const status = error instanceof FeedProxyError ? error.status : 502

      console.warn(`[news] ${target}: ${error.message}`)
      sendJson(response, status, { error: error.message })
    })

  return true
}

/** The request's path and query; null for a malformed request-target. */
export function parseRequestUrl(request) {
  // Fixed base: the Host header is untrusted and only path + query matter.
  // A malformed request-target (e.g. "//[") must not crash the server.
  try {
    return new URL(request.url ?? '/', 'http://localhost')
  } catch {
    return null
  }
}

function startStandalone() {
  const server = createServer((request, response) => {
    const url = parseRequestUrl(request)

    if (!url) {
      sendJson(response, 400, { error: 'Malformed request URL' })
      return
    }

    if (url.pathname === '/health') {
      sendJson(response, 200, { ok: true })
      return
    }

    if (!handleNewsRequest(request, response, url)) {
      sendJson(response, 404, { error: 'Use GET /rss?url=<feed url>' })
    }
  })

  server.listen(PORT, HOST, () => {
    console.log(`Linkhaven news feed proxy on http://${HOST}:${PORT}/rss?url=…`)
  })
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  startStandalone()
}
