/**
 * Stores sync vaults on disk. A vault is a folder of opaque, end-to-end
 * encrypted files written by Linkhaven devices; the server can't read them.
 *
 *   <dataDir>/vaults/<vaultId>/vault.json   tokens (hashed), devices, ETags
 *   <dataDir>/vaults/<vaultId>/files/<hash> the encrypted files
 *
 * There are no accounts. Two kinds of access token exist, both stored only
 * as SHA-256 hashes:
 *
 * - the join token comes from the sync code; it can only register a new
 *   device and read the join keyring (`keyring/join`)
 * - every device has its own token for everything else, so one device can
 *   be removed without touching the others
 *
 * Writes are atomic (temp file + rename) and serialised per vault, so ETags
 * always match the stored content.
 */
import { createHash, timingSafeEqual } from 'node:crypto'
import {
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises'
import { join } from 'node:path'

export class VaultError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

const VAULT_ID = /^[a-f0-9]{32}$/
const DEVICE_ID = /^[a-f0-9]{32}$/
const TOKEN = /^[A-Za-z0-9_-]{32,128}$/
/** `state.bin`, `images/<uuid>.bin`, `keyring/<device>` and the like. */
const FILE_PATH = /^(?:[a-z0-9-]+\/)?[A-Za-z0-9._%-]{1,160}$/
const SEEN_RESOLUTION_MS = 60 * 60 * 1000
const MAX_LABEL_LENGTH = 1024
const MAX_PUBLIC_KEY_LENGTH = 256

export const JOIN_KEYRING_PATH = 'keyring/join'

export function keyringPath(deviceId) {
  return `keyring/${deviceId}`
}

export function isValidVaultId(value) {
  return typeof value === 'string' && VAULT_ID.test(value)
}

export function isValidDeviceId(value) {
  return typeof value === 'string' && DEVICE_ID.test(value)
}

export function isValidToken(value) {
  return typeof value === 'string' && TOKEN.test(value)
}

export function isValidFilePath(value) {
  return (
    typeof value === 'string' &&
    FILE_PATH.test(value) &&
    !value.split('/').some((part) => part === '.' || part === '..')
  )
}

function sha256(data) {
  return createHash('sha256').update(data).digest('hex')
}

function sameHash(expectedHex, token) {
  if (!expectedHex) {
    return false
  }

  const expected = Buffer.from(expectedHex, 'hex')
  const given = Buffer.from(sha256(token ?? ''), 'hex')

  return expected.length === given.length && timingSafeEqual(expected, given)
}

/** File names on disk: the path, made flat and safe. */
function diskName(path) {
  return sha256(path)
}

export function createVaultStore({
  dataDir,
  maxVaultBytes = 100 * 1024 * 1024,
  maxFileBytes = 25 * 1024 * 1024,
  maxDevices = 20,
  now = () => Date.now(),
}) {
  const vaultsDir = join(dataDir, 'vaults')
  const locks = new Map()

  /** Runs `task` after every earlier task on the same vault. */
  const withLock = (vaultId, task) => {
    const previous = locks.get(vaultId) ?? Promise.resolve()
    const next = previous.then(task, task)
    const settled = next.catch(() => undefined)

    locks.set(vaultId, settled)
    settled.then(() => {
      if (locks.get(vaultId) === settled) {
        locks.delete(vaultId)
      }
    })

    return next
  }

  const vaultDir = (vaultId) => join(vaultsDir, vaultId)

  const readMeta = async (vaultId) => {
    try {
      return JSON.parse(
        await readFile(join(vaultDir(vaultId), 'vault.json'), 'utf8'),
      )
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null
      }

      throw error
    }
  }

  const writeAtomic = async (path, data) => {
    const temp = `${path}.${process.pid}.${now()}.tmp`

    await writeFile(temp, data)
    await rename(temp, path)
  }

  const writeMeta = (vaultId, meta) =>
    writeAtomic(join(vaultDir(vaultId), 'vault.json'), JSON.stringify(meta))

  /**
   * Who is asking: a registered device, or someone with the join token.
   * Anyone else gets 403 (a removed device included).
   */
  const authorize = (meta, token) => {
    for (const [deviceId, device] of Object.entries(meta.devices)) {
      if (sameHash(device.tokenHash, token)) {
        return { kind: 'device', deviceId }
      }
    }

    if (sameHash(meta.joinTokenHash, token)) {
      return { kind: 'join' }
    }

    throw new VaultError(403, 'This device is not part of this sync.')
  }

  /** Marks a device as seen, at most once an hour (fewer disk writes). */
  const markSeen = (meta, access) => {
    if (access.kind !== 'device') {
      return false
    }

    const device = meta.devices[access.deviceId]

    if (now() - device.lastSeenAt < SEEN_RESOLUTION_MS) {
      return false
    }

    device.lastSeenAt = now()
    meta.lastSeenAt = now()

    return true
  }

  const openVault = async (vaultId, token) => {
    const meta = await readMeta(vaultId)

    if (!meta) {
      throw new VaultError(404, 'There is no sync with this code.')
    }

    return { meta, access: authorize(meta, token) }
  }

  const requireDevice = (access) => {
    if (access.kind !== 'device') {
      throw new VaultError(403, 'Join the sync first.')
    }
  }

  const removeFile = async (vaultId, meta, path) => {
    const entry = meta.files[path]

    if (!entry) {
      return false
    }

    await rm(join(vaultDir(vaultId), 'files', diskName(path)), {
      force: true,
    })
    delete meta.files[path]
    meta.bytes -= entry.size

    return true
  }

  return {
    async exists(vaultId) {
      return (await readMeta(vaultId)) !== null
    },

    /**
     * Registers a device with the join token. With `create`, the vault is
     * new and this claims the join token for it.
     */
    async registerDevice(vaultId, joinToken, device) {
      if (
        !isValidToken(joinToken) ||
        !isValidDeviceId(device.deviceId) ||
        !isValidToken(device.deviceToken) ||
        typeof device.publicKey !== 'string' ||
        device.publicKey.length === 0 ||
        device.publicKey.length > MAX_PUBLIC_KEY_LENGTH ||
        typeof device.label !== 'string' ||
        device.label.length > MAX_LABEL_LENGTH
      ) {
        throw new VaultError(400, 'Invalid device.')
      }

      return withLock(vaultId, async () => {
        let meta = await readMeta(vaultId)
        const created = !meta

        if (!meta && !device.create) {
          throw new VaultError(404, 'There is no sync with this code.')
        }

        if (meta && device.create) {
          throw new VaultError(409, 'This sync already exists.')
        }

        if (!meta) {
          meta = {
            version: 2,
            joinTokenHash: sha256(joinToken),
            createdAt: now(),
            lastSeenAt: now(),
            bytes: 0,
            devices: {},
            files: {},
          }
          await mkdir(join(vaultDir(vaultId), 'files'), { recursive: true })
        } else if (authorize(meta, joinToken).kind !== 'join') {
          throw new VaultError(403, 'Use the sync code to add a device.')
        }

        if (meta.devices[device.deviceId]) {
          throw new VaultError(409, 'This device is already registered.')
        }

        if (Object.keys(meta.devices).length >= maxDevices) {
          throw new VaultError(409, 'This sync already has the most devices.')
        }

        meta.devices[device.deviceId] = {
          tokenHash: sha256(device.deviceToken),
          publicKey: device.publicKey,
          label: device.label,
          createdAt: now(),
          lastSeenAt: now(),
        }
        meta.lastSeenAt = now()
        await writeMeta(vaultId, meta)

        return { created }
      })
    },

    async listDevices(vaultId, token) {
      return withLock(vaultId, async () => {
        const { meta, access } = await openVault(vaultId, token)

        requireDevice(access)

        if (markSeen(meta, access)) {
          await writeMeta(vaultId, meta)
        }

        return Object.entries(meta.devices).map(([deviceId, device]) => ({
          deviceId,
          publicKey: device.publicKey,
          label: device.label,
          createdAt: device.createdAt,
          lastSeenAt: device.lastSeenAt,
          current: deviceId === access.deviceId,
        }))
      })
    },

    /** Removes a device: its token stops working at once. */
    async removeDevice(vaultId, token, deviceId) {
      return withLock(vaultId, async () => {
        const { meta, access } = await openVault(vaultId, token)

        requireDevice(access)

        if (!meta.devices[deviceId]) {
          return false
        }

        delete meta.devices[deviceId]
        await removeFile(vaultId, meta, keyringPath(deviceId))
        await writeMeta(vaultId, meta)

        return true
      })
    },

    /** Replaces the join token, so an old sync code can't add devices. */
    async setJoinToken(vaultId, token, joinToken) {
      if (!isValidToken(joinToken)) {
        throw new VaultError(400, 'Invalid join token.')
      }

      return withLock(vaultId, async () => {
        const { meta, access } = await openVault(vaultId, token)

        requireDevice(access)
        meta.joinTokenHash = sha256(joinToken)
        await writeMeta(vaultId, meta)
      })
    },

    async read(vaultId, path, token) {
      return withLock(vaultId, async () => {
        const { meta, access } = await openVault(vaultId, token)

        if (access.kind === 'join' && path !== JOIN_KEYRING_PATH) {
          throw new VaultError(403, 'Join the sync first.')
        }

        const entry = meta.files[path]

        if (markSeen(meta, access)) {
          await writeMeta(vaultId, meta)
        }

        if (!entry) {
          return null
        }

        const data = await readFile(
          join(vaultDir(vaultId), 'files', diskName(path)),
        )

        return { data, etag: entry.etag }
      })
    },

    /**
     * Writes a file. `ifMatch`: only while the file has this ETag;
     * `ifNoneMatch: '*'`: only while it doesn't exist.
     */
    async write(vaultId, path, token, data, { ifMatch, ifNoneMatch } = {}) {
      if (data.length > maxFileBytes) {
        throw new VaultError(413, 'This file is too large.')
      }

      return withLock(vaultId, async () => {
        const { meta, access } = await openVault(vaultId, token)

        requireDevice(access)

        const current = meta.files[path]

        if (
          (ifNoneMatch === '*' && current) ||
          (ifMatch !== undefined && current?.etag !== ifMatch)
        ) {
          throw new VaultError(412, 'The file changed on the server.')
        }

        const bytes = meta.bytes - (current?.size ?? 0) + data.length

        if (bytes > maxVaultBytes) {
          throw new VaultError(507, 'This sync is full.')
        }

        const etag = `"${sha256(data).slice(0, 32)}"`

        await writeAtomic(
          join(vaultDir(vaultId), 'files', diskName(path)),
          data,
        )
        meta.files[path] = { etag, size: data.length, updatedAt: now() }
        meta.bytes = bytes
        markSeen(meta, access)
        await writeMeta(vaultId, meta)

        return { etag, created: !current }
      })
    },

    async remove(vaultId, path, token) {
      return withLock(vaultId, async () => {
        const { meta, access } = await openVault(vaultId, token)

        requireDevice(access)

        const removed = await removeFile(vaultId, meta, path)

        if (removed) {
          await writeMeta(vaultId, meta)
        }

        return removed
      })
    },

    /** Deletes the whole vault (the user's "delete data on server"). */
    async destroy(vaultId, token) {
      return withLock(vaultId, async () => {
        const { access } = await openVault(vaultId, token)

        requireDevice(access)
        await rm(vaultDir(vaultId), { recursive: true, force: true })

        return true
      })
    },

    /** Removes vaults nobody used for `maxIdleMs`; returns how many. */
    async removeIdleVaults(maxIdleMs) {
      let removed = 0
      let ids = []

      try {
        ids = await readdir(vaultsDir)
      } catch {
        return 0
      }

      for (const vaultId of ids.filter(isValidVaultId)) {
        await withLock(vaultId, async () => {
          const meta = await readMeta(vaultId).catch(() => null)
          const lastSeenAt =
            meta?.lastSeenAt ??
            (await stat(vaultDir(vaultId)).then((info) => info.mtimeMs))

          if (now() - lastSeenAt > maxIdleMs) {
            await rm(vaultDir(vaultId), { recursive: true, force: true })
            removed += 1
          }
        })
      }

      return removed
    },
  }
}
