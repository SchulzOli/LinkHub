import { useCallback, useState } from 'react'

export type PromptTone = 'default' | 'danger'

export type PromptDialogConfig = {
  description: string
  eyebrow: string
  primaryLabel: string
  role: 'alertdialog' | 'dialog'
  secondaryLabel?: string
  title: string
  tone: PromptTone
}

export type PromptDialogOptions = PromptDialogConfig & {
  onDismissAction?: () => void
  onPrimaryAction?: () => void
}

export type PromptNoticeOptions = {
  description: string
  eyebrow: string
  primaryLabel?: string
  title: string
  tone?: PromptTone
}

type PromptDialogState = PromptDialogConfig & {
  onDismissAction?: () => void
  onPrimaryAction: () => void
}

export function usePromptDialogManager() {
  const [promptDialog, setPromptDialog] = useState<PromptDialogState | null>(
    null,
  )

  const dismissPromptDialog = useCallback(() => {
    const onDismissAction = promptDialog?.onDismissAction

    setPromptDialog(null)
    onDismissAction?.()
  }, [promptDialog])

  const openPromptDialog = useCallback((dialog: PromptDialogOptions) => {
    setPromptDialog({
      ...dialog,
      onDismissAction: dialog.onDismissAction,
      onPrimaryAction: () => {
        setPromptDialog(null)
        dialog.onPrimaryAction?.()
      },
    })
  }, [])

  const showPromptNotice = useCallback(
    ({
      description,
      eyebrow,
      primaryLabel = 'Dismiss',
      title,
      tone = 'default',
    }: PromptNoticeOptions) => {
      openPromptDialog({
        description,
        eyebrow,
        primaryLabel,
        role: 'dialog',
        title,
        tone,
      })
    },
    [openPromptDialog],
  )

  return {
    dismissPromptDialog,
    openPromptDialog,
    promptDialog,
    showPromptNotice,
  }
}
