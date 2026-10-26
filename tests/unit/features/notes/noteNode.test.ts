import { describe, expect, it } from 'vitest'

import {
  coerceNoteNode,
  type NoteStroke,
} from '../../../../src/contracts/noteNode'
import { coercePictureNode } from '../../../../src/contracts/pictureNode'
import {
  appendNotePoint,
  createNoteNode,
  getNoteStrokePath,
  roundNotePoints,
  strokeHitByEraser,
} from '../../../../src/features/notes/noteGeometry'

const stroke: NoteStroke = {
  id: 's1',
  color: 'ink',
  width: 4,
  points: [
    [0, 0, 0.5],
    [100, 0, 0.5],
  ],
  simulatePressure: true,
}

describe('note nodes', () => {
  it('round-trips through the picture node coercion', () => {
    const note = {
      ...createNoteNode({ position: { x: 24, y: 48 } }),
      strokes: [stroke],
    }

    expect(coercePictureNode(JSON.parse(JSON.stringify(note)))).toEqual(note)
  })

  it('keeps the valid parts of a damaged note', () => {
    const note = coerceNoteNode({
      ...createNoteNode({ position: { x: 0, y: 0 } }),
      strokes: [stroke, { id: 'bad', color: 'purple', points: [] }],
      texts: [
        { id: 't1', x: 4, y: 8, text: 'Hi', color: 'ink', fontSize: 26 },
        'nonsense',
      ],
      size: 'huge',
    })

    expect(note?.strokes.map((entry) => entry.id)).toEqual(['s1'])
    expect(note?.texts.map((entry) => entry.text)).toEqual(['Hi'])
    expect(note?.size).toEqual({ columns: 16, rows: 12 })
    expect(coerceNoteNode({ type: 'note' })).toBeNull()
  })

  it('draws a stroke as a closed outline path', () => {
    const path = getNoteStrokePath(stroke)

    expect(path.startsWith('M')).toBe(true)
    expect(path.endsWith('Z')).toBe(true)
  })

  it('skips tiny moves and rounds stored points', () => {
    const points = appendNotePoint([[0, 0, 0.5]], [0.2, 0.3, 0.5])

    expect(points).toHaveLength(1)
    expect(appendNotePoint(points, [5, 5, 0.5])).toHaveLength(2)
    expect(roundNotePoints([[1.234, 5.678, 0.4567]])).toEqual([
      [1.2, 5.7, 0.46],
    ])
  })

  it('lets the eraser hit strokes near the pointer only', () => {
    expect(strokeHitByEraser(stroke, { x: 50, y: 5 }, 6)).toBe(true)
    expect(strokeHitByEraser(stroke, { x: 50, y: 40 }, 6)).toBe(false)
  })
})
