import { describe, expect, it } from 'vitest'

import {
  createFormatPainterFromCard,
  createFormatPainterFromGroup,
  getCardUpdatesFromFormatPainter,
  getGroupUpdatesFromFormatPainter,
  isFormatPainterSourceMatch,
} from '../../../../src/features/appearance/formatPainter'

describe('formatPainter', () => {
  it('keeps card-only fields when copying card format to another card', () => {
    const payload = createFormatPainterFromCard({
      id: 'card-1',
      borderColor: '#556677',
      borderPresetIndex: undefined,
      cornerRadius: 24,
      fillColor: '#112233',
      fillPresetIndex: undefined,
      shadowStyle: 'hard',
      showImage: false,
      showTitle: false,
      size: {
        columns: 7,
        rows: 4,
      },
      surfaceTransparency: 28,
    })

    expect(getCardUpdatesFromFormatPainter(payload)).toEqual({
      borderColor: '#556677',
      borderPresetIndex: undefined,
      cornerRadius: 24,
      fillColor: '#112233',
      fillPresetIndex: undefined,
      shadowStyle: 'hard',
      showImage: false,
      showTitle: false,
      size: {
        columns: 7,
        rows: 4,
      },
      surfaceTransparency: 28,
    })
  })

  it('drops card-only showImage when applying card format to a group', () => {
    const payload = createFormatPainterFromCard({
      id: 'card-1',
      borderColor: '#556677',
      borderPresetIndex: undefined,
      cornerRadius: 24,
      fillColor: '#112233',
      fillPresetIndex: undefined,
      shadowStyle: 'soft',
      showImage: false,
      showTitle: true,
      size: {
        columns: 8,
        rows: 6,
      },
      surfaceTransparency: 14,
    })

    expect(getGroupUpdatesFromFormatPainter(payload)).toEqual({
      borderColor: '#556677',
      borderPresetIndex: undefined,
      cornerRadius: 24,
      fillColor: '#112233',
      fillPresetIndex: undefined,
      shadowStyle: 'soft',
      showTitle: true,
      size: {
        columns: 8,
        rows: 6,
      },
      surfaceTransparency: 14,
    })
  })

  it('preserves preset-based colors while clearing custom colors and clamps only card size updates', () => {
    const payload = createFormatPainterFromGroup({
      id: 'group-1',
      borderColor: '#999999',
      borderPresetIndex: 3,
      cornerRadius: 18,
      fillColor: '#111111',
      fillPresetIndex: 1,
      shadowStyle: 'long',
      showTitle: false,
      size: {
        columns: 13,
        rows: 1,
      },
      surfaceTransparency: 42,
    })

    expect(getCardUpdatesFromFormatPainter(payload)).toEqual({
      borderColor: undefined,
      borderPresetIndex: 3,
      cornerRadius: 18,
      fillColor: undefined,
      fillPresetIndex: 1,
      shadowStyle: 'long',
      showImage: undefined,
      showTitle: false,
      size: {
        columns: 12,
        rows: 2,
      },
      surfaceTransparency: 42,
    })

    expect(getGroupUpdatesFromFormatPainter(payload)).toEqual({
      borderColor: undefined,
      borderPresetIndex: 3,
      cornerRadius: 18,
      fillColor: undefined,
      fillPresetIndex: 1,
      shadowStyle: 'long',
      showTitle: false,
      size: {
        columns: 13,
        rows: 2,
      },
      surfaceTransparency: 42,
    })
  })

  it('matches only the original source node', () => {
    const payload = createFormatPainterFromGroup({
      id: 'group-1',
      borderColor: undefined,
      borderPresetIndex: undefined,
      cornerRadius: 12,
      fillColor: undefined,
      fillPresetIndex: undefined,
      shadowStyle: 'soft',
      showTitle: true,
      size: {
        columns: 4,
        rows: 4,
      },
      surfaceTransparency: 0,
    })

    expect(
      isFormatPainterSourceMatch(payload, { id: 'group-1', kind: 'group' }),
    ).toBe(true)
    expect(
      isFormatPainterSourceMatch(payload, { id: 'group-1', kind: 'card' }),
    ).toBe(false)
    expect(
      isFormatPainterSourceMatch(payload, { id: 'group-2', kind: 'group' }),
    ).toBe(false)
  })
})
