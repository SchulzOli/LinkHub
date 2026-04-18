import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(async () => {
    window.localStorage.clear()
    await window.indexedDB.deleteDatabase('linkhub')
  })
  await page.reload()
})

test('keeps the bottom taskbar ordered on small screens', async ({ page }) => {
  const viewport = page.viewportSize()

  test.skip(!viewport || viewport.width > 768, 'Small-screen layout only')

  const quickAddToggle = page.locator('button[name="quick-add-toggle"]')

  await quickAddToggle.click()

  const quickAddForm = page.locator('.quickAddForm')
  await expect(quickAddForm).toBeVisible()

  const layout = await page.evaluate(() => {
    const taskbarNode = document.querySelector('[data-testid="bottom-taskbar"]')
    const quickAddNode = document.querySelector(
      'button[name="quick-add-toggle"]',
    )
    const modeNode = document.querySelector(
      '[aria-label="Toggle interaction mode"]',
    )
    const menuNode = document.querySelector(
      '[data-testid="options-menu-toggle"]',
    )
    const formNode = document.querySelector('.quickAddForm')
    const addGroupNode = document.querySelector('[aria-label="Add group"]')
    const uploadImageNode = document.querySelector(
      '[aria-label="Upload image"]',
    )
    const imageGalleryNode = document.querySelector(
      '[aria-label="Open image gallery"]',
    )

    if (!taskbarNode || !quickAddNode || !modeNode || !menuNode || !formNode) {
      return null
    }

    const taskbarRect = taskbarNode.getBoundingClientRect()
    const quickAddRect = quickAddNode.getBoundingClientRect()
    const modeRect = modeNode.getBoundingClientRect()
    const menuRect = menuNode.getBoundingClientRect()
    const formRect = formNode.getBoundingClientRect()
    const taskbarStyles = getComputedStyle(taskbarNode)

    return {
      taskbar: {
        clientWidth: taskbarNode.clientWidth,
        height: taskbarRect.height,
        scrollWidth: taskbarNode.scrollWidth,
        width: taskbarRect.width,
        display: taskbarStyles.display,
        top: taskbarRect.top,
      },
      quickAddY: quickAddRect.y,
      modeY: modeRect.y,
      menuY: menuRect.y,
      secondaryActionsHidden:
        !addGroupNode && !uploadImageNode && !imageGalleryNode,
      form: {
        bottom: formRect.bottom,
        left: formRect.left,
        top: formRect.top,
        right: formRect.right,
        width: formRect.width,
      },
    }
  })

  expect(layout).not.toBeNull()

  if (!layout) {
    return
  }

  expect(layout.taskbar.display).toBe('flex')
  expect(layout.taskbar.scrollWidth).toBe(layout.taskbar.clientWidth)
  expect(layout.taskbar.width).toBeLessThanOrEqual(viewport.width - 8)
  expect(layout.taskbar.height).toBeLessThanOrEqual(64)
  expect(layout.secondaryActionsHidden).toBe(true)
  expect(Math.abs(layout.modeY - layout.quickAddY)).toBeLessThanOrEqual(8)
  expect(Math.abs(layout.menuY - layout.quickAddY)).toBeLessThanOrEqual(8)
  expect(Math.abs(layout.modeY - layout.menuY)).toBeLessThanOrEqual(8)
  expect(layout.form.left).toBeGreaterThanOrEqual(0)
  expect(layout.form.right).toBeLessThanOrEqual(viewport.width)
  expect(layout.form.top).toBeGreaterThanOrEqual(0)
  expect(layout.form.bottom).toBeLessThanOrEqual(layout.taskbar.top - 8)
})
