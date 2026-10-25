import { useEffect, useState } from 'react'

import {
  AUTO_AI_MODELS,
  AUTO_AI_MODEL_LABELS,
  AUTO_HISTORY_DAYS,
  AUTO_MAX_LINKS_LIMITS,
  AUTO_REFRESH_HOURS,
  parseAutoListDraft,
  type AutoContentKey,
  type AutoDashboardSettings,
  type AutoSourceKey,
} from '../../contracts/autoDashboard'
import {
  canUseBrowserSignals,
  releaseBrowserSignalPermission,
  requestBrowserSignalPermission,
} from '../../features/auto/browserSignals'
import { useAutoDashboardStore } from '../../state/useAutoDashboardStore'
import { useNetworkFeaturesStore } from '../../state/useNetworkFeaturesStore'
import { useWorkspaceStore } from '../../state/useWorkspaceStore'
import {
  PanelSection,
  SettingRow,
  Slider,
  StatusMessage,
  Switch,
} from '../ui/panel/Panel'
import panelStyles from '../ui/panel/Panel.module.css'
import styles from './OptionsMenu.module.css'

type AutoDashboardPanelProps = {
  menuId: string
  tabListId: string
}

const SOURCE_ROWS: Array<{
  key: AutoSourceKey
  label: string
  hint: string
  permission?: 'history' | 'topSites'
}> = [
  {
    key: 'linkhub',
    label: 'Linkhaven clicks',
    hint: 'Links you open from your own canvases. No permission needed.',
  },
  {
    key: 'topSites',
    label: 'Most visited sites',
    hint: 'The browser’s top sites list. Asks for permission once.',
    permission: 'topSites',
  },
  {
    key: 'history',
    label: 'Browsing history',
    hint: 'Visit counts from your history. Asks for permission once; read locally only.',
    permission: 'history',
  },
]

const CONTENT_ROWS: Array<{
  key: AutoContentKey
  label: string
  hint: string
}> = [
  { key: 'links', label: 'Links', hint: 'Cards for the pages you open most.' },
  {
    key: 'feeds',
    label: 'News feeds',
    hint: 'Subreddits, YouTube channels, GitHub repos and news sites become one feed. Needs the feed proxy.',
  },
  {
    key: 'charts',
    label: 'Charts',
    hint: 'Stock and crypto quote pages become live charts. Needs the chart feed.',
  },
]

function formatRefresh(hours: number) {
  return hours === 0 ? 'Manual' : hours === 24 ? 'Daily' : `${hours} h`
}

function formatBuiltAt(value: string | undefined) {
  if (!value) {
    return 'Never built'
  }

  const date = new Date(value)

  return Number.isNaN(date.getTime())
    ? 'Never built'
    : `Built ${date.toLocaleString()}`
}

export function AutoDashboardPanel(props: AutoDashboardPanelProps) {
  const loaded = useAutoDashboardStore((state) => state.loaded)
  const load = useAutoDashboardStore((state) => state.load)

  useEffect(() => {
    void load()
  }, [load])

  // The form seeds its text drafts from the stored settings on mount.
  return loaded ? <AutoDashboardForm {...props} /> : null
}

