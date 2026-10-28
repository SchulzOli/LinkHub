import { isLinkhavenOrigin, parseOriginList } from '../origins.mjs'

/**
 * Only Linkhaven may read through the proxy: the web app, the browser
 * extension and a dev server or preview on localhost. Other web pages get
 * no CORS header, so they can't use the proxy from a visitor's browser.
 * FEED_ALLOWED_ORIGINS (comma-separated) replaces the default rule.
 */
const EXTRA_ORIGINS = parseOriginList(process.env.FEED_ALLOWED_ORIGINS)

export function isAllowedOrigin(origin, extra = EXTRA_ORIGINS) {
  if (!origin) {
    return false
  }

  if (extra.length > 0) {
    return extra.includes(origin)
  }

  return isLinkhavenOrigin(origin)
}
