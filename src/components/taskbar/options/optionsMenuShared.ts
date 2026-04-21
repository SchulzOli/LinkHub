/**
 * Shared helpers and types for the Options Menu feature surface.
 *
 * These helpers are extracted from the original monolithic `OptionsMenu.tsx`
 * and reused by the Options Menu shell, the Templates panel, and the Canvas
 * Import/Export hook.
 */

export type DataStatus = {
  kind: 'busy' | 'error' | 'idle' | 'success'
  message: string
}

export type PromptTone = 'default' | 'danger'

export type PromptDialogConfig = {
  auxiliaryLabel?: string
  auxiliaryTone?: PromptTone
  description: string
  eyebrow: string
  primaryLabel: string
  role: 'alertdialog' | 'dialog'
  secondaryLabel?: string
  title: string
  tone: PromptTone
}

export type PromptDialogOptions = PromptDialogConfig & {
  onAuxiliaryAction?: () => void
  onDismissAction?: () => void
  onPrimaryAction?: () => void
}

export type OpenPromptDialog = (dialog: PromptDialogOptions) => void

export const DATE_TIME_FORMATTER = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
})

export function triggerBlobDownload(blob: Blob, fileName: string) {
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')

  anchor.href = objectUrl
  anchor.download = fileName
  anchor.click()

  window.setTimeout(() => {
    URL.revokeObjectURL(objectUrl)
  }, 0)
}

export function createTemplateDownloadName(templateName: string) {
  const normalizedBaseName =
    templateName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'template'

  return `${normalizedBaseName}-${new Date().toISOString().slice(0, 10)}.template.json`
}

export async function readBlobAsDataUrl(blob: Blob) {
  if (typeof FileReader === 'undefined') {
    throw new Error('Template downloads are not supported in this environment.')
  }

  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('Template download failed.'))
        return
      }

      resolve(reader.result)
    }

    reader.onerror = () => {
      reject(new Error('Template download failed.'))
    }

    reader.readAsDataURL(blob)
  })
}
