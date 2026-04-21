import { expect, test, type Page } from '@playwright/test'

import { CANVAS_TEST_ID } from './fixtures'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(async () => {
    window.localStorage.clear()
    await window.indexedDB.deleteDatabase('linkhub')
  })
  await page.reload()
})

async function dropTestImage(page: Page, fileName: string) {
  const canvas = page.getByTestId(CANVAS_TEST_ID)
  const dataTransfer = await page.evaluateHandle((name) => {
    const transfer = new DataTransfer()
    const pngBytes = Uint8Array.from([
      137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1,
      0, 0, 0, 1, 8, 6, 0, 0, 0, 31, 21, 196, 137, 0, 0, 0, 13, 73, 68, 65, 84,
      120, 156, 99, 248, 255, 255, 63, 0, 5, 254, 2, 254, 167, 53, 129, 132, 0,
      0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130,
    ])
    const file = new File([pngBytes], name, {
      type: '',
    })

    transfer.items.add(file)

    return transfer
  }, fileName)

  await canvas.dispatchEvent('dragenter', { dataTransfer })
  await canvas.dispatchEvent('dragover', {
    clientX: 420,
    clientY: 320,
    dataTransfer,
  })
  await canvas.dispatchEvent('drop', {
    clientX: 420,
    clientY: 320,
    dataTransfer,
  })
}

test('drops an image onto the canvas, stores it in the gallery, and creates a picture node', async ({
  page,
}) => {
  let dialogMessage: string | null = null

  page.on('dialog', async (dialog) => {
    dialogMessage = dialog.message()
    await dialog.dismiss()
  })

  await dropTestImage(page, 'dropped-from-explorer.png')

  await expect(page.getByTestId(/picture-node-/).first()).toBeVisible()
  await expect.poll(() => dialogMessage).toBeNull()

  await page
    .getByRole('button', { name: 'Open image gallery' })
    .click({ force: true })

  await expect(
    page.getByRole('heading', { name: 'Image Gallery' }),
  ).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'dropped-from-explorer' }),
  ).toBeVisible()
  await expect(page.getByText('Used 1 time')).toBeVisible()
})

test('renames an image from the gallery and keeps the updated title after reload', async ({
  page,
}) => {
  await dropTestImage(page, 'gallery-rename.png')

  await page.getByRole('button', { name: 'Open image gallery' }).click()

  const imageCard = page
    .locator('article')
    .filter({ hasText: 'gallery-rename' })

  await imageCard.getByRole('button', { name: 'Edit title' }).click()
  await imageCard
    .getByRole('textbox', { name: 'Image title' })
    .fill('Gallery hero')
  await imageCard.getByRole('button', { name: 'Save title' }).click()

  await expect(
    page.getByRole('heading', { name: 'Gallery hero' }),
  ).toBeVisible()

  await page.reload()
  await page.getByRole('button', { name: 'Open image gallery' }).click()
  await expect(
    page.getByRole('heading', { name: 'Gallery hero' }),
  ).toBeVisible()
})

test('uses a gallery override image on a max-radius card and keeps the title inside the card bounds', async ({
  page,
}) => {
  await dropTestImage(page, 'override-circle.png')
  await expect(page.getByTestId(/picture-node-/).first()).toBeVisible()

  await page.getByRole('button', { name: 'Add link' }).click()
  await page
    .getByLabel('Link URL')
    .fill('https://github.com/SchulzOli/new-editor')
  await page.getByLabel('Link title').fill('github.com/SchulzOli/new-editor')
  await page.getByRole('button', { name: 'Create' }).click()

  await expect(page.getByTestId('card-edit-panel')).toBeVisible()

  await page.getByRole('button', { name: 'Choose from gallery' }).click()
  await expect(
    page.getByRole('heading', { name: 'Choose Card Image' }),
  ).toBeVisible()

  const imageCard = page
    .locator('article')
    .filter({ hasText: 'override-circle' })
  await imageCard.getByRole('button', { name: 'Use for card' }).click()

  await expect(
    page.getByRole('heading', { name: 'Choose Card Image' }),
  ).toHaveCount(0)

  const card = page.getByTestId(/link-card-/).first()
  const cardImage = card.getByTestId('card-image')

  await expect(cardImage).toBeVisible()
  await expect
    .poll(() =>
      cardImage.evaluate((node) =>
        (node as HTMLImageElement).src.startsWith('blob:'),
      ),
    )
    .toBe(true)

  const cornerRadiusSlider = page.getByLabel(/Edit corner radius for/)
  await cornerRadiusSlider.evaluate((node) => {
    const input = node as HTMLInputElement
    const valueSetter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value',
    )?.set

    valueSetter?.call(input, input.max)
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
  })

  await expect(page.getByText('50%')).toBeVisible()

  await expect
    .poll(() =>
      card.evaluate((node) => ({
        cardRadius: getComputedStyle(node).borderTopLeftRadius,
        imageRadius: getComputedStyle(
          node.querySelector('[data-testid="card-image"]') as HTMLElement,
        ).borderTopLeftRadius,
        objectFit: getComputedStyle(
          node.querySelector('[data-testid="card-image"]') as HTMLElement,
        ).objectFit,
      })),
    )
    .toEqual({
      cardRadius: '50%',
      imageRadius: '50%',
      objectFit: 'contain',
    })

  await expect
    .poll(() =>
      card.evaluate((node) => {
        const title = node.querySelector(
          '[data-testid="card-title"]',
        ) as HTMLElement | null

        if (!title) {
          return null
        }

        const cardRect = node.getBoundingClientRect()
        const titleRect = title.getBoundingClientRect()
        const tolerance = 1

        return {
          fitsHorizontally:
            titleRect.left >= cardRect.left - tolerance &&
            titleRect.right <= cardRect.right + tolerance,
          fitsVertically:
            titleRect.top >= cardRect.top - tolerance &&
            titleRect.bottom <= cardRect.bottom + tolerance,
        }
      }),
    )
    .toEqual({
      fitsHorizontally: true,
      fitsVertically: true,
    })
})
