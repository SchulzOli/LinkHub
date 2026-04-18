import { expect, type Locator, type Page } from '@playwright/test'

export const APP_TITLE = 'LinkHub'
export const QUICK_ADD_BUTTON = 'button[name="quick-add-toggle"]'
export const CANVAS_TEST_ID = 'infinite-canvas'

async function dismissVisiblePanel(page: Page, testId: string) {
  const panel = page.getByTestId(testId)
  const edgePadding = 4

  if (!(await panel.isVisible())) {
    return
  }

  const box = await panel.boundingBox()
  const viewport = page.viewportSize()

  if (!box || !viewport) {
    throw new Error(`missing geometry while dismissing ${testId}`)
  }

  const candidatePoints = [
    {
      x: edgePadding,
      y: edgePadding,
    },
    {
      x: viewport.width - edgePadding,
      y: edgePadding,
    },
    {
      x: Math.max(edgePadding, box.x - 16),
      y: Math.min(
        viewport.height - edgePadding,
        box.y + Math.min(24, box.height / 2),
      ),
    },
    {
      x: Math.min(viewport.width - edgePadding, box.x + box.width + 16),
      y: Math.min(
        viewport.height - edgePadding,
        box.y + Math.min(24, box.height / 2),
      ),
    },
    {
      x: Math.min(
        viewport.width - edgePadding,
        Math.max(edgePadding, box.x + Math.min(24, box.width / 2)),
      ),
      y:
        box.y + box.height + 12 < viewport.height
          ? box.y + box.height + 12
          : Math.max(edgePadding, box.y - 12),
    },
  ]
  const clickPoint = candidatePoints.find(
    (point) =>
      !(
        point.x >= box.x &&
        point.x <= box.x + box.width &&
        point.y >= box.y &&
        point.y <= box.y + box.height
      ),
  )

  if (!clickPoint) {
    throw new Error(`no outside click point available for ${testId}`)
  }

  await page.mouse.click(clickPoint.x, clickPoint.y)
  await expect(panel).toHaveCount(0)
}

export async function dismissVisibleEditPanels(page: Page) {
  await dismissVisiblePanel(page, 'card-edit-panel')
  await dismissVisiblePanel(page, 'group-edit-panel')
}

export async function openGroupEditor(
  page: Page,
  group: Locator = page.locator('article[data-testid^="card-group-"]').last(),
) {
  await expect(group).toBeVisible()

  const updateButton = group.getByRole('button', { name: 'Update group' })

  await expect(updateButton).toBeVisible()
  await updateButton.click()
  await expect(page.getByTestId('group-edit-panel')).toBeVisible()
}
