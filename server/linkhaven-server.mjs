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
 *   /            the web app, when a build is there (self-hosting)
 *
 *   npm run server
 *
 * Environment (defaults in brackets):
 *   PORT [8790], HOST [127.0.0.1]
 *   SYNC [on], SYNC_DATA_DIR [./data], SYNC_MAX_VAULT_MB [100],
 *   SYNC_MAX_FILE_MB [25], SYNC_IDLE_DAYS [365]
 *   NEWS_PROXY [on], CHARTS [on]
 *   WEB_APP [on], WEB_APP_DIR [./web next to this file, else ../dist-pwa]
 *   LINKHAVEN_ALLOWED_ORIGINS  extra web app origins, comma-separated
 *   TRUST_PROXY [off]  use X-Forwarded-For (behind Caddy/nginx) for limits
 */
import { existsSync } from 'node:fs'
import { createServer } from 'node:http'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import {
  attachChartSockets,
  handleChartRequest,
} from './chart-feed/chart-feed-server.mjs'
import {
  handleNewsRequest,
  parseRequestUrl,
} from './news-feed/news-feed-server.mjs'
import { isLinkhavenOrigin, isSameOrigin, parseOriginList } from './origins.mjs'
import { createSyncHandler } from './sync/syncHandler.mjs'
import { createWebAppHandler } from './webApp.mjs'

const SERVER_DIR = dirname(fileURLToPath(import.meta.url))

/** The Docker image puts the build in ./web; in the repository it's dist-pwa. */
function defaultWebAppDir() {
  const bundled = resolve(SERVER_DIR, 'web')

  return existsSync(bundled) ? bundled : resolve(SERVER_DIR, '../dist-pwa')
}

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
    webApp: flag(env.WEB_APP, true),
    webAppDir: env.WEB_APP_DIR ? resolve(env.WEB_APP_DIR) : defaultWebAppDir(),
  }
}

export function createLinkhavenServer(config = readServerConfig()) {
  // The web app served by this server itself is always allowed.
  const isAllowedOrigin = (origin, request) =>
    isLinkhavenOrigin(origin, config.extraOrigins) ||
    isSameOrigin(origin, request)
  const sync = config.sync
    ? createSyncHandler({
        dataDir: config.dataDir,
        isAllowedOrigin,
        maxVaultBytes: config.maxVaultBytes,
        maxFileBytes: config.maxFileBytes,
        trustProxy: config.trustProxy,
      })
    : null
  const webApp = config.webApp
    ? createWebAppHandler({
        dir: config.webAppDir,
        services: {
          sync: config.sync,
          newsProxy: config.newsProxy,
          charts: config.charts,
        },
      })
    : Promise.resolve(null)

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
            webApp: Boolean(await webApp),
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

      const serveWebApp = await webApp

      if (serveWebApp && (await serveWebApp(request, response, url))) {
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
    const hasWebApp = config.webApp && existsSync(config.webAppDir)
    const parts = [
      hasWebApp ? `web app ${base}/ (from ${config.webAppDir})` : null,
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
