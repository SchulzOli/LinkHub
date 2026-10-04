import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import panelStyles from '../ui/panel/Panel.module.css'

import menuStyles from './OptionsMenu.module.css'
import styles from './ThemeGallery.module.css'

import type {
  AppearanceProfile,
  ThemeMode,
} from '../../contracts/appearanceProfile'
import {
  isBuiltinThemeId,
  type ThemeContent,
  type ThemeDocument,
} from '../../contracts/theme'
import type { AppearanceStyleTokens } from '../../features/appearance/stylePresets'
import { BUILTIN_THEMES } from '../../features/themes/builtinThemes'
import {
  createThemeFileName,
  exportThemeAsBlob,
  importThemeFromFile,
} from '../../features/themes/themeImportExport'
import { createThemeFromAppearance } from '../../features/themes/themeLibrary'
import {
  deleteTheme,
  listThemes,
  putTheme,
} from '../../storage/themeRepository'
import { DeleteIcon } from '../ui/DeleteIcon'
import {
  ChevronDownIcon,
  IconButton,
  PanelSection,
  StatusMessage,
} from '../ui/panel/Panel'
import { DownloadIcon } from '../ui/panel/PanelIcons'

type ThemeGalleryProps = {
  appearance: AppearanceProfile
  applyTheme: (themeId: string, content: ThemeContent) => void
  menuId: string
  tabListId: string
  setStyleToken: (
    mode: ThemeMode,
    tokenKey: keyof AppearanceStyleTokens,
    value: string,
  ) => void
  resetStyleTokens: () => void
}

type GalleryStatus = {
  kind: 'error' | 'idle' | 'success'
  message: string
}

function triggerBlobDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')

  anchor.href = url
  anchor.download = fileName
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

// ── Token editor groups ────────────────────────────────

type TokenGroup = {
  label: string
  tokens: Array<{
    key: keyof AppearanceStyleTokens
    label: string
    kind: 'color' | 'text'
  }>
}

const TOKEN_GROUPS: TokenGroup[] = [
  {
    label: 'Canvas',
    tokens: [
      { key: 'bgCanvas', label: 'Background', kind: 'color' },
      { key: 'bgShell', label: 'Shell', kind: 'color' },
      { key: 'gridColor', label: 'Grid', kind: 'color' },
    ],
  },
  {
    label: 'Panels',
    tokens: [
      { key: 'panelBg', label: 'Background', kind: 'color' },
      { key: 'panelBorder', label: 'Border', kind: 'color' },
    ],
  },
  {
    label: 'Cards',
    tokens: [
      { key: 'cardBg', label: 'Background', kind: 'color' },
      { key: 'cardBorder', label: 'Border', kind: 'color' },
    ],
  },
  {
    label: 'Text',
    tokens: [
      { key: 'textPrimary', label: 'Primary', kind: 'color' },
      { key: 'textMuted', label: 'Muted', kind: 'color' },
    ],
  },
  {
    label: 'Accent',
    tokens: [
      { key: 'accent', label: 'Accent', kind: 'color' },
      { key: 'accentStrong', label: 'Strong', kind: 'color' },
    ],
  },
  {
    label: 'UI Controls',
    tokens: [
      { key: 'buttonHoverBg', label: 'Button hover', kind: 'color' },
      { key: 'buttonActiveBg', label: 'Button active', kind: 'color' },
      { key: 'inputBg', label: 'Input bg', kind: 'color' },
      { key: 'inputBorder', label: 'Input border', kind: 'color' },
      { key: 'menuBg', label: 'Menu bg', kind: 'color' },
      { key: 'menuBorder', label: 'Menu border', kind: 'color' },
      { key: 'menuItemHoverBg', label: 'Menu item hover', kind: 'color' },
    ],
  },
  {
    label: 'Tabs',
    tokens: [
      { key: 'tabBg', label: 'Tab bg', kind: 'color' },
      { key: 'tabActiveBg', label: 'Active bg', kind: 'color' },
      { key: 'tabActiveBorder', label: 'Active border', kind: 'color' },
    ],
  },
  {
    label: 'Radii & Font',
    tokens: [
      { key: 'radiusSm', label: 'Small radius', kind: 'text' },
      { key: 'radiusMd', label: 'Medium radius', kind: 'text' },
      { key: 'radiusLg', label: 'Large radius', kind: 'text' },
      { key: 'uiFont', label: 'Font family', kind: 'text' },
    ],
  },
]

