import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { renderSVG } from 'uqr'

import { DEFAULT_SYNC_SERVER_URL } from '../../features/sync/serverTransport'
import {
  DEFAULT_SYNC_DEVICE_NAME,
  useSyncStore,
} from '../../state/useSyncStore'
import type { SyncConnection } from '../../storage/syncRepository'
import { PanelSection, SettingRow, StatusMessage } from '../ui/panel/Panel'
import panelStyles from '../ui/panel/Panel.module.css'
import styles from './OptionsMenu.module.css'

type SyncPanelProps = {
  menuId: string
  tabListId: string
}

function formatLastSync(value: string | undefined) {
  if (!value) {
    return 'Not synced yet'
  }

  const date = new Date(value)

  return Number.isNaN(date.getTime())
    ? 'Not synced yet'
    : `Last sync ${date.toLocaleString()}`
}

function WebDavConnectForm() {
  const connect = useSyncStore((state) => state.connect)
  const busy = useSyncStore((state) => state.status.kind === 'busy')
  const [url, setUrl] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [passphrase, setPassphrase] = useState('')
  const [deviceName, setDeviceName] = useState(DEFAULT_SYNC_DEVICE_NAME)
  const passphraseTooShort = passphrase.length > 0 && passphrase.length < 10

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()

    if (!url.trim() || passphrase.length < 10) {
      return
    }

    void connect({ url, username, password, passphrase, deviceName }).then(
      (connected) => {
        if (connected) {
          setPassword('')
          setPassphrase('')
        }
      },
    )
  }

  return (
    <form className={panelStyles.stack} onSubmit={handleSubmit}>
      <PanelSection
        description="Pick a WebDAV folder you own, e.g. in Nextcloud: Files → Settings → WebDAV, then add a folder name such as Linkhaven/ at the end. Use an app password, not your main password."
        grouped={false}
        title="Sync folder"
      >
        <label className={panelStyles.field}>
          <span className={panelStyles.fieldLabel}>WebDAV folder address</span>
          <input
            aria-label="WebDAV folder address"
            autoComplete="url"
            inputMode="url"
            onChange={(event) => setUrl(event.currentTarget.value)}
            placeholder="https://cloud.example.com/remote.php/dav/files/me/Linkhaven/"
            required
            spellCheck={false}
            type="url"
            value={url}
          />
        </label>
        <div className={panelStyles.pair}>
          <label className={panelStyles.field}>
            <span className={panelStyles.fieldLabel}>User name</span>
            <input
              aria-label="Sync user name"
              autoComplete="username"
              onChange={(event) => setUsername(event.currentTarget.value)}
              spellCheck={false}
              value={username}
            />
          </label>
          <label className={panelStyles.field}>
            <span className={panelStyles.fieldLabel}>App password</span>
            <input
              aria-label="Sync app password"
              autoComplete="current-password"
              onChange={(event) => setPassword(event.currentTarget.value)}
              type="password"
              value={password}
            />
          </label>
        </div>
      </PanelSection>

      <PanelSection
        description="Encrypts everything on this device before upload; the server only sees ciphertext. Use the same passphrase on every device. It can't be recovered, so keep it somewhere safe."
        grouped={false}
        title="Encryption"
      >
        <label className={panelStyles.field}>
          <span className={panelStyles.fieldLabel}>
            Sync passphrase (at least 10 characters)
          </span>
          <input
            aria-invalid={passphraseTooShort}
            aria-label="Sync passphrase"
            autoComplete="new-password"
            minLength={10}
            onChange={(event) => setPassphrase(event.currentTarget.value)}
            required
            type="password"
            value={passphrase}
          />
        </label>
        <label className={panelStyles.field}>
          <span className={panelStyles.fieldLabel}>This device’s name</span>
          <input
            aria-label="Device name"
            onChange={(event) => setDeviceName(event.currentTarget.value)}
            value={deviceName}
          />
        </label>
        <div className={panelStyles.actions}>
          <button
            className={`${panelStyles.button} ${panelStyles.buttonPrimary}`}
            data-testid="sync-connect"
            disabled={busy || !url.trim() || passphrase.length < 10}
            type="submit"
          >
            {busy ? 'Connecting…' : 'Connect'}
          </button>
        </div>
      </PanelSection>
    </form>
  )
}

