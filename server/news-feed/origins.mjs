/**
 * Only LinkHub may read through the proxy: the dev server / preview on
 * localhost and the browser extension. Other web pages get no CORS header,
 * so they can't use the proxy from a visitor's browser.
 * FEED_ALLOWED_ORIGINS (comma-separated) replaces the default rule.
 */
const EXTRA_ORIGINS = (process.env.FEED_ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

export function isAllowedOrigin(origin, extra = EXTRA_ORIGINS) {
  if (!origin) {
    return false
  }

  if (extra.length > 0) {
    return extra.includes(origin)
  }

  return /^(https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?|(chrome|moz|safari-web)-extension:\/\/[a-z0-9-]+|extension:\/\/[a-z0-9-]+)$/i.test(
    origin,
  )
}
