import { z } from 'zod'

import { CardGroupSchema, type CardGroup } from '../../contracts/cardGroup'
import { LinkCardSchema, type LinkCard } from '../../contracts/linkCard'

export const CARD_CLIPBOARD_PREFIX = 'linkhub:cards:'
export const SELECTION_CLIPBOARD_PREFIX = 'linkhub:selection:'

const CardClipboardPayloadSchema = z.object({
  version: z.literal(1),
  cards: z.array(LinkCardSchema).min(1),
})

const SelectionClipboardPayloadSchema = z
  .object({
    version: z.literal(2),
    cards: z.array(LinkCardSchema),
    groups: z.array(CardGroupSchema),
  })
  .refine((payload) => payload.cards.length > 0 || payload.groups.length > 0)

export type CardClipboardPayload = z.infer<typeof CardClipboardPayloadSchema>
export type SelectionClipboardPayload = z.infer<
  typeof SelectionClipboardPayloadSchema
>

export function serializeCardClipboard(cards: LinkCard[]) {
  return `${CARD_CLIPBOARD_PREFIX}${JSON.stringify({ version: 1, cards })}`
}

export function serializeSelectionClipboard(input: {
  cards: LinkCard[]
  groups: CardGroup[]
}) {
  return `${SELECTION_CLIPBOARD_PREFIX}${JSON.stringify({
    version: 2,
    cards: input.cards,
    groups: input.groups,
  })}`
}

export function parseCardClipboard(text: string) {
  if (!text.startsWith(CARD_CLIPBOARD_PREFIX)) {
    return null
  }

  try {
    const parsed = JSON.parse(text.slice(CARD_CLIPBOARD_PREFIX.length))
    const payload = CardClipboardPayloadSchema.safeParse(parsed)

    return payload.success ? payload.data : null
  } catch {
    return null
  }
}

export function parseSelectionClipboard(text: string) {
  if (text.startsWith(SELECTION_CLIPBOARD_PREFIX)) {
    try {
      const parsed = JSON.parse(text.slice(SELECTION_CLIPBOARD_PREFIX.length))
      const payload = SelectionClipboardPayloadSchema.safeParse(parsed)

      return payload.success ? payload.data : null
    } catch {
      return null
    }
  }

  const cardPayload = parseCardClipboard(text)

  return cardPayload
    ? {
        version: 2 as const,
        cards: cardPayload.cards,
        groups: [],
      }
    : null
}
