import type { SyncFetch } from './webdavTransport'

/**
 * How sync requests leave the app on each platform:
 *
 * - Tauri app: through Tauri's HTTP plugin, which is not bound by CORS
 * - browser extension: plain fetch, after the user grants access to the
 *   sync server's address (an optional host permission)
 * - web app: plain fetch; the server must allow this site (CORS)
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

export function isTauriApp() {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

function originPattern(url: string) {
  return `${new URL(url).origin}/*`
}

/**
 * Asks for access to the sync server where the platform needs it. Must run
 * straight from a click: browsers only show the prompt for user actions.
 */
export async function requestSyncServerAccess(url: string) {
  if (isTauriApp()) {
    return true
  }

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

  if (!permissions || isTauriApp()) {
    return
  }

  try {
    await permissions.remove({ origins: [originPattern(url)] })
  } catch {
    // Already gone.
  }
}

export async function getSyncFetch(): Promise<SyncFetch> {
  if (isTauriApp()) {
    const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http')

    return tauriFetch as SyncFetch
  }

  return (...args) => fetch(...args)
}
