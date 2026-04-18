/**
 * Playwright script to generate 6 promotional screenshots for the browser
 * extension store listing (AMO / Chrome Web Store).
 *
 * Screenshots are saved to: extension/screenshots/
 *
 * Run:
 *   npx playwright test screenshots --project=chromium
 *
 * Prerequisites:
 *   Dev server running on http://127.0.0.1:4173 (Playwright auto-starts it)
 */

import { expect, test, type Locator, type Page } from '@playwright/test'

import { moveElementToPoint } from './dragHelpers'
import { dismissVisibleEditPanels } from './fixtures'

// ── Viewport: 1280×800 (AMO recommended) ────────────────────────
const VIEWPORT = { width: 1280, height: 800 }
const SCREENSHOT_DIR = 'extension/screenshots'

// ── Helpers ──────────────────────────────────────────────────────

async function clearAppState(page: Page) {
  await page.evaluate(async () => {
    window.localStorage.clear()
    await window.indexedDB.deleteDatabase('linkhub')
  })
  await page.reload()
  await page.waitForLoadState('networkidle')
}

async function createCard(page: Page, url: string, title: string) {
  await page
    .getByRole('button', { name: /Add link|Open quick add/ })
    .first()
    .click()
  await page.getByLabel('Link URL').fill(url)
  await page.getByLabel('Link title').fill(title)
  await page.getByRole('button', { name: 'Create' }).click({ force: true })
  await page.waitForTimeout(400)
  await dismissVisibleEditPanels(page)
}

async function createGroup(page: Page) {
  await page.getByRole('button', { name: 'Add group' }).click()
  await page.waitForTimeout(400)
  await dismissVisibleEditPanels(page)
}

