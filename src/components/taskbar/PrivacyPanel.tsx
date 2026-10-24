import type { ReactNode } from 'react'

import {
  NETWORK_FEATURE_KEYS,
  type NetworkFeatureKey,
} from '../../contracts/networkFeatures'
import { isChartNode, isFeedNode } from '../../contracts/pictureNode'
import { useNetworkFeaturesStore } from '../../state/useNetworkFeaturesStore'
import { useWorkspaceStore } from '../../state/useWorkspaceStore'
import { PanelSection, SettingRow, Switch } from '../ui/panel/Panel'
import panelStyles from '../ui/panel/Panel.module.css'
import styles from './OptionsMenu.module.css'

type PrivacyPanelProps = {
  menuId: string
  tabListId: string
}

const FEATURE_LABELS: Record<NetworkFeatureKey, string> = {
  googleFavicons: 'Google favicons',
  chartsAndFeeds: 'Charts and news feeds',
  linkCheck: 'Link check',
}

function plural(count: number, word: string) {
  return `${count} ${word}${count === 1 ? '' : 's'}`
}

function hostList(urls: string[]) {
  const hosts = [
    ...new Set(
      urls.flatMap((url) => {
        try {
          return [new URL(url).host]
        } catch {
          return []
        }
      }),
    ),
  ]

  return hosts.length > 0 ? hosts.join(', ') : 'nothing yet'
}

export function PrivacyPanel({ menuId, tabListId }: PrivacyPanelProps) {
  const features = useNetworkFeaturesStore()
  const workspace = useWorkspaceStore((state) => state.workspace)
  const charts = workspace.pictures.filter(isChartNode)
  const feeds = workspace.pictures.filter(isFeedNode)
  const workspaceOfflineOnly = workspace.appearance.faviconsOfflineOnly
  const enabledCount = NETWORK_FEATURE_KEYS.filter(
    (key) => features[key],
  ).length
  const nodeCount = `${plural(charts.length, 'chart')} and ${plural(feeds.length, 'feed')} here`

  const rows: Array<{
    key: NetworkFeatureKey
    description: string
    status: ReactNode
  }> = [
    {
      key: 'googleFavicons',
      description:
        'Asks www.google.com for the icon when a site doesn’t serve one itself.',
      status: !features.googleFavicons
        ? 'Off · icons come from each site itself, or a letter'
        : workspaceOfflineOnly
          ? 'On, but this workspace is set to “Favicons offline-only”'
          : 'On · may contact www.google.com',
    },
    {
      key: 'chartsAndFeeds',
      description:
        'Chart nodes connect to a price feed, news feed nodes load RSS through a proxy.',
      status: features.chartsAndFeeds
        ? `On · ${nodeCount} · connects to ${hostList([
            ...charts.map((chart) => chart.source.url),
            ...feeds.flatMap((feed) =>
              feed.proxyUrl.trim()
                ? [feed.proxyUrl]
                : feed.sources.map((source) => source.url),
            ),
          ])}`
        : `Off · no connections · ${nodeCount} paused`,
    },
    {
      key: 'linkCheck',
      description:
        'Sends one request to every saved link, only when you press Check Links in the Data tab.',
      status: features.linkCheck
        ? `On · ${plural(workspace.cards.length, 'link')} would be checked`
        : 'Off · your links are never contacted',
    },
  ]

  return (
    <div
      aria-labelledby={`${tabListId}-privacy`}
      className={styles.panelBody}
      id={`${menuId}-privacy`}
      role="tabpanel"
    >
      <div className={panelStyles.stack} data-testid="privacy-panel">
        <PanelSection
          description="LinkHub keeps everything on this device. These are the only features that use the network, and each stays off until you turn it on. No tracking, no analytics, no AI."
          meta={
            <span data-testid="privacy-summary">
              {enabledCount === 0
                ? 'Fully local'
                : `${enabledCount} of ${NETWORK_FEATURE_KEYS.length} on`}
            </span>
          }
          title="Network access"
        >
          {rows.map((row) => (
            <SettingRow
              hint={
                <>
                  {row.description}
                  <span className={panelStyles.chips}>
                    <span
                      className={panelStyles.chip}
                      data-testid={`privacy-status-${row.key}`}
                    >
                      {row.status}
                    </span>
                  </span>
                </>
              }
              key={row.key}
              label={FEATURE_LABELS[row.key]}
              testId={`privacy-row-${row.key}`}
            >
              <Switch
                ariaLabel={FEATURE_LABELS[row.key]}
                checked={features[row.key]}
                onChange={(checked) => features.setFeature(row.key, checked)}
              />
            </SettingRow>
          ))}
        </PanelSection>
      </div>
    </div>
  )
}
