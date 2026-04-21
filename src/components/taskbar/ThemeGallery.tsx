import { useCallback, useEffect, useRef, useState } from 'react'

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

// ── Swatch preview colors ──────────────────────────────

function getSwatchColors(tokens: AppearanceStyleTokens) {
  return [
    tokens.bgCanvas,
    tokens.cardBg,
    tokens.accent,
    tokens.panelBorder,
    tokens.textPrimary,
  ]
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
    void refreshUserThemes()
  }, [loaded, refreshUserThemes])

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

  return (
    <div
      aria-labelledby={`${tabListId}-themes`}
      className={menuStyles.panelBody}
      id={`${menuId}-themes`}
      role="tabpanel"
    >
      {/* ── Gallery actions ────────────────────────────── */}
      <div className={styles.galleryActions}>
        <button
          className={styles.galleryActionButton}
          onClick={() => void handleSaveAsCurrent()}
          type="button"
        >
          Save current as theme
        </button>
        <button
          className={styles.galleryActionButton}
          onClick={() => importInputRef.current?.click()}
          type="button"
        >
          Import theme
        </button>
        <input
          accept=".json,.linkhub-theme.json"
          className={styles.galleryHiddenInput}
          onChange={(event) => void handleImport(event)}
          ref={importInputRef}
          type="file"
        />
      </div>

      {status.kind !== 'idle' ? (
        <p
          className={
            status.kind === 'error' ? styles.statusError : styles.statusSuccess
          }
        >
          {status.message}
        </p>
      ) : null}

      {/* ── Theme cards grid ───────────────────────────── */}
      <div className={styles.galleryGrid}>
        {allThemes.map((theme) => {
          const isActive = appearance.activeThemeId === theme.id
          const isBuiltin = isBuiltinThemeId(theme.id)
          const previewTokens = theme.content.tokens[appearance.themeMode]

          return (
            <div
              aria-label={`Apply ${theme.name} theme`}
              aria-pressed={isActive}
              className={isActive ? styles.themeCardActive : styles.themeCard}
              key={theme.id}
              onClick={() => handleApply(theme)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  handleApply(theme)
                }
              }}
            >
              <div className={styles.themeHeader}>
                <h4 className={styles.themeName}>
                  {theme.name}
                  {isActive ? ' ✓' : ''}
                </h4>
                {isBuiltin ? (
                  <span className={styles.themeBadge}>Built-in</span>
                ) : null}
              </div>
              {theme.description ? (
                <p className={styles.themeDescription}>{theme.description}</p>
              ) : null}
              <div className={styles.swatchRow}>
                {getSwatchColors(previewTokens).map((color, index) => (
                  <div
                    className={styles.swatch}
                    key={index}
                    style={{ background: color }}
                  />
                ))}
              </div>
              {!isBuiltin ? (
                <div className={styles.themeActions}>
                  <button
                    className={styles.themeActionButton}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleExport(theme)
                    }}
                    type="button"
                  >
                    Export
                  </button>
                  <button
                    className={styles.themeActionButton}
                    onClick={(e) => {
                      e.stopPropagation()
                      void handleDelete(theme)
                    }}
                    type="button"
                  >
                    Delete
                  </button>
                </div>
              ) : null}
            </div>
          )
        })}
      </div>

      {/* ── Token Editor ───────────────────────────────── */}
      <div className={styles.tokenSection}>
        <div
          className={styles.tokenSectionHeader}
          onClick={() => setTokenEditorOpen(!tokenEditorOpen)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              setTokenEditorOpen(!tokenEditorOpen)
            }
          }}
        >
          <h4 className={styles.tokenSectionTitle}>Customize tokens</h4>
          <span
            className={
              tokenEditorOpen
                ? styles.tokenSectionChevronOpen
                : styles.tokenSectionChevron
            }
          >
            ▶
          </span>
        </div>

        {tokenEditorOpen ? (
          <div className={styles.tokenGroupList}>
            <div className={styles.tokenModeToggle}>
              <button
                className={
                  tokenMode === 'light'
                    ? styles.tokenModeButtonActive
                    : styles.tokenModeButton
                }
                onClick={() => setTokenMode('light')}
                type="button"
              >
                Light
              </button>
              <button
                className={
                  tokenMode === 'dark'
                    ? styles.tokenModeButtonActive
                    : styles.tokenModeButton
                }
                onClick={() => setTokenMode('dark')}
                type="button"
              >
                Dark
              </button>
            </div>

            {TOKEN_GROUPS.map((group) => (
              <div className={styles.tokenGroup} key={group.label}>
                <span className={styles.tokenGroupLabel}>{group.label}</span>
                {group.tokens.map((token) => (
                  <div className={styles.tokenRow} key={token.key}>
                    <span className={styles.tokenLabel}>{token.label}</span>
                    {token.kind === 'color' ? (
                      <input
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
                  </div>
                ))}
              </div>
            ))}

            <div className={styles.tokenResetRow}>
              <button
                className={styles.themeActionButton}
                onClick={resetStyleTokens}
                type="button"
              >
                Reset to preset defaults
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
