import type { CardGroup } from '../../contracts/cardGroup'
import {
  CHART_SETTING_KEYS,
  DEFAULT_CHART_SETTINGS,
  type ChartNode,
  type ChartSettingKey,
  type ChartSettings,
  type ChartSettingsOverrides,
} from '../../contracts/chartNode'
import type { PictureNode } from '../../contracts/pictureNode'
import { getGroupDepth } from '../groups/groupLayout'
import {
  getEntityPixelBounds,
  isWithinGroupBodyBounds,
} from '../groups/groupUtils'

/**
 * Chart settings cascade: defaults → outermost group → … → innermost group
 * → the chart itself. Each level only stores the keys it set explicitly, so
 * a value set on one chart never leaks to its siblings, and a group change
 * reaches exactly the members that still inherit that key.
 */

export type ChartSettingOrigin =
  | { level: 'default' }
  | { level: 'group'; groupId: string }
  | { level: 'chart' }

export type ResolvedChartSettings = {
  settings: ChartSettings
  origins: Record<ChartSettingKey, ChartSettingOrigin>
  /** Containing groups, outermost first. */
  groupChain: CardGroup[]
}

type Positioned = Pick<PictureNode, 'positionX' | 'positionY' | 'size'>

/** Groups whose (expanded) body contains the node, outermost first. */
export function getContainingGroupChain(
  node: Positioned,
  groups: CardGroup[],
  gridSize: number,
): CardGroup[] {
  const bounds = getEntityPixelBounds(node, gridSize)

  return groups
    .filter((group) => isWithinGroupBodyBounds(bounds, group, gridSize, true))
    .map((group) => ({ group, depth: getGroupDepth(groups, group.id) }))
    .sort((left, right) => left.depth - right.depth)
    .map((entry) => entry.group)
}

function getAncestorChain(groups: CardGroup[], groupId: string) {
  const byId = new Map(groups.map((group) => [group.id, group]))
  const chain: CardGroup[] = []
  let current = byId.get(groupId)

  while (current) {
    chain.unshift(current)
    current = current.parentGroupId
      ? byId.get(current.parentGroupId)
      : undefined
  }

  return chain
}

function cascade(
  levels: Array<{
    origin: ChartSettingOrigin
    overrides: ChartSettingsOverrides | undefined
  }>,
) {
  const settings = { ...DEFAULT_CHART_SETTINGS }
  const origins = Object.fromEntries(
    CHART_SETTING_KEYS.map((key) => [key, { level: 'default' }]),
  ) as Record<ChartSettingKey, ChartSettingOrigin>

  for (const { origin, overrides } of levels) {
    if (!overrides) {
      continue
    }

    for (const key of CHART_SETTING_KEYS) {
      const value = overrides[key]

      if (value !== undefined) {
        ;(settings as Record<ChartSettingKey, unknown>)[key] = value
        origins[key] = origin
      }
    }
  }

  return { settings, origins }
}

export function resolveChartSettings(
  chart: ChartNode,
  groups: CardGroup[],
  gridSize: number,
): ResolvedChartSettings {
  const groupChain = getContainingGroupChain(chart, groups, gridSize)
  const { settings, origins } = cascade([
    ...groupChain.map((group) => ({
      origin: { level: 'group', groupId: group.id } as ChartSettingOrigin,
      overrides: group.chartSettings,
    })),
    { origin: { level: 'chart' }, overrides: chart.settings },
  ])

  return { settings, origins, groupChain }
}

/** What the group itself would pass down (its ancestors + its own keys). */
export function resolveGroupChartSettings(
  groups: CardGroup[],
  groupId: string,
): ChartSettings {
  return cascade(
    getAncestorChain(groups, groupId).map((group) => ({
      origin: { level: 'group', groupId: group.id } as ChartSettingOrigin,
      overrides: group.chartSettings,
    })),
  ).settings
}

export function getGroupChartMembers(
  groupId: string,
  pictures: PictureNode[],
  groups: CardGroup[],
  gridSize: number,
): ChartNode[] {
  return pictures.filter(
    (node): node is ChartNode =>
      node.type === 'chart' &&
      getContainingGroupChain(node, groups, gridSize).some(
        (group) => group.id === groupId,
      ),
  )
}

