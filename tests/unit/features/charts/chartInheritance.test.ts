import { beforeEach, describe, expect, it } from 'vitest'

import type { CardGroup } from '../../../../src/contracts/cardGroup'
import {
  DEFAULT_CHART_SETTINGS,
  type ChartNode,
} from '../../../../src/contracts/chartNode'
import type { PictureNode } from '../../../../src/contracts/pictureNode'
import { createDefaultWorkspace } from '../../../../src/contracts/workspace'
import {
  applyGroupChartSetting,
  getGroupChartMembers,
  resolveChartSettings,
  summarizeGroupChartSetting,
} from '../../../../src/features/charts/chartInheritance'
import { useWorkspaceStore } from '../../../../src/state/useWorkspaceStore'

const GRID = 24
const NOW = '2026-10-04T12:00:00.000Z'

function group(overrides: Partial<CardGroup> = {}): CardGroup {
  return {
    id: 'outer',
    name: 'Stocks',
    positionX: 0,
    positionY: 0,
    size: { columns: 40, rows: 30 },
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  }
}

function chart(id: string, overrides: Partial<ChartNode> = {}): ChartNode {
  return {
    id,
    type: 'chart',
    source: { url: 'ws://127.0.0.1:8787/feed', symbol: id.toUpperCase() },
    settings: {},
    // Below the header (body starts at padding + header + gap).
    positionX: 24,
    positionY: 48,
    size: { columns: 12, rows: 8 },
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  }
}

function findChart(pictures: PictureNode[], id: string) {
  const node = pictures.find((picture) => picture.id === id)

  if (node?.type !== 'chart') {
    throw new Error(`chart ${id} missing`)
  }

  return node
}

describe('chart setting inheritance', () => {
  const outsideChart = chart('outside', { positionX: 2400, positionY: 2400 })
  const a = chart('a')
  const b = chart('b', { positionX: 24 * 15 })
  const groups = [group({ chartSettings: { range: '5Y' } })]

  it('uses defaults outside groups and the group value inside', () => {
    expect(resolveChartSettings(outsideChart, groups, GRID).settings).toEqual(
      DEFAULT_CHART_SETTINGS,
    )

    const resolved = resolveChartSettings(a, groups, GRID)

    expect(resolved.settings.range).toBe('5Y')
    expect(resolved.origins.range).toEqual({ level: 'group', groupId: 'outer' })
    expect(resolved.origins.overlay).toEqual({ level: 'default' })
  })

  it('detects chart members of a group', () => {
    expect(
      getGroupChartMembers('outer', [a, b, outsideChart], groups, GRID).map(
        (node) => node.id,
      ),
    ).toEqual(['a', 'b'])
  })

  it('keeps a value set on one chart when the group changes it', () => {
    const ownA = chart('a', { settings: { range: '1M' } })
    let pictures: PictureNode[] = [ownA, b, outsideChart]

    expect(
      summarizeGroupChartSetting({
        groupId: 'outer',
        key: 'range',
        pictures,
        groups,
        gridSize: GRID,
      }),
    ).toEqual({
      groupValue: '5Y',
      memberCount: 2,
      overriddenChartIds: ['a'],
    })

    const next = applyGroupChartSetting({
      groupId: 'outer',
      key: 'range',
      value: 'MAX',
      pictures,
      groups,
      gridSize: GRID,
      now: NOW,
    })

    pictures = next.pictures

    expect(
      resolveChartSettings(findChart(pictures, 'a'), next.groups, GRID).settings
        .range,
    ).toBe('1M')
    expect(
      resolveChartSettings(findChart(pictures, 'b'), next.groups, GRID).settings
        .range,
    ).toBe('MAX')
    expect(
      resolveChartSettings(findChart(pictures, 'outside'), next.groups, GRID)
        .settings.range,
    ).toBe(DEFAULT_CHART_SETTINGS.range)
    // Other keys of chart a are untouched.
    expect(findChart(pictures, 'a').settings).toEqual({ range: '1M' })
  })

  it('applies to overridden members only when forced', () => {
    const pictures: PictureNode[] = [
      chart('a', { settings: { range: '1M', overlay: 'sma50' } }),
      b,
    ]
    const next = applyGroupChartSetting({
      groupId: 'outer',
      key: 'range',
      value: '3Y',
      force: true,
      pictures,
      groups,
      gridSize: GRID,
      now: NOW,
    })
    const forcedA = findChart(next.pictures, 'a')

    expect(forcedA.settings).toEqual({ overlay: 'sma50' })
    expect(
      resolveChartSettings(forcedA, next.groups, GRID).settings.range,
    ).toBe('3Y')
  })

  it('lets a nested group win over its parent and treats it as an override', () => {
    const nested = [
      group({ chartSettings: { range: '5Y' } }),
      group({
        id: 'inner',
        name: 'Tech',
        parentGroupId: 'outer',
        positionX: 24,
        positionY: 48,
        size: { columns: 20, rows: 14 },
        chartSettings: { range: '1D' },
      }),
    ]
    const innerChart = chart('inner-chart', { positionX: 48, positionY: 96 })
    const outerOnly = chart('outer-chart', {
      positionX: 24 * 25,
      positionY: 96,
    })
    const pictures: PictureNode[] = [innerChart, outerOnly]

    expect(resolveChartSettings(innerChart, nested, GRID).settings.range).toBe(
      '1D',
    )
    expect(
      summarizeGroupChartSetting({
        groupId: 'outer',
        key: 'range',
        pictures,
        groups: nested,
        gridSize: GRID,
      }).overriddenChartIds,
    ).toEqual(['inner-chart'])

    const soft = applyGroupChartSetting({
      groupId: 'outer',
      key: 'range',
      value: 'YTD',
      pictures,
      groups: nested,
      gridSize: GRID,
      now: NOW,
    })

    expect(
      resolveChartSettings(innerChart, soft.groups, GRID).settings.range,
    ).toBe('1D')
    expect(
      resolveChartSettings(outerOnly, soft.groups, GRID).settings.range,
    ).toBe('YTD')

    const forced = applyGroupChartSetting({
      groupId: 'outer',
      key: 'range',
      value: 'YTD',
      force: true,
      pictures,
      groups: nested,
      gridSize: GRID,
      now: NOW,
    })

    expect(
      forced.groups.find((entry) => entry.id === 'inner')?.chartSettings,
    ).toEqual({})
    expect(
      resolveChartSettings(innerChart, forced.groups, GRID).settings.range,
    ).toBe('YTD')
  })
})

