import { getStroke } from 'perfect-freehand'

import {
  DEFAULT_NOTE_SIZE,
  MAX_NOTE_STROKE_POINTS,
  type NoteColor,
  type NoteNode,
  type NotePoint,
  type NoteStroke,
  type NoteText,
} from '../../contracts/noteNode'
import { createId } from '../../utils/id'

/** `ink` follows the theme's text colour, so notes read in dark and light. */
export function noteColorValue(color: NoteColor) {
  return color === 'ink' ? 'var(--text-primary)' : color
}

export function createNoteNode(input: {
  position: { x: number; y: number }
}): NoteNode {
  const now = new Date().toISOString()

  return {
    id: createId(),
    type: 'note',
    strokes: [],
    texts: [],
    positionX: input.position.x,
    positionY: input.position.y,
    size: DEFAULT_NOTE_SIZE,
    createdAt: now,
    updatedAt: now,
  }
}

/**
 * The outline of a stroke as an SVG path, drawn like Excalidraw's freedraw
 * (perfect-freehand): thicker where the pen presses or moves slowly,
 * tapering at the ends.
 */
export function getNoteStrokePath(
  stroke: Pick<NoteStroke, 'points' | 'width' | 'simulatePressure'>,
) {
  const outline = getStroke(stroke.points, {
    size: stroke.width * 2,
    thinning: 0.6,
    smoothing: 0.5,
    streamline: 0.5,
    simulatePressure: stroke.simulatePressure,
    last: true,
  })

  if (outline.length < 2) {
    return ''
  }

  const average = (a: number, b: number) => (a + b) / 2
  const round = (value: number) => Math.round(value * 100) / 100
  let path = `M${round(outline[0][0])},${round(outline[0][1])}Q`

  for (let index = 0; index < outline.length; index += 1) {
    const [x0, y0] = outline[index]
    const [x1, y1] = outline[(index + 1) % outline.length]

    path += `${round(x0)},${round(y0)} ${round(average(x0, x1))},${round(average(y0, y1))} `
  }

  return `${path}Z`
}

/** Keeps a point only once it moved a little, and caps the length. */
export function appendNotePoint(points: NotePoint[], point: NotePoint) {
  const last = points.at(-1)

  if (
    points.length >= MAX_NOTE_STROKE_POINTS ||
    (last && Math.hypot(point[0] - last[0], point[1] - last[1]) < 0.75)
  ) {
    return points
  }

  return [...points, point]
}

/** Points stored with one decimal: plenty for drawing, half the size. */
export function roundNotePoints(points: NotePoint[]): NotePoint[] {
  const round = (value: number) => Math.round(value * 10) / 10

  return points.map(([x, y, pressure]) => [
    round(x),
    round(y),
    Math.round(pressure * 100) / 100,
  ])
}

function distanceToSegment(
  point: { x: number; y: number },
  a: NotePoint,
  b: NotePoint,
) {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const lengthSquared = dx * dx + dy * dy
  const t =
    lengthSquared === 0
      ? 0
      : Math.max(
          0,
          Math.min(
            1,
            ((point.x - a[0]) * dx + (point.y - a[1]) * dy) / lengthSquared,
          ),
        )

  return Math.hypot(point.x - (a[0] + t * dx), point.y - (a[1] + t * dy))
}

/** True when the eraser at `point` (radius in note units) hits a stroke. */
export function strokeHitByEraser(
  stroke: NoteStroke,
  point: { x: number; y: number },
  radius: number,
) {
  const reach = radius + stroke.width

  if (stroke.points.length === 1) {
    const [x, y] = stroke.points[0]

    return Math.hypot(point.x - x, point.y - y) <= reach
  }

  for (let index = 1; index < stroke.points.length; index += 1) {
    if (
      distanceToSegment(
        point,
        stroke.points[index - 1],
        stroke.points[index],
      ) <= reach
    ) {
      return true
    }
  }

  return false
}

export function createNoteText(
  input: Pick<NoteText, 'x' | 'y' | 'color' | 'fontSize'>,
): NoteText {
  return { id: createId(), text: '', ...input }
}
