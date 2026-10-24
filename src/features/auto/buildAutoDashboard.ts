import type { AutoDashboardSettings } from '../../contracts/autoDashboard'
import type { CardSize } from '../../contracts/linkCard'
import type { Workspace } from '../../contracts/workspace'
import {
  applyAiPlan,
  AutoAiError,
  buildAiPromptItems,
  buildAiUserMessage,
  type AiPlan,
} from './aiPlanner'
import type { BrowserVisit } from './browserSignals'
import { buildAutoCandidates, type AutoSignal } from './candidates'
import { layoutAutoPlan, type AutoWorkspaceContent } from './layout'
import {
  buildHeuristicPlan,
  classifyCandidates,
  countPlanItems,
  type AutoPlan,
} from './plan'

export type AutoBuildDeps = {
  readHistory: (days: number) => Promise<BrowserVisit[]>
  readTopSites: () => Promise<BrowserVisit[]>
  /** Every workspace except the Auto one, for LinkHub's own click counts. */
  loadLinkHubWorkspaces: () => Promise<Workspace[]>
  requestAiPlan: (input: {
    apiKey: string
    model: AutoDashboardSettings['ai']['model']
    userMessage: string
  }) => Promise<AiPlan>
  locale: string
  now: number
}

export type AutoBuildResult = {
  content: AutoWorkspaceContent
  plan: AutoPlan
  counts: ReturnType<typeof countPlanItems>
  candidateCount: number
  usedAi: boolean
  warnings: string[]
}

const DAY_MS = 24 * 3600 * 1000

function parseLocalDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number)

  if (!year || !month || !day) {
    return 0
  }

  // Midday: the bucket says "that day", not when exactly.
  return new Date(year, month - 1, day, 12).getTime()
}

/** Link opens counted on LinkHub's own cards, inside the time window. */
export function collectLinkHubSignals(
  workspaces: Workspace[],
  days: number,
  now: number,
): AutoSignal[] {
  const since = now - days * DAY_MS
  const signals: AutoSignal[] = []

  for (const workspace of workspaces) {
    const cardsById = new Map(workspace.cards.map((card) => [card.id, card]))
    const perCard = new Map<string, { count: number; last: number }>()

    for (const [dateKey, bucket] of Object.entries(
      workspace.analytics.dailyBuckets,
    )) {
      const time = parseLocalDateKey(dateKey)

      if (time < since) {
        continue
      }

      for (const [cardId, count] of Object.entries(bucket.linkOpensByCardId)) {
        const entry = perCard.get(cardId) ?? { count: 0, last: 0 }

        entry.count += count
        entry.last = Math.max(entry.last, time)
        perCard.set(cardId, entry)
      }
    }

    for (const [cardId, entry] of perCard) {
      const card = cardsById.get(cardId)

      if (card) {
        signals.push({
          url: card.url,
          title: card.title,
          count: entry.count,
          lastVisitTime: entry.last,
          source: 'linkhub',
        })
      }
    }
  }

  return signals
}

function toSignals(visits: BrowserVisit[], source: AutoSignal['source']) {
  return visits.map((visit) => ({
    url: visit.url,
    title: visit.title,
    count: visit.visitCount,
    lastVisitTime: visit.lastVisitTime,
    source,
  }))
}

async function collectSignals(
  settings: AutoDashboardSettings,
  deps: AutoBuildDeps,
  warnings: string[],
) {
  const tasks: Array<Promise<AutoSignal[]>> = []

  if (settings.sources.linkhub) {
    tasks.push(
      deps
        .loadLinkHubWorkspaces()
        .then((workspaces) =>
          collectLinkHubSignals(workspaces, settings.historyDays, deps.now),
        ),
    )
  }

  if (settings.sources.topSites) {
    tasks.push(
      deps.readTopSites().then((visits) => toSignals(visits, 'topSites')),
    )
  }

  if (settings.sources.history) {
    tasks.push(
      deps
        .readHistory(settings.historyDays)
        .then((visits) => toSignals(visits, 'history')),
    )
  }

  const results = await Promise.allSettled(tasks)

  return results.flatMap((result) => {
    if (result.status === 'fulfilled') {
      return result.value
    }

    warnings.push('One data source could not be read.')

    return []
  })
}

export async function buildAutoDashboard(
  settings: AutoDashboardSettings,
  options: { cardSize: CardSize; gridSize: number },
  deps: AutoBuildDeps,
): Promise<AutoBuildResult> {
  const warnings: string[] = []
  const signals = await collectSignals(settings, deps, warnings)
  const candidates = classifyCandidates(
    buildAutoCandidates({
      signals,
      pinnedUrls: settings.pinnedUrls,
      excludedSites: settings.excludedSites,
      maxPerSite: settings.maxPerSite,
      now: deps.now,
    }),
  )
  const heuristic = buildHeuristicPlan({
    candidates,
    content: settings.content,
    maxLinks: settings.maxLinks,
    now: deps.now,
  })
  let plan = heuristic
  let usedAi = false

  if (settings.ai.enabled && candidates.length > 0) {
    if (!settings.ai.apiKey) {
      warnings.push('AI is on but no API key is set; used the rules only.')
    } else {
      try {
        const { items, idToCandidateId } = buildAiPromptItems(
          candidates,
          deps.now,
        )
        const ai = await deps.requestAiPlan({
          apiKey: settings.ai.apiKey,
          model: settings.ai.model,
          userMessage: buildAiUserMessage(items, deps.locale),
        })

        plan = applyAiPlan({
          ai,
          candidates,
          idToCandidateId,
          heuristic,
          content: settings.content,
          maxLinks: settings.maxLinks,
        })
        usedAi = true
      } catch (error) {
        warnings.push(
          `${error instanceof AutoAiError ? error.message : 'The AI step failed.'} Used the rules only.`,
        )
      }
    }
  }

  return {
    content: layoutAutoPlan(plan, options),
    plan,
    counts: countPlanItems(plan),
    candidateCount: candidates.length,
    usedAi,
    warnings,
  }
}
