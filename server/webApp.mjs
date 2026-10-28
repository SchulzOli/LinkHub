/**
 * Serves the Linkhaven web app (the PWA build, `npm run build:pwa`) from the
 * Linkhaven server, so one server is all a self-hosted setup needs.
 *
 * index.html gets a `linkhaven-server` meta tag naming the services this
 * server runs; the app then uses this server for sync, news feeds and
 * charts without any address to type.
 */
import { readFile, stat } from 'node:fs/promises'
import { extname, join, resolve, sep } from 'node:path'

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.txt': 'text/plain; charset=utf-8',
}

// Hashed build output can be cached for good; everything else is checked
// on each load so a new version shows up (the service worker does the
// offline caching).
const IMMUTABLE = /^\/assets\//

function escapeAttribute(value) {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;')
}

/** index.html with the services of this server announced to the app. */
export function injectServerMeta(html, services) {
  const tag = `<meta name="linkhaven-server" content="${escapeAttribute(
    JSON.stringify(services),
  )}" />`

  return html.includes('</head>')
    ? html.replace('</head>', `    ${tag}\n  </head>`)
    : `${tag}\n${html}`
}

/**
 * Returns a request handler, or null when `dir` holds no web app build.
 * The handler answers GET and HEAD and returns false for anything else.
 */
export async function createWebAppHandler({ dir, services }) {
  const root = resolve(dir)
  let indexHtml

  try {
    indexHtml = injectServerMeta(
      await readFile(join(root, 'index.html'), 'utf8'),
      services,
    )
  } catch {
    return null
  }

  const send = (request, response, status, type, body, cache) => {
    response.writeHead(status, {
      'content-type': type,
      'content-length': Buffer.byteLength(body),
      'cache-control': cache,
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'no-referrer',
    })
    response.end(request.method === 'HEAD' ? undefined : body)
  }

  const sendIndex = (request, response) =>
    send(request, response, 200, CONTENT_TYPES['.html'], indexHtml, 'no-cache')

  return async function handleWebApp(request, response, url) {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return false
    }

    let pathname

    try {
      pathname = decodeURIComponent(url.pathname)
    } catch {
      return false
    }

    if (pathname === '/' || pathname === '/index.html') {
      sendIndex(request, response)
      return true
    }

    const file = resolve(root, `.${pathname}`)

    if (!file.startsWith(`${root}${sep}`)) {
      return false
    }

    try {
      const info = await stat(file)

      if (info.isFile()) {
        send(
          request,
          response,
          200,
          CONTENT_TYPES[extname(file).toLowerCase()] ??
            'application/octet-stream',
          await readFile(file),
          IMMUTABLE.test(pathname)
            ? 'public, max-age=31536000, immutable'
            : 'no-cache',
        )
        return true
      }

      if (info.isDirectory()) {
        if (!pathname.endsWith('/')) {
          // One leading slash, so the redirect can't point at another host.
          response.writeHead(301, {
            location: `/${url.pathname.replace(/^\/+/, '')}/`,
          })
          response.end()
          return true
        }

        const index = join(file, 'index.html')
        const html = await readFile(index)

        send(request, response, 200, CONTENT_TYPES['.html'], html, 'no-cache')
        return true
      }
    } catch {
      // Not a file of the build: fall through.
    }

    return false
  }
}