export type GroupChartSettingSummary<K extends ChartSettingKey> = {
  /** Value the group passes down for this key. */
  groupValue: ChartSettings[K]
  memberCount: number
  /** Members that do NOT follow the group for this key. */
  overriddenChartIds: string[]
}

/**
 * A member "overrides" a key when its effective value comes from the chart
 * itself or from a group nested deeper than `groupId`.
 */
export function summarizeGroupChartSetting<K extends ChartSettingKey>(input: {
  groupId: string
  key: K
  pictures: PictureNode[]
  groups: CardGroup[]
  gridSize: number
}): GroupChartSettingSummary<K> {
  const { groupId, key, pictures, groups, gridSize } = input
  const members = getGroupChartMembers(groupId, pictures, groups, gridSize)
  const groupDepth = getGroupDepth(groups, groupId)
  const overriddenChartIds = members
    .filter((chart) => {
      const origin = resolveChartSettings(chart, groups, gridSize).origins[key]

      if (origin.level === 'chart') {
        return true
      }

      return (
        origin.level === 'group' &&
        origin.groupId !== groupId &&
        getGroupDepth(groups, origin.groupId) > groupDepth
      )
    })
    .map((chart) => chart.id)

  return {
    groupValue: resolveGroupChartSettings(groups, groupId)[key],
    memberCount: members.length,
    overriddenChartIds,
  }
}

function withoutKey<T extends ChartSettingsOverrides | undefined>(
  overrides: T,
  key: ChartSettingKey,
): T {
  if (!overrides || overrides[key] === undefined) {
    return overrides
  }

  const next = { ...overrides }
  delete next[key]

  return next as T
}

export function setChartOverride<K extends ChartSettingKey>(
  chart: ChartNode,
  key: K,
  value: ChartSettings[K] | undefined,
  now: string,
): ChartNode {
  return {
    ...chart,
    settings:
      value === undefined
        ? withoutKey(chart.settings, key)
        : { ...chart.settings, [key]: value },
    updatedAt: now,
  }
}

/**
 * Sets `key` on the group. Members keep their own value for that key unless
 * `force` is set, which clears the key on member charts and on nested
 * member groups so all of them follow the group again.
 */
export function applyGroupChartSetting<K extends ChartSettingKey>(input: {
  groupId: string
  key: K
  value: ChartSettings[K]
  force?: boolean
  pictures: PictureNode[]
  groups: CardGroup[]
  gridSize: number
  now: string
}): { groups: CardGroup[]; pictures: PictureNode[] } {
  const { groupId, key, value, force, pictures, groups, gridSize, now } = input
  const memberIds = force
    ? new Set(
        getGroupChartMembers(groupId, pictures, groups, gridSize).map(
          (chart) => chart.id,
        ),
      )
    : new Set<string>()
  const groupDepth = getGroupDepth(groups, groupId)
  const nestedGroupIds = force
    ? new Set(
        groups
          .filter(
            (group) =>
              group.id !== groupId &&
              getAncestorChain(groups, group.id).some(
                (ancestor) => ancestor.id === groupId,
              ) &&
              getGroupDepth(groups, group.id) > groupDepth,
          )
          .map((group) => group.id),
      )
    : new Set<string>()

  const nextGroups = groups.map((group) => {
    if (group.id === groupId) {
      return {
        ...group,
        chartSettings: { ...group.chartSettings, [key]: value },
        updatedAt: now,
      }
    }

    if (
      nestedGroupIds.has(group.id) &&
      group.chartSettings?.[key] !== undefined
    ) {
      return {
        ...group,
        chartSettings: withoutKey(group.chartSettings, key),
        updatedAt: now,
      }
    }

    return group
  })

  const nextPictures =
    memberIds.size === 0
      ? pictures
      : pictures.map((node) =>
          node.type === 'chart' &&
          memberIds.has(node.id) &&
          node.settings[key] !== undefined
            ? setChartOverride(node, key, undefined, now)
            : node,
        )

  return { groups: nextGroups, pictures: nextPictures }
}
