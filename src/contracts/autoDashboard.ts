import { z } from 'zod'

/**
 * Settings for the optional Auto dashboard: a workspace LinkHub builds
 * from what the user opens most. Everything is off until the user turns it
 * on, every signal source is opt-in, and the AI step only runs with the
 * user's own API key. Settings are app-wide (not per workspace) and stay
 * out of canvas exports, because they can hold an API key.
 */

export const AUTO_HISTORY_DAYS = [7, 30, 90] as const
export const AUTO_REFRESH_HOURS = [0, 1, 6, 24] as const

export const AUTO_AI_MODELS = [
  'claude-opus-5-5',
  'claude-sonnet-5-5',
  'claude-haiku-5-5',
] as const

export const AutoAiModelSchema = z.enum(AUTO_AI_MODELS)
export type AutoAiModel = z.infer<typeof AutoAiModelSchema>

export const AUTO_AI_MODEL_LABELS: Record<AutoAiModel, string> = {
  'claude-opus-5-5': 'Opus',
  'claude-sonnet-5-5': 'Sonnet',
  'claude-haiku-5-5': 'Haiku',
}

export const AUTO_MAX_LINKS_LIMITS = { min: 4, max: 60 } as const
export const AUTO_MAX_PER_SITE_LIMITS = { min: 1, max: 6 } as const
export const AUTO_LIST_LIMIT = 200

const ListSchema = z
  .array(z.string().trim().min(1).max(2048))
  .max(AUTO_LIST_LIMIT)

export const AutoDashboardSettingsSchema = z.object({
  enabled: z.boolean(),
  /** Workspace the dashboard is written to; created on the first build. */
  workspaceId: z.string().min(1).optional(),
  lastBuiltAt: z.string().optional(),
  sources: z.object({
    /** Link opens LinkHub counts on its own cards. Needs no permission. */
    linkhub: z.boolean(),
    /** The browser's most visited sites (`topSites` permission). */
    topSites: z.boolean(),
    /** The browser history with visit counts (`history` permission). */
    history: z.boolean(),
  }),
  content: z.object({
    links: z.boolean(),
    feeds: z.boolean(),
    charts: z.boolean(),
  }),
  historyDays: z
    .number()
    .int()
    .refine((value) =>
      (AUTO_HISTORY_DAYS as readonly number[]).includes(value),
    ),
  /** 0 = rebuild only when asked. */
  refreshHours: z
    .number()
    .int()
    .refine((value) =>
      (AUTO_REFRESH_HOURS as readonly number[]).includes(value),
    ),
  maxLinks: z
    .number()
    .int()
    .min(AUTO_MAX_LINKS_LIMITS.min)
    .max(AUTO_MAX_LINKS_LIMITS.max),
  maxPerSite: z
    .number()
    .int()
    .min(AUTO_MAX_PER_SITE_LIMITS.min)
    .max(AUTO_MAX_PER_SITE_LIMITS.max),
  /** Hosts (`bank.example`) or URL prefixes that never show up. */
  excludedSites: ListSchema,
  /** URLs that always show up, whatever their score. */
  pinnedUrls: ListSchema,
  ai: z.object({
    enabled: z.boolean(),
    apiKey: z.string().trim().max(400),
    model: AutoAiModelSchema,
  }),
})

export type AutoDashboardSettings = z.infer<typeof AutoDashboardSettingsSchema>
export type AutoSourceKey = keyof AutoDashboardSettings['sources']
export type AutoContentKey = keyof AutoDashboardSettings['content']

export const DEFAULT_AUTO_DASHBOARD_SETTINGS: AutoDashboardSettings = {
  enabled: false,
  sources: { linkhub: true, topSites: false, history: false },
  content: { links: true, feeds: true, charts: true },
  historyDays: 30,
  refreshHours: 6,
  maxLinks: 24,
  maxPerSite: 3,
  excludedSites: [],
  pinnedUrls: [],
  ai: { enabled: false, apiKey: '', model: 'claude-opus-5-5' },
}

