import { describe, expect, it } from 'vitest'

import {
  hashSyncContent,
  mergeSyncRecords,
  stableStringify,
  type SyncRecord,
} from '../../../../src/features/sync/syncMerge'

function record(hash: string, updatedAt = '2026-10-01T00:00:00.000Z') {
  return { hash, updatedAt, data: { hash } } satisfies SyncRecord
}

describe('sync merge', () => {
  it('takes a change from whichever side made it', () => {
    const plan = mergeSyncRecords(
      { 'workspace:a': record('a2'), 'workspace:b': record('b1') },
      { 'workspace:a': record('a1'), 'workspace:b': record('b2') },
      { 'workspace:a': 'a1', 'workspace:b': 'b1' },
    )

    expect(plan.pushRemote).toEqual(['workspace:a'])
    expect(plan.applyLocal).toEqual(['workspace:b'])
    expect(plan.remote['workspace:a'].hash).toBe('a2')
    expect(plan.base).toEqual({ 'workspace:a': 'a2', 'workspace:b': 'b2' })
  })

  it('adds new records on both sides', () => {
    const plan = mergeSyncRecords(
      { 'theme:here': record('t1') },
      { 'theme:there': record('t2') },
      {},
    )

    expect(plan.pushRemote).toEqual(['theme:here'])
    expect(plan.applyLocal).toEqual(['theme:there'])
  })

  it('follows a deletion made on either side', () => {
    const plan = mergeSyncRecords(
      { 'image:kept-remote': record('k1') },
      { 'image:deleted-here': record('d1') },
      { 'image:deleted-here': 'd1', 'image:kept-remote': 'k1' },
    )

    expect(plan.deleteRemote).toEqual(['image:deleted-here'])
    expect(plan.deleteLocal).toEqual(['image:kept-remote'])
    expect(plan.remote).toEqual({})
    expect(plan.base).toEqual({})
  })

  it('lets an edit win over a deletion', () => {
    const plan = mergeSyncRecords(
      { 'workspace:a': record('a2') },
      {},
      { 'workspace:a': 'a1' },
    )

    expect(plan.pushRemote).toEqual(['workspace:a'])
    expect(plan.deleteLocal).toEqual([])
  })

  it('keeps the newer of two edits and a copy of the losing workspace', () => {
    const plan = mergeSyncRecords(
      { 'workspace:a': record('local', '2026-10-02T00:00:00.000Z') },
      { 'workspace:a': record('remote', '2026-10-03T00:00:00.000Z') },
      { 'workspace:a': 'base' },
    )

    expect(plan.applyLocal).toEqual(['workspace:a'])
    expect(plan.conflictCopies).toEqual([{ key: 'workspace:a', from: 'local' }])

    const newerHere = mergeSyncRecords(
      { 'workspace:a': record('local', '2026-10-04T00:00:00.000Z') },
      { 'workspace:a': record('remote', '2026-10-03T00:00:00.000Z') },
      { 'workspace:a': 'base' },
    )

    expect(newerHere.pushRemote).toEqual(['workspace:a'])
    expect(newerHere.conflictCopies).toEqual([
      { key: 'workspace:a', from: 'remote' },
    ])
  })

  it('never lets an empty workspace replace one with content', () => {
    const freshInstall = mergeSyncRecords(
      {
        'workspace:default': {
          ...record('empty', '2026-10-09T00:00:00.000Z'),
          empty: true,
        },
      },
      { 'workspace:default': record('cards', '2026-10-01T00:00:00.000Z') },
      {},
    )

    expect(freshInstall.applyLocal).toEqual(['workspace:default'])
    expect(freshInstall.conflictCopies).toEqual([])
  })

  it('does nothing when both sides already agree', () => {
    const plan = mergeSyncRecords(
      { 'workspace:a': record('same') },
      { 'workspace:a': record('same') },
      {},
    )

    expect(plan).toMatchObject({
      applyLocal: [],
      pushRemote: [],
      deleteLocal: [],
      deleteRemote: [],
      base: { 'workspace:a': 'same' },
    })
  })

  it('hashes content independent of key order', async () => {
    expect(stableStringify({ b: 1, a: [1, { d: 2, c: undefined }] })).toBe(
      '{"a":[1,{"d":2}],"b":1}',
    )
    expect(await hashSyncContent({ a: 1, b: 2 })).toBe(
      await hashSyncContent({ b: 2, a: 1 }),
    )
  })
})