async function openMenu(page: Page) {
  await page.getByRole('button', { name: 'Open menu' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
}

async function closeMenu(page: Page) {
  await page.keyboard.press('Escape')
  await page.waitForTimeout(200)
}

async function applyTheme(page: Page, themeName: string) {
  await page.getByRole('tab', { name: 'Themes' }).click()
  await page.getByRole('button', { name: `Apply ${themeName} theme` }).click()
  await page.waitForTimeout(300)
}

async function selectOption(
  page: Page,
  label: string | RegExp,
  optionLabel: string,
) {
  const trigger = page.getByLabel(label)
  await trigger.click()
  await page.getByRole('option', { name: optionLabel, exact: true }).click()
  await page.waitForTimeout(150)
}

/** Move an element using dispatchEvent (like existing E2E tests). */
async function moveCardToPoint(
  page: Page,
  element: Locator,
  target: { x: number; y: number },
) {
  await moveElementToPoint(page, element, target, { settleMs: 200 })
}

async function moveCardIntoGroupSlot(
  page: Page,
  card: Locator,
  groupBody: Locator,
  slot: { column: number; row: number },
) {
  const cardBox = await card.boundingBox()
  const groupBodyBox = await groupBody.boundingBox()

  if (!cardBox || !groupBodyBox) {
    throw new Error('missing geometry while placing a card inside a group')
  }

  const padding = 16
  const gap = 14
  const insetX = cardBox.width / 2 + padding
  const insetY = cardBox.height / 2 + padding
  const maxX = Math.max(
    insetX,
    groupBodyBox.width - cardBox.width / 2 - padding,
  )
  const maxY = Math.max(
    insetY,
    groupBodyBox.height - cardBox.height / 2 - padding,
  )
  const slotX = insetX + slot.column * (cardBox.width + gap)
  const slotY = insetY + slot.row * (cardBox.height + gap)

  await moveElementToPoint(
    page,
    card,
    {
      x: groupBodyBox.x + Math.max(insetX, Math.min(maxX, slotX)),
      y: groupBodyBox.y + Math.max(insetY, Math.min(maxY, slotY)),
    },
    {
      pointerDownMethod: 'mouse',
      settleMs: 250,
      sourcePosition: 'center',
      steps: 10,
    },
  )
}

async function screenshot(page: Page, name: string) {
  await page.waitForTimeout(600)
  await page.screenshot({
    path: `${SCREENSHOT_DIR}/${name}.png`,
    fullPage: false,
  })
}

// ── Test Suite ───────────────────────────────────────────────────

test.describe('Store listing screenshots', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(VIEWPORT)
    await page.goto('/')
    await clearAppState(page)
  })

  /**
   * Screenshot 1: Large grouped link collection across the canvas
   * Shows: Five named groups with fifty visible nodes to demonstrate scale
   */
  test('01 — Canvas overview with link cards', async ({ page }) => {
    test.slow()

    await openMenu(page)
    await applyTheme(page, 'Sunset')
    await page.getByRole('tab', { name: 'Options' }).click()
    await selectOption(page, 'Color mode', 'Light')
    await page.getByLabel('Default width').fill('2')
    await page.getByLabel('Default height').fill('2')
    await page.getByLabel('Default show title').uncheck()
    await closeMenu(page)

    const groupConfigs = [
      {
        name: 'Development',
        position: { x: 56, y: 84 },
        cards: [
          { url: 'github.com', title: 'GitHub' },
          { url: 'stackoverflow.com', title: 'Stack Overflow' },
          { url: 'npmjs.com', title: 'npm' },
          { url: 'gitlab.com', title: 'GitLab' },
          { url: 'codepen.io', title: 'CodePen' },
          { url: 'developer.mozilla.org', title: 'MDN' },
          { url: 'figma.com', title: 'Figma' },
          { url: 'notion.so', title: 'Notion' },
          { url: 'vercel.com', title: 'Vercel' },
          { url: 'linear.app', title: 'Linear' },
        ],
      },
      {
        name: 'Research',
        position: { x: 410, y: 84 },
        cards: [
          { url: 'wikipedia.org', title: 'Wikipedia' },
          { url: 'arxiv.org', title: 'arXiv' },
          { url: 'scholar.google.com', title: 'Scholar' },
          { url: 'archive.org', title: 'Archive' },
          { url: 'researchgate.net', title: 'ResearchGate' },
          { url: 'pubmed.ncbi.nlm.nih.gov', title: 'PubMed' },
          { url: 'nature.com', title: 'Nature' },
          { url: 'semanticscholar.org', title: 'Semantic Scholar' },
          { url: 'jstor.org', title: 'JSTOR' },
          { url: 'docs.python.org', title: 'Python Docs' },
        ],
      },
      {
        name: 'Media',
        position: { x: 764, y: 84 },
        cards: [
          { url: 'youtube.com', title: 'YouTube' },
          { url: 'spotify.com', title: 'Spotify' },
          { url: 'twitch.tv', title: 'Twitch' },
          { url: 'netflix.com', title: 'Netflix' },
          { url: 'letterboxd.com', title: 'Letterboxd' },
          { url: 'soundcloud.com', title: 'SoundCloud' },
          { url: 'vimeo.com', title: 'Vimeo' },
          { url: 'disneyplus.com', title: 'Disney+' },
          { url: 'primevideo.com', title: 'Prime Video' },
          { url: 'audible.com', title: 'Audible' },
        ],
      },
      {
        name: 'Workflow',
        position: { x: 230, y: 394 },
        cards: [
          { url: 'slack.com', title: 'Slack' },
          { url: 'atlassian.com/software/jira', title: 'Jira' },
          { url: 'trello.com', title: 'Trello' },
          { url: 'asana.com', title: 'Asana' },
          { url: 'clickup.com', title: 'ClickUp' },
          { url: 'miro.com', title: 'Miro' },
          { url: 'loom.com', title: 'Loom' },
          { url: 'zoom.us', title: 'Zoom' },
          { url: 'drive.google.com', title: 'Drive' },
          { url: 'dropbox.com', title: 'Dropbox' },
        ],
      },
      {
        name: 'Discover',
        position: { x: 584, y: 394 },
        cards: [
          { url: 'reddit.com', title: 'Reddit' },
          { url: 'news.ycombinator.com', title: 'Hacker News' },
          { url: 'producthunt.com', title: 'Product Hunt' },
          { url: 'dribbble.com', title: 'Dribbble' },
          { url: 'behance.net', title: 'Behance' },
          { url: 'webflow.com', title: 'Webflow' },
          { url: 'framer.com', title: 'Framer' },
          { url: 'stripe.com', title: 'Stripe' },
          { url: 'paypal.com', title: 'PayPal' },
          { url: 'etsy.com', title: 'Etsy' },
        ],
      },
    ]

    for (const [groupIndex, groupConfig] of groupConfigs.entries()) {
      await createGroup(page)

      const group = page
        .locator('article[data-testid^="card-group-"]')
        .nth(groupIndex)

      await group.getByRole('button', { name: 'Update group' }).click({
        force: true,
      })
      await expect(page.getByTestId('group-edit-panel')).toBeVisible()
      await page.getByLabel(/Edit group name/).fill(groupConfig.name)
      await page.getByLabel(/Edit group width for/).fill('18')
      await page.getByLabel(/Edit group height for/).fill('10')
      await dismissVisibleEditPanels(page)

      await moveCardToPoint(
        page,
        group.getByTestId(/card-group-header-/),
        groupConfig.position,
      )

      const groupBody = page.getByTestId(/card-group-body-/).nth(groupIndex)

      for (const [cardIndex, cardConfig] of groupConfig.cards.entries()) {
        await createCard(page, cardConfig.url, cardConfig.title)
        await moveCardIntoGroupSlot(
          page,
          page.getByTestId(/link-card-/).last(),
          groupBody,
          {
            column: cardIndex % 5,
            row: Math.floor(cardIndex / 5),
          },
        )
      }
    }

    await page.mouse.click(1160, 690)
    await page.waitForTimeout(200)

    await screenshot(page, '01-canvas-overview')
  })

  /**
   * Screenshot 2: Groups with multiple nested cards
   * Shows: A primary group with five visible nodes plus a secondary group
   */
  test('02 — Groups organizing cards', async ({ page }) => {
    await openMenu(page)
    await applyTheme(page, 'Blueprint')
    await page.getByRole('tab', { name: 'Options' }).click()
    await selectOption(page, 'Color mode', 'Light')
    await closeMenu(page)

    // Create first group
    await createGroup(page)
    const group1 = page.locator('article[data-testid^="card-group-"]').first()
    await moveCardToPoint(page, group1.getByTestId(/card-group-header-/), {
      x: 180,
      y: 160,
    })

    // Name the group via edit panel
    await group1
      .getByRole('button', { name: 'Update group' })
      .click({ force: true })
    await expect(page.getByTestId('group-edit-panel')).toBeVisible()
    await page.getByLabel(/Edit group name/).fill('Development')
    await page.getByLabel(/Edit group width for/).fill('18')
    await page.getByLabel(/Edit group height for/).fill('15')
    await dismissVisibleEditPanels(page)

    const group1Body = page.getByTestId(/card-group-body-/).first()

    const developmentCards = [
      { url: 'github.com', title: 'GitHub', slot: { column: 0, row: 0 } },
      {
        url: 'stackoverflow.com',
        title: 'Stack Overflow',
        slot: { column: 1, row: 0 },
      },
      {
        url: 'notion.so',
        title: 'Notion',
        slot: { column: 2, row: 0 },
      },
      {
        url: 'developer.mozilla.org',
        title: 'MDN Web Docs',
        slot: { column: 0, row: 1 },
      },
      { url: 'figma.com', title: 'Figma', slot: { column: 1, row: 1 } },
    ]

    for (const link of developmentCards) {
      await createCard(page, link.url, link.title)
      await moveCardIntoGroupSlot(
        page,
        page.getByTestId(/link-card-/).last(),
        group1Body,
        link.slot,
      )
      await dismissVisibleEditPanels(page)
    }

    // Create second group
    await createGroup(page)
    const group2 = page.locator('article[data-testid^="card-group-"]').last()
    await moveCardToPoint(
      page,
      group2.getByTestId(/card-group-header-/).last(),
      {
        x: 620,
        y: 160,
      },
    )

    await group2
      .getByRole('button', { name: 'Update group' })
      .click({ force: true })
    await expect(page.getByTestId('group-edit-panel')).toBeVisible()
    await page.getByLabel(/Edit group name/).fill('Social')
    await page.getByLabel(/Edit group width for/).fill('13')
    await page.getByLabel(/Edit group height for/).fill('8')
    await dismissVisibleEditPanels(page)

    const group2Body = page.getByTestId(/card-group-body-/).last()

    const socialCards = [
      { url: 'reddit.com', title: 'Reddit', slot: { column: 0, row: 0 } },
      { url: 'youtube.com', title: 'YouTube', slot: { column: 1, row: 0 } },
    ]

    for (const link of socialCards) {
      await createCard(page, link.url, link.title)
      await moveCardIntoGroupSlot(
        page,
        page.getByTestId(/link-card-/).last(),
        group2Body,
        link.slot,
      )
      await dismissVisibleEditPanels(page)
    }

    await page.mouse.click(1100, 620)
    await page.waitForTimeout(250)

    await screenshot(page, '02-groups-organization')
  })

  /**
   * Screenshot 3: Theme & appearance customization (menu open)
   * Shows: Theme tab open with all available themes, styled canvas behind
   */
  test('03 — Theme customization panel', async ({ page }) => {
    // Create cards first (before switching theme — avoids taskbar overlap issues)
    await createCard(page, 'github.com', 'GitHub')
    await createCard(page, 'spotify.com', 'Spotify')
    await createCard(page, 'discord.com', 'Discord')

    const cards = page.getByTestId(/link-card-/)
    await moveCardToPoint(page, cards.nth(0), { x: 120, y: 200 })
    await moveCardToPoint(page, cards.nth(1), { x: 280, y: 200 })
    await moveCardToPoint(page, cards.nth(2), { x: 440, y: 200 })

    // Now apply Neon dark theme and open the Themes tab for the screenshot
    await openMenu(page)
    await applyTheme(page, 'Neon')
    await page.getByRole('tab', { name: 'Options' }).click()
    await selectOption(page, 'Color mode', 'Dark')
    await page.getByRole('tab', { name: 'Themes' }).click()
    await page.waitForTimeout(300)

    await screenshot(page, '03-themes-customization')
  })

  /**
   * Screenshot 4: Card edit panel with styling options visible
   * Shows: A card being edited — color, size, shadow, transparency controls
   */
  test('04 — Card styling & edit panel', async ({ page }) => {
    await openMenu(page)
    await applyTheme(page, 'Excalidraw')
    await page.getByRole('tab', { name: 'Options' }).click()
    await selectOption(page, 'Color mode', 'Light')
    await closeMenu(page)

    await createCard(page, 'figma.com', 'Figma')
    await createCard(page, 'notion.so', 'Notion')
    await createCard(page, 'linear.app', 'Linear')
    await createCard(page, 'vercel.com', 'Vercel')

    const cards = page.getByTestId(/link-card-/)
    await moveCardToPoint(page, cards.nth(0), { x: 120, y: 180 })
    await moveCardToPoint(page, cards.nth(1), { x: 280, y: 180 })
    await moveCardToPoint(page, cards.nth(2), { x: 120, y: 360 })
    await moveCardToPoint(page, cards.nth(3), { x: 280, y: 360 })

    // Click Update button on the first card — force to bypass overlay
    await cards
      .nth(0)
      .getByRole('button', { name: 'Update' })
      .click({ force: true })
    await expect(page.getByTestId('card-edit-panel')).toBeVisible()

    await page.waitForTimeout(300)
    await screenshot(page, '04-card-edit-styling')
  })

  /**
   * Screenshot 5: Multiple workspaces (sidebar visible)
   * Shows: Workspace rail with multiple boards, demonstrating organization
   */
  test('05 — Multiple workspaces sidebar', async ({ page }) => {
    await openMenu(page)
    await applyTheme(page, 'Nord')
    await page.getByRole('tab', { name: 'Options' }).click()
    await selectOption(page, 'Color mode', 'Dark')
    await closeMenu(page)

    await createCard(page, 'github.com', 'GitHub')
    await createCard(page, 'developer.mozilla.org', 'MDN Web Docs')
    await createCard(page, 'typescript-lang.org', 'TypeScript')

    const cards = page.getByTestId(/link-card-/)
    await moveCardToPoint(page, cards.nth(0), { x: 300, y: 200 })
    await moveCardToPoint(page, cards.nth(1), { x: 480, y: 200 })
    await moveCardToPoint(page, cards.nth(2), { x: 660, y: 200 })

    // Click empty area to deselect
    await page.mouse.click(900, 400)
    await page.waitForTimeout(200)

    // Open rail, pin it, create extra workspaces via JS to avoid switching
    await page.getByTestId('workspace-rail-toggle').click()
    await expect(page.getByTestId('workspace-rail')).toHaveAttribute(
      'data-open',
      'true',
    )
    await page.getByTestId('workspace-rail-pin').click()
    await expect(page.getByTestId('workspace-rail')).toHaveAttribute(
      'data-pinned',
      'true',
    )

    // Create workspaces — this switches to them, but we'll switch back
    await page.getByTestId('create-workspace').click()
    await expect(page.getByRole('tab', { name: 'Board 2' })).toBeVisible()

    await page.getByTestId('create-workspace').click()
    await expect(page.getByRole('tab', { name: 'Board 3' })).toBeVisible()

    // Switch back to Home — rail is pinned so tabs are accessible
    await page.getByRole('tab', { name: 'Home' }).click({ force: true })
    await page.waitForTimeout(500)

    await screenshot(page, '05-multiple-workspaces')

    await screenshot(page, '05-multiple-workspaces')
  })

  /**
   * Screenshot 6: Template library with a grouped reusable layout
   * Shows: A saved template built from a five-node group with preview thumbnails
   */
  test('06 — Template library with reusable layouts', async ({ page }) => {
    await openMenu(page)
    await applyTheme(page, 'Nord')
    await page.getByRole('tab', { name: 'Options' }).click()
    await selectOption(page, 'Color mode', 'Dark')
    await closeMenu(page)

    await createGroup(page)
    const group = page.locator('article[data-testid^="card-group-"]').first()
    await moveCardToPoint(page, group.getByTestId(/card-group-header-/), {
      x: 180,
      y: 170,
    })

    await group
      .getByRole('button', { name: 'Update group' })
      .click({ force: true })
    await expect(page.getByTestId('group-edit-panel')).toBeVisible()
    await page.getByLabel(/Edit group name/).fill('Launch Kit')
    await page.getByLabel(/Edit group width for/).fill('18')
    await page.getByLabel(/Edit group height for/).fill('15')
    await dismissVisibleEditPanels(page)

    const groupBody = page.getByTestId(/card-group-body-/).first()

    const launchKitCards = [
      { url: 'github.com', title: 'GitHub', slot: { column: 0, row: 0 } },
      { url: 'figma.com', title: 'Figma', slot: { column: 1, row: 0 } },
      { url: 'notion.so', title: 'Docs', slot: { column: 2, row: 0 } },
      { url: 'linear.app', title: 'Linear', slot: { column: 0, row: 1 } },
      { url: 'vercel.com', title: 'Vercel', slot: { column: 1, row: 1 } },
    ]

    for (const link of launchKitCards) {
      await createCard(page, link.url, link.title)
      await moveCardIntoGroupSlot(
        page,
        page.getByTestId(/link-card-/).last(),
        groupBody,
        link.slot,
      )
      await dismissVisibleEditPanels(page)
    }

    await group.getByTestId(/card-group-header-/).click({ force: true })

    await openMenu(page)
    await page.getByRole('tab', { name: 'Templates' }).click()
    await expect(page.getByTestId('templates-panel')).toBeVisible()
    await expect(page.getByTestId('open-template-create')).toBeEnabled()

    await page.getByTestId('open-template-create').click()
    await page.getByLabel('Template name').fill('Launch Kit')
    await page
      .getByLabel('Template description')
      .fill('A reusable setup for product and dev links.')
    await page.getByRole('button', { name: 'Create template' }).click()

    await expect(page.getByTestId('template-status')).toContainText(
      'Saved template “Launch Kit”.',
    )

    const launchKitTemplate = page
      .getByTestId('templates-panel')
      .locator('article')
      .filter({ hasText: 'Launch Kit' })
      .first()

    await expect(
      launchKitTemplate.getByRole('img', {
        name: 'Template preview for Launch Kit',
      }),
    ).toBeVisible()

    await launchKitTemplate.getByRole('button', { name: 'Duplicate' }).click()
    await expect(page.getByTestId('templates-panel')).toContainText(
      'Launch Kit copy',
    )

    await screenshot(page, '06-template-library')
  })
})
