import styles from './EmptyCanvasGuide.module.css'

type EmptyCanvasGuideProps = {
  visible: boolean
  onToggleQuickAdd: () => void
}

export function EmptyCanvasGuide({
  visible,
  onToggleQuickAdd,
}: EmptyCanvasGuideProps) {
  if (!visible) {
    return null
  }

  return (
    <section className={styles.guide} data-testid="empty-canvas-guide">
      <h1 className={styles.title}>Start by pasting a link anywhere.</h1>
      <p className={styles.body}>
        The canvas is your startpage. Paste a URL directly onto the board or use
        the quick add control in the taskbar to place a square link card.
      </p>
      <button onClick={onToggleQuickAdd} type="button">
        Open quick add
      </button>
    </section>
  )
}
