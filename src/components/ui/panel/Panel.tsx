import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react'

import styles from './Panel.module.css'

type PanelSectionProps = {
  title: string
  meta?: ReactNode
  actions?: ReactNode
  description?: ReactNode
  children?: ReactNode
  testId?: string
  /** Wrap children in the bordered grouped list. Defaults to true. */
  grouped?: boolean
}

/** A quiet uppercase label with optional meta/actions above a grouped list. */
export function PanelSection({
  title,
  meta,
  actions,
  description,
  children,
  testId,
  grouped = true,
}: PanelSectionProps) {
  return (
    <section className={styles.section} data-testid={testId}>
      <div className={styles.sectionHeader}>
        <div className={styles.sectionHeading}>
          <h4 className={styles.sectionTitle}>{title}</h4>
          {meta !== undefined ? (
            <span className={styles.sectionMeta}>{meta}</span>
          ) : null}
        </div>
        {actions ? (
          <div className={styles.sectionActions}>{actions}</div>
        ) : null}
      </div>
      {description ? (
        <p className={styles.sectionDescription}>{description}</p>
      ) : null}
      {children ? (
        grouped ? (
          <div className={styles.group}>{children}</div>
        ) : (
          children
        )
      ) : null}
    </section>
  )
}

type SettingRowProps = {
  label: ReactNode
  hint?: ReactNode
  children?: ReactNode
  /** Put the control under the label (sliders, colour rows, inputs). */
  stacked?: boolean
  testId?: string
}

/** One row of a grouped list: label + hint on the left, control on the right. */
export function SettingRow({
  label,
  hint,
  children,
  stacked = false,
  testId,
}: SettingRowProps) {
  return (
    <div
      className={`${styles.row} ${stacked ? styles.rowStacked : ''}`}
      data-testid={testId}
    >
      <div className={styles.rowText}>
        <span className={styles.rowLabel}>{label}</span>
        {hint ? <p className={styles.rowHint}>{hint}</p> : null}
      </div>
      {children ? <div className={styles.rowControl}>{children}</div> : null}
    </div>
  )
}

type SwitchProps = {
  ariaLabel: string
  checked: boolean
  disabled?: boolean
  onChange: (checked: boolean) => void
}

/** A checkbox styled as a switch; keeps the native checkbox role. */
export function Switch({
  ariaLabel,
  checked,
  disabled,
  onChange,
}: SwitchProps) {
  return (
    <input
      aria-label={ariaLabel}
      checked={checked}
      className={styles.switch}
      disabled={disabled}
      type="checkbox"
      onChange={(event) => onChange(event.currentTarget.checked)}
    />
  )
}

type SliderProps = {
  ariaLabel: string
  min: number
  max: number
  value: number
  suffix?: string
  onChange: (value: number) => void
}

export function Slider({
  ariaLabel,
  min,
  max,
  value,
  suffix = '%',
  onChange,
}: SliderProps) {
  return (
    <div className={styles.slider}>
      <input
        aria-label={ariaLabel}
        max={max}
        min={min}
        type="range"
        value={value}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
      />
      <span className={styles.sliderValue}>
        {value}
        {suffix}
      </span>
    </div>
  )
}

type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'> & {
  label: string
  tone?: 'default' | 'accent' | 'danger'
  children: ReactNode
}

export function IconButton({
  label,
  tone = 'default',
  children,
  className,
  title,
  ...rest
}: IconButtonProps) {
  const toneClass =
    tone === 'accent'
      ? styles.iconButtonAccent
      : tone === 'danger'
        ? styles.iconButtonDanger
        : ''

  return (
    <button
      {...rest}
      aria-label={label}
      className={`${styles.iconButton} ${toneClass} ${className ?? ''}`}
      title={title ?? label}
      type="button"
    >
      {children}
    </button>
  )
}

export type StatusKind = 'idle' | 'busy' | 'success' | 'error' | 'warning'

export function StatusMessage({
  kind,
  children,
  testId,
}: {
  kind: StatusKind
  children: ReactNode
  testId?: string
}) {
  const kindClass =
    kind === 'busy'
      ? styles.statusBusy
      : kind === 'success'
        ? styles.statusSuccess
        : kind === 'error'
          ? styles.statusError
          : kind === 'warning'
            ? styles.statusWarning
            : ''

  return (
    <p
      className={`${styles.status} ${kindClass}`}
      data-testid={testId}
      role={kind === 'error' ? 'alert' : 'status'}
    >
      {children}
    </p>
  )
}

export function StatGrid({
  columns = 4,
  children,
}: {
  columns?: number
  children: ReactNode
}) {
  return (
    <div
      className={styles.stats}
      style={{ '--stat-columns': columns } as CSSProperties}
    >
      {children}
    </div>
  )
}

export function Stat({
  label,
  value,
  caption,
  valueTestId,
  captionTestId,
}: {
  label: ReactNode
  value: ReactNode
  caption?: ReactNode
  valueTestId?: string
  captionTestId?: string
}) {
  return (
    <div className={styles.stat}>
      <span className={styles.statLabel}>{label}</span>
      <strong className={styles.statValue} data-testid={valueTestId}>
        {value}
      </strong>
      {caption ? (
        <span className={styles.statCaption} data-testid={captionTestId}>
          {caption}
        </span>
      ) : null}
    </div>
  )
}

export function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      focusable="false"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.75"
      viewBox="0 0 24 24"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}
