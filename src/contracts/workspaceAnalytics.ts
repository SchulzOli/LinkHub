import { z } from 'zod'

const CountRecordSchema = z.record(z.string(), z.number().int().nonnegative())

export const WorkspaceAnalyticsDailyBucketSchema = z.object({
  canvasOpens: z.number().int().nonnegative(),
  linkOpens: z.number().int().nonnegative(),
  linkOpensByCardId: CountRecordSchema,
})

export const WorkspaceAnalyticsSchema = z.object({
  dailyBuckets: z.record(z.string(), WorkspaceAnalyticsDailyBucketSchema),
  totals: z.object({
    canvasOpens: z.number().int().nonnegative(),
    linkOpens: z.number().int().nonnegative(),
    linkOpensByCardId: CountRecordSchema,
  }),
})

export type WorkspaceAnalyticsDailyBucket = z.infer<
  typeof WorkspaceAnalyticsDailyBucketSchema
>
export type WorkspaceAnalytics = z.infer<typeof WorkspaceAnalyticsSchema>

export function createDefaultWorkspaceAnalytics(): WorkspaceAnalytics {
  return {
    dailyBuckets: {},
    totals: {
      canvasOpens: 0,
      linkOpens: 0,
      linkOpensByCardId: {},
    },
  }
}

function coerceNonNegativeInteger(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.trunc(value)
    : 0
}

function coerceCountRecord(value: unknown) {
  if (typeof value !== 'object' || value === null) {
    return {}
  }

  return Object.fromEntries(
    Object.entries(value)
      .map(([key, count]) => [key, coerceNonNegativeInteger(count)] as const)
      .filter(([, count]) => count > 0),
  )
}

function coerceDailyBucket(value: unknown): WorkspaceAnalyticsDailyBucket {
  if (typeof value !== 'object' || value === null) {
    return {
      canvasOpens: 0,
      linkOpens: 0,
      linkOpensByCardId: {},
    }
  }

  const bucket = value as Partial<WorkspaceAnalyticsDailyBucket>

  return {
    canvasOpens: coerceNonNegativeInteger(bucket.canvasOpens),
    linkOpens: coerceNonNegativeInteger(bucket.linkOpens),
    linkOpensByCardId: coerceCountRecord(bucket.linkOpensByCardId),
  }
}

export function coerceWorkspaceAnalytics(value: unknown): WorkspaceAnalytics {
  const parsed = WorkspaceAnalyticsSchema.safeParse(value)

  if (parsed.success) {
    return parsed.data
  }

  if (typeof value !== 'object' || value === null) {
    return createDefaultWorkspaceAnalytics()
  }

  const analytics = value as Partial<WorkspaceAnalytics>
  const dailyBucketsSource =
    typeof analytics.dailyBuckets === 'object' &&
    analytics.dailyBuckets !== null
      ? analytics.dailyBuckets
      : {}

  return {
    dailyBuckets: Object.fromEntries(
      Object.entries(dailyBucketsSource).map(([dateKey, bucket]) => [
        dateKey,
        coerceDailyBucket(bucket),
      ]),
    ),
    totals: {
      canvasOpens: coerceNonNegativeInteger(analytics.totals?.canvasOpens),
      linkOpens: coerceNonNegativeInteger(analytics.totals?.linkOpens),
      linkOpensByCardId: coerceCountRecord(analytics.totals?.linkOpensByCardId),
    },
  }
}
