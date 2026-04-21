import { expect, test, type Locator, type Page } from '@playwright/test'

import { SURFACE_SHADOW_STYLE_LABELS } from '../../src/features/appearance/surfaceEffects'
import { moveCardIntoGroupBody } from './dragHelpers'
import { dismissVisibleEditPanels, openGroupEditor } from './fixtures'

const OFF_SHADOW_LABEL = SURFACE_SHADOW_STYLE_LABELS.none
const SHORT_SHADOW_LABEL = SURFACE_SHADOW_STYLE_LABELS.short
const DEFAULT_SHADOW_LABEL = SURFACE_SHADOW_STYLE_LABELS.soft
const HARD_SHADOW_LABEL = SURFACE_SHADOW_STYLE_LABELS.hard
const LONG_SHADOW_LABEL = SURFACE_SHADOW_STYLE_LABELS.long

async function setRangeValue(control: Locator, value: number) {
  const currentValue = Number(await control.inputValue())

  if (currentValue === value) {
    return
  }

  const min = Number((await control.getAttribute('min')) ?? '0')
  const max = Number((await control.getAttribute('max')) ?? '100')
  const shouldStartFromMin = Math.abs(value - min) <= Math.abs(max - value)

  await control.focus()
  await control.press(shouldStartFromMin ? 'Home' : 'End')

  const startValue = shouldStartFromMin ? min : max
  const stepCount = Math.abs(value - startValue)
  const directionKey = value >= startValue ? 'ArrowRight' : 'ArrowLeft'

  for (let stepIndex = 0; stepIndex < stepCount; stepIndex += 1) {
    await control.press(directionKey)
  }
}

async function selectMenuOption(
  page: Page,
  label: string | RegExp,
  optionLabel: string,
) {
  const trigger = page.getByLabel(label)

  await trigger.click()
  await expect(page.getByRole('listbox', { name: label })).toBeVisible()
  await page.getByRole('option', { name: optionLabel, exact: true }).click()
  await expect(trigger).toContainText(optionLabel)
}

async function applyBuiltInTheme(page: Page, themeName: string) {
  await page.getByRole('tab', { name: 'Themes' }).click()
  await page.getByRole('button', { name: `Apply ${themeName} theme` }).click()
  await expect(
    page.getByRole('button', { name: `Apply ${themeName} theme` }),
  ).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('tab', { name: 'Options' }).click()
}

