import {
  memo,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react'

import styles from './NoteNode.module.css'

import {
  MAX_NOTE_STROKES,
  MAX_NOTE_TEXTS,
  NOTE_COLOR_LABELS,
  NOTE_COLORS,
  NOTE_FONT_SIZES,
  NOTE_STROKE_WIDTHS,
  type NoteColor,
  type NoteNode as NoteNodeContract,
  type NoteStroke,
  type NoteText,
} from '../../contracts/noteNode'
import type { PlacementGuide } from '../../contracts/placementGuide'
import type { Viewport } from '../../contracts/workspace'
import {
  getCardPixelDimensions,
  getOverlayActionMetrics,
} from '../../features/appearance/themeTokens'
import {
  appendNotePoint,
  createNoteText,
  noteColorValue,
  roundNotePoints,
  strokeHitByEraser,
} from '../../features/notes/noteGeometry'
import {
  useWorkspaceStore,
  type InteractionMode,
} from '../../state/useWorkspaceStore'
import { createId } from '../../utils/id'
import {
  useCanvasEditActions,
  useCanvasSelectionActions,
} from '../canvas/CanvasActionsContext'
import {
  NodeActionBar,
  NodeActionButton,
  NodeResizeHandles,
} from '../nodes/NodeChrome'
import { NODE_CHROME_HOST, NODE_SURFACE } from '../nodes/nodeClasses'
import { useNodePlacement } from '../pictures/useNodePlacement'
import { StrokeIcon } from '../ui/StrokeIcon'

import { NoteDrawing } from './NoteDrawing'

type NoteNodeProps = {
  note: NoteNodeContract
  guide: PlacementGuide
  isSelected: boolean
  interactionMode: InteractionMode
  viewport: Viewport
}

type Tool = 'pen' | 'eraser'
type SizeIndex = 0 | 1 | 2

/** A click (not a drag) waits this long for a second click. */
const DOT_DELAY_MS = 280
const ERASER_RADIUS = 6

function PenIcon() {
  return (
    <StrokeIcon>
      <path d="M4 20l1-4 11-11 3 3-11 11-4 1z" />
      <path d="M14 7l3 3" />
    </StrokeIcon>
  )
}

function EraserIcon() {
  return (
    <StrokeIcon>
      <path d="M8.5 19.5 4 15l9.5-9.5 6 6-8 8z" />
      <path d="M9 19.5h11" />
    </StrokeIcon>
  )
}

function ClearIcon() {
  return (
    <StrokeIcon>
      <path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12" />
    </StrokeIcon>
  )
}

export const NoteNode = memo(function NoteNode({
  note,
  guide,
  isSelected,
  interactionMode,
  viewport,
}: NoteNodeProps) {
  const isEditMode = interactionMode === 'edit'
  const { onSelectPicture: onSelect } = useCanvasSelectionActions()
  const { onRemovePicture: onRemove } = useCanvasEditActions()
  const updateNote = useWorkspaceStore((state) => state.updateNote)
  const { handlePointerDown, createResizePointerDown } = useNodePlacement({
    node: note,
    guide,
    viewport,
    enabled: isEditMode,
  })
  const [tool, setTool] = useState<Tool>('pen')
  const [color, setColor] = useState<NoteColor>('ink')
  const [sizeIndex, setSizeIndex] = useState<SizeIndex>(1)
  const [liveStroke, setLiveStroke] = useState<NoteStroke | null>(null)
  const [erasing, setErasing] = useState<ReadonlySet<string>>(new Set())
  const [editing, setEditing] = useState<NoteText | null>(null)
  const padRef = useRef<HTMLDivElement | null>(null)
  const textRef = useRef<HTMLTextAreaElement | null>(null)
  const pendingDots = useRef<{ strokes: NoteStroke[]; timer: number } | null>(
    null,
  )
  const lastTouchTap = useRef<{ at: number; x: number; y: number } | null>(null)
  // Latest note for timers and handlers that outlive a render.
  const noteRef = useRef(note)

  useEffect(() => {
    noteRef.current = note
  }, [note])

  useEffect(
    () => () => {
      if (pendingDots.current) {
        window.clearTimeout(pendingDots.current.timer)
      }
    },
    [],
  )

  useEffect(() => {
    const element = textRef.current

    if (element) {
      element.style.height = 'auto'
      element.style.height = `${element.scrollHeight}px`
    }
  }, [editing])

  const size = getCardPixelDimensions(note.size, guide.gridSize)
  const actionMetrics = getOverlayActionMetrics(size.width, size.height)
  const nodeStyle: CSSProperties & Record<string, string | number> = {
    width: size.width,
    height: size.height,
    ['--action-button-size' as const]: `${actionMetrics.buttonSize}px`,
    ['--action-icon-size' as const]: `${actionMetrics.iconSize}px`,
    ['--action-bar-gap' as const]: `${actionMetrics.gap}px`,
    ['--action-bar-offset' as const]: `${actionMetrics.offset}px`,
    transform: `translate(${note.positionX}px, ${note.positionY}px)`,
  }

  const toLocal = (event: { clientX: number; clientY: number }) => {
    const rect = padRef.current?.getBoundingClientRect()

    return {
      x: (event.clientX - (rect?.left ?? 0)) / viewport.zoom,
      y: (event.clientY - (rect?.top ?? 0)) / viewport.zoom,
    }
  }

  const commitStrokes = (strokes: NoteStroke[]) => {
    if (strokes.length === 0) {
      return
    }

    updateNote(note.id, {
      strokes: [...noteRef.current.strokes, ...strokes].slice(
        -MAX_NOTE_STROKES,
      ),
    })
  }

  const flushPendingDots = () => {
    const pending = pendingDots.current

    if (pending) {
      window.clearTimeout(pending.timer)
      pendingDots.current = null
      commitStrokes(pending.strokes)
    }
  }

  const commitText = (text: NoteText | null) => {
    setEditing(null)

    if (!text) {
      return
    }

    const others = noteRef.current.texts.filter((entry) => entry.id !== text.id)
    const content = text.text.replace(/\s+$/, '')

    updateNote(note.id, {
      texts: content ? [...others, { ...text, text: content }] : others,
    })
  }

  const handlePadPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || editing) {
      return
    }

    // The pad draws; it never moves the note or starts a marquee.
    event.stopPropagation()
    event.preventDefault()

    if (isEditMode) {
      onSelect(note.id, event.metaKey || event.ctrlKey)
    }

    // Touch has no dblclick: a second tap close to the first types.
    if (event.pointerType === 'touch') {
      const last = lastTouchTap.current

      lastTouchTap.current = {
        at: event.timeStamp,
        x: event.clientX,
        y: event.clientY,
      }

      if (
        last &&
        event.timeStamp - last.at < DOT_DELAY_MS &&
        Math.hypot(event.clientX - last.x, event.clientY - last.y) < 24
      ) {
        lastTouchTap.current = null
        openTextAt(event)
        return
      }
    }

    event.currentTarget.setPointerCapture(event.pointerId)

    const point = toLocal(event)

    if (tool === 'eraser') {
      const hits = new Set(
        note.strokes
          .filter((stroke) => strokeHitByEraser(stroke, point, ERASER_RADIUS))
          .map((stroke) => stroke.id),
      )

      setErasing(hits)
      return
    }

    setLiveStroke({
      id: createId(),
      color,
      width: NOTE_STROKE_WIDTHS[sizeIndex],
      points: [[point.x, point.y, event.pressure || 0.5]],
      simulatePressure: event.pointerType !== 'pen',
    })
  }

  const handlePadPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (tool === 'eraser' && event.buttons === 1) {
      const point = toLocal(event)
      const hits = note.strokes.filter(
        (stroke) =>
          !erasing.has(stroke.id) &&
          strokeHitByEraser(stroke, point, ERASER_RADIUS),
      )

      if (hits.length > 0) {
        setErasing(
          (current) =>
            new Set([...current, ...hits.map((stroke) => stroke.id)]),
        )
      }
      return
    }

    if (!liveStroke) {
      return
    }

    const events = event.nativeEvent.getCoalescedEvents?.() ?? [
      event.nativeEvent,
    ]
    let points = liveStroke.points

    for (const entry of events) {
      const point = toLocal(entry)

      points = appendNotePoint(points, [
        point.x,
        point.y,
        entry.pressure || 0.5,
      ])
    }

    if (points !== liveStroke.points) {
      setLiveStroke({ ...liveStroke, points })
    }
  }

  const handlePadPointerUp = () => {
    if (tool === 'eraser') {
      if (erasing.size > 0) {
        updateNote(note.id, {
          strokes: noteRef.current.strokes.filter(
            (stroke) => !erasing.has(stroke.id),
          ),
        })
      }

      setErasing(new Set())
      return
    }

    if (!liveStroke) {
      return
    }

    const stroke = { ...liveStroke, points: roundNotePoints(liveStroke.points) }

    setLiveStroke(null)

    if (stroke.points.length > 1) {
      flushPendingDots()
      commitStrokes([stroke])
      return
    }

    // A click: keep the dot unless a second click makes it a double click.
    const dots = [...(pendingDots.current?.strokes ?? []), stroke]

    if (pendingDots.current) {
      window.clearTimeout(pendingDots.current.timer)
    }

    pendingDots.current = {
      strokes: dots,
      timer: window.setTimeout(() => {
        pendingDots.current = null
        commitStrokes(dots)
      }, DOT_DELAY_MS),
    }
  }

  /** Opens the text under the pointer, or a new one there. */
  const openTextAt = (event: { clientX: number; clientY: number }) => {
    // The two clicks were for typing, not for dots.
    if (pendingDots.current) {
      window.clearTimeout(pendingDots.current.timer)
      pendingDots.current = null
    }

    // Hit-test by position: pointer capture sends the clicks to the pad.
    const hit = [
      ...(padRef.current?.querySelectorAll<HTMLElement>(
        '[data-note-text-id]',
      ) ?? []),
    ].find((element) => {
      const rect = element.getBoundingClientRect()

      return (
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom
      )
    })
    const existing = note.texts.find(
      (text) => text.id === hit?.dataset.noteTextId,
    )

    if (existing) {
      setEditing(existing)
      return
    }

    if (note.texts.length >= MAX_NOTE_TEXTS) {
      return
    }

    const point = toLocal(event)
    const fontSize = NOTE_FONT_SIZES[sizeIndex]

    setEditing(
      createNoteText({
        x: Math.max(0, point.x - 2),
        y: Math.max(0, point.y - fontSize * 0.65),
        color,
        fontSize,
      }),
    )
  }

  const handleDoubleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    event.stopPropagation()
    openTextAt(event)
  }

  const toolButton = (value: Tool, label: string, icon: React.ReactNode) => (
    <button
      aria-label={label}
      aria-pressed={tool === value}
      className={styles.tool}
      onClick={() => setTool(value)}
      title={label}
      type="button"
    >
      {icon}
    </button>
  )

  return (
    <article
      className={`${NODE_SURFACE} ${NODE_CHROME_HOST} ${styles.note}`}
      data-entity-id={note.id}
      data-entity-kind="picture"
      data-mode={interactionMode}
      data-selected={isSelected}
      data-testid={`note-node-${note.id}`}
      style={nodeStyle}
      onPointerDown={(event) => {
        if (event.button !== 0) {
          return
        }

        if (isEditMode) {
          onSelect(note.id, event.metaKey || event.ctrlKey)
        }

        handlePointerDown(event)
      }}
    >
      <div className={styles.frame}>
        <div
          className={styles.toolbar}
          data-testid="note-toolbar"
          onPointerDown={(event) => {
            // Buttons are tools; the empty bar is the note's drag handle.
            if ((event.target as Element).closest('button')) {
              event.stopPropagation()
            }
          }}
        >
          {toolButton('pen', 'Pen', <PenIcon />)}
          {toolButton('eraser', 'Eraser', <EraserIcon />)}
          <span aria-hidden="true" className={styles.divider} />
          {NOTE_COLORS.map((value) => (
            <button
              aria-label={`${NOTE_COLOR_LABELS[value]} ink`}
              aria-pressed={color === value}
              className={styles.swatch}
              key={value}
              onClick={() => {
                setColor(value)
                setTool('pen')
              }}
              style={{ ['--swatch' as string]: noteColorValue(value) }}
              title={NOTE_COLOR_LABELS[value]}
              type="button"
            />
          ))}
          <span aria-hidden="true" className={styles.divider} />
          {(['S', 'M', 'L'] as const).map((label, index) => (
            <button
              aria-label={`Size ${label}`}
              aria-pressed={sizeIndex === index}
              className={styles.sizeButton}
              key={label}
              onClick={() => setSizeIndex(index as SizeIndex)}
              title={`Pen and text size ${label}`}
              type="button"
            >
              <span
                className={styles.sizeDot}
                style={{ width: 3 + index * 3, height: 3 + index * 3 }}
              />
            </button>
          ))}
          <span className={styles.spacer} />
          <button
            aria-label="Clear note"
            className={styles.tool}
            disabled={note.strokes.length === 0 && note.texts.length === 0}
            onClick={() => updateNote(note.id, { strokes: [], texts: [] })}
            title="Clear note (undo with Ctrl+Z)"
            type="button"
          >
            <ClearIcon />
          </button>
        </div>

        <div
          ref={padRef}
          className={styles.pad}
          data-testid="note-pad"
          data-tool={tool}
          onDoubleClick={handleDoubleClick}
          onLostPointerCapture={handlePadPointerUp}
          onPointerDown={handlePadPointerDown}
          onPointerMove={handlePadPointerMove}
        >
          <NoteDrawing
            editingTextId={editing?.id ?? null}
            fadedStrokeIds={erasing}
            liveStroke={liveStroke}
            strokes={note.strokes}
            texts={note.texts}
          />
          {note.strokes.length === 0 &&
          note.texts.length === 0 &&
          !liveStroke &&
          !editing ? (
            <p className={styles.hint}>Draw here · double-click to type</p>
          ) : null}
          {editing ? (
            <textarea
              ref={textRef}
              aria-label="Note text"
              autoFocus
              className={styles.textInput}
              data-testid="note-text-input"
              onBlur={() => commitText(editing)}
              onChange={(event) => {
                const value = event.currentTarget.value

                setEditing((current) =>
                  current ? { ...current, text: value } : current,
                )
              }}
              onKeyDown={(event) => {
                event.stopPropagation()

                if (
                  event.key === 'Escape' ||
                  (event.key === 'Enter' && (event.metaKey || event.ctrlKey))
                ) {
                  event.preventDefault()
                  event.currentTarget.blur()
                }
              }}
              onPointerDown={(event) => event.stopPropagation()}
              rows={1}
              spellCheck={false}
              style={{
                left: editing.x,
                top: editing.y,
                color: noteColorValue(editing.color),
                fontSize: editing.fontSize,
              }}
              value={editing.text}
            />
          ) : null}
        </div>
      </div>

      {isEditMode ? (
        <>
          <NodeActionBar>
            <NodeActionButton
              kind="delete"
              label="Delete note"
              onClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
                onRemove(note.id)
              }}
            />
          </NodeActionBar>
          <NodeResizeHandles
            label={(direction) => `Resize note ${direction}`}
            onPointerDown={createResizePointerDown}
          />
        </>
      ) : null}
    </article>
  )
})
