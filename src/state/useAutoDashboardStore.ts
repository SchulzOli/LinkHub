import { create } from 'zustand'

import {
  DEFAULT_AUTO_DASHBOARD_SETTINGS,
  withSetupSwitches,
  type AutoDashboardSettings,
} from '../contracts/autoDashboard'
import { createDefaultWorkspace, type Workspace } from '../contracts/workspace'
import { requestAiPlan } from '../features/auto/aiPlanner'
import { readHistory, readTopSites } from '../features/auto/browserSignals'
import { buildAutoDashboard } from '../features/auto/buildAutoDashboard'
import {
  loadAutoDashboardSettings,
  saveAutoDashboardSettings,
} from '../storage/autoDashboardRepository'
import {
  loadWorkspace,
  saveWorkspace,
  saveWorkspaceSnapshot,
} from '../storage/workspaceRepository'
import { useNetworkFeaturesStore } from './useNetworkFeaturesStore'
import { useWorkspaceStore } from './useWorkspaceStore'
import { getPersistedWorkspace } from './workspaceStoreHelpers'

export type AutoDashboardStatus = {
  kind: 'idle' | 'busy' | 'success' | 'warning' | 'error'
  message: string
}

type AutoDashboardState = {
  settings: AutoDashboardSettings
  loaded: boolean
  status: AutoDashboardStatus
  load: () => Promise<AutoDashboardSettings>
  update: (
    change: (settings: AutoDashboardSettings) => AutoDashboardSettings,
  ) => Promise<void>
  /** Rebuilds the Auto workspace; creates (and opens) it the first time. */
  build: () => Promise<void>
}

const AUTO_WORKSPACE_NAME = 'Auto'

let loadPromise: Promise<AutoDashboardSettings> | null = null
let buildPromise: Promise<void> | null = null

async function loadOtherWorkspaces(autoWorkspaceId: string | undefined) {
  const state = useWorkspaceStore.getState()
  const workspaces: Workspace[] = []

  for (const summary of state.workspaceSummaries) {
    if (summary.id === autoWorkspaceId) {
      continue
    }

    if (summary.id === state.activeWorkspaceId) {
      workspaces.push(getPersistedWorkspace(state))
      continue
    }

    const stored = await loadWorkspace(summary.id)

    if (stored) {
      workspaces.push(stored)
    }
  }

  return workspaces
}

/** Writes the content into the Auto workspace and returns its id. */
async function writeAutoWorkspace(
  workspaceId: string | undefined,
  content: Pick<Workspace, 'cards' | 'groups' | 'pictures'>,
) {
  const state = useWorkspaceStore.getState()
  const exists =
    workspaceId !== undefined &&
    state.workspaceSummaries.some((summary) => summary.id === workspaceId)

  if (!exists) {
    await state.importWorkspace(
      createDefaultWorkspace({
        name: AUTO_WORKSPACE_NAME,
        // Match the look of the workspace the user is coming from.
        appearance: state.workspace.appearance,
        placementGuide: state.workspace.placementGuide,
        ...content,
      }),
    )

    return useWorkspaceStore.getState().activeWorkspaceId
  }

  const now = new Date().toISOString()

  if (workspaceId === state.activeWorkspaceId) {
    const next = { ...getPersistedWorkspace(state), ...content, updatedAt: now }

    saveWorkspaceSnapshot(next)
    await saveWorkspace(next)
    state.hydrateWorkspace(next)

    return workspaceId
  }

  const stored = await loadWorkspace(workspaceId)

  if (stored) {
    await saveWorkspace({ ...stored, ...content, updatedAt: now })
  }

  return workspaceId
}

function describeResult(
  result: Awaited<ReturnType<typeof buildAutoDashboard>>,
) {
  const { links, feeds, charts } = result.counts
  const parts = [
    `${links} link${links === 1 ? '' : 's'}`,
    `${feeds} feed${feeds === 1 ? '' : 's'}`,
    `${charts} chart${charts === 1 ? '' : 's'}`,
  ]

  return `Built ${parts.join(', ')}${result.usedAi ? ' (arranged by AI)' : ''}.`
}

export const useAutoDashboardStore = create<AutoDashboardState>((set, get) => ({
  settings: DEFAULT_AUTO_DASHBOARD_SETTINGS,
  loaded: false,
  status: { kind: 'idle', message: '' },
  load: () => {
    loadPromise ??= loadAutoDashboardSettings().then((settings) => {
      set({ settings, loaded: true })

      return settings
    })

    return loadPromise
  },
  update: async (change) => {
    const settings = change(get().settings)

    set({ settings })

    try {
      await saveAutoDashboardSettings(settings)
    } catch {
      set({
        status: { kind: 'error', message: 'Settings could not be saved.' },
      })
    }
  },
  build: () => {
    buildPromise ??= (async () => {
      const settings = withSetupSwitches(
        get().settings,
        useNetworkFeaturesStore.getState(),
      )
      const workspaceState = useWorkspaceStore.getState()

      if (!settings.enabled) {
        set({
          status: {
            kind: 'warning',
            message: 'The Auto dashboard is off. Turn it on in Menu → Privacy.',
          },
        })
        return
      }

      set({ status: { kind: 'busy', message: 'Building the Auto dashboard…' } })

      try {
        const result = await buildAutoDashboard(
          settings,
          {
            cardSize: workspaceState.workspace.appearance.defaultCardSize,
            gridSize: workspaceState.workspace.placementGuide.gridSize,
          },
          {
            readHistory: (days) => readHistory(days),
            readTopSites,
            loadLinkHubWorkspaces: () =>
              loadOtherWorkspaces(settings.workspaceId),
            requestAiPlan,
            locale:
              typeof navigator === 'undefined'
                ? 'en'
                : navigator.language || 'en',
            now: Date.now(),
          },
        )

        if (result.candidateCount === 0) {
          set({
            status: {
              kind: 'warning',
              message:
                'Nothing to show yet. Turn on a data source or open a few links first.',
            },
          })
          return
        }

        const workspaceId = await writeAutoWorkspace(
          settings.workspaceId,
          result.content,
        )

        await get().update((current) => ({
          ...current,
          workspaceId,
          lastBuiltAt: new Date().toISOString(),
        }))
        set({
          status: {
            kind: result.warnings.length > 0 ? 'warning' : 'success',
            message: [describeResult(result), ...result.warnings].join(' '),
          },
        })
      } catch {
        set({
          status: {
            kind: 'error',
            message: 'The Auto dashboard could not be built.',
          },
        })
      }
    })().finally(() => {
      buildPromise = null
    })

    return buildPromise
  },
}))
