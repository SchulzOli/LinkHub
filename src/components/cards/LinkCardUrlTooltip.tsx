import type { CSSProperties } from 'react'
import { createPortal } from 'react-dom'

import styles from './LinkCard.module.css'

type LinkCardUrlTooltipProps = {
  displayUrl: string
  isEditMode: boolean
  isVisible: boolean
  style: CSSProperties | null
}

export function LinkCardUrlTooltip({
  displayUrl,
  isEditMode,
  isVisible,
  style,
}: LinkCardUrlTooltipProps) {
  if (isEditMode || !isVisible || !style || typeof document === 'undefined') {
    return null
  }

  return createPortal(
    <span
      className={styles.urlTooltip}
      data-testid="card-url-tooltip"
      role="tooltip"
      style={style}
    >
      {displayUrl}
    </span>,
    document.body,
  )
}
