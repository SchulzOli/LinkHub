import { memo } from 'react'

import '@fontsource-variable/caveat'

import styles from './NoteNode.module.css'

import type { NoteStroke, NoteText } from '../../contracts/noteNode'
import {
  getNoteStrokePath,
  noteColorValue,
} from '../../features/notes/noteGeometry'

const NoteStrokePath = memo(function NoteStrokePath({
  stroke,
  faded,
}: {
  stroke: NoteStroke
  faded?: boolean
}) {
  return (
    <path
      d={getNoteStrokePath(stroke)}
      data-testid="note-stroke"
      fill={noteColorValue(stroke.color)}
      opacity={faded ? 0.25 : 1}
    />
  )
})

/**
 * The drawing and text of a note, without any interaction: used on the
 * canvas and in template previews.
 */
export function NoteDrawing({
  strokes,
  texts,
  liveStroke,
  fadedStrokeIds,
  editingTextId,
}: {
  strokes: NoteStroke[]
  texts: NoteText[]
  liveStroke?: NoteStroke | null
  fadedStrokeIds?: ReadonlySet<string>
  editingTextId?: string | null
}) {
  return (
    <>
      <svg aria-hidden="true" className={styles.strokes}>
        {strokes.map((stroke) => (
          <NoteStrokePath
            faded={fadedStrokeIds?.has(stroke.id)}
            key={stroke.id}
            stroke={stroke}
          />
        ))}
        {liveStroke ? <NoteStrokePath stroke={liveStroke} /> : null}
      </svg>
      {texts.map((text) =>
        text.id === editingTextId ? null : (
          <div
            className={styles.text}
            data-note-text-id={text.id}
            data-testid="note-text"
            key={text.id}
            style={{
              left: text.x,
              top: text.y,
              color: noteColorValue(text.color),
              fontSize: text.fontSize,
            }}
          >
            {text.text}
          </div>
        ),
      )}
    </>
  )
}
