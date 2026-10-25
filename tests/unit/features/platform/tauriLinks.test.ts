import { afterEach, describe, expect, it, vi } from 'vitest'

const openUrl = vi.fn()

vi.mock('@tauri-apps/plugin-opener', () => ({ openUrl }))

describe('links in the Tauri app', () => {
  afterEach(() => {
    delete (window as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__
    document.body.innerHTML = ''
  })

  it('opens web links in the system browser, not in the app window', async () => {
    ;(window as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = {}

    const { installTauriLinkHandling } =
      await import('../../../../src/features/platform/tauriLinks')

    installTauriLinkHandling()
    document.body.innerHTML =
      '<a href="https://docs.example.com/page" target="_blank"><span>Docs</span></a>'

    const event = new MouseEvent('click', { bubbles: true, cancelable: true })

    document.querySelector('span')?.dispatchEvent(event)
    await vi.waitFor(() =>
      expect(openUrl).toHaveBeenCalledWith('https://docs.example.com/page'),
    )
    expect(event.defaultPrevented).toBe(true)
  })
})
