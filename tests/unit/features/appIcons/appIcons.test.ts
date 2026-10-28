import { describe, expect, it, vi } from 'vitest'

import { APP_ICON_NAMES } from '../../../../src/features/appIcons/appIconNames'
import {
  APP_DEFAULT_PORTS,
  APP_ICON_CDN,
  appIconCandidates,
  fetchAppIconBlob,
  findAppIcon,
} from '../../../../src/features/appIcons/appIcons'
import { fetchCardIcon } from '../../../../src/features/favicon/faviconCache'
import { isPrivateHost } from '../../../../src/features/links/urlValidation'

const name = async (title: string, url = 'http://192.168.1.20:9999/') =>
  (await findAppIcon({ title, url }))?.name ?? null

describe('app icons', () => {
  it('matches homelab cards by their title', async () => {
    expect(await name('Radarr')).toBe('radarr')
    expect(await name('Homeassistant')).toBe('home-assistant')
    expect(await name('Home Assistant')).toBe('home-assistant')
    expect(await name('OpenWebUI')).toBe('open-webui')
    expect(await name('Jellyfin (remote)')).toBe('jellyfin')
    expect(await name('Jellyfin Remote')).toBe('jellyfin')
    expect(await name('Sonarr - Serien')).toBe('sonarr')
    expect(await name('Komodo')).toBe('komodo')
    expect(await name('Schaltzentrale (lokal)')).toBeNull()
  })

  it('falls back to the address: host name, path, default port', async () => {
    expect(await name('Filme', 'https://radarr.home.lan/')).toBe('radarr')
    expect(await name('Serien', 'https://nas.lan/sonarr/')).toBe('sonarr')
    expect(await name('Medien', 'http://192.168.1.5:8096/')).toBe('jellyfin')
    expect(
      await findAppIcon({
        title: 'Haus',
        url: 'https://haus.example.com/',
        localUrl: 'http://192.168.1.9:8123/',
      }),
    ).toMatchObject({ name: 'home-assistant' })
    // Generic parts of an address say nothing.
    expect(
      appIconCandidates({ title: 'X', url: 'https://www.example.com/' }),
    ).not.toContain('www')
  })

  it('every default port points at an existing icon', () => {
    const names = new Set(
      APP_ICON_NAMES.split(' ').map((raw) => raw.replace(/\*$/, '')),
    )

    for (const icon of Object.values(APP_DEFAULT_PORTS)) {
      expect(names).toContain(icon)
    }
  })

  it('loads the icon from jsDelivr, SVG where there is one', async () => {
    const fetchFn = vi.fn(async () => new Response('<svg/>'))
    const result = await fetchAppIconBlob(
      { title: 'Radarr', url: 'http://10.0.0.1/' },
      fetchFn as unknown as typeof fetch,
    )

    expect(fetchFn).toHaveBeenCalledWith(
      `${APP_ICON_CDN}/svg/radarr.svg`,
      expect.anything(),
    )
    expect(result?.icon.name).toBe('radarr')
  })
})

describe('card icons', () => {
  it('tries the app icon first and asks nobody when nothing is allowed', async () => {
    const fetchFn = vi.fn(async () => new Response('x'.repeat(200)))
    const card = { title: 'Jellyfin', url: 'http://192.168.1.5:8096/' }

    expect(
      await fetchCardIcon(
        card,
        { site: false, google: false, apps: false },
        fetchFn as unknown as typeof fetch,
      ),
    ).toBeNull()
    expect(fetchFn).not.toHaveBeenCalled()

    const icon = await fetchCardIcon(
      card,
      { site: false, google: true, apps: true },
      fetchFn as unknown as typeof fetch,
    )

    expect(icon?.label).toBe('jellyfin')
    expect(fetchFn).toHaveBeenCalledTimes(1)
  })

  it("doesn't ask Google about local addresses", async () => {
    const fetchFn = vi.fn(async () => new Response('x'.repeat(200)))

    expect(
      await fetchCardIcon(
        { title: 'Schaltzentrale', url: 'http://192.168.1.7:3000/' },
        { site: false, google: true, apps: false },
        fetchFn as unknown as typeof fetch,
      ),
    ).toBeNull()
    expect(fetchFn).not.toHaveBeenCalled()
    expect(isPrivateHost('192.168.1.7')).toBe(true)
    expect(isPrivateHost('nas.local')).toBe(true)
    expect(isPrivateHost('router')).toBe(true)
    expect(isPrivateHost('jellyfin.tail1234.ts.net')).toBe(true)
    expect(isPrivateHost('example.com')).toBe(false)
  })
})
