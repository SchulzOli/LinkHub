import { describe, expect, it } from 'vitest'

import { createDefaultWorkspace } from '../../../src/contracts/workspace'
import { ensureLatestWorkspace } from '../../../src/storage/storageMigrations'

describe('storage migrations', () => {
  it('defaults analytics for legacy workspaces', () => {
    const workspace = createDefaultWorkspace()
    const legacyWorkspace = { ...workspace }

    Reflect.deleteProperty(legacyWorkspace, 'analytics')
    Reflect.deleteProperty(legacyWorkspace, 'pictures')

    const migratedWorkspace = ensureLatestWorkspace(legacyWorkspace)

    expect(migratedWorkspace.analytics).toEqual({
      dailyBuckets: {},
      totals: {
        canvasOpens: 0,
        linkOpens: 0,
        linkOpensByCardId: {},
      },
    })
    expect(migratedWorkspace.pictures).toEqual([])
  })

  it('coerces legacy picture nodes onto the workspace shape', () => {
    const migratedWorkspace = ensureLatestWorkspace({
      ...createDefaultWorkspace(),
      pictures: [
        {
          id: 'picture-1',
          imageId: 'image-1',
          positionX: 32,
          positionY: 64,
          size: { columns: 7.6, rows: 4.4 },
          createdAt: '2026-04-03T00:00:00.000Z',
          updatedAt: '2026-04-03T00:00:00.000Z',
        },
      ],
    })

    expect(migratedWorkspace.pictures).toEqual([
      expect.objectContaining({
        id: 'picture-1',
        type: 'picture',
        imageId: 'image-1',
        size: { columns: 8, rows: 4 },
      }),
    ])
  })
})
