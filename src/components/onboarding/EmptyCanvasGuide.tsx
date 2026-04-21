import styles from './EmptyCanvasGuide.module.css'

type EmptyCanvasGuideProps = {
  visible: boolean
  onToggleQuickAdd: () => void
  /**
   * Optional secondary CTA handler. When provided, a "Browse templates"
   * button is rendered that deep-links into the Templates tab of the
   * options menu.
   */
  onBrowseTemplates?: () => void
}

/**
 * Decorative background: a light grid and three placeholder link-card
 * silhouettes. `aria-hidden` because it is purely illustrative. Colors come
 * from `currentColor` so the CSS module can tint the whole SVG via the
 * accent token.
 */
function EmptyCanvasIllustration() {
  return (
    <svg
      aria-hidden="true"
      className={styles.illustration}
      preserveAspectRatio="none"
      viewBox="0 0 320 160"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <pattern
          height="16"
          id="empty-canvas-grid"
          patternUnits="userSpaceOnUse"
          width="16"
        >
          <path
            d="M 16 0 L 0 0 0 16"
            fill="none"
            stroke="currentColor"
            strokeOpacity="0.18"
            strokeWidth="0.6"
          />
        </pattern>
      </defs>
      <rect
        fill="url(#empty-canvas-grid)"
        height="160"
        width="320"
        x="0"
        y="0"
      />
      {/* Placeholder cards */}
      <g fill="none" stroke="currentColor" strokeOpacity="0.35" strokeWidth="1">
        <rect height="36" rx="6" width="64" x="28" y="30" />
        <rect height="36" rx="6" width="64" x="120" y="58" />
        <rect height="36" rx="6" width="64" x="212" y="34" />
      </g>
      <g fill="currentColor" fillOpacity="0.18">
        <circle cx="44" cy="48" r="4" />
        <circle cx="136" cy="76" r="4" />
        <circle cx="228" cy="52" r="4" />
      </g>
    </svg>
  )
}

export function EmptyCanvasGuide({
  visible,
  onToggleQuickAdd,
  onBrowseTemplates,
}: EmptyCanvasGuideProps) {
  if (!visible) {
    return null
  }

  return (
    <section className={styles.guide} data-testid="empty-canvas-guide">
      <EmptyCanvasIllustration />
      <div className={styles.content}>
        <h1 className={styles.title}>Start by pasting a link anywhere.</h1>
        <p className={styles.body}>
          The canvas is your startpage. Paste a URL directly onto the board or
          use the quick add control in the taskbar to place a square link card.
        </p>
        <div className={styles.actions}>
          <button
            className={styles.primaryAction}
            data-testid="empty-canvas-primary"
            onClick={onToggleQuickAdd}
            type="button"
          >
            Add your first link
          </button>
          {onBrowseTemplates ? (
            <button
              className={styles.secondaryAction}
              data-testid="empty-canvas-secondary"
              onClick={onBrowseTemplates}
              type="button"
            >
              Browse templates
            </button>
          ) : null}
        </div>
      </div>
    </section>
  )
}
