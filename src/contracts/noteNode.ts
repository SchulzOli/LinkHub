import { z } from 'zod'

import { CardSizeSchema, coerceCardSize, type CardSize } from './linkCard'

/**
 * Note nodes are a small sketch pad on the canvas, in the spirit of
 * Excalidraw: freehand strokes drawn with the mouse, pen or a finger, and
 * text placed with a double click. Like charts and feeds they live in
 * `workspace.pictures`, so moving, grouping, templates, export and sync
 * treat them like any other free-floating node.
 *
 * Coordinates are in the note's own space: CSS pixels at 100 % zoom from
 * the top-left corner of its drawing area. Resizing a note crops or reveals
 * the drawing; it never scales it.
 */

/** Ink colours; `ink` follows the theme's text colour (dark/light). */
export const NOTE_COLORS = [
  'ink',
  '#e03131',
  '#2f9e44',
  '#1971c2',
  '#f08c00',
] as const

export const NOTE_COLOR_LABELS: Record<(typeof NOTE_COLORS)[number], string> = {
  ink: 'Ink',
  '#e03131': 'Red',
  '#2f9e44': 'Green',
  '#1971c2': 'Blue',
  '#f08c00': 'Orange',
}

export const NoteColorSchema = z.enum(NOTE_COLORS)
export type NoteColor = z.infer<typeof NoteColorSchema>

export const NOTE_STROKE_WIDTHS = [2, 4, 8] as const
export const NOTE_FONT_SIZES = [18, 26, 40] as const

export const MAX_NOTE_STROKES = 2000
export const MAX_NOTE_STROKE_POINTS = 4000
export const MAX_NOTE_TEXTS = 200
export const MAX_NOTE_TEXT_LENGTH = 4000

/** One point: x, y and pen pressure (0–1; 0.5 when the device has none). */
export const NotePointSchema = z.tuple([z.number(), z.number(), z.number()])
export type NotePoint = z.infer<typeof NotePointSchema>

export const NoteStrokeSchema = z.object({
  id: z.string().min(1),
  color: NoteColorSchema,
  width: z.number().positive().max(64),
  points: z.array(NotePointSchema).min(1).max(MAX_NOTE_STROKE_POINTS),
  /** True for mouse and touch: pressure is simulated from the speed. */
  simulatePressure: z.boolean(),
})

export type NoteStroke = z.infer<typeof NoteStrokeSchema>

export const NoteTextSchema = z.object({
  id: z.string().min(1),
  x: z.number(),
  y: z.number(),
  text: z.string().max(MAX_NOTE_TEXT_LENGTH),
  color: NoteColorSchema,
  fontSize: z.number().positive().max(120),
})

export type NoteText = z.infer<typeof NoteTextSchema>

export const DEFAULT_NOTE_SIZE: CardSize = { columns: 16, rows: 12 }

export const NoteNodeSchema = z.object({
  id: z.string().min(1),
  type: z.literal('note'),
  strokes: z.array(NoteStrokeSchema).max(MAX_NOTE_STROKES),
  texts: z.array(NoteTextSchema).max(MAX_NOTE_TEXTS),
  positionX: z.number(),
  positionY: z.number(),
  size: CardSizeSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type NoteNode = z.infer<typeof NoteNodeSchema>

function coerceList<T>(value: unknown, schema: z.ZodType<T>, max: number) {
  return Array.isArray(value)
    ? value
        .map((entry) => schema.safeParse(entry))
        .flatMap((parsed) => (parsed.success ? [parsed.data] : []))
        .slice(0, max)
    : []
}

export function coerceNoteNode(value: unknown): NoteNode | null {
  if (typeof value !== 'object' || value === null) {
    return null
  }

  const candidate = value as Partial<NoteNode> & {
    size?: unknown
    strokes?: unknown
    texts?: unknown
  }

  if (
    candidate.type !== 'note' ||
    typeof candidate.id !== 'string' ||
    candidate.id.length === 0 ||
    typeof candidate.positionX !== 'number' ||
    typeof candidate.positionY !== 'number' ||
    typeof candidate.createdAt !== 'string' ||
    typeof candidate.updatedAt !== 'string'
  ) {
    return null
  }

  return {
    id: candidate.id,
    type: 'note',
    strokes: coerceList(candidate.strokes, NoteStrokeSchema, MAX_NOTE_STROKES),
    texts: coerceList(candidate.texts, NoteTextSchema, MAX_NOTE_TEXTS),
    positionX: candidate.positionX,
    positionY: candidate.positionY,
    size: coerceCardSize(candidate.size, DEFAULT_NOTE_SIZE),
    createdAt: candidate.createdAt,
    updatedAt: candidate.updatedAt,
  }
}
