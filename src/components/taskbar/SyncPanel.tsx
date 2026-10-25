import { useEffect, useState, type FormEvent } from 'react'

import {
  DEFAULT_SYNC_DEVICE_NAME,
  useSyncStore,
} from '../../state/useSyncStore'
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

function ConnectForm() {
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

export function SyncPanel({ menuId, tabListId }: SyncPanelProps) {
  const loaded = useSyncStore((state) => state.loaded)
  const load = useSyncStore((state) => state.load)
  const connection = useSyncStore((state) => state.connection)
  const status = useSyncStore((state) => state.status)
  const sync = useSyncStore((state) => state.sync)
  const disconnect = useSyncStore((state) => state.disconnect)
  const busy = status.kind === 'busy'

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
          <PanelSection
            description="Workspaces, their order, custom themes and uploaded images sync automatically while Linkhaven is open. View position and usage statistics stay on each device."
            meta={formatLastSync(connection.lastSyncAt)}
            title="Device sync"
          >
            <SettingRow hint={connection.url} label="Folder">
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
        ) : (
          <ConnectForm />
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
