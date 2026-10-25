import { IDBFactory } from 'fake-indexeddb'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { LinkCard } from '../../../../src/contracts/linkCard'
import {
  decryptSyncBytes,
  deriveSyncKey,
  encryptSyncBytes,
  SyncDecryptError,
} from '../../../../src/features/sync/syncCrypto'
import {
  createWebDavTransport,
  normalizeSyncFolderUrl,
  SyncWriteConflictError,
} from '../../../../src/features/sync/webdavTransport'
import { useNetworkFeaturesStore } from '../../../../src/state/useNetworkFeaturesStore'
import { useSyncStore } from '../../../../src/state/useSyncStore'
import { useWorkspaceStore } from '../../../../src/state/useWorkspaceStore'
import { getPersistedWorkspace } from '../../../../src/state/workspaceStoreHelpers'
import {
  loadWorkspaceSession,
  saveWorkspace,
  saveWorkspaceSnapshot,
} from '../../../../src/storage/workspaceRepository'
import { createFakeWebDav } from './fakeWebDav'

function createCard(overrides: Partial<LinkCard> = {}): LinkCard {
  return {
    id: 'card-1',
    url: 'https://docs.example.com/',
    title: 'Team docs',
    faviconUrl: '',
    positionX: 24,
    positionY: 24,
    size: { columns: 5, rows: 5 },
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    ...overrides,
  }
}

/** One simulated device: its own IndexedDB and localStorage. */
type Device = { indexedDB: IDBFactory; storage: Map<string, string> }

/** Saves the open workspace like the app's autosave, then the device. */
async function saveDevice(): Promise<Device> {
  const persisted = getPersistedWorkspace(useWorkspaceStore.getState())

  saveWorkspaceSnapshot(persisted)
  await saveWorkspace(persisted)

  const storage = new Map<string, string>()

  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index) as string

    storage.set(key, window.localStorage.getItem(key) as string)
  }

  return { indexedDB: globalThis.indexedDB as IDBFactory, storage }
}

async function openDevice(device: Device | null) {
  globalThis.indexedDB = device?.indexedDB ?? new IDBFactory()
  window.localStorage.clear()

  for (const [key, value] of device?.storage ?? []) {
    window.localStorage.setItem(key, value)
  }

  useNetworkFeaturesStore.getState().setFeature('deviceSync', true)
  useWorkspaceStore
    .getState()
    .initializeWorkspaceSession(await loadWorkspaceSession())
  useSyncStore.setState({
    connection: null,
    status: { kind: 'idle', message: '' },
  })
}

const PASSPHRASE = 'correct horse battery staple'

