import type { AutoDashboardSettings } from '../../contracts/autoDashboard'
import { MAX_FEED_SOURCES } from '../../contracts/feedNode'
import type { AutoCandidate } from './candidates'
import { classifyCandidateUrl, type AutoClassification } from './classify'

/**
 * What the Auto dashboard shows, before it is laid out on the canvas.
 * Built by rules first; the optional AI step may then regroup it.
 */
export type AutoPlanLink = { id: string; url: string; title: string }

export type AutoPlan = {
  linkGroups: Array<{ name: string; links: AutoPlanLink[] }>
  feeds: Array<{ id: string; url: string; title: string }>
  charts: Array<{ id: string; symbol: string; title: string }>
}

export type ClassifiedCandidate = AutoCandidate & {
  classification: AutoClassification
}

export const MAX_AUTO_CHARTS = 6
const RECENT_WINDOW_MS = 2 * 24 * 3600 * 1000

export function classifyCandidates(
  candidates: AutoCandidate[],
): ClassifiedCandidate[] {
  return candidates.map((candidate) => ({
    ...candidate,
    classification: classifyCandidateUrl(candidate.url),
  }))
}

export function getCandidateDisplayTitle(candidate: AutoCandidate) {
  return candidate.title || candidate.host
}

export function countPlanItems(plan: AutoPlan) {
  return {
    links: plan.linkGroups.reduce((sum, group) => sum + group.links.length, 0),
    feeds: plan.feeds.length,
    charts: plan.charts.length,
  }
}

/**
 * Feed and chart pages become feed sources and charts when that content is
 * on; otherwise (and for every other page) they stay plain links.
 */
export function buildHeuristicPlan(input: {
  candidates: ClassifiedCandidate[]
  content: AutoDashboardSettings['content']
  maxLinks: number
  now?: number
}): AutoPlan {
  const now = input.now ?? Date.now()
  const links: Array<AutoPlanLink & { recent: boolean }> = []
  const feeds: AutoPlan['feeds'] = []
  const charts: AutoPlan['charts'] = []
  const feedUrls = new Set<string>()
  const symbols = new Set<string>()

  for (const candidate of input.candidates) {
    const { classification } = candidate

    if (classification.kind === 'feed' && input.content.feeds) {
      if (
        !feedUrls.has(classification.feedUrl) &&
        feeds.length < MAX_FEED_SOURCES
      ) {
        feedUrls.add(classification.feedUrl)
        feeds.push({
          id: candidate.id,
          url: classification.feedUrl,
          title: classification.label,
        })
      }
      continue
    }

    if (classification.kind === 'chart' && input.content.charts) {
      if (
        !symbols.has(classification.symbol) &&
        charts.length < MAX_AUTO_CHARTS
      ) {
        symbols.add(classification.symbol)
        charts.push({
          id: candidate.id,
          symbol: classification.symbol,
          title: classification.symbol,
        })
      }
      continue
    }

    if (!input.content.links) {
      continue
    }

    if (links.length >= input.maxLinks && !candidate.pinned) {
      continue
    }

    links.push({
      id: candidate.id,
      url: candidate.url,
      title: getCandidateDisplayTitle(candidate),
      recent:
        candidate.lastVisitTime > 0 &&
        now - candidate.lastVisitTime <= RECENT_WINDOW_MS,
    })
  }

  const recent = links.filter((link) => link.recent)
  const frequent = links.filter((link) => !link.recent)
  const strip = ({ id, url, title }: AutoPlanLink) => ({ id, url, title })
  const linkGroups: AutoPlan['linkGroups'] = []

  if (recent.length > 0) {
    linkGroups.push({ name: 'Recently used', links: recent.map(strip) })
  }

  if (frequent.length > 0) {
    linkGroups.push({ name: 'Most used', links: frequent.map(strip) })
  }

  return { linkGroups, feeds, charts }
}
