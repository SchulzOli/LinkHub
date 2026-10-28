#!/usr/bin/env node
/**
 * The Linkhaven server: one process for every optional service the app can
 * use. Each part can be switched off; all of it runs the same on your own
 * computer, a NAS or a public host (see doc/SERVER.md).
 *
 *   /sync/v1/…   device sync: stores end-to-end encrypted vaults
 *   /rss         news feed proxy (RSS/Atom without CORS)
 *   /feed /sse /search   chart feed (live market data)
 *   /health
 *
 *   npm run server
 *
 * Environment (defaults in brackets):
 *   PORT [8790], HOST [127.0.0.1]
 *   SYNC [on], SYNC_DATA_DIR [./data], SYNC_MAX_VAULT_MB [100],
 *   SYNC_MAX_FILE_MB [25], SYNC_IDLE_DAYS [365]
 *   NEWS_PROXY [on], CHARTS [on]
 *   LINKHAVEN_ALLOWED_ORIGINS  extra web app origins, comma-separated
 *   TRUST_PROXY [off]  use X-Forwarded-For (behind Caddy/nginx) for limits
 */
import { createServer } from 'node:http'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import {
  attachChartSockets,
  handleChartRequest,
} from './chart-feed/chart-feed-server.mjs'
import {
  handleNewsRequest,
  parseRequestUrl,
} from './news-feed/news-feed-server.mjs'
import { isLinkhavenOrigin, parseOriginList } from './origins.mjs'
import { createSyncHandler } from './sync/syncHandler.mjs'

const DAY_MS = 24 * 60 * 60 * 1000

function flag(value, fallback) {
  if (value === undefined || value === '') {
    return fallback
  }

  return !/^(0|off|false|no)$/i.test(value)
}

export function readServerConfig(env = process.env) {
  return {
    port: Number(env.PORT ?? 8790),
    host: env.HOST ?? '127.0.0.1',
    sync: flag(env.SYNC, true),
    dataDir: resolve(env.SYNC_DATA_DIR ?? 'data'),
    maxVaultBytes: Number(env.SYNC_MAX_VAULT_MB ?? 100) * 1024 * 1024,
    maxFileBytes: Number(env.SYNC_MAX_FILE_MB ?? 25) * 1024 * 1024,
    idleDays: Number(env.SYNC_IDLE_DAYS ?? 365),
    newsProxy: flag(env.NEWS_PROXY, true),
    charts: flag(env.CHARTS, true),
    extraOrigins: parseOriginList(env.LINKHAVEN_ALLOWED_ORIGINS),
    trustProxy: flag(env.TRUST_PROXY, false),
  }
}

export function createLinkhavenServer(config = readServerConfig()) {
  const isAllowedOrigin = (origin) =>
    isLinkhavenOrigin(origin, config.extraOrigins)
  const sync = config.sync
    ? createSyncHandler({
        dataDir: config.dataDir,
        isAllowedOrigin,
        maxVaultBytes: config.maxVaultBytes,
        maxFileBytes: config.maxFileBytes,
        trustProxy: config.trustProxy,
      })
    : null

  const server = createServer(async (request, response) => {
    const url = parseRequestUrl(request)

    if (!url) {
      response.writeHead(400, { 'content-type': 'application/json' })
      response.end(JSON.stringify({ error: 'Malformed request URL' }))
      return
    }

    if (url.pathname === '/health') {
      response.writeHead(200, {
        'access-control-allow-origin': '*',
        'content-type': 'application/json',
      })
      response.end(
        JSON.stringify({
          ok: true,
          services: {
            sync: Boolean(sync),
            newsProxy: config.newsProxy,
            charts: config.charts,
          },
        }),
      )
      return
    }

    try {
      if (sync && (await sync.handle(request, response, url))) {
        return
      }

      if (config.newsProxy && handleNewsRequest(request, response, url)) {
        return
      }

      if (config.charts && handleChartRequest(request, response, url)) {
        return
      }
    } catch (error) {
      console.error(error)

      if (!response.headersSent) {
        response.writeHead(500, { 'content-type': 'application/json' })
        response.end(JSON.stringify({ error: 'Server error' }))
      }
      return
    }

    response.writeHead(404, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ error: 'Not found' }))
  })

  if (config.charts) {
    attachChartSockets(server)
  }

  let cleanupTimer = null

  if (sync && config.idleDays > 0) {
    const cleanup = () =>
      sync.store
        .removeIdleVaults(config.idleDays * DAY_MS)
        .then((removed) => {
          if (removed > 0) {
            console.log(`[sync] removed ${removed} idle vault(s)`)
          }
        })
        .catch((error) => console.error('[sync] cleanup failed', error))

    cleanupTimer = setInterval(cleanup, DAY_MS)
    cleanupTimer.unref()
    void cleanup()
  }

  server.on('close', () => {
    if (cleanupTimer) {
      clearInterval(cleanupTimer)
    }
  })

  return server
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const config = readServerConfig()
  const server = createLinkhavenServer(config)

  server.listen(config.port, config.host, () => {
    const base = `http://${config.host}:${config.port}`
    const parts = [
      config.sync ? `sync ${base}/sync/v1 (data in ${config.dataDir})` : null,
      config.newsProxy ? `news proxy ${base}/rss` : null,
      config.charts ? `charts ws://${config.host}:${config.port}/feed` : null,
    ].filter(Boolean)

    console.log(`Linkhaven server on ${base}`)

    for (const part of parts) {
      console.log(`  · ${part}`)
    }
  })
}
