import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { renderSVG } from 'uqr'

import { getHostServer } from '../../features/selfHost/hostServer'
import {
  DEFAULT_SYNC_SERVER_URL,
  normalizeSyncServerUrl,
} from '../../features/sync/serverTransport'
import type { SyncScope } from '../../features/sync/syncScope'
import { useAutoDashboardStore } from '../../state/useAutoDashboardStore'
import {
  DEFAULT_SYNC_DEVICE_NAME,
  useSyncStore,
} from '../../state/useSyncStore'
import { useWorkspaceStore } from '../../state/useWorkspaceStore'
import type { SyncConnection } from '../../storage/syncRepository'
import {
  PanelSection,
  SettingRow,
  StatusMessage,
  Switch,
} from '../ui/panel/Panel'
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

/** "Only the workspaces I choose", set before the first sync. */
function ChooseWorkspacesRow({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <SettingRow
      hint="For a work computer, say: this device gets no workspace until you pick one after connecting, and its own workspaces stay on it."
      label="Only workspaces I choose"
    >
      <Switch
        ariaLabel="Only workspaces I choose"
        checked={checked}
        onChange={onChange}
      />
    </SettingRow>
  )
}

const CHOOSE_LATER: SyncScope = { mode: 'chosen', workspaceIds: [] }

