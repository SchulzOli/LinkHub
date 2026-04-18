import type { Locator, Page } from '@playwright/test'

type MoveElementToPointOptions = {
  pointerDownMethod?: 'dispatch' | 'mouse'
  settleMs?: number
  sourceOffset?: { x: number; y: number }
  sourcePosition?: 'offset' | 'center'
  steps?: number
}

type MoveCardIntoGroupBodyOptions = MoveElementToPointOptions & {
  targetInset?: number
}

type MoveGroupIntoGroupBodyOptions = {
  placement?: 'fit-inside-end' | 'near-start'
  settleMs?: number
  targetInset?: number
}

function getElementDragStartPoint(
  box: { height: number; width: number; x: number; y: number },
  options: MoveElementToPointOptions,
) {
  if (options.sourcePosition === 'center') {
    return {
      x: box.x + box.width / 2,
      y: box.y + box.height / 2,
    }
  }

  const sourceOffset = options.sourceOffset ?? { x: 20, y: 20 }

  return {
    x: box.x + Math.min(sourceOffset.x, box.width / 2),
    y: box.y + Math.min(sourceOffset.y, box.height / 2),
  }
}

async function moveMouseToPoint(
  page: Page,
  point: { x: number; y: number },
  steps?: number,
) {
  if (steps && steps > 0) {
    await page.mouse.move(point.x, point.y, { steps })
    return
  }

  await page.mouse.move(point.x, point.y)
}

export async function moveElementToPoint(
  page: Page,
  element: Locator,
  point: { x: number; y: number },
  options: MoveElementToPointOptions = {},
) {
  const elementBox = await element.boundingBox()

  if (!elementBox) {
    throw new Error('missing geometry while moving an element')
  }

  const startPoint = getElementDragStartPoint(elementBox, options)

  if (options.pointerDownMethod === 'mouse') {
    await page.mouse.move(startPoint.x, startPoint.y)
    await page.mouse.down()
  } else {
    await element.dispatchEvent('pointerdown', {
      clientX: startPoint.x,
      clientY: startPoint.y,
      button: 0,
    })
  }

  await moveMouseToPoint(page, point, options.steps)
  await page.mouse.up()

  if (options.settleMs && options.settleMs > 0) {
    await page.waitForTimeout(options.settleMs)
  }
}

export async function moveCardIntoGroupBody(
  page: Page,
  card: Locator,
  groupBody: Locator,
  options: MoveCardIntoGroupBodyOptions = {},
) {
  const groupBodyBox = await groupBody.boundingBox()

  if (!groupBodyBox) {
    throw new Error('missing geometry while moving a card into a group body')
  }

  const targetInset = options.targetInset ?? 36

  await moveElementToPoint(
    page,
    card,
    {
      x: groupBodyBox.x + Math.min(targetInset, groupBodyBox.width / 2),
      y: groupBodyBox.y + Math.min(targetInset, groupBodyBox.height / 2),
    },
    options,
  )
}

export async function moveGroupIntoGroupBody(
  page: Page,
  groupHeader: Locator,
  groupBody: Locator,
  options: MoveGroupIntoGroupBodyOptions = {},
) {
  const groupArticle = groupHeader.locator('xpath=ancestor::article[1]')
  const groupBox = await groupArticle.boundingBox()
  const groupHeaderBox = await groupHeader.boundingBox()
  const groupBodyBox = await groupBody.boundingBox()

  if (!groupBox || !groupHeaderBox || !groupBodyBox) {
    throw new Error('missing geometry while moving a group into a group body')
  }

  const targetInset = options.targetInset ?? 24
  const targetPoint =
    options.placement === 'fit-inside-end'
      ? {
          x:
            groupBodyBox.x +
            Math.max(
              targetInset,
              groupBodyBox.width - groupBox.width + targetInset,
            ),
          y:
            groupBodyBox.y +
            Math.max(
              groupHeaderBox.height / 2,
              groupBodyBox.height - groupBox.height + groupHeaderBox.height / 2,
            ),
        }
      : {
          x: groupBodyBox.x + targetInset * 2,
          y: groupBodyBox.y + groupHeaderBox.height / 2 + targetInset,
        }

  await groupHeader.dispatchEvent('pointerdown', {
    clientX: groupHeaderBox.x + Math.min(targetInset, groupHeaderBox.width / 2),
    clientY: groupHeaderBox.y + groupHeaderBox.height / 2,
    button: 0,
  })
  await moveMouseToPoint(page, targetPoint)
  await page.mouse.up()

  if (options.settleMs && options.settleMs > 0) {
    await page.waitForTimeout(options.settleMs)
  }
}
