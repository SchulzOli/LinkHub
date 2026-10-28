import { describe, expect, it } from 'vitest'

import {
  mergeSyncRecords,
  type SyncRecord,
} from '../../../../src/features/sync/syncMerge'
import {
  listRemoteWorkspaces,
  scopeSyncRecords,
  workspaceImageIds,
} from '../../../../src/features/sync/syncScope'

const record = (hash: string, data: unknown = {}): SyncRecord => ({
  hash,
  updatedAt: '2026-10-28T10:00:00.000Z',
  data,
})

const work = record('w1', {
  name: 'Arbeit',
  cards: [{ faviconOverrideImageId: 'logo' }],
  pictures: [{ type: 'picture', imageId: 'chart' }, { type: 'note' }],
})
const homelab = record('h1', {
  name: 'Homelab',
  cards: [{ faviconOverrideImageId: 'jellyfin' }],
  pictures: [],
})

describe('sync scope', () => {
  it('finds the images a workspace uses', () => {
    expect(workspaceImageIds(work.data)).toEqual(['logo', 'chart'])
    expect(workspaceImageIds(null)).toEqual([])
  })

  it('syncs everything by default', () => {
    const local = { 'workspace:work': work }
    const scoped = scopeSyncRecords(undefined, local, {}, {})

    expect(scoped.local).toBe(local)
    expect(scoped.outside).toEqual({})
  })

  it('a work device gets only its chosen workspace and its images', () => {
    const remote = {
      'workspace:work': work,
      'workspace:homelab': homelab,
      'image:logo': record('i1'),
      'image:chart': record('i2'),
      'image:jellyfin': record('i3'),
      'theme:dark': record('t1'),
      directory: record('d1', { order: ['homelab', 'work'] }),
    }
    // The work device's own workspace, never shared.
    const local = { 'workspace:private': record('p1', { name: 'Notes' }) }
    const scoped = scopeSyncRecords(
      { mode: 'chosen', workspaceIds: ['work'] },
      local,
      remote,
      {},
    )
    const plan = mergeSyncRecords(scoped.local, scoped.remote, scoped.base)

    expect(plan.applyLocal.sort()).toEqual([
      'image:chart',
      'image:logo',
      'theme:dark',
      'workspace:work',
    ])
    expect(plan.pushRemote).toEqual([])
    expect(plan.deleteRemote).toEqual([])
    expect(Object.keys(scoped.outside).sort()).toEqual([
      'directory',
      'image:jellyfin',
      'workspace:homelab',
    ])
  })

  it('never deletes what it leaves out, and forgets its base', () => {
    const remote = { 'workspace:homelab': homelab }
    // The device had synced Homelab before and has it locally no more.
    const base = { 'workspace:homelab': 'h1', 'workspace:work': 'w1' }
    const scoped = scopeSyncRecords(
      { mode: 'chosen', workspaceIds: ['work'] },
      {},
      remote,
      base,
    )
    const plan = mergeSyncRecords(scoped.local, scoped.remote, scoped.base)

    expect(plan.deleteRemote).toEqual([])
    expect(scoped.base).toEqual({ 'workspace:work': 'w1' })
    expect({ ...scoped.outside, ...plan.remote }).toHaveProperty(
      'workspace:homelab',
    )
  })

  it('lists the workspaces of the sync by name', () => {
    expect(
      listRemoteWorkspaces({
        'workspace:work': work,
        'workspace:x': record('x', {}),
        'theme:dark': record('t1'),
      }),
    ).toEqual([
      { id: 'work', name: 'Arbeit' },
      { id: 'x', name: 'Workspace' },
    ])
  })
})