describe('workspace store chart actions', () => {
  beforeEach(() => {
    useWorkspaceStore.setState({
      undoStack: [],
      workspace: createDefaultWorkspace({
        groups: [group()],
        pictures: [chart('a'), chart('b', { positionX: 24 * 15 })],
      }),
    })
  })

  it('sets a value on one chart without touching its siblings', () => {
    useWorkspaceStore.getState().setChartSetting('a', 'overlay', 'sma20')

    const { workspace } = useWorkspaceStore.getState()

    expect(findChart(workspace.pictures, 'a').settings).toEqual({
      overlay: 'sma20',
    })
    expect(findChart(workspace.pictures, 'b').settings).toEqual({})
  })

  it('propagates group changes and resets all overrides in one undo step', () => {
    const store = useWorkspaceStore.getState()

    store.setChartSetting('a', 'range', '1M')
    store.setChartSetting('b', 'live', false)
    store.setGroupChartSetting('outer', 'range', '5Y')

    let { workspace } = useWorkspaceStore.getState()

    expect(
      resolveChartSettings(
        findChart(workspace.pictures, 'a'),
        workspace.groups,
        GRID,
      ).settings.range,
    ).toBe('1M')
    expect(
      resolveChartSettings(
        findChart(workspace.pictures, 'b'),
        workspace.groups,
        GRID,
      ).settings.range,
    ).toBe('5Y')

    const undoDepth = useWorkspaceStore.getState().undoStack.length

    useWorkspaceStore.getState().resetGroupChartOverrides('outer')
    workspace = useWorkspaceStore.getState().workspace

    expect(findChart(workspace.pictures, 'a').settings).toEqual({})
    expect(findChart(workspace.pictures, 'b').settings).toEqual({})
    expect(useWorkspaceStore.getState().undoStack.length).toBe(undoDepth + 1)
  })

  it('moves member charts with their group', () => {
    useWorkspaceStore.getState().moveGroup('outer', { x: 240, y: 480 })

    const { workspace } = useWorkspaceStore.getState()

    expect(findChart(workspace.pictures, 'a')).toMatchObject({
      positionX: 24 + 240,
      positionY: 48 + 480,
    })
  })
})