type Provider = 'server' | 'webdav'

function ServerConnectForm() {
  const connectServer = useSyncStore((state) => state.connectServer)
  const busy = useSyncStore((state) => state.status.kind === 'busy')
  const [serverUrl, setServerUrl] = useState(DEFAULT_SYNC_SERVER_URL)
  const [deviceName, setDeviceName] = useState(DEFAULT_SYNC_DEVICE_NAME)
  const [code, setCode] = useState('')
  const ready = serverUrl.trim() !== '' && !busy

  const handleJoin = (event: FormEvent) => {
    event.preventDefault()

    if (ready && code.trim()) {
      void connectServer({ mode: 'join', serverUrl, deviceName, code })
    }
  }

  return (
    <form className={panelStyles.stack} onSubmit={handleJoin}>
      <PanelSection
        description="No account: one device creates a sync and gets a sync code; your other devices join with that code. Everything is encrypted on the device with a key from the code, so the server only stores data it can't read."
        grouped={false}
        title="Linkhaven sync server"
      >
        <label className={panelStyles.field}>
          <span className={panelStyles.fieldLabel}>Server address</span>
          <input
            aria-label="Sync server address"
            autoComplete="url"
            inputMode="url"
            onChange={(event) => setServerUrl(event.currentTarget.value)}
            placeholder="https://sync.example.com"
            spellCheck={false}
            value={serverUrl}
          />
        </label>
        <label className={panelStyles.field}>
          <span className={panelStyles.fieldLabel}>This device’s name</span>
          <input
            aria-label="Device name"
            onChange={(event) => setDeviceName(event.currentTarget.value)}
            value={deviceName}
          />
        </label>
      </PanelSection>

      <PanelSection
        description="Start syncing from this device."
        grouped={false}
        title="New sync"
      >
        <div className={panelStyles.actions}>
          <button
            className={`${panelStyles.button} ${panelStyles.buttonPrimary}`}
            data-testid="sync-create"
            disabled={!ready}
            onClick={() =>
              void connectServer({ mode: 'create', serverUrl, deviceName })
            }
            type="button"
          >
            {busy ? 'Connecting…' : 'Create sync'}
          </button>
        </div>
      </PanelSection>

      <PanelSection
        description="Already syncing on another device? Open Sync there, show the sync code and enter it here."
        grouped={false}
        title="Join a sync"
      >
        <label className={panelStyles.field}>
          <span className={panelStyles.fieldLabel}>Sync code</span>
          <input
            aria-label="Sync code"
            autoComplete="off"
            onChange={(event) => setCode(event.currentTarget.value)}
            placeholder="lh1-…"
            spellCheck={false}
            value={code}
          />
        </label>
        <div className={panelStyles.actions}>
          <button
            className={panelStyles.button}
            data-testid="sync-join"
            disabled={!ready || !code.trim()}
            type="submit"
          >
            Join
          </button>
        </div>
      </PanelSection>
    </form>
  )
}

function SyncCodeView({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)
  // Only the code's own characters go in, so the SVG is safe to inline.
  const qr = useMemo(
    () =>
      renderSVG(code.toUpperCase(), {
        border: 2,
        blackColor: '#000',
        whiteColor: '#fff',
      }),
    [code],
  )

  return (
    <div className={panelStyles.stack}>
      <code className={styles.syncCode} data-testid="sync-code">
        {code}
      </code>
      <div
        aria-label="Sync code as QR code"
        className={styles.syncQr}
        dangerouslySetInnerHTML={{ __html: qr }}
        role="img"
      />
      <div className={panelStyles.actions}>
        <button
          className={panelStyles.button}
          onClick={() => {
            void navigator.clipboard
              ?.writeText(code)
              .then(() => setCopied(true))
          }}
          type="button"
        >
          {copied ? 'Copied' : 'Copy code'}
        </button>
      </div>
      <p className={panelStyles.rowHint}>
        Anyone with this code can read and change your synced workspaces. Share
        it only with your own devices.
      </p>
    </div>
  )
}