function WebDavConnectForm() {
  const connect = useSyncStore((state) => state.connect)
  const busy = useSyncStore((state) => state.status.kind === 'busy')
  const [url, setUrl] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [passphrase, setPassphrase] = useState('')
  const [deviceName, setDeviceName] = useState(DEFAULT_SYNC_DEVICE_NAME)
  const [chooseOnly, setChooseOnly] = useState(false)
  const passphraseTooShort = passphrase.length > 0 && passphrase.length < 10

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()

    if (!url.trim() || passphrase.length < 10) {
      return
    }

    void connect({
      url,
      username,
      password,
      passphrase,
      deviceName,
      scope: chooseOnly ? CHOOSE_LATER : undefined,
    }).then((connected) => {
      if (connected) {
        setPassword('')
        setPassphrase('')
      }
    })
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
        <ChooseWorkspacesRow checked={chooseOnly} onChange={setChooseOnly} />
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

const SELF_HOSTING_GUIDE =
  'https://schulzoli.github.io/Linkhaven/self-hosting.html'

type ServerChoice = {
  id: 'host' | 'public' | 'own'
  label: string
  url: string
}

function sameServer(a: string, b: string) {
  try {
    return normalizeSyncServerUrl(a) === normalizeSyncServerUrl(b)
  } catch {
    return false
  }
}

/** This server (self-hosted web app), the public one, or one you enter. */
function getServerChoices(): ServerChoice[] {
  const host = getHostServer()
  const choices: ServerChoice[] = []

  if (host?.sync) {
    choices.push({ id: 'host', label: 'This server', url: host.origin })
  }

  if (
    DEFAULT_SYNC_SERVER_URL &&
    !(host?.sync && sameServer(host.origin, DEFAULT_SYNC_SERVER_URL))
  ) {
    choices.push({
      id: 'public',
      label: 'Public server',
      url: DEFAULT_SYNC_SERVER_URL,
    })
  }

  choices.push({ id: 'own', label: 'Self-hosted', url: '' })

  return choices
}

function ServerConnectForm() {
  const connectServer = useSyncStore((state) => state.connectServer)
  const busy = useSyncStore((state) => state.status.kind === 'busy')
  const [choices] = useState(getServerChoices)
  const [choiceId, setChoiceId] = useState(choices[0].id)
  const [ownUrl, setOwnUrl] = useState('')
  const [deviceName, setDeviceName] = useState(DEFAULT_SYNC_DEVICE_NAME)
  const [code, setCode] = useState('')
  const [chooseOnly, setChooseOnly] = useState(false)
  const scope = chooseOnly ? CHOOSE_LATER : undefined
  const choice = choices.find((entry) => entry.id === choiceId) ?? choices[0]
  const serverUrl = choice.id === 'own' ? ownUrl : choice.url
  const ready = serverUrl.trim() !== '' && !busy

  const handleJoin = (event: FormEvent) => {
    event.preventDefault()

    if (ready && code.trim()) {
      void connectServer({ mode: 'join', serverUrl, deviceName, code, scope })
    }
  }

  return (
    <form className={panelStyles.stack} onSubmit={handleJoin}>
      <PanelSection
        description="No account: one device creates a sync and gets a sync code; your other devices join with that code. Everything is encrypted on the device with a key from the code, so the server only stores data it can't read."
        grouped={false}
        title="Linkhaven sync server"
      >
        {choices.length > 1 ? (
          <div
            aria-label="Sync server"
            className={panelStyles.segmented}
            role="group"
          >
            {choices.map((entry) => (
              <button
                aria-pressed={choice.id === entry.id}
                className={panelStyles.segment}
                key={entry.id}
                onClick={() => setChoiceId(entry.id)}
                type="button"
              >
                {entry.label}
              </button>
            ))}
          </div>
        ) : null}
        {choice.id === 'own' ? (
          <>
            <label className={panelStyles.field}>
              <span className={panelStyles.fieldLabel}>Server address</span>
              <input
                aria-label="Sync server address"
                autoComplete="url"
                inputMode="url"
                onChange={(event) => setOwnUrl(event.currentTarget.value)}
                placeholder="https://linkhaven.example.com"
                spellCheck={false}
                value={ownUrl}
              />
            </label>
            <p className={panelStyles.rowHint}>
              Run your own server with one Docker container, on a NAS, a home
              server or a VPS:{' '}
              <a href={SELF_HOSTING_GUIDE} rel="noreferrer" target="_blank">
                self-hosting guide
              </a>
              .
            </p>
          </>
        ) : (
          <p className={panelStyles.rowHint} data-testid="sync-server-url">
            {choice.url}
          </p>
        )}
        <label className={panelStyles.field}>
          <span className={panelStyles.fieldLabel}>This device’s name</span>
          <input
            aria-label="Device name"
            onChange={(event) => setDeviceName(event.currentTarget.value)}
            value={deviceName}
          />
        </label>
        <ChooseWorkspacesRow checked={chooseOnly} onChange={setChooseOnly} />
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
              void connectServer({
                mode: 'create',
                serverUrl,
                deviceName,
                // The new sync starts with the open workspace.
                scope: chooseOnly
                  ? {
                      mode: 'chosen',
                      workspaceIds: [
                        useWorkspaceStore.getState().activeWorkspaceId,
                      ],
                    }
                  : undefined,
              })
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
            placeholder="lh2-…"
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

function formatSeen(value: number) {
  const minutes = Math.round((Date.now() - value) / 60000)

  if (minutes < 60) {
    return 'Active in the last hour'
  }

  return `Last synced ${new Date(value).toLocaleDateString()}`
}

function DeviceList() {
  const devices = useSyncStore((state) => state.devices)
  const loadDevices = useSyncStore((state) => state.loadDevices)
  const removeDevice = useSyncStore((state) => state.removeDevice)
  const busy = useSyncStore((state) => state.status.kind === 'busy')

  useEffect(() => {
    void loadDevices()
  }, [loadDevices])

  return (
    <PanelSection
      description="Every device has its own access. Removing one locks it out at once; your data is then re-encrypted with a new key it doesn't have."
      meta={devices ? `${devices.length}` : undefined}
      testId="sync-devices"
      title="Devices"
    >
      {(devices ?? []).map((device) => (
        <SettingRow
          hint={formatSeen(device.lastSeenAt)}
          key={device.deviceId}
          label={device.name}
          testId={`sync-device-${device.current ? 'current' : device.deviceId}`}
        >
          {device.current ? (
            <span className={panelStyles.chip}>This device</span>
          ) : (
            <button
              aria-label={`Remove ${device.name}`}
              className={`${panelStyles.button} ${panelStyles.buttonQuiet}`}
              disabled={busy}
              onClick={() => {
                if (
                  window.confirm(
                    `Remove “${device.name}” from the sync? It loses access right away and its copy stops syncing. Your other devices get a new key and the sync gets a new code.`,
                  )
                ) {
                  void removeDevice(device.deviceId)
                }
              }}
              type="button"
            >
              Remove
            </button>
          )}
        </SettingRow>
      ))}
    </PanelSection>
  )
}

/** Which workspaces this device syncs: all, or the ones ticked here. */
function WorkspaceScopeSection({ connection }: { connection: SyncConnection }) {
  const setScope = useSyncStore((state) => state.setScope)
  const busy = useSyncStore((state) => state.status.kind === 'busy')
  const remoteWorkspaces = useSyncStore((state) => state.remoteWorkspaces)
  const localWorkspaces = useWorkspaceStore((state) => state.workspaceSummaries)
  const autoWorkspaceId = useAutoDashboardStore(
    (state) => state.settings.workspaceId,
  )
  const scope = connection.scope ?? { mode: 'all' as const }
  const chosen = new Set(scope.mode === 'chosen' ? scope.workspaceIds : [])
  const localIds = new Set(localWorkspaces.map((workspace) => workspace.id))
  const remoteIds = new Set(remoteWorkspaces.map((workspace) => workspace.id))
  const rows = [
    ...localWorkspaces.filter((workspace) => workspace.id !== autoWorkspaceId),
    ...remoteWorkspaces.filter((workspace) => !localIds.has(workspace.id)),
  ]

  const toggle = (id: string, on: boolean) => {
    const ids = scope.mode === 'chosen' ? scope.workspaceIds : []

    void setScope({
      mode: 'chosen',
      workspaceIds: on
        ? [...new Set([...ids, id])]
        : ids.filter((other) => other !== id),
    })
  }

  return (
    <PanelSection
      description="A work computer can sync just its work workspace: workspaces you don't tick are neither sent nor received here, and nothing is deleted anywhere."
      meta={
        scope.mode === 'all'
          ? 'All'
          : `${scope.workspaceIds.filter((id) => localIds.has(id) || remoteIds.has(id)).length} chosen`
      }
      title="Workspaces on this device"
    >
      <div
        aria-label="Workspaces to sync"
        className={panelStyles.segmented}
        role="group"
      >
        <button
          aria-pressed={scope.mode === 'all'}
          className={panelStyles.segment}
          disabled={busy}
          onClick={() => void setScope({ mode: 'all' })}
          type="button"
        >
          All workspaces
        </button>
        <button
          aria-pressed={scope.mode === 'chosen'}
          className={panelStyles.segment}
          disabled={busy}
          onClick={() =>
            scope.mode === 'chosen'
              ? undefined
              : void setScope({
                  mode: 'chosen',
                  workspaceIds: rows
                    .filter((row) => localIds.has(row.id))
                    .map((row) => row.id),
                })
          }
          type="button"
        >
          Only chosen
        </button>
      </div>
      {scope.mode === 'chosen'
        ? rows.map((workspace) => (
            <SettingRow
              hint={
                !localIds.has(workspace.id)
                  ? 'On your other devices'
                  : !remoteIds.has(workspace.id)
                    ? 'Only on this device'
                    : undefined
              }
              key={workspace.id}
              label={workspace.name}
            >
              <Switch
                ariaLabel={`Sync ${workspace.name}`}
                checked={chosen.has(workspace.id)}
                disabled={busy}
                onChange={(on) => toggle(workspace.id, on)}
              />
            </SettingRow>
          ))
        : null}
    </PanelSection>
  )
}

function ConnectedView({ connection }: { connection: SyncConnection }) {
  const status = useSyncStore((state) => state.status)
  const sync = useSyncStore((state) => state.sync)
  const disconnect = useSyncStore((state) => state.disconnect)
  const syncCode = useSyncStore((state) => state.syncCode)
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

      <WorkspaceScopeSection connection={connection} />

      {isServer ? <DeviceList /> : null}

      {isServer ? (
        <PanelSection
          description="Enter or scan this code on another device to sync it too. Removing a device gives the sync a new code."
          grouped={false}
          title="Add a device"
        >
          {showCode && syncCode ? (
            <SyncCodeView code={syncCode} />
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
