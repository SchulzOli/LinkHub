import { useCallback, useEffect, useState } from 'react'

import type { AppearanceProfile } from '../../../contracts/appearanceProfile'
import type { TemplateDocument } from '../../../contracts/template'
import type { Workspace } from '../../../contracts/workspace'
import {
  loadWorkspaceStorageSnapshot,
  type WorkspaceStorageSnapshot,
} from '../../../features/analytics/workspaceStorage'
import { createTemplatePreviewDataUrl } from '../../../features/templates/templateLibrary'
import {
  getTemplateImageRecords,
  listTemplates,
  putTemplate,
} from '../../../storage/templateRepository'
import { listThemes } from '../../../storage/themeRepository'
import type { MenuTab } from './optionsMenuTabs'

export type StorageStatisticsState = {
  kind: 'error' | 'idle' | 'loading' | 'ready'
  message: string
  snapshot: WorkspaceStorageSnapshot | null
}

type UseOptionsMenuDataInput = {
  activeTab: MenuTab
  appearance: AppearanceProfile
  open: boolean
  workspace: Workspace
}

/**
 * Drives tab-scoped data loading for the Options Menu:
 *
 * - Saved theme / template counts when the Data tab opens.
 * - Workspace storage snapshot when the Statistics tab opens.
 *
 * Templates themselves are refreshed lazily by the Templates panel which
 * owns the corresponding error surfaces.
 */
export function useOptionsMenuData({
  activeTab,
  appearance,
  open,
  workspace,
}: UseOptionsMenuDataInput) {
  const [templates, setTemplates] = useState<TemplateDocument[]>([])
  const [savedTemplateCount, setSavedTemplateCount] = useState(0)
  const [savedThemeCount, setSavedThemeCount] = useState(0)
  const [storageStatistics, setStorageStatistics] =
    useState<StorageStatisticsState>({
      kind: 'idle',
      message: '',
      snapshot: null,
    })

  const refreshTemplates = useCallback(async () => {
    const storedTemplates = await listTemplates()
    const templatesWithPreviews = await Promise.all(
      storedTemplates.map(async (template) => {
        try {
          const imageRecords = await getTemplateImageRecords(template.id)
          const previewDataUrl = await createTemplatePreviewDataUrl({
            appearance,
            bundle: {
              cards: template.content.cards,
              groups: template.content.groups,
              pictures: template.content.pictures,
            },
            imageRecords,
          })

          if (!previewDataUrl) {
            return template
          }

          if (previewDataUrl === template.previewDataUrl) {
            return template
          }

          const nextTemplate = {
            ...template,
            previewDataUrl,
          } satisfies TemplateDocument

          await putTemplate({ records: imageRecords, template: nextTemplate })

          return nextTemplate
        } catch {
          return template
        }
      }),
    )

    const sortedTemplates = templatesWithPreviews.sort((left, right) =>
      right.updatedAt.localeCompare(left.updatedAt),
    )

    setTemplates(sortedTemplates)
    setSavedTemplateCount(sortedTemplates.length)
  }, [appearance])

  const refreshTemplateCount = useCallback(async () => {
    setSavedTemplateCount((await listTemplates()).length)
  }, [])

  const refreshThemeCount = useCallback(async () => {
    setSavedThemeCount((await listThemes()).length)
  }, [])

  useEffect(() => {
    if (!open || activeTab !== 'data') {
      return
    }

    void Promise.all([refreshTemplateCount(), refreshThemeCount()]).catch(
      () => undefined,
    )
  }, [activeTab, open, refreshTemplateCount, refreshThemeCount])

  useEffect(() => {
    if (!open || activeTab !== 'statistics') {
      return
    }

    let cancelled = false

    setStorageStatistics((current) =>
      current.snapshot
        ? {
            kind: 'ready',
            message: '',
            snapshot: current.snapshot,
          }
        : {
            kind: 'loading',
            message: '',
            snapshot: null,
          },
    )

    void loadWorkspaceStorageSnapshot(workspace)
      .then((snapshot) => {
        if (cancelled) {
          return
        }

        setStorageStatistics({
          kind: 'ready',
          message: '',
          snapshot,
        })
      })
      .catch(() => {
        if (cancelled) {
          return
        }

        setStorageStatistics((current) =>
          current.snapshot
            ? {
                kind: 'ready',
                message: '',
                snapshot: current.snapshot,
              }
            : {
                kind: 'error',
                message: 'Storage statistics could not be loaded.',
                snapshot: null,
              },
        )
      })

    return () => {
      cancelled = true
    }
  }, [activeTab, open, workspace])

  return {
    refreshTemplateCount,
    refreshTemplates,
    refreshThemeCount,
    savedTemplateCount,
    savedThemeCount,
    setTemplates,
    storageStatistics,
    templates,
  }
}
