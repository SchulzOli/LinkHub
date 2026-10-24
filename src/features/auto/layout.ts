import type { CardGroup } from '../../contracts/cardGroup'
import { DEFAULT_CHART_SIZE } from '../../contracts/chartNode'
import { DEFAULT_FEED_SIZE } from '../../contracts/feedNode'
import type { CardSize, LinkCard } from '../../contracts/linkCard'
import type { PictureNode } from '../../contracts/pictureNode'
import {
  createDefaultWorkspace,
  type Workspace,
} from '../../contracts/workspace'
import { createChartNode } from '../charts/chartCreation'
import { createFeedNode } from '../feeds/feedCreation'
import { createCardGroup } from '../groups/groupCreation'
import { syncWorkspaceGroupMembership } from '../groups/groupService'
import { createLinkCard } from '../links/linkCreation'
import type { AutoPlan } from './plan'

export type AutoWorkspaceContent = Pick<
  Workspace,
  'cards' | 'groups' | 'pictures'
>

/** Grid cells; sections wrap to a new row past this width. */
const ROW_WIDTH_CELLS = 96
const SECTION_GAP_CELLS = 2
/** Header strip of a group; the body starts below it. */
const GROUP_HEADER_CELLS = 2
const LINKS_PER_ROW = 6
const CHARTS_PER_ROW = 2

type Section = {
  name: string
  columns: number
  rows: number
  /** Places the members once the group's top-left corner is known. */
  place: (
    originX: number,
    originY: number,
  ) => {
    cards: LinkCard[]
    pictures: PictureNode[]
  }
}

function gridSectionSize(
  count: number,
  perRow: number,
  item: CardSize,
): { columns: number; rows: number } {
  const columnsUsed = Math.min(perRow, Math.max(1, count))
  const rowsUsed = Math.max(1, Math.ceil(count / perRow))

  return {
    columns: 1 + columnsUsed * (item.columns + 1),
    rows: GROUP_HEADER_CELLS + rowsUsed * (item.rows + 1),
  }
}

function slot(
  index: number,
  perRow: number,
  item: CardSize,
  originX: number,
  originY: number,
  gridSize: number,
) {
  const column = index % perRow
  const row = Math.floor(index / perRow)

  return {
    x: originX + gridSize * (1 + column * (item.columns + 1)),
    y: originY + gridSize * (GROUP_HEADER_CELLS + row * (item.rows + 1)),
  }
}

function buildSections(
  plan: AutoPlan,
  options: { cardSize: CardSize; gridSize: number },
): Section[] {
  const { cardSize, gridSize } = options
  const sections: Section[] = []

  for (const group of plan.linkGroups) {
    if (group.links.length === 0) {
      continue
    }

    sections.push({
      name: group.name,
      ...gridSectionSize(group.links.length, LINKS_PER_ROW, cardSize),
      place: (originX, originY) => ({
        cards: group.links.flatMap((link, index) => {
          const card = createLinkCard({
            url: link.url,
            title: link.title,
            size: cardSize,
            position: slot(
              index,
              LINKS_PER_ROW,
              cardSize,
              originX,
              originY,
              gridSize,
            ),
          })

          return card ? [card] : []
        }),
        pictures: [],
      }),
    })
  }

  if (plan.feeds.length > 0) {
    sections.push({
      name: 'News',
      ...gridSectionSize(1, 1, DEFAULT_FEED_SIZE),
      place: (originX, originY) => {
        const feed = createFeedNode({
          position: slot(0, 1, DEFAULT_FEED_SIZE, originX, originY, gridSize),
          sources: plan.feeds.map((source) => ({
            url: source.url,
            title: source.title.slice(0, 80) || undefined,
          })),
        })

        return { cards: [], pictures: [{ ...feed, title: 'News' }] }
      },
    })
  }

  if (plan.charts.length > 0) {
    sections.push({
      name: 'Markets',
      ...gridSectionSize(
        plan.charts.length,
        CHARTS_PER_ROW,
        DEFAULT_CHART_SIZE,
      ),
      place: (originX, originY) => ({
        cards: [],
        pictures: plan.charts.map((chart, index) =>
          createChartNode({
            position: slot(
              index,
              CHARTS_PER_ROW,
              DEFAULT_CHART_SIZE,
              originX,
              originY,
              gridSize,
            ),
            source: { symbol: chart.symbol },
          }),
        ),
      }),
    })
  }

  return sections
}

/**
 * Lays the plan out as groups in rows, left to right. Every section is a
 * group so the dashboard can be collapsed and restyled like any canvas.
 */
export function layoutAutoPlan(
  plan: AutoPlan,
  options: { cardSize: CardSize; gridSize: number },
): AutoWorkspaceContent {
  const { gridSize } = options
  const groups: CardGroup[] = []
  const cards: LinkCard[] = []
  const pictures: PictureNode[] = []
  let cursorX = 0
  let cursorY = 0
  let rowHeight = 0

  for (const section of buildSections(plan, options)) {
    if (cursorX > 0 && cursorX + section.columns > ROW_WIDTH_CELLS) {
      cursorX = 0
      cursorY += rowHeight + SECTION_GAP_CELLS
      rowHeight = 0
    }

    const originX = cursorX * gridSize
    const originY = cursorY * gridSize
    const group = createCardGroup({
      name: section.name,
      position: { x: originX, y: originY },
      size: { columns: section.columns, rows: section.rows },
    })
    const members = section.place(originX, originY)

    groups.push(group)
    cards.push(...members.cards.map((card) => ({ ...card, groupId: group.id })))
    pictures.push(...members.pictures)

    cursorX += section.columns + SECTION_GAP_CELLS
    rowHeight = Math.max(rowHeight, section.rows)
  }

  const synced = syncWorkspaceGroupMembership(
    createDefaultWorkspace({
      groups,
      cards,
      pictures,
      placementGuide: {
        ...createDefaultWorkspace().placementGuide,
        gridSize,
      },
    }),
  )

  return {
    groups: synced.groups,
    cards: synced.cards,
    pictures: synced.pictures,
  }
}