test('persists selected theme, color mode and default card size settings', async ({
  page,
}) => {
  await page.goto('/')

  await page.getByRole('button', { name: 'Open menu' }).click()
  await applyBuiltInTheme(page, 'Blueprint')
  await selectMenuOption(page, 'Color mode', 'Light')
  await page.getByLabel('Default width').fill('4')
  await page.getByLabel('Default height').fill('6')
  await page.getByLabel('Default corner radius').fill('24')
  await page.getByLabel('Default show title').uncheck()
  await page.getByLabel('Default show image').check()
  await page.getByLabel('Open links in new tab').uncheck()
  await setRangeValue(page.getByLabel('Default transparency'), 28)
  await selectMenuOption(page, 'Default shadow', LONG_SHADOW_LABEL)
  await page.getByRole('button', { name: 'Default fill editor' }).click()
  await page.getByLabel('Default fill preset input 1').fill('#c7f0ff')
  await page.getByRole('button', { name: 'Save presets' }).click()
  await page.getByRole('button', { name: 'Default fill preset 1' }).click()
  await page.getByRole('button', { name: 'Default border editor' }).click()
  await page.getByLabel('Default border preset input 1').fill('#1274c4')
  await page.getByRole('button', { name: 'Save presets' }).last().click()
  await page.getByRole('button', { name: 'Default border preset 1' }).click()

  await expect(page.getByLabel('Default width')).toHaveValue('4')
  await expect(page.getByLabel('Default height')).toHaveValue('6')
  await expect(page.getByLabel('Default corner radius')).toHaveValue('24')
  await expect(page.getByLabel('Default show title')).not.toBeChecked()
  await expect(page.getByLabel('Default show image')).toBeChecked()
  await expect(page.getByLabel('Open links in new tab')).not.toBeChecked()
  await expect(page.getByLabel('Default transparency')).toHaveValue('28')
  await expect(page.getByLabel('Default shadow')).toContainText(
    LONG_SHADOW_LABEL,
  )
  await page.waitForTimeout(250)

  await page.reload()

  await page.getByRole('button', { name: 'Open menu' }).click()
  await expect(page.getByLabel('Color mode')).toContainText('Light')
  await page.getByRole('tab', { name: 'Themes' }).click()
  await expect(
    page.getByRole('button', { name: 'Apply Blueprint theme' }),
  ).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('tab', { name: 'Options' }).click()
  await expect(page.getByLabel('Default width')).toHaveValue('4')
  await expect(page.getByLabel('Default height')).toHaveValue('6')
  await expect(page.getByLabel('Default corner radius')).toHaveValue('24')
  await expect(page.getByLabel('Default show title')).not.toBeChecked()
  await expect(page.getByLabel('Default show image')).toBeChecked()
  await expect(page.getByLabel('Open links in new tab')).not.toBeChecked()
  await expect(page.getByLabel('Default transparency')).toHaveValue('28')
  await expect(page.getByLabel('Default shadow')).toContainText(
    LONG_SHADOW_LABEL,
  )
  await page.keyboard.press('Escape')

  await page
    .getByRole('button', { name: /Add link|Open quick add|Add your first link/ })
    .first()
    .click()
  await page.getByLabel('Link URL').fill('example.com')
  await page.getByLabel('Link title').fill('Example')
  await page.getByRole('button', { name: 'Create' }).click()
  const card = page.getByTestId(/link-card-/).first()
  await expect(card).toBeVisible()
  await dismissVisibleEditPanels(page)

  await expect
    .poll(() =>
      card.evaluate((node) => ({
        fillColor: getComputedStyle(node)
          .getPropertyValue('--card-surface')
          .trim(),
        borderColor: getComputedStyle(node)
          .getPropertyValue('--card-outline')
          .trim(),
        cornerRadius: getComputedStyle(node)
          .getPropertyValue('--card-radius')
          .trim(),
        surfaceTransparency: node.getAttribute('data-surface-transparency'),
        layout: node
          .querySelector('[data-layout]')
          ?.getAttribute('data-layout'),
        shadowStyle: node.getAttribute('data-shadow-style'),
      })),
    )
    .toEqual({
      fillColor: '#c7f0ff',
      borderColor: '#1274c4',
      cornerRadius: '24%',
      surfaceTransparency: '28',
      layout: 'single-content',
      shadowStyle: 'long',
    })
  await expect(card.getByTestId('card-title')).toHaveCount(0)
  await expect(card.getByTestId('card-image')).toBeVisible()

  await page.getByRole('button', { name: 'Toggle interaction mode' }).click()
  await expect(card.locator('a')).toHaveCount(1)
  await expect(card.locator('a')).not.toHaveAttribute('target', '_blank')
})