function pick<T>(value: unknown, schema: z.ZodType<T>, fallback: T): T {
  const parsed = schema.safeParse(value)

  return parsed.success ? parsed.data : fallback
}

/** Keeps every valid field of a stored record; the rest falls back. */
export function coerceAutoDashboardSettings(
  value: unknown,
): AutoDashboardSettings {
  const parsed = AutoDashboardSettingsSchema.safeParse(value)

  if (parsed.success) {
    return parsed.data
  }

  const defaults = DEFAULT_AUTO_DASHBOARD_SETTINGS
  const shape = AutoDashboardSettingsSchema.shape
  const raw =
    typeof value === 'object' && value !== null
      ? (value as Record<string, unknown>)
      : {}
  const rawSources = (raw.sources ?? {}) as Record<string, unknown>
  const rawContent = (raw.content ?? {}) as Record<string, unknown>
  const rawAi = (raw.ai ?? {}) as Record<string, unknown>

  return {
    enabled: pick(raw.enabled, shape.enabled, defaults.enabled),
    workspaceId: pick(raw.workspaceId, shape.workspaceId, undefined),
    lastBuiltAt: pick(raw.lastBuiltAt, shape.lastBuiltAt, undefined),
    sources: {
      linkhub: pick(rawSources.linkhub, z.boolean(), defaults.sources.linkhub),
      topSites: pick(
        rawSources.topSites,
        z.boolean(),
        defaults.sources.topSites,
      ),
      history: pick(rawSources.history, z.boolean(), defaults.sources.history),
    },
    content: {
      links: pick(rawContent.links, z.boolean(), defaults.content.links),
      feeds: pick(rawContent.feeds, z.boolean(), defaults.content.feeds),
      charts: pick(rawContent.charts, z.boolean(), defaults.content.charts),
    },
    historyDays: pick(raw.historyDays, shape.historyDays, defaults.historyDays),
    refreshHours: pick(
      raw.refreshHours,
      shape.refreshHours,
      defaults.refreshHours,
    ),
    maxLinks: pick(raw.maxLinks, shape.maxLinks, defaults.maxLinks),
    maxPerSite: pick(raw.maxPerSite, shape.maxPerSite, defaults.maxPerSite),
    excludedSites: pick(
      raw.excludedSites,
      shape.excludedSites,
      defaults.excludedSites,
    ),
    pinnedUrls: pick(raw.pinnedUrls, shape.pinnedUrls, defaults.pinnedUrls),
    ai: {
      enabled: pick(rawAi.enabled, z.boolean(), defaults.ai.enabled),
      apiKey: pick(rawAi.apiKey, shape.ai.shape.apiKey, defaults.ai.apiKey),
      model: pick(rawAi.model, AutoAiModelSchema, defaults.ai.model),
    },
  }
}

/** True when the Auto workspace is due for a rebuild on open. */
export function isAutoDashboardStale(
  settings: AutoDashboardSettings,
  now = Date.now(),
) {
  if (!settings.enabled || settings.refreshHours === 0) {
    return false
  }

  const lastBuilt = settings.lastBuiltAt ? Date.parse(settings.lastBuiltAt) : 0

  return (
    !Number.isFinite(lastBuilt) ||
    now - lastBuilt >= settings.refreshHours * 3600 * 1000
  )
}

/** One entry per line; blank lines and duplicates are dropped. */
export function parseAutoListDraft(draft: string): string[] {
  const seen = new Set<string>()
  const entries: string[] = []

  for (const line of draft.split(/\r?\n/)) {
    const entry = line.trim()

    if (!entry || entry.length > 2048 || seen.has(entry.toLowerCase())) {
      continue
    }

    seen.add(entry.toLowerCase())
    entries.push(entry)

    if (entries.length >= AUTO_LIST_LIMIT) {
      break
    }
  }

  return entries
}
