/**
 * Stores sync vaults on disk. A vault is a folder of opaque, end-to-end
 * encrypted files written by Linkhaven devices; the server can't read them.
 *
 *   <dataDir>/vaults/<vaultId>/vault.json   token hash, sizes, ETags
 *   <dataDir>/vaults/<vaultId>/files/<name> the encrypted files
 *
 * There are no accounts: the first write to a vault claims it with the
 * SHA-256 of its access token, and every later request must present the
 * same token. Writes are atomic (temp file + rename) and serialised per
 * vault, so ETags always match the stored content.
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
const SEEN_RESOLUTION_MS = 24 * 60 * 60 * 1000
/** `state.bin`, `images/<uuid>.bin` and the like; no paths that escape. */
const FILE_PATH = /^(?:[a-z0-9-]+\/)?[A-Za-z0-9._%-]{1,160}$/

export function isValidVaultId(value) {
  return typeof value === 'string' && VAULT_ID.test(value)
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

/** File names on disk: the path, made flat and safe. */
function diskName(path) {
  return sha256(path)
}

export function createVaultStore({
  dataDir,
  maxVaultBytes = 100 * 1024 * 1024,
  maxFileBytes = 25 * 1024 * 1024,
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

  const checkToken = (meta, token) => {
    const expected = Buffer.from(meta.tokenHash, 'hex')
    const given = Buffer.from(sha256(token ?? ''), 'hex')

    if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
      throw new VaultError(403, 'Wrong access token for this vault.')
    }
  }

  /** The vault, checked against the token; null when it doesn't exist. */
  const openVault = async (vaultId, token) => {
    const meta = await readMeta(vaultId)

    if (meta) {
      checkToken(meta, token)
    }

    return meta
  }

  return {
    async exists(vaultId) {
      return (await readMeta(vaultId)) !== null
    },

    async read(vaultId, path, token) {
      return withLock(vaultId, async () => {
        const meta = await openVault(vaultId, token)
        const entry = meta?.files[path]

        if (!entry) {
          return null
        }

        const data = await readFile(
          join(vaultDir(vaultId), 'files', diskName(path)),
        )

        // Keeps idle-vault cleanup accurate without a write per read.
        if (now() - meta.lastSeenAt > SEEN_RESOLUTION_MS) {
          meta.lastSeenAt = now()
          await writeMeta(vaultId, meta)
        }

        return { data, etag: entry.etag }
      })
    },

    /**
     * Writes a file. `ifMatch`: only while the file has this ETag; `'*'`
     * absent = must not exist (If-None-Match: *); undefined = always.
     */
    async write(vaultId, path, token, data, { ifMatch, ifNoneMatch } = {}) {
      if (data.length > maxFileBytes) {
        throw new VaultError(413, 'This file is too large.')
      }

      return withLock(vaultId, async () => {
        let meta = await openVault(vaultId, token)

        if (!meta) {
          if (!token || token.length < 32) {
            throw new VaultError(400, 'A new vault needs an access token.')
          }

          meta = {
            version: 1,
            tokenHash: sha256(token),
            createdAt: now(),
            lastSeenAt: now(),
            bytes: 0,
            files: {},
          }
          await mkdir(join(vaultDir(vaultId), 'files'), { recursive: true })
        }

        const current = meta.files[path]

        if (
          (ifNoneMatch === '*' && current) ||
          (ifMatch !== undefined && current?.etag !== ifMatch)
        ) {
          throw new VaultError(412, 'The file changed on the server.')
        }

        const bytes = meta.bytes - (current?.size ?? 0) + data.length

        if (bytes > maxVaultBytes) {
          throw new VaultError(507, 'This sync vault is full.')
        }

        const etag = `"${sha256(data).slice(0, 32)}"`

        await writeAtomic(
          join(vaultDir(vaultId), 'files', diskName(path)),
          data,
        )
        meta.files[path] = { etag, size: data.length, updatedAt: now() }
        meta.bytes = bytes
        meta.lastSeenAt = now()
        await writeMeta(vaultId, meta)

        return { etag, created: !current }
      })
    },

    async remove(vaultId, path, token) {
      return withLock(vaultId, async () => {
        const meta = await openVault(vaultId, token)
        const entry = meta?.files[path]

        if (!entry) {
          return false
        }

        await rm(join(vaultDir(vaultId), 'files', diskName(path)), {
          force: true,
        })
        delete meta.files[path]
        meta.bytes -= entry.size
        meta.lastSeenAt = now()
        await writeMeta(vaultId, meta)

        return true
      })
    },

    /** Deletes the whole vault (the user's "delete data on server"). */
    async destroy(vaultId, token) {
      return withLock(vaultId, async () => {
        const meta = await openVault(vaultId, token)

        if (!meta) {
          return false
        }

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