test('closes the burger menu when clicking outside', async ({ page }) => {
  await page.goto('/')

  await page.getByRole('button', { name: 'Open menu' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(1)

  const menuBounds = await page.getByRole('dialog').boundingBox()
  if (!menuBounds) throw new Error('menu dialog missing bounding box')

  const outsidePoint = {
    x:
      menuBounds.x > 24
        ? menuBounds.x - 12
        : menuBounds.x + Math.min(24, menuBounds.width / 2),
    y:
      menuBounds.y > 24
        ? menuBounds.y - 12
        : menuBounds.y + menuBounds.height + 12,
  }

  await page.mouse.click(outsidePoint.x, outsidePoint.y)
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('keeps the burger menu inside the viewport on small screens', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 700 })
  await page.goto('/')

  await page.getByRole('button', { name: 'Open menu' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()

  const menuBox = await page.getByRole('dialog').boundingBox()
  if (!menuBox) throw new Error('menu dialog missing bounding box on mobile')

  expect(menuBox.x).toBeGreaterThanOrEqual(0)
  expect(menuBox.y).toBeGreaterThanOrEqual(0)
  expect(menuBox.x + menuBox.width).toBeLessThanOrEqual(390)
  expect(menuBox.y + menuBox.height).toBeLessThanOrEqual(700)
  expect(menuBox.height).toBeGreaterThanOrEqual(520)
})

test('resets non-color options without touching saved color presets', async ({
  page,
}) => {
  await page.goto('/')

  await page.getByRole('button', { name: 'Open menu' }).click()
  await applyBuiltInTheme(page, 'Blueprint')
  await selectMenuOption(page, 'Color mode', 'Light')
  await page.getByLabel('Default width').fill('4')
  await page.getByLabel('Default height').fill('6')
  await page.getByLabel('Default corner radius').fill('28')
  await page.getByLabel('Default show title').uncheck()
  await page.getByLabel('Default show image').uncheck()
  await setRangeValue(page.getByLabel('Default transparency'), 42)
  await selectMenuOption(page, 'Default shadow', OFF_SHADOW_LABEL)
  await page.getByRole('button', { name: 'Default fill editor' }).click()
  await page.getByLabel('Default fill preset input 1').fill('#c7f0ff')
  await page.getByRole('button', { name: 'Save presets' }).click()
  await page.getByRole('button', { name: 'Default fill preset 1' }).click()

  await page.getByRole('button', { name: 'Reset options' }).click()

  await expect(page.getByLabel('Color mode')).toContainText('Dark')
  await expect(page.getByLabel('Default width')).toHaveValue('5')
  await expect(page.getByLabel('Default height')).toHaveValue('5')
  await expect(page.getByLabel('Default corner radius')).toHaveValue('10')
  await expect(page.getByLabel('Default show title')).toBeChecked()
  await expect(page.getByLabel('Default show image')).toBeChecked()
  await expect(page.getByLabel('Default transparency')).toHaveValue('0')
  await expect(page.getByLabel('Default shadow')).toContainText(
    DEFAULT_SHADOW_LABEL,
  )

  await page.getByRole('tab', { name: 'Themes' }).click()
  await expect(
    page.getByRole('button', { name: 'Apply Excalidraw theme' }),
  ).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('tab', { name: 'Options' }).click()
  await selectMenuOption(page, 'Color mode', 'Light')
  await page.keyboard.press('Escape')

  await page
    .getByRole('button', { name: /Add link|Open quick add|Add your first link/ })
    .first()
    .click()
  await page.getByLabel('Link URL').fill('example.com')
  await page.getByLabel('Link title').fill('Example')
  await page.getByRole('button', { name: 'Create' }).click()
  await expect(page.getByTestId('card-edit-panel')).toBeVisible()
  await dismissVisibleEditPanels(page)

  const card = page.getByTestId(/link-card-/).first()
  await expect
    .poll(() =>
      card.evaluate((node) => ({
        fillColor: getComputedStyle(node)
          .getPropertyValue('--card-surface')
          .trim(),
        cornerRadius: getComputedStyle(node)
          .getPropertyValue('--card-radius')
          .trim(),
        surfaceTransparency: node.getAttribute('data-surface-transparency'),
        shadowStyle: node.getAttribute('data-shadow-style'),
      })),
    )
    .toEqual({
      fillColor: '#c7f0ff',
      cornerRadius: '10%',
      surfaceTransparency: '0',
      shadowStyle: 'soft',
    })
})

test('keeps card surface effects independent from group overrides', async ({
  page,
}) => {
  await page.goto('/')

  await page.getByRole('button', { name: 'Open menu' }).click()
  await setRangeValue(page.getByLabel('Default transparency'), 28)
  await selectMenuOption(page, 'Default shadow', LONG_SHADOW_LABEL)
  await page.keyboard.press('Escape')

  await page
    .getByRole('button', { name: /Add link|Open quick add|Add your first link/ })
    .first()
    .click()
  await page.getByLabel('Link URL').fill('example.com')
  await page.getByLabel('Link title').fill('Example')
  await page.getByRole('button', { name: 'Create' }).click()
  await expect(page.getByTestId('card-edit-panel')).toBeVisible()
  await setRangeValue(page.getByLabel(/Edit transparency for/), 42)
  await selectMenuOption(page, /Edit shadow for/, HARD_SHADOW_LABEL)
  await dismissVisibleEditPanels(page)

  const card = page.getByTestId(/link-card-/).first()

  await page.getByRole('button', { name: 'Add group' }).click()
  await openGroupEditor(page)
  await setRangeValue(page.getByLabel(/Edit transparency for group/), 0)
  await selectMenuOption(page, /Edit shadow for group/, SHORT_SHADOW_LABEL)
  await dismissVisibleEditPanels(page)

  const group = page.getByTestId(/card-group-/).first()
  const groupBody = page.getByTestId(/card-group-body-/).first()

  await moveCardIntoGroupBody(page, card, groupBody, {
    pointerDownMethod: 'mouse',
    sourcePosition: 'center',
    steps: 8,
  })

  await expect
    .poll(async () => ({
      card: await card.evaluate((node) => ({
        surfaceTransparency: node.getAttribute('data-surface-transparency'),
        shadowStyle: node.getAttribute('data-shadow-style'),
      })),
      group: await group.evaluate((node) => ({
        surfaceTransparency: node.getAttribute('data-surface-transparency'),
        shadowStyle: node.getAttribute('data-shadow-style'),
      })),
    }))
    .toEqual({
      card: {
        surfaceTransparency: '42',
        shadowStyle: 'hard',
      },
      group: {
        surfaceTransparency: '0',
        shadowStyle: 'short',
      },
    })
})

test('updates preset-based card colors and favicon treatment after a theme switch', async ({
  page,
}) => {
  await page.goto('/')

  await page
    .getByRole('button', { name: /Add link|Open quick add|Add your first link/ })
    .first()
    .click()
  await page.getByLabel('Link URL').fill('example.com')
  await page.getByLabel('Link title').fill('Example')
  await page.getByRole('button', { name: 'Create' }).click()
  await expect(page.getByTestId('card-edit-panel')).toBeVisible()

  const card = page.getByTestId(/link-card-/).first()
  await page.getByRole('button', { name: 'Fill color preset 3' }).click()
  await page.getByRole('button', { name: 'Border color preset 4' }).click()

  await expect
    .poll(() =>
      card.evaluate((node) => ({
        fillColor: getComputedStyle(node)
          .getPropertyValue('--card-surface')
          .trim(),
        borderColor: getComputedStyle(node)
          .getPropertyValue('--card-outline')
          .trim(),
        faviconPlateBg: getComputedStyle(node)
          .getPropertyValue('--favicon-plate-bg')
          .trim(),
        faviconPlateBorder: getComputedStyle(node)
          .getPropertyValue('--favicon-plate-border')
          .trim(),
        faviconFilter: getComputedStyle(node)
          .getPropertyValue('--favicon-filter')
          .trim(),
      })),
    )
    .toEqual({
      fillColor: '#24364a',
      borderColor: '#66c7b5',
      faviconPlateBg: 'transparent',
      faviconPlateBorder: 'transparent',
      faviconFilter:
        'drop-shadow(0 1px 1px rgba(0, 0, 0, 0.34)) saturate(1.08)',
    })

  await page.getByRole('button', { name: 'Open menu' }).click()
  await selectMenuOption(page, 'Color mode', 'Light')
  await page.keyboard.press('Escape')

  await expect
    .poll(() =>
      card.evaluate((node) => ({
        fillColor: getComputedStyle(node)
          .getPropertyValue('--card-surface')
          .trim(),
        borderColor: getComputedStyle(node)
          .getPropertyValue('--card-outline')
          .trim(),
        faviconPlateBg: getComputedStyle(node)
          .getPropertyValue('--favicon-plate-bg')
          .trim(),
        faviconPlateBorder: getComputedStyle(node)
          .getPropertyValue('--favicon-plate-border')
          .trim(),
        faviconFilter: getComputedStyle(node)
          .getPropertyValue('--favicon-filter')
          .trim(),
      })),
    )
    .toEqual({
      fillColor: '#edf4ff',
      borderColor: '#4eb79a',
      faviconPlateBg: 'transparent',
      faviconPlateBorder: 'transparent',
      faviconFilter:
        'drop-shadow(0 1px 1px rgba(255, 255, 255, 0.22)) saturate(0.98)',
    })
})