export function ThemeGallery({
  appearance,
  applyTheme,
  menuId,
  tabListId,
  setStyleToken,
  resetStyleTokens,
}: ThemeGalleryProps) {
  const [userThemes, setUserThemes] = useState<ThemeDocument[]>([])
  const [status, setStatus] = useState<GalleryStatus>({
    kind: 'idle',
    message: '',
  })
  const [loaded, setLoaded] = useState(false)
  const [tokenEditorOpen, setTokenEditorOpen] = useState(false)
  const [tokenMode, setTokenMode] = useState<ThemeMode>(appearance.themeMode)
  const importInputRef = useRef<HTMLInputElement | null>(null)

  const refreshUserThemes = useCallback(async () => {
    setUserThemes(await listThemes())
    setLoaded(true)
  }, [])

  // Lazy-load user themes on first mount
  useEffect(() => {
    if (loaded) return

    let cancelled = false

    void listThemes().then((themes) => {
      if (cancelled) return
      setUserThemes(themes)
      setLoaded(true)
    })

    return () => {
      cancelled = true
    }
  }, [loaded])

  const allThemes = [...BUILTIN_THEMES, ...userThemes]

  const handleApply = (theme: ThemeDocument) => {
    applyTheme(theme.id, theme.content)
  }

  const handleExport = (theme: ThemeDocument) => {
    const blob = exportThemeAsBlob(theme)

    triggerBlobDownload(blob, createThemeFileName(theme))
  }

  const handleDelete = async (theme: ThemeDocument) => {
    await deleteTheme(theme.id)
    await refreshUserThemes()
    setStatus({ kind: 'success', message: `Deleted "${theme.name}".` })
  }

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]

    event.target.value = ''

    if (!file) return

    const theme = await importThemeFromFile(file)

    if (!theme) {
      setStatus({ kind: 'error', message: 'Invalid theme file.' })
      return
    }

    await putTheme(theme)
    await refreshUserThemes()
    setStatus({ kind: 'success', message: `Imported "${theme.name}".` })
  }

  const handleSaveAsCurrent = async () => {
    const name = `Custom theme ${userThemes.length + 1}`
    const theme = createThemeFromAppearance(appearance, name)

    await putTheme(theme)
    await refreshUserThemes()
    setStatus({ kind: 'success', message: `Saved "${name}".` })
  }

  const activeTokens = appearance.styleTokens[tokenMode]

  const statusKind = status.kind === 'idle' ? null : status.kind

  return (
    <div
      aria-labelledby={`${tabListId}-themes`}
      className={menuStyles.panelBody}
      id={`${menuId}-themes`}
      role="tabpanel"
    >
      <div className={panelStyles.stack}>
        <PanelSection
          actions={
            <>
              <button
                aria-label="Save current as theme"
                className={`${panelStyles.button} ${panelStyles.buttonQuiet}`}
                onClick={() => void handleSaveAsCurrent()}
                type="button"
              >
                Save current
              </button>
              <button
                aria-label="Import theme"
                className={`${panelStyles.button} ${panelStyles.buttonQuiet}`}
                onClick={() => importInputRef.current?.click()}
                type="button"
              >
                Import
              </button>
              <input
                accept=".json,.linkhub-theme.json"
                className={panelStyles.hiddenInput}
                onChange={(event) => void handleImport(event)}
                ref={importInputRef}
                type="file"
              />
            </>
          }
          grouped={false}
          meta={`${allThemes.length}`}
          title="Themes"
        >
          <div className={styles.galleryGrid}>
            {allThemes.map((theme) => {
              const isActive = appearance.activeThemeId === theme.id
              const isBuiltin = isBuiltinThemeId(theme.id)
              const tokens = theme.content.tokens[appearance.themeMode]

              return (
                <article
                  className={styles.themeCard}
                  data-active={isActive}
                  key={theme.id}
                >
                  <button
                    aria-label={`Apply ${theme.name} theme`}
                    aria-pressed={isActive}
                    className={styles.themeApply}
                    onClick={() => handleApply(theme)}
                    type="button"
                  >
                    <ThemePreview tokens={tokens} />
                    <span className={styles.themeInfo}>
                      <span className={styles.themeName}>{theme.name}</span>
                      {isActive ? (
                        <span
                          className={`${panelStyles.chip} ${panelStyles.chipAccent}`}
                        >
                          Active
                        </span>
                      ) : isBuiltin ? null : (
                        <span className={panelStyles.chip}>Custom</span>
                      )}
                    </span>
                    {theme.description ? (
                      <span className={styles.themeDescription}>
                        {theme.description}
                      </span>
                    ) : null}
                  </button>
                  {!isBuiltin ? (
                    <div className={styles.themeActions}>
                      <IconButton
                        label={`Export ${theme.name}`}
                        title="Export"
                        onClick={() => handleExport(theme)}
                      >
                        <DownloadIcon className={panelStyles.icon} />
                      </IconButton>
                      <IconButton
                        label={`Delete ${theme.name}`}
                        title="Delete"
                        tone="danger"
                        onClick={() => void handleDelete(theme)}
                      >
                        <DeleteIcon className={panelStyles.icon} />
                      </IconButton>
                    </div>
                  ) : null}
                </article>
              )
            })}
          </div>
        </PanelSection>

        {statusKind ? (
          <StatusMessage kind={statusKind}>{status.message}</StatusMessage>
        ) : null}

        <PanelSection title="Customize">
          <button
            aria-expanded={tokenEditorOpen}
            className={panelStyles.disclosure}
            onClick={() => setTokenEditorOpen(!tokenEditorOpen)}
            type="button"
          >
            <span>Edit colors and radii of the active theme</span>
            <ChevronDownIcon className={panelStyles.disclosureChevron} />
          </button>
          {tokenEditorOpen ? (
            <div className={styles.tokenEditor}>
              <div className={styles.tokenToolbar}>
                <div
                  className={panelStyles.segmented}
                  role="group"
                  aria-label="Token mode"
                >
                  {(['light', 'dark'] as const).map((mode) => (
                    <button
                      aria-pressed={tokenMode === mode}
                      className={panelStyles.segment}
                      key={mode}
                      onClick={() => setTokenMode(mode)}
                      type="button"
                    >
                      {mode === 'light' ? 'Light' : 'Dark'}
                    </button>
                  ))}
                </div>
                <button
                  className={`${panelStyles.button} ${panelStyles.buttonQuiet}`}
                  onClick={resetStyleTokens}
                  type="button"
                >
                  Reset to preset defaults
                </button>
              </div>
              {TOKEN_GROUPS.map((group) => (
                <div className={styles.tokenGroup} key={group.label}>
                  <span className={styles.tokenGroupLabel}>{group.label}</span>
                  {group.tokens.map((token) => (
                    <label className={styles.tokenRow} key={token.key}>
                      <span className={styles.tokenLabel}>{token.label}</span>
                      {token.kind === 'color' ? (
                        <input
                          aria-label={`${group.label} ${token.label} color`}
                          className={styles.tokenColorInput}
                          type="color"
                          value={
                            activeTokens[token.key].startsWith('#')
                              ? activeTokens[token.key].slice(0, 7)
                              : '#888888'
                          }
                          onChange={(e) =>
                            setStyleToken(tokenMode, token.key, e.target.value)
                          }
                        />
                      ) : (
                        <span />
                      )}
                      <input
                        className={styles.tokenTextInput}
                        value={activeTokens[token.key]}
                        onChange={(e) =>
                          setStyleToken(tokenMode, token.key, e.target.value)
                        }
                      />
                    </label>
                  ))}
                </div>
              ))}
            </div>
          ) : null}
        </PanelSection>
      </div>
    </div>
  )
}

/** A miniature canvas: background, a card, a panel strip and the accent. */
function ThemePreview({ tokens }: { tokens: AppearanceStyleTokens }) {
  return (
    <span
      aria-hidden="true"
      className={styles.preview}
      style={
        {
          '--p-canvas': tokens.bgCanvas,
          '--p-grid': tokens.gridColor,
          '--p-card': tokens.cardBg,
          '--p-card-border': tokens.cardBorder,
          '--p-panel': tokens.panelBg,
          '--p-panel-border': tokens.panelBorder,
          '--p-text': tokens.textPrimary,
          '--p-muted': tokens.textMuted,
          '--p-accent': tokens.accent,
        } as CSSProperties
      }
    >
      <span className={styles.previewCard}>
        <span className={styles.previewLine} />
        <span className={styles.previewLineMuted} />
      </span>
      <span className={styles.previewCardSmall} />
      <span className={styles.previewBar}>
        <span className={styles.previewAccent} />
      </span>
    </span>
  )
}
