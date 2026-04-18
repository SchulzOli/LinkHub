import { ThemeDocumentSchema, type ThemeDocument } from '../../contracts/theme'

export function exportThemeAsBlob(theme: ThemeDocument): Blob {
  return new Blob([JSON.stringify(theme, null, 2)], {
    type: 'application/json',
  })
}

export function createThemeFileName(theme: ThemeDocument): string {
  const slug = theme.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

  return `${slug}.linkhub-theme.json`
}

export async function importThemeFromFile(
  file: File,
): Promise<ThemeDocument | null> {
  const text = await file.text()

  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return null
  }

  const parsed = ThemeDocumentSchema.safeParse(raw)

  return parsed.success ? parsed.data : null
}
