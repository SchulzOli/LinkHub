/**
 * Lets the installable web app (PWA) open offline. Only the PWA build has a
 * service worker; the extension and the dev server don't need one.
 */
export function registerServiceWorker() {
  if (import.meta.env.MODE !== 'pwa' || !('serviceWorker' in navigator)) {
    return
  }

  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('./sw.js').catch(() => {
      // Without it the app still works, just not offline.
    })
  })
}
