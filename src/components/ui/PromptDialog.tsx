import { DialogFrame } from './DialogFrame'
import styles from './PromptDialog.module.css'

type PromptDialogProps = {
  auxiliaryLabel?: string
  auxiliaryTone?: 'default' | 'danger'
  closeLabel?: string
  description: string
  eyebrow: string
  onAuxiliaryAction?: () => void
  onPrimaryAction: () => void
  onRequestClose: () => void
  open: boolean
  primaryLabel: string
  role?: 'alertdialog' | 'dialog'
  secondaryLabel?: string
  title: string
  tone: 'default' | 'danger'
}

export function PromptDialog({
  auxiliaryLabel,
  auxiliaryTone = 'default',
  closeLabel,
  description,
  eyebrow,
  onAuxiliaryAction,
  onPrimaryAction,
  onRequestClose,
  open,
  primaryLabel,
  role = 'alertdialog',
  secondaryLabel,
  title,
  tone,
}: PromptDialogProps) {
  return (
    <DialogFrame
      closeLabel={closeLabel}
      description={description}
      eyebrow={eyebrow}
      open={open}
      onRequestClose={onRequestClose}
      role={role}
      size="compact"
      title={title}
    >
      <div className={styles.actions}>
        {secondaryLabel ? (
          <button
            className={styles.secondaryAction}
            onClick={onRequestClose}
            type="button"
          >
            {secondaryLabel}
          </button>
        ) : null}
        {auxiliaryLabel && onAuxiliaryAction ? (
          <button
            className={`${styles.auxiliaryAction} ${
              auxiliaryTone === 'danger' ? styles.primaryActionDanger : ''
            }`}
            onClick={onAuxiliaryAction}
            type="button"
          >
            {auxiliaryLabel}
          </button>
        ) : null}
        <button
          className={`${styles.primaryAction} ${
            tone === 'danger' ? styles.primaryActionDanger : ''
          }`}
          onClick={onPrimaryAction}
          type="button"
        >
          {primaryLabel}
        </button>
      </div>
    </DialogFrame>
  )
}
