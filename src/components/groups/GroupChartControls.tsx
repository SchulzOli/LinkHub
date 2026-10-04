import { memo, useMemo, useRef, useState, type RefObject } from 'react'

import controlStyles from '../charts/ChartControls.module.css'
import styles from './GroupFrame.module.css'

import type { CardGroup } from '../../contracts/cardGroup'
import type { PictureNode } from '../../contracts/pictureNode'
import {
  getGroupChartMembers,
  resolveGroupChartSettings,
  summarizeGroupChartSetting,
} from '../../features/charts/chartInheritance'
import { requestChartReload } from '../../features/charts/chartReloadBus'
import { useWorkspaceStore } from '../../state/useWorkspaceStore'
import {
  ChartActionButton,
  ChartPopover,
  ChartPopoverSection,
  ChartSettingsFields,
} from '../charts/ChartControls'
import { stopCanvasPointer } from '../charts/chartControlOptions'
import { StrokeIcon } from '../ui/StrokeIcon'

type GroupChartControlsProps = {
  /** The group element; the panel is placed relative to it. */
  anchorRef: RefObject<HTMLElement | null>
  group: CardGroup
  groups: CardGroup[]
  pictures: PictureNode[]
  gridSize: number
}

/**
 * Appears in a group header as soon as the group contains charts and lets
 * the user drive all member charts at once. Members that set a value on
 * their own keep it; the per-key badge shows how many and can force them.
 */
export const GroupChartControls = memo(function GroupChartControls({
  anchorRef,
  group,
  groups,
  pictures,
  gridSize,
}: GroupChartControlsProps) {
  const [open, setOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const setGroupChartSetting = useWorkspaceStore(
    (state) => state.setGroupChartSetting,
  )
  const resetGroupChartOverrides = useWorkspaceStore(
    (state) => state.resetGroupChartOverrides,
  )
  const members = useMemo(
    () => getGroupChartMembers(group.id, pictures, groups, gridSize),
    [gridSize, group.id, groups, pictures],
  )

  if (members.length === 0) {
    return null
  }

  const values = resolveGroupChartSettings(groups, group.id)
  const label = `${members.length} chart${members.length === 1 ? '' : 's'}`

  return (
    <div className={styles.headerTools}>
      <button
        aria-expanded={open}
        aria-label={`Chart controls for group ${group.name}`}
        className={styles.headerToolButton}
        data-testid={`group-chart-controls-${group.id}`}
        onClick={() => setOpen((value) => !value)}
        onPointerDown={stopCanvasPointer}
        ref={buttonRef}
        title={`Control ${label} in this group`}
        type="button"
      >
        <StrokeIcon>
          <path d="M4 4v14a2 2 0 0 0 2 2h14M8 14l3.5-3.5 2.5 2.5L20 7" />
        </StrokeIcon>
        <span>{members.length}</span>
      </button>
      <ChartPopover
        anchorRef={anchorRef}
        triggerRef={buttonRef}
        label={`Chart controls for ${group.name}`}
        onClose={() => setOpen(false)}
        open={open}
        testId="group-chart-panel"
      >
        <ChartPopoverSection title={`${group.name} · ${label}`}>
          <p className={controlStyles.hint}>
            Changes apply to every chart in this group. Charts with their own
            value keep it.
          </p>
          <ChartSettingsFields
            onChange={(key, value) =>
              setGroupChartSetting(group.id, key, value)
            }
            renderStatus={(key) => {
              const summary = summarizeGroupChartSetting({
                groupId: group.id,
                key,
                pictures,
                groups,
                gridSize,
              })
              const count = summary.overriddenChartIds.length

              return count > 0 ? (
                <button
                  className={controlStyles.status}
                  data-testid={`group-chart-override-${key}`}
                  onClick={() =>
                    setGroupChartSetting(group.id, key, summary.groupValue, {
                      force: true,
                    })
                  }
                  onPointerDown={stopCanvasPointer}
                  title="These charts set their own value. Click to apply the group value to them too."
                  type="button"
                >
                  {count} own · apply to all
                </button>
              ) : null
            }}
            values={values}
          />
        </ChartPopoverSection>
        <ChartPopoverSection title="Actions">
          <div className={controlStyles.actions}>
            <ChartActionButton
              label="Reload all"
              onClick={() =>
                requestChartReload(members.map((chart) => chart.id))
              }
            />
            <ChartActionButton
              label="Reset all to group"
              onClick={() => resetGroupChartOverrides(group.id)}
              tone="accent"
            />
          </div>
        </ChartPopoverSection>
      </ChartPopover>
    </div>
  )
})
