import { ThemeDocumentSchema, type ThemeDocument } from '../contracts/theme'
import { openLinkhavenDb, STORAGE_STORES } from './db'

function toSerializableTheme(theme: ThemeDocument) {
  return JSON.parse(JSON.stringify(theme))
}

export async function listThemes() {
  const db = await openLinkhavenDb()
  const rawThemes = (await db.getAll(STORAGE_STORES.theme)) as unknown[]

  return rawThemes
    .flatMap((raw) => {
      const parsed = ThemeDocumentSchema.safeParse(raw)

      return parsed.success ? [parsed.data] : []
    })
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
}

export async function getTheme(themeId: string) {
  const db = await openLinkhavenDb()
  const raw = await db.get(STORAGE_STORES.theme, themeId)

  if (!raw) {
    return null
  }

  const parsed = ThemeDocumentSchema.safeParse(raw)

  return parsed.success ? parsed.data : null
}

export async function putTheme(theme: ThemeDocument) {
  const db = await openLinkhavenDb()

  await db.put(STORAGE_STORES.theme, toSerializableTheme(theme), theme.id)
}

export async function deleteTheme(themeId: string) {
  const db = await openLinkhavenDb()
  const transaction = db.transaction([STORAGE_STORES.theme], 'readwrite')

  await transaction.objectStore(STORAGE_STORES.theme).delete(themeId)
  await transaction.done
}
