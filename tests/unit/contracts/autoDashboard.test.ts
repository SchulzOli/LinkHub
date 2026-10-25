import { describe, expect, it } from 'vitest'

import {
  coerceAutoDashboardSettings,
  DEFAULT_AUTO_DASHBOARD_SETTINGS,
  isAutoDashboardStale,
  parseAutoListDraft,
  withSetupSwitches,
} from '../../../src/contracts/autoDashboard'
import {
  loadAutoDashboardSettings,
  saveAutoDashboardSettings,
} from '../../../src/storage/autoDashboardRepository'

describe('auto dashboard settings', () => {
  it('is off with only the Linkhaven source by default', () => {
    expect(DEFAULT_AUTO_DASHBOARD_SETTINGS.enabled).toBe(false)
    expect(DEFAULT_AUTO_DASHBOARD_SETTINGS.sources).toEqual({
      linkhub: true,
      topSites: false,
      history: false,
    })
    expect(DEFAULT_AUTO_DASHBOARD_SETTINGS.ai.enabled).toBe(false)
  })

  it('keeps valid fields of a damaged record', () => {
    const settings = coerceAutoDashboardSettings({
      enabled: true,
      sources: { history: true, topSites: 'yes' },
      historyDays: 12,
      maxLinks: 30,
      ai: { model: 'gpt-x', apiKey: 'sk-1' },
    })

    expect(settings.enabled).toBe(true)
    expect(settings.sources).toEqual({
      linkhub: true,
      topSites: false,
      history: true,
    })
    expect(settings.historyDays).toBe(30)
    expect(settings.maxLinks).toBe(30)
    expect(settings.ai).toEqual({
      enabled: false,
      apiKey: 'sk-1',
      model: 'claude-opus-5-5',
    })
  })

  it('falls back to the defaults for garbage', () => {
    expect(coerceAutoDashboardSettings(null)).toEqual(
      DEFAULT_AUTO_DASHBOARD_SETTINGS,
    )
    expect(coerceAutoDashboardSettings('x')).toEqual(
      DEFAULT_AUTO_DASHBOARD_SETTINGS,
    )
  })

  it('parses list drafts line by line without duplicates', () => {
    expect(
      parseAutoListDraft(' a.example \n\nB.example\nb.example\r\nc.example '),
    ).toEqual(['a.example', 'B.example', 'c.example'])
  })

  it('is due for a rebuild only when on, timed and old enough', () => {
    const now = Date.UTC(2026, 9, 24, 12)
    const on = {
      ...DEFAULT_AUTO_DASHBOARD_SETTINGS,
      enabled: true,
      refreshHours: 6,
    }

    expect(isAutoDashboardStale(on, now)).toBe(true)
    expect(
      isAutoDashboardStale(
        { ...on, lastBuiltAt: new Date(now - 5 * 3600 * 1000).toISOString() },
        now,
      ),
    ).toBe(false)
    expect(
      isAutoDashboardStale(
        { ...on, lastBuiltAt: new Date(now - 7 * 3600 * 1000).toISOString() },
        now,
      ),
    ).toBe(true)
    expect(isAutoDashboardStale({ ...on, refreshHours: 0 }, now)).toBe(false)
    expect(isAutoDashboardStale({ ...on, enabled: false }, now)).toBe(false)
  })

  it('runs and uses AI only as the setup switches say', () => {
    const stored = {
      ...DEFAULT_AUTO_DASHBOARD_SETTINGS,
      enabled: true,
      ai: { ...DEFAULT_AUTO_DASHBOARD_SETTINGS.ai, enabled: true },
    }

    expect(
      withSetupSwitches(stored, { autoDashboard: false, aiArrangement: true }),
    ).toMatchObject({ enabled: false, ai: { enabled: false } })
    expect(
      withSetupSwitches(DEFAULT_AUTO_DASHBOARD_SETTINGS, {
        autoDashboard: true,
        aiArrangement: false,
      }),
    ).toMatchObject({ enabled: true, ai: { enabled: false } })
    expect(
      withSetupSwitches(DEFAULT_AUTO_DASHBOARD_SETTINGS, {
        autoDashboard: true,
        aiArrangement: true,
      }),
    ).toMatchObject({ enabled: true, ai: { enabled: true } })
  })

  it('round-trips through IndexedDB', async () => {
    const settings = {
      ...DEFAULT_AUTO_DASHBOARD_SETTINGS,
      enabled: true,
      workspaceId: 'ws-auto',
      excludedSites: ['bank.example'],
    }

    await saveAutoDashboardSettings(settings)

    expect(await loadAutoDashboardSettings()).toEqual(settings)
  })
})
