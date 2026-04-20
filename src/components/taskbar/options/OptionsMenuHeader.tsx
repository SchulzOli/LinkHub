import styles from '../OptionsMenu.module.css'

import { LinkHubMark } from '../../ui/LinkHubMark'
import type { MenuTab } from './optionsMenuTabs'
import { OPTIONS_MENU_TABS } from './optionsMenuTabs'

type OptionsMenuHeaderProps = {
  activeTab: MenuTab
  menuId: string
  onRequestClose: () => void
  onSelectTab: (tab: MenuTab) => void
  tabListId: string
}

/**
 * Renders the Options Menu header (brand mark, title, close button) and the
 * tablist. Controlled by the Options Menu shell which owns `activeTab`.
 */
export function OptionsMenuHeader({
  activeTab,
  menuId,
  onRequestClose,
  onSelectTab,
  tabListId,
}: OptionsMenuHeaderProps) {
  return (
    <div className={styles.topSection}>
      <div className={styles.headerRow}>
        <div className={styles.headerIntro}>
          <span aria-hidden="true" className={styles.brandMark}>
            <LinkHubMark
              className={styles.brandGlyph}
              color="var(--text-primary)"
            />
          </span>
          <div className={styles.titleStack}>
            <p className={styles.eyebrow}>Workspace menu</p>
            <div className={styles.titleRow}>
              <h2 className={styles.title}>LinkHub</h2>
              <span className={styles.headerMeta}>Local</span>
            </div>
            <p className={styles.subtitle}>
              Settings, templates, stats and canvas data in one place.
            </p>
          </div>
        </div>
        <button
          aria-label="Close menu"
          className={styles.closeButton}
          onClick={onRequestClose}
          type="button"
        >
          <span aria-hidden="true" className={styles.closeIcon}>
            <svg
              viewBox="0 0 24 24"
              focusable="false"
              className={styles.closeSvg}
            >
              <path
                d="M6.7 5.3 12 10.6l5.3-5.3 1.4 1.4-5.3 5.3 5.3 5.3-1.4 1.4-5.3-5.3-5.3 5.3-1.4-1.4 5.3-5.3-5.3-5.3 1.4-1.4Z"
                fill="currentColor"
              />
            </svg>
          </span>
        </button>
      </div>
      <div
        aria-label="Menu sections"
        className={styles.tabList}
        id={tabListId}
        role="tablist"
      >
        {OPTIONS_MENU_TABS.map((tab) => {
          const selected = activeTab === tab.id

          return (
            <button
              aria-controls={`${menuId}-${tab.id}`}
              aria-selected={selected}
              className={selected ? styles.tabActive : styles.tab}
              id={`${tabListId}-${tab.id}`}
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              role="tab"
              type="button"
            >
              {tab.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
