import {
  coerceAutoDashboardSettings,
  DEFAULT_AUTO_DASHBOARD_SETTINGS,
  type AutoDashboardSettings,
} from '../contracts/autoDashboard'
import { openLinkhavenDb, STORAGE_STORES } from './db'

const AUTO_DASHBOARD_SETTINGS_KEY = 'auto-dashboard'

// Only IndexedDB, no localStorage mirror: the record can hold an API key,
// and losing the settings just means the Auto dashboard is off again.

export async function loadAutoDashboardSettings(): Promise<AutoDashboardSettings> {
  try {
    const db = await openLinkhavenDb()
    const raw = await db.get(
      STORAGE_STORES.workspaceMetadata,
      AUTO_DASHBOARD_SETTINGS_KEY,
    )

    return raw
      ? coerceAutoDashboardSettings(raw)
      : DEFAULT_AUTO_DASHBOARD_SETTINGS
  } catch {
    return DEFAULT_AUTO_DASHBOARD_SETTINGS
  }
}

export async function saveAutoDashboardSettings(
  settings: AutoDashboardSettings,
) {
  const db = await openLinkhavenDb()

  await db.put(
    STORAGE_STORES.workspaceMetadata,
    JSON.parse(JSON.stringify(settings)),
    AUTO_DASHBOARD_SETTINGS_KEY,
  )
}