describe('device sync', () => {
  let server: ReturnType<typeof createFakeWebDav>
  const folder = 'https://dav.example.test/me/Linkhaven/'

  beforeEach(() => {
    server = createFakeWebDav()
    vi.stubGlobal('fetch', server.fetch)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('encrypts with the passphrase and refuses tampering', async () => {
    const key = await deriveSyncKey('passphrase', new Uint8Array(16), 1000)
    const plain = new TextEncoder().encode('Team docs')
    const sealed = await encryptSyncBytes(key, 'state.bin', plain)

    expect(new TextDecoder().decode(sealed)).not.toContain('Team docs')
    expect([...(await decryptSyncBytes(key, 'state.bin', sealed))]).toEqual([
      ...plain,
    ])
    // Bound to its path: a file moved elsewhere doesn't decrypt.
    await expect(
      decryptSyncBytes(key, 'images/x.bin', sealed),
    ).rejects.toBeInstanceOf(SyncDecryptError)

    const other = await deriveSyncKey('other', new Uint8Array(16), 1000)

    await expect(
      decryptSyncBytes(other, 'state.bin', sealed),
    ).rejects.toBeInstanceOf(SyncDecryptError)
  })

  it('writes with ETags so two devices never overwrite each other', async () => {
    const transport = createWebDavTransport({
      url: 'https://dav.example.test/me/Linkhaven',
      username: 'me',
      password: 'secret',
      fetch: server.fetch,
    })

    expect(transport.url).toBe(folder)
    expect(normalizeSyncFolderUrl(' https://a.test/dav?x=1#y ')).toBe(
      'https://a.test/dav/',
    )
    expect(() => normalizeSyncFolderUrl('ftp://a.test/')).toThrow()

    await transport.write('state.bin', new Uint8Array([1]), { ifMatch: null })

    const first = await transport.read('state.bin')

    await transport.write('state.bin', new Uint8Array([2]), {
      ifMatch: first?.etag,
    })
    await expect(
      transport.write('state.bin', new Uint8Array([3]), {
        ifMatch: first?.etag,
      }),
    ).rejects.toBeInstanceOf(SyncWriteConflictError)
    expect([...((await transport.read('state.bin'))?.data ?? [])]).toEqual([2])
    expect(await transport.read('missing.bin')).toBeNull()
  })

  it('syncs workspaces between two devices, end-to-end encrypted', async () => {
    // Device A: a card in Home and a second workspace.
    await openDevice(null)
    useWorkspaceStore.getState().addCard(createCard())
    await useWorkspaceStore.getState().createWorkspace()
    await useWorkspaceStore
      .getState()
      .renameWorkspace(useWorkspaceStore.getState().activeWorkspaceId, 'Work')

    const connected = await useSyncStore.getState().connect({
      url: folder,
      username: 'me',
      password: 'secret',
      passphrase: PASSPHRASE,
      deviceName: 'Laptop',
    })

    expect(connected).toBe(true)
    expect(useSyncStore.getState().status.message).toBe('Synced: 3 sent.')

    const deviceA = await saveDevice()
    const aConnection = useSyncStore.getState().connection

    // Only ciphertext and the public salt reach the server.
    for (const [path, file] of server.files) {
      if (!path.endsWith('linkhaven-sync.json')) {
        expect(new TextDecoder().decode(file.data)).not.toContain('Team docs')
      }
    }

    // Device B: fresh install. A wrong passphrase is caught at once.
    await openDevice(null)

    expect(
      await useSyncStore.getState().connect({
        url: folder,
        username: 'me',
        password: 'secret',
        passphrase: 'not the passphrase',
        deviceName: 'Phone',
      }),
    ).toBe(false)
    expect(useSyncStore.getState().status.message).toMatch(/passphrase/)

    await useSyncStore.getState().connect({
      url: folder,
      username: 'me',
      password: 'secret',
      passphrase: PASSPHRASE,
      deviceName: 'Phone',
    })

    const phone = useWorkspaceStore.getState()
    const names = phone.workspaceSummaries.map((summary) => summary.name)

    expect(names).toEqual(['Home', 'Work'])

    // B renames the card in Home and deletes Work.
    const home = phone.workspaceSummaries.find((s) => s.name === 'Home')
    const work = phone.workspaceSummaries.find((s) => s.name === 'Work')

    await phone.switchWorkspace(home!.id)
    expect(useWorkspaceStore.getState().workspace.cards[0]?.title).toBe(
      'Team docs',
    )
    useWorkspaceStore.getState().updateCard('card-1', { title: 'Docs' })
    await useWorkspaceStore.getState().deleteWorkspace(work!.id)
    await useSyncStore.getState().sync()

    // Back on A: the rename and the deletion arrive.
    await openDevice(deviceA)
    useSyncStore.setState({ connection: aConnection })
    await useSyncStore.getState().sync()

    const laptop = useWorkspaceStore.getState()

    expect(laptop.workspaceSummaries.map((summary) => summary.name)).toEqual([
      'Home',
    ])
    expect(laptop.workspace.name).toBe('Home')
    expect(laptop.workspace.cards[0]?.title).toBe('Docs')
  })

  it('keeps both versions when two devices edit the same workspace', async () => {
    const connect = (deviceName: string) =>
      useSyncStore.getState().connect({
        url: folder,
        username: 'me',
        password: 'secret',
        passphrase: PASSPHRASE,
        deviceName,
      })

    await openDevice(null)
    useWorkspaceStore.getState().addCard(createCard())
    await connect('Laptop')

    const laptopConnection = useSyncStore.getState().connection
    let laptop = await saveDevice()

    await openDevice(null)
    await connect('Phone')

    const phoneConnection = useSyncStore.getState().connection
    const phone = await saveDevice()

    // Both edit the card before either syncs again.
    await openDevice(laptop)
    useWorkspaceStore.getState().updateCard('card-1', { title: 'Laptop edit' })
    useSyncStore.setState({ connection: laptopConnection })
    await useSyncStore.getState().sync()
    laptop = await saveDevice()

    await openDevice(phone)
    // Ensure a later edit time than the laptop's.
    await new Promise((resolve) => setTimeout(resolve, 5))
    useWorkspaceStore.getState().updateCard('card-1', { title: 'Phone edit' })
    useSyncStore.setState({ connection: phoneConnection })
    await useSyncStore.getState().sync()

    expect(useSyncStore.getState().status.message).toMatch(/1 conflict/)

    const summaries = useWorkspaceStore.getState().workspaceSummaries

    expect(summaries.map((summary) => summary.name)).toEqual([
      'Home',
      'Home (conflict)',
    ])
    expect(useWorkspaceStore.getState().workspace.cards[0]?.title).toBe(
      'Phone edit',
    )

    // The laptop gets the newer edit and the copy of its own.
    await openDevice(laptop)
    useSyncStore.setState({ connection: laptopConnection })
    await useSyncStore.getState().sync()

    expect(
      useWorkspaceStore.getState().workspaceSummaries.map((s) => s.name),
    ).toEqual(['Home', 'Home (conflict)'])
    expect(useWorkspaceStore.getState().workspace.cards[0]?.title).toBe(
      'Phone edit',
    )
  })

  it('does not sync while the switch is off', async () => {
    await openDevice(null)
    await useSyncStore.getState().connect({
      url: folder,
      username: 'me',
      password: 'secret',
      passphrase: PASSPHRASE,
      deviceName: 'Laptop',
    })

    const before = server.requests.length

    useNetworkFeaturesStore.getState().setFeature('deviceSync', false)
    await useSyncStore.getState().sync()

    expect(server.requests.length).toBe(before)
    expect(useSyncStore.getState().status.message).toMatch(/off/)
  })
})
