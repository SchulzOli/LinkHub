import { useEffect, useId, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

import styles from './DialogFrame.module.css'

type DialogFrameProps = {
  children: ReactNode
  closeLabel?: string
  description?: string
  eyebrow?: string
  flushContent?: boolean
  headerActions?: ReactNode
  open: boolean
  onRequestClose: () => void
  role?: 'alertdialog' | 'dialog'
  size?: 'compact' | 'wide'
  title: string
}

export function DialogFrame({
  children,
  closeLabel = 'Close dialog',
  description,
  eyebrow,
  flushContent = false,
  headerActions,
  open,
  onRequestClose,
  role = 'dialog',
  size = 'compact',
  title,
}: DialogFrameProps) {
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    if (!open) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onRequestClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onRequestClose, open])

  if (!open || typeof document === 'undefined') {
    return null
  }

  return createPortal(
    <div
      className={styles.overlay}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) {
          onRequestClose()
        }
      }}
    >
      <section
        aria-describedby={description ? descriptionId : undefined}
        aria-labelledby={titleId}
        aria-modal="true"
        className={`${styles.frame} ${
          size === 'wide' ? styles.frameWide : styles.frameCompact
        }`}
        onPointerDown={(event) => event.stopPropagation()}
        role={role}
      >
        <header className={styles.header}>
          <div className={styles.copy}>
            {eyebrow ? <p className={styles.eyebrow}>{eyebrow}</p> : null}
            <h2 className={styles.title} id={titleId}>
              {title}
            </h2>
            {description ? (
              <p className={styles.description} id={descriptionId}>
                {description}
              </p>
            ) : null}
          </div>
          <div className={styles.headerActions}>
            {headerActions}
            <button
              aria-label={closeLabel}
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
        </header>
        <div
          className={`${styles.content} ${flushContent ? styles.contentFlush : ''}`}
        >
          {children}
        </div>
      </section>
    </div>,
    document.body,
  )
}