function AutoDashboardForm({ menuId, tabListId }: AutoDashboardPanelProps) {
  const settings = useAutoDashboardStore((state) => state.settings)
  const status = useAutoDashboardStore((state) => state.status)
  const update = useAutoDashboardStore((state) => state.update)
  const build = useAutoDashboardStore((state) => state.build)
  const activeWorkspaceId = useWorkspaceStore(
    (state) => state.activeWorkspaceId,
  )
  const workspaceSummaries = useWorkspaceStore(
    (state) => state.workspaceSummaries,
  )
  const switchWorkspace = useWorkspaceStore((state) => state.switchWorkspace)
  const [permissionMessage, setPermissionMessage] = useState('')
  const [excludedDraft, setExcludedDraft] = useState(() =>
    settings.excludedSites.join('\n'),
  )
  const [pinnedDraft, setPinnedDraft] = useState(() =>
    settings.pinnedUrls.join('\n'),
  )
  const [apiKeyDraft, setApiKeyDraft] = useState(() => settings.ai.apiKey)
  const aiArrangementOn = useNetworkFeaturesStore(
    (state) => state.aiArrangement,
  )
  const browserSignalsAvailable = canUseBrowserSignals()
  const busy = status.kind === 'busy'
  const autoWorkspaceExists = workspaceSummaries.some(
    (summary) => summary.id === settings.workspaceId,
  )

  const patch = (
    change: (current: AutoDashboardSettings) => AutoDashboardSettings,
  ) => void update(change)

  const handleSourceToggle = async (
    row: (typeof SOURCE_ROWS)[number],
    checked: boolean,
  ) => {
    setPermissionMessage('')

    if (checked && row.permission) {
      const granted = await requestBrowserSignalPermission(row.permission)

      if (!granted) {
        setPermissionMessage(`${row.label}: permission was not granted.`)
        return
      }
    }

    if (!checked && row.permission) {
      void releaseBrowserSignalPermission(row.permission)
    }

    patch((current) => ({
      ...current,
      sources: { ...current.sources, [row.key]: checked },
    }))
  }

  return (
    <div
      aria-labelledby={`${tabListId}-auto`}
      className={styles.panelBody}
      id={`${menuId}-auto`}
      role="tabpanel"
    >
      <div className={panelStyles.stack} data-testid="auto-dashboard-panel">
        <PanelSection
          description="Builds a workspace from what you open most: links, news feeds and charts. Everything stays on this device unless you turn on AI."
          meta={formatBuiltAt(settings.lastBuiltAt)}
          title="Auto dashboard"
        >
          <SettingRow
            hint="The Auto workspace is rebuilt from scratch each time. Pin pages below to keep them."
            label="Build now"
          >
            <div className={panelStyles.actions}>
              <button
                className={`${panelStyles.button} ${panelStyles.buttonPrimary}`}
                data-testid="auto-dashboard-build"
                disabled={busy}
                onClick={() => void build()}
                type="button"
              >
                {busy ? 'Building…' : autoWorkspaceExists ? 'Rebuild' : 'Build'}
              </button>
              {autoWorkspaceExists &&
              settings.workspaceId !== activeWorkspaceId ? (
                <button
                  className={`${panelStyles.button} ${panelStyles.buttonQuiet}`}
                  onClick={() => {
                    if (settings.workspaceId) {
                      void switchWorkspace(settings.workspaceId)
                    }
                  }}
                  type="button"
                >
                  Open
                </button>
              ) : null}
            </div>
          </SettingRow>
        </PanelSection>

        {status.message ? (
          <StatusMessage kind={status.kind} testId="auto-dashboard-status">
            {status.message}
          </StatusMessage>
        ) : null}

        <>
          <PanelSection
            description={
              browserSignalsAvailable
                ? undefined
                : 'Browser data is only available in the Linkhaven browser extension.'
            }
            title="Data sources"
          >
            {SOURCE_ROWS.map((row) => (
              <SettingRow hint={row.hint} key={row.key} label={row.label}>
                <Switch
                  ariaLabel={row.label}
                  checked={settings.sources[row.key]}
                  disabled={Boolean(row.permission) && !browserSignalsAvailable}
                  onChange={(checked) => void handleSourceToggle(row, checked)}
                />
              </SettingRow>
            ))}
            <SettingRow label="Time window">
              <div
                aria-label="Time window"
                className={panelStyles.segmented}
                role="group"
              >
                {AUTO_HISTORY_DAYS.map((days) => (
                  <button
                    aria-pressed={settings.historyDays === days}
                    className={panelStyles.segment}
                    key={days}
                    onClick={() =>
                      patch((current) => ({ ...current, historyDays: days }))
                    }
                    type="button"
                  >
                    {days} days
                  </button>
                ))}
              </div>
            </SettingRow>
          </PanelSection>
          {permissionMessage ? (
            <StatusMessage kind="warning">{permissionMessage}</StatusMessage>
          ) : null}

          <PanelSection title="Content">
            {CONTENT_ROWS.map((row) => (
              <SettingRow hint={row.hint} key={row.key} label={row.label}>
                <Switch
                  ariaLabel={row.label}
                  checked={settings.content[row.key]}
                  onChange={(checked) =>
                    patch((current) => ({
                      ...current,
                      content: { ...current.content, [row.key]: checked },
                    }))
                  }
                />
              </SettingRow>
            ))}
            <SettingRow label="Links at most" stacked>
              <Slider
                ariaLabel="Links at most"
                max={AUTO_MAX_LINKS_LIMITS.max}
                min={AUTO_MAX_LINKS_LIMITS.min}
                suffix=""
                value={settings.maxLinks}
                onChange={(value) =>
                  patch((current) => ({ ...current, maxLinks: value }))
                }
              />
            </SettingRow>
            <SettingRow label="Pages per site" stacked>
              <Slider
                ariaLabel="Pages per site"
                max={6}
                min={1}
                suffix=""
                value={settings.maxPerSite}
                onChange={(value) =>
                  patch((current) => ({ ...current, maxPerSite: value }))
                }
              />
            </SettingRow>
            <SettingRow
              hint="When the Auto workspace is opened."
              label="Refresh"
            >
              <div
                aria-label="Refresh"
                className={panelStyles.segmented}
                role="group"
              >
                {AUTO_REFRESH_HOURS.map((hours) => (
                  <button
                    aria-pressed={settings.refreshHours === hours}
                    className={panelStyles.segment}
                    key={hours}
                    onClick={() =>
                      patch((current) => ({
                        ...current,
                        refreshHours: hours,
                      }))
                    }
                    type="button"
                  >
                    {formatRefresh(hours)}
                  </button>
                ))}
              </div>
            </SettingRow>
          </PanelSection>

          <PanelSection title="Always and never">
            <SettingRow
              hint="One URL per line. Always shown."
              label="Pinned pages"
              stacked
            >
              <textarea
                aria-label="Pinned pages"
                className={panelStyles.textarea}
                onBlur={() => {
                  const pinnedUrls = parseAutoListDraft(pinnedDraft)

                  setPinnedDraft(pinnedUrls.join('\n'))
                  patch((current) => ({ ...current, pinnedUrls }))
                }}
                onChange={(event) => setPinnedDraft(event.currentTarget.value)}
                placeholder="https://example.com/dashboard"
                spellCheck={false}
                value={pinnedDraft}
              />
            </SettingRow>
            <SettingRow
              hint="One site (example.com) or URL per line. Login, search, banking and local pages are always left out."
              label="Excluded sites"
              stacked
            >
              <textarea
                aria-label="Excluded sites"
                className={panelStyles.textarea}
                onBlur={() => {
                  const excludedSites = parseAutoListDraft(excludedDraft)

                  setExcludedDraft(excludedSites.join('\n'))
                  patch((current) => ({ ...current, excludedSites }))
                }}
                onChange={(event) =>
                  setExcludedDraft(event.currentTarget.value)
                }
                placeholder="mail.example.com"
                spellCheck={false}
                value={excludedDraft}
              />
            </SettingRow>
          </PanelSection>

          <PanelSection
            description="Optional. Claude groups your pages into topics, cleans up titles and spots chart symbols. Titles and URLs of the candidate pages are sent to the Anthropic API with your own key; nothing else is."
            title="AI arrangement"
          >
            {aiArrangementOn ? (
              <>
                <SettingRow
                  hint="Stored only in this browser and never exported."
                  label="Anthropic API key"
                  stacked
                >
                  <input
                    aria-label="Anthropic API key"
                    autoComplete="off"
                    onBlur={() => {
                      const apiKey = apiKeyDraft.trim()

                      patch((current) => ({
                        ...current,
                        ai: { ...current.ai, apiKey },
                      }))
                    }}
                    onChange={(event) =>
                      setApiKeyDraft(event.currentTarget.value)
                    }
                    placeholder="sk-ant-…"
                    spellCheck={false}
                    type="password"
                    value={apiKeyDraft}
                  />
                </SettingRow>
                <SettingRow label="Model">
                  <div
                    aria-label="Model"
                    className={panelStyles.segmented}
                    role="group"
                  >
                    {AUTO_AI_MODELS.map((model) => (
                      <button
                        aria-pressed={settings.ai.model === model}
                        className={panelStyles.segment}
                        key={model}
                        onClick={() =>
                          patch((current) => ({
                            ...current,
                            ai: { ...current.ai, model },
                          }))
                        }
                        type="button"
                      >
                        {AUTO_AI_MODEL_LABELS[model]}
                      </button>
                    ))}
                  </div>
                </SettingRow>
              </>
            ) : (
              <p className={panelStyles.empty}>
                Off. Turn on AI arrangement in Menu → Privacy to use it.
              </p>
            )}
          </PanelSection>
        </>
      </div>
    </div>
  )
}
