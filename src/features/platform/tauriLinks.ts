import { isTauriApp } from '../sync/syncPlatform'

/**
 * In the Tauri app, web links open in the system browser: the app window
 * itself must never navigate away from Linkhaven. Clicks are caught once,
 * at the document, so every link (cards, feeds, help) is covered.
 */
export function installTauriLinkHandling() {
  if (!isTauriApp()) {
    return
  }

  const openExternal = (url: string) => {
    void import('@tauri-apps/plugin-opener').then(({ openUrl }) => openUrl(url))
  }

  const handleClick = (event: MouseEvent) => {
    if (event.defaultPrevented || event.button > 1) {
      return
    }

    const anchor = (event.target as Element | null)?.closest?.('a[href]')

    if (!(anchor instanceof HTMLAnchorElement)) {
      return
    }

    const url = new URL(anchor.href, window.location.href)

    if (
      (url.protocol === 'http:' || url.protocol === 'https:') &&
      url.origin !== window.location.origin
    ) {
      event.preventDefault()
      openExternal(url.toString())
    }
  }

  document.addEventListener('click', handleClick)
  // Middle click.
  document.addEventListener('auxclick', handleClick)
  window.open = ((url?: string | URL) => {
    if (url) {
      openExternal(String(url))
    }

    return null
  }) as typeof window.open
}