function ConnectedView({ connection }: { connection: SyncConnection }) {
  const status = useSyncStore((state) => state.status)
  const sync = useSyncStore((state) => state.sync)
  const disconnect = useSyncStore((state) => state.disconnect)
  const [showCode, setShowCode] = useState(false)
  const busy = status.kind === 'busy'
  const isServer = connection.provider === 'server'

  return (
    <>
      <PanelSection
        description="Workspaces, their order, custom themes and uploaded images sync automatically while Linkhaven is open. View position and usage statistics stay on each device."
        meta={formatLastSync(connection.lastSyncAt)}
        title="Device sync"
      >
        <SettingRow
          hint={connection.url}
          label={isServer ? 'Linkhaven server' : 'WebDAV folder'}
        >
          <span className={panelStyles.chip}>{connection.deviceName}</span>
        </SettingRow>
        <SettingRow label="Sync">
          <div className={panelStyles.actions}>
            <button
              className={`${panelStyles.button} ${panelStyles.buttonPrimary}`}
              data-testid="sync-now"
              disabled={busy}
              onClick={() => void sync()}
              type="button"
            >
              {busy ? 'Syncing…' : 'Sync now'}
            </button>
            <button
              className={`${panelStyles.button} ${panelStyles.buttonQuiet}`}
              data-testid="sync-disconnect"
              disabled={busy}
              onClick={() => void disconnect()}
              type="button"
            >
              Disconnect
            </button>
          </div>
        </SettingRow>
      </PanelSection>

      {connection.provider === 'server' ? (
        <PanelSection
          description="Enter or scan this code on another device to sync it too."
          grouped={false}
          title="Add a device"
        >
          {showCode ? (
            <SyncCodeView code={connection.code} />
          ) : (
            <div className={panelStyles.actions}>
              <button
                className={panelStyles.button}
                data-testid="sync-show-code"
                onClick={() => setShowCode(true)}
                type="button"
              >
                Show sync code
              </button>
            </div>
          )}
          <div className={panelStyles.actions}>
            <button
              className={`${panelStyles.button} ${panelStyles.buttonQuiet}`}
              data-testid="sync-delete-server-data"
              disabled={busy}
              onClick={() => {
                if (
                  window.confirm(
                    'Delete the synced data from the server for all devices? Each device keeps its own copy.',
                  )
                ) {
                  void disconnect({ deleteServerData: true })
                }
              }}
              type="button"
            >
              Disconnect and delete server data
            </button>
          </div>
        </PanelSection>
      ) : null}
    </>
  )
}

export function SyncPanel({ menuId, tabListId }: SyncPanelProps) {
  const loaded = useSyncStore((state) => state.loaded)
  const load = useSyncStore((state) => state.load)
  const connection = useSyncStore((state) => state.connection)
  const status = useSyncStore((state) => state.status)
  const [provider, setProvider] = useState<Provider>('server')

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div
      aria-labelledby={`${tabListId}-sync`}
      className={styles.panelBody}
      id={`${menuId}-sync`}
      role="tabpanel"
    >
      <div className={panelStyles.stack} data-testid="sync-panel">
        {!loaded ? null : connection ? (
          <ConnectedView connection={connection} />
        ) : (
          <>
            <div
              aria-label="Sync through"
              className={panelStyles.segmented}
              role="group"
            >
              {(
                [
                  ['server', 'Linkhaven server'],
                  ['webdav', 'WebDAV folder'],
                ] as const
              ).map(([value, label]) => (
                <button
                  aria-pressed={provider === value}
                  className={panelStyles.segment}
                  key={value}
                  onClick={() => setProvider(value)}
                  type="button"
                >
                  {label}
                </button>
              ))}
            </div>
            {provider === 'server' ? (
              <ServerConnectForm />
            ) : (
              <WebDavConnectForm />
            )}
          </>
        )}

        {status.message ? (
          <StatusMessage kind={status.kind} testId="sync-status">
            {status.message}
          </StatusMessage>
        ) : null}
      </div>
    </div>
  )
}
