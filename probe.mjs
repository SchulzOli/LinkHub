import { chromium } from '@playwright/test'
const browser = await chromium.launch()
const page = await browser.newPage()
// inject listener BEFORE app loads: patch prepareStackTrace so we get component stacks
await page.addInitScript(() => {
  const origErr = console.error
  let seen = false
  console.error = (...args) => {
    const t = String(args[0] ?? '')
    if (t.includes('mounted') && !seen) {
      seen = true
      const e = new Error('trace')
      // Print each arg and synthesize a stack
      origErr('### MOUNTED_WARNING ###')
      origErr('args:', ...args.slice(1))
      origErr('stack:', e.stack)
    } else {
      origErr(...args)
    }
  }
})
page.on('console', (msg) => {
  const t = msg.text()
  if (
    t.includes('MOUNTED_WARNING') ||
    t.includes('stack:') ||
    t.includes('args:') ||
    t.includes('at ')
  ) {
    console.log(t)
  }
})
await page.goto('http://localhost:5173/')
await page.waitForTimeout(1500)
try {
  await page.getByRole('button', { name: 'Open menu' }).click({ timeout: 2000 })
  await page.waitForTimeout(500)
  await page.getByRole('tab', { name: 'Themes' }).click({ timeout: 2000 })
  await page.waitForTimeout(500)
  await page
    .getByRole('button', { name: 'Apply Blueprint theme' })
    .click({ timeout: 2000 })
  await page.waitForTimeout(1500)
} catch (e) {
  console.log('SKIP', e.message)
}
await browser.close()
