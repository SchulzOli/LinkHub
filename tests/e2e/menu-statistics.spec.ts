import { expect, test } from '@playwright/test'

import { dismissVisibleEditPanels, openGroupEditor } from './fixtures'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

test('replaces the status tab with statistics and tracks link opens per card and total', async ({
  page,
  context,
}) => {
  await page.getByRole('button', { name: 'Add group' }).click()
  await openGroupEditor(page)
  await dismissVisibleEditPanels(page)

  for (const entry of [
    { title: 'One', url: 'one.example.com' },
    { title: 'Two', url: 'two.example.com' },
  ] as const) {
    await page.getByRole('button', { name: 'Add link' }).click()
    await page.getByLabel('Link URL').fill(entry.url)
    await page.getByLabel('Link title').fill(entry.title)
    await page.getByRole('button', { name: 'Create' }).click()
    await expect(page.getByTestId('card-edit-panel')).toBeVisible()
    await dismissVisibleEditPanels(page)
  }

  await page.getByRole('button', { name: 'Open menu' }).click()
  await page.getByRole('tab', { name: 'Statistics' }).click()

  await expect(page.getByTestId('statistics-panel')).toBeVisible()
  await expect(page.getByTestId('statistics-card-count')).toHaveText('2')
  await expect(page.getByTestId('statistics-group-count')).toHaveText('1')
  await expect(page.getByTestId('statistics-link-opens-total')).toHaveText('0')
  await expect(page.getByTestId('statistics-canvas-opens-total')).toHaveText(
    '1',
  )
  await expect(page.getByTestId('statistics-storage-section')).toBeVisible()
  await expect(
    page.getByTestId('statistics-storage-value-groups'),
  ).not.toHaveText('0 B')
  await expect(
    page.getByTestId('statistics-storage-value-cards'),
  ).not.toHaveText('0 B')
  await expect(
    page.getByTestId('statistics-storage-value-pictures'),
  ).toHaveText('0 B')
  await expect(
    page.getByTestId('statistics-storage-value-templates'),
  ).toHaveText('0 B')
  await expect(page.getByTestId('statistics-storage-value-themes')).toHaveText(
    '0 B',
  )
  await expect(page.getByTestId('statistics-storage-value-gallery')).toHaveText(
    '0 B',
  )
  await expect(
    page.getByRole('heading', { name: 'Current board' }),
  ).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Local library' }),
  ).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Capacity' })).toBeVisible()
  await expect(
    page.getByTestId('statistics-storage-value-local-snapshot'),
  ).not.toHaveText('0 B')
  await expect(
    page.getByTestId('statistics-storage-local-snapshot-detail'),
  ).toContainText('of')
  await expect(
    page.getByTestId('statistics-storage-origin-copy'),
  ).toContainText('Browser-dependent')

  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Toggle interaction mode' }).click()

  const firstCard = page.getByTestId(/link-card-/).filter({ hasText: 'One' })
  const firstCardTestId = await firstCard.getAttribute('data-testid')

  if (!firstCardTestId) {
    throw new Error('missing first card test id for statistics test')
  }

  const firstCardId = firstCardTestId.replace(/^link-card-/, '')
  const pagePromise = context.waitForEvent('page')

  await firstCard.locator('a').click()

  const openedPage = await pagePromise
  await openedPage.close()
  await page.bringToFront()

  await page.getByRole('button', { name: 'Open menu' }).click()
  await page.getByRole('tab', { name: 'Statistics' }).click()

  await expect(page.getByTestId('statistics-link-opens-total')).toHaveText('1')
  await expect(
    page.getByTestId(`statistics-card-value-${firstCardId}-total`),
  ).toHaveText('1')
})

test('tracks canvas opens in statistics across reloads', async ({ page }) => {
  await page.getByRole('button', { name: 'Open menu' }).click()
  await page.getByRole('tab', { name: 'Statistics' }).click()
  await expect(page.getByTestId('statistics-canvas-opens-total')).toHaveText(
    '1',
  )

  await page.reload()

  await page.getByRole('button', { name: 'Open menu' }).click()
  await page.getByRole('tab', { name: 'Statistics' }).click()
  await expect(page.getByTestId('statistics-canvas-opens-total')).toHaveText(
    '2',
  )
})

test('switches timeline ranges and removes the old period cards', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Open menu' }).click()
  await page.getByRole('tab', { name: 'Statistics' }).click()

  await expect(page.getByTestId('statistics-period-day')).toHaveCount(0)
  await expect(page.getByTestId('statistics-link-timeline-bar')).toHaveCount(14)
  await expect(page.getByTestId('statistics-link-timeline-meta')).toHaveText(
    'Last 14 days · 0 opens',
  )

  await page.getByTestId('statistics-timeline-range-30d').click()

  await expect(
    page.getByTestId('statistics-timeline-range-30d'),
  ).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByTestId('statistics-link-timeline-bar')).toHaveCount(30)
  await expect(page.getByTestId('statistics-link-timeline-meta')).toHaveText(
    'Last 30 days · 0 opens',
  )

  await page.getByTestId('statistics-timeline-range-12w').click()

  await expect(page.getByTestId('statistics-link-timeline-bar')).toHaveCount(12)
  await expect(page.getByTestId('statistics-link-timeline-meta')).toHaveText(
    'Last 12 weeks · 0 opens',
  )
})
