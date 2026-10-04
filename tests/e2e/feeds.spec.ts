import { expect, test, type Page } from '@playwright/test'

const PROXY = 'http://127.0.0.1:8788/rss'
const NOW = Date.now()

function rss(
  title: string,
  items: Array<{ title: string; link: string; ago: number; summary?: string }>,
) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel><title>${title}</title><link>https://example.com/</link>
${items
  .map(
    (item) => `<item><title>${item.title}</title><link>${item.link}</link>
<guid>${item.link}</guid><pubDate>${new Date(NOW - item.ago).toUTCString()}</pubDate>
<description>${item.summary ?? ''}</description></item>`,
  )
  .join('\n')}
</channel></rss>`
}

const FEEDS: Record<string, string> = {
  'https://alpha.example/rss': rss('Alpha News', [
    {
      title: 'Budget passes parliament',
      link: 'https://alpha.example/budget',
      ago: 3600e3,
      summary: 'Vote count',
    },
    {
      title: 'Old harbour reopens',
      link: 'https://alpha.example/harbour',
      ago: 10 * 86400e3,
    },
  ]),
  'https://beta.example/feed': rss('Beta Daily', [
    {
      title: 'Zoo welcomes panda',
      link: 'https://beta.example/panda',
      ago: 600e3,
    },
    {
      title: 'Apple harvest starts',
      link: 'https://beta.example/apple',
      ago: 2 * 86400e3,
      summary: 'Budget for farms',
    },
  ]),
}

/** Stands in for `npm run feed:news`; records which feeds were requested. */
async function mockFeedProxy(page: Page) {
  const requested: string[] = []

  await page.route(`${PROXY}?**`, async (route) => {
    const target = new URL(route.request().url()).searchParams.get('url') ?? ''

    requested.push(target)

    if (target === 'https://page.example/') {
      await route.fulfill({
        contentType: 'text/html',
        body: '<!DOCTYPE html><html><head><link rel="alternate" type="application/rss+xml" href="https://alpha.example/rss"></head></html>',
      })
      return
    }

    const body = FEEDS[target]

    await route.fulfill(
      body
        ? { contentType: 'application/rss+xml', body }
        : {
            status: 502,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Feed server answered HTTP 404' }),
          },
    )
  })

  return requested
}

async function itemTitles(page: Page) {
  return page
    .getByTestId(/feed-node-/)
    .first()
    .getByTestId('feed-item')
    .evaluateAll((items) =>
      items.map(
        (item) => item.querySelector('[class*="itemTitle"]')?.textContent ?? '',
      ),
    )
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 })
  await page.goto('/')
  await page.evaluate(async () => {
    window.localStorage.clear()
    await window.indexedDB.deleteDatabase('linkhub')
  })
})

test('adds feeds, merges, sorts, filters and opens articles', async ({
  page,
  context,
}) => {
  await mockFeedProxy(page)
  await page.reload()
  await page.getByRole('button', { name: 'Add news feed' }).click()

  const node = page.getByTestId(/feed-node-/).first()

  await node.getByLabel('Feed URL').fill('alpha.example/rss')
  await node.getByRole('button', { name: 'Add feed' }).click()
  await expect(node.getByTestId('feed-title')).toHaveText('Alpha News')
  await expect(node.getByTestId('feed-item')).toHaveCount(2)

  await node.getByRole('button', { name: 'Feed options' }).click()
  const options = page.getByTestId('feed-options')
  await options.getByLabel('Feed URL').fill('https://beta.example/feed')
  await options.getByRole('button', { name: 'Add feed' }).click()
  await page.keyboard.press('Escape')

  await expect(node.getByTestId('feed-title')).toHaveText('News')
  await expect(node.getByTestId('feed-item')).toHaveCount(4)
  expect(await itemTitles(page)).toEqual([
    'Zoo welcomes panda',
    'Budget passes parliament',
    'Apple harvest starts',
    'Old harbour reopens',
  ])

  await node.getByLabel('Sort articles').selectOption('title')
  expect(await itemTitles(page)).toEqual([
    'Apple harvest starts',
    'Budget passes parliament',
    'Old harbour reopens',
    'Zoo welcomes panda',
  ])

  // Query matches titles and summaries.
  await node.getByLabel('Filter articles').fill('budget')
  expect(await itemTitles(page)).toEqual([
    'Apple harvest starts',
    'Budget passes parliament',
  ])
  await node.getByLabel('Filter articles').fill('')

  await node.getByLabel('Time window').selectOption('3d')
  await expect(node.getByTestId('feed-item')).toHaveCount(3)
  await node.getByLabel('Time window').selectOption('all')

  // Source chips hide/show one feed.
  await node.getByRole('button', { name: 'Beta Daily' }).click()
  await expect(
    node.getByRole('button', { name: 'Beta Daily' }),
  ).toHaveAttribute('aria-pressed', 'false')
  await expect(node.getByTestId('feed-item')).toHaveCount(2)
  await node.getByRole('button', { name: 'Beta Daily' }).click()
  await expect(node.getByTestId('feed-item')).toHaveCount(4)

  // Articles are real links that open in a new tab.
  const article = node.getByRole('link', { name: /Zoo welcomes panda/ })
  await expect(article).toHaveAttribute('href', 'https://beta.example/panda')
  await expect(article).toHaveAttribute('target', '_blank')
  await expect(article).toHaveAttribute('rel', 'noopener noreferrer')

  await context.route('https://beta.example/panda', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<title>Panda</title>' }),
  )
  const [popup] = await Promise.all([
    context.waitForEvent('page'),
    article.click(),
  ])
  await expect(popup).toHaveURL('https://beta.example/panda')
  await popup.close()

  // Settings persist across reloads.
  await page.reload()
  const reloaded = page.getByTestId(/feed-node-/).first()
  await expect(reloaded.getByLabel('Sort articles')).toHaveValue('title')
  await expect(reloaded.getByTestId('feed-item')).toHaveCount(4)
})

test('follows a page feed link and reports failing feeds', async ({ page }) => {
  const requested = await mockFeedProxy(page)

  await page.reload()
  await page.getByRole('button', { name: 'Add news feed' }).click()

  const node = page.getByTestId(/feed-node-/).first()

  await node.getByLabel('Feed URL').fill('https://page.example/')
  await node.getByRole('button', { name: 'Add feed' }).click()
  await expect(node.getByTestId('feed-item')).toHaveCount(2)
  expect(requested).toContain('https://alpha.example/rss')

  await node.getByRole('button', { name: 'Feed options' }).click()
  const options = page.getByTestId('feed-options')
  await options.getByLabel('Feed URL').fill('https://missing.example/rss')
  await options.getByRole('button', { name: 'Add feed' }).click()
  await page.keyboard.press('Escape')

  await expect(node.getByTestId('feed-error')).toContainText('HTTP 404')
  await expect(node.getByTestId('feed-item')).toHaveCount(2)

  await node.getByRole('button', { name: 'Feed options' }).click()
  await options.getByRole('button', { name: /Remove missing\.example/ }).click()
  await page.keyboard.press('Escape')
  await expect(node.getByTestId('feed-error')).toHaveCount(0)
})

test('wheel over the article list scrolls it instead of zooming', async ({
  page,
}) => {
  await page.route(`${PROXY}?**`, (route) =>
    route.fulfill({
      contentType: 'application/rss+xml',
      body: rss(
        'Long',
        Array.from({ length: 40 }, (_, index) => ({
          title: `Story ${index}`,
          link: `https://long.example/${index}`,
          ago: index * 60e3,
        })),
      ),
    }),
  )
  await page.reload()
  await page.getByRole('button', { name: 'Add news feed' }).click()

  const node = page.getByTestId(/feed-node-/).first()

  await node.getByLabel('Feed URL').fill('https://long.example/rss')
  await node.getByRole('button', { name: 'Add feed' }).click()
  await expect(node.getByTestId('feed-item')).toHaveCount(40)

  const list = node.getByTestId('feed-list')
  const before = await node.boundingBox()

  await list.hover()
  await page.mouse.wheel(0, 400)
  await expect
    .poll(() => list.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(0)
  expect((await node.boundingBox())?.width).toBeCloseTo(before!.width, 0)
})
