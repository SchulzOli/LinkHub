/**
 * Which web pages may use a Linkhaven server from a visitor's browser:
 * Linkhaven itself (the web app, the browser extension, a dev server on
 * localhost). Other sites get no CORS header and are refused, so they can't
 * use someone's server through their visitors.
 */

/** The published web app. Add your own with LINKHAVEN_ALLOWED_ORIGINS. */
export const LINKHAVEN_WEB_ORIGINS = ['https://schulzoli.github.io']

const LOCAL_OR_EXTENSION =
  /^(https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?|(chrome|moz|safari-web)-extension:\/\/[a-z0-9-]+|extension:\/\/[a-z0-9-]+)$/i

export function parseOriginList(value) {
  return String(value ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
}

/** Linkhaven's own origins plus `extra`. */
export function isLinkhavenOrigin(origin, extra = []) {
  if (!origin) {
    return false
  }

  return (
    LOCAL_OR_EXTENSION.test(origin) ||
    LINKHAVEN_WEB_ORIGINS.includes(origin) ||
    extra.includes(origin)
  )
}
