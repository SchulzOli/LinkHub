import type { SyncFetch } from './webdavTransport'

/**
 * How sync requests leave the app:
 *
 * - browser extension: after the user grants access to the sync server's
 *   address (an optional host permission), which also lifts CORS
 * - web app (PWA): the server must allow this site (CORS)
 */

type ChromePermissions = {
  request: (permissions: { origins: string[] }) => Promise<boolean>
  remove: (permissions: { origins: string[] }) => Promise<boolean>
}

function getExtensionPermissions(): ChromePermissions | null {
  const scope = globalThis as {
    browser?: { permissions?: ChromePermissions }
    chrome?: { permissions?: ChromePermissions }
  }

  return scope.browser?.permissions ?? scope.chrome?.permissions ?? null
}

function originPattern(url: string) {
  return `${new URL(url).origin}/*`
}

/**
 * Asks for access to the sync server where the platform needs it. Must run
 * straight from a click: browsers only show the prompt for user actions.
 */
export async function requestSyncServerAccess(url: string) {
  const permissions = getExtensionPermissions()

  if (!permissions) {
    return true
  }

  try {
    return await permissions.request({ origins: [originPattern(url)] })
  } catch {
    return false
  }
}

export async function releaseSyncServerAccess(url: string) {
  const permissions = getExtensionPermissions()

  if (!permissions) {
    return
  }

  try {
    await permissions.remove({ origins: [originPattern(url)] })
  } catch {
    // Already gone.
  }
}

export async function getSyncFetch(): Promise<SyncFetch> {
  return (...args) => fetch(...args)
}
