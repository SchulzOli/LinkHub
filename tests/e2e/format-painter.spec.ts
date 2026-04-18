import { expect, test, type Locator, type Page } from '@playwright/test'

import { SURFACE_SHADOW_STYLE_LABELS } from '../../src/features/appearance/surfaceEffects'
import {
  CANVAS_TEST_ID,
  dismissVisibleEditPanels,
  openGroupEditor,
} from './fixtures'

const HARD_SHADOW_LABEL = SURFACE_SHADOW_STYLE_LABELS.hard

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

async function createLinkCard(
  page: Page,
  input: { title: string; url: string },
) {
  const cards = page.locator('article[data-testid^="link-card-"]')
  const previousCount = await cards.count()

  await page.getByRole('button', { name: 'Add link' }).click()
  await page.getByLabel('Link URL').fill(input.url)
  await page.getByLabel('Link title').fill(input.title)
  await page.getByRole('button', { name: 'Create' }).click()

  const card = cards.nth(previousCount)

  await expect(card).toBeVisible()
  await dismissVisibleEditPanels(page)

  return card
}

async function createGroup(page: Page, name: string) {
  const groups = page.locator('article[data-testid^="card-group-"]')
  const previousCount = await groups.count()

  await page.getByRole('button', { name: 'Add group' }).click()
  await openGroupEditor(page)
  await page.getByLabel(/Edit group name for/).fill(name)
  await dismissVisibleEditPanels(page)

  const group = groups.nth(previousCount)

  await expect(group).toBeVisible()
  await expect(group).toContainText(name)

  return group
}

async function openCardEditor(page: Page, card: Locator) {
  await expect(card).toBeVisible()
  await card.hover()
  await card.getByRole('button', { name: 'Update' }).click()
  await expect(page.getByTestId('card-edit-panel')).toBeVisible()
}

async function readCardFormat(card: Locator) {
  return card.evaluate((node) => ({
    height: Math.round(node.getBoundingClientRect().height),
    cornerRadius: getComputedStyle(node)
      .getPropertyValue('--card-radius')
      .trim(),
    imageCount: node.querySelectorAll('[data-testid="card-image"]').length,
    titleCount: node.querySelectorAll('[data-testid="card-title"]').length,
    transparency: node.getAttribute('data-surface-transparency'),
    width: Math.round(node.getBoundingClientRect().width),
  }))
}

async function readGroupFormat(group: Locator) {
  return group.evaluate((node) => ({
    height: Math.round(node.getBoundingClientRect().height),
    shadowStyle: node.getAttribute('data-shadow-style'),
    title: node.textContent?.trim() ?? '',
    transparency: node.getAttribute('data-surface-transparency'),
    width: Math.round(node.getBoundingClientRect().width),
  }))
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(async () => {
    window.localStorage.clear()
    await window.indexedDB.deleteDatabase('linkhub')
  })
  await page.reload()
})

test('copies card format with Ctrl+Shift+C until empty canvas click ends the mode', async ({
  page,
}) => {
  const canvas = page.getByTestId(CANVAS_TEST_ID)
  const sourceCard = await createLinkCard(page, {
    title: 'Source',
    url: 'source.example.com',
  })
  const targetOne = await createLinkCard(page, {
    title: 'Target one',
    url: 'target-one.example.com',
  })
  const targetTwo = await createLinkCard(page, {
    title: 'Target two',
    url: 'target-two.example.com',
  })
  const targetThree = await createLinkCard(page, {
    title: 'Target three',
    url: 'target-three.example.com',
  })

  await openCardEditor(page, sourceCard)
  await page.getByLabel(/Edit width for/).fill('7')
  await page.getByLabel(/Edit height for/).fill('4')
  await page.getByLabel(/Show title on/).uncheck()
  await page.getByLabel(/Show image on/).uncheck()
  await setRangeValue(page.getByLabel(/Edit corner radius for/), 24)
  await setRangeValue(page.getByLabel(/Edit transparency for/), 42)
  await dismissVisibleEditPanels(page)

  const expectedFormat = await readCardFormat(sourceCard)

  await sourceCard.click()
  await page.keyboard.press('Control+Shift+C')

  await expect(canvas).toHaveAttribute('data-format-painter', 'active')
  await expect
    .poll(() => canvas.evaluate((node) => getComputedStyle(node).cursor))
    .toBe('copy')

  const targetThreeBefore = await readCardFormat(targetThree)

  await targetOne.click()
  await expect.poll(() => readCardFormat(targetOne)).toEqual(expectedFormat)
  await expect(canvas).toHaveAttribute('data-format-painter', 'active')

  await targetTwo.click()
  await expect.poll(() => readCardFormat(targetTwo)).toEqual(expectedFormat)
  await expect(canvas).toHaveAttribute('data-format-painter', 'active')

  await page.mouse.click(8, 8)

  await expect(canvas).toHaveAttribute('data-format-painter', 'idle')
  await expect
    .poll(() => canvas.evaluate((node) => getComputedStyle(node).cursor))
    .toBe('crosshair')

  await targetThree.click()
  await expect
    .poll(() => readCardFormat(targetThree))
    .toEqual(targetThreeBefore)
})

test('starts copy format from a group edit window and ends on Escape', async ({
  page,
}) => {
  const canvas = page.getByTestId(CANVAS_TEST_ID)
  const sourceGroup = await createGroup(page, 'Source group')
  const targetGroup = await createGroup(page, 'Target group')

  await openGroupEditor(page, targetGroup)
  await page.getByLabel(/Edit group width for/).fill('5')
  await page.getByLabel(/Edit group height for/).fill('4')
  await dismissVisibleEditPanels(page)

  await openGroupEditor(page, sourceGroup)
  await page.getByLabel(/Edit group width for/).fill('10')
  await page.getByLabel(/Edit group height for/).fill('7')
  await page.getByLabel(/Show title on group/).uncheck()
  await setRangeValue(page.getByLabel(/Edit transparency for group/), 42)
  await selectMenuOption(page, /Edit shadow for group/, HARD_SHADOW_LABEL)
  await page.getByRole('button', { name: /Copy format from group/ }).click()

  await expect(page.getByTestId('group-edit-panel')).toHaveCount(0)
  await expect(canvas).toHaveAttribute('data-format-painter', 'active')
  await expect
    .poll(() => canvas.evaluate((node) => getComputedStyle(node).cursor))
    .toBe('copy')

  const expectedGroupFormat = await readGroupFormat(sourceGroup)
  const targetGroupBefore = await readGroupFormat(targetGroup)

  await expect(targetGroup).toContainText('Target group')
  await expect(targetGroup).toHaveAttribute('data-surface-transparency', '0')
  expect(targetGroupBefore.width).not.toBe(expectedGroupFormat.width)
  expect(targetGroupBefore.height).not.toBe(expectedGroupFormat.height)

  await targetGroup.locator('[data-testid^="card-group-header-"]').click()

  await expect
    .poll(() => readGroupFormat(targetGroup))
    .toEqual({
      ...expectedGroupFormat,
      title: 'Target group',
    })

  await page.keyboard.press('Escape')

  await expect(canvas).toHaveAttribute('data-format-painter', 'idle')
  await expect
    .poll(() => canvas.evaluate((node) => getComputedStyle(node).cursor))
    .toBe('crosshair')
})
