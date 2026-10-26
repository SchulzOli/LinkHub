import { expect, test, type Page } from '@playwright/test'

async function addNote(page: Page) {
  await page.getByRole('button', { name: 'Add note' }).click()

  const note = page.getByTestId(/note-node-/)

  await expect(note).toHaveCount(1)

  return note
}

async function drawLine(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
) {
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()

  for (let step = 1; step <= 12; step += 1) {
    await page.mouse.move(
      from.x + ((to.x - from.x) * step) / 12,
      from.y + ((to.y - from.y) * step) / 12,
    )
  }

  await page.mouse.up()
}

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name === 'mobile-chrome',
    'Mouse drawing; touch is covered by the gesture tests',
  )
  await page.goto('/')
})

test('draws with the mouse and types after a double click', async ({
  page,
}) => {
  const note = await addNote(page)
  const pad = note.getByTestId('note-pad')
  const box = (await pad.boundingBox())!

  await drawLine(
    page,
    { x: box.x + 30, y: box.y + 40 },
    { x: box.x + 200, y: box.y + 60 },
  )
  await expect(note.getByTestId('note-stroke')).toHaveCount(1)

  // A double click types instead of leaving two dots.
  await page.mouse.dblclick(box.x + 60, box.y + 150)
  await page.keyboard.type('Buy milk')
  await page.keyboard.press('Escape')

  await expect(note.getByTestId('note-text')).toHaveText('Buy milk')
  await page.waitForTimeout(400)
  await expect(note.getByTestId('note-stroke')).toHaveCount(1)

  // Double click on the text edits it again.
  await note.getByTestId('note-text').dblclick()
  await page.keyboard.press('End')
  await page.keyboard.type(' and eggs')
  await page.keyboard.press('Escape')
  await expect(note.getByTestId('note-text')).toHaveText('Buy milk and eggs')

  // Everything is saved with the workspace.
  await page.waitForTimeout(600)
  await page.reload()
  await expect(page.getByTestId('note-stroke')).toHaveCount(1)
  await expect(page.getByTestId('note-text')).toHaveText('Buy milk and eggs')
})

test('erases strokes and clears the note', async ({ page }) => {
  const note = await addNote(page)
  const box = (await note.getByTestId('note-pad').boundingBox())!

  await drawLine(
    page,
    { x: box.x + 30, y: box.y + 40 },
    { x: box.x + 200, y: box.y + 40 },
  )
  await drawLine(
    page,
    { x: box.x + 30, y: box.y + 140 },
    { x: box.x + 200, y: box.y + 140 },
  )
  await expect(note.getByTestId('note-stroke')).toHaveCount(2)

  await note.getByRole('button', { name: 'Eraser' }).click()
  await drawLine(
    page,
    { x: box.x + 100, y: box.y + 20 },
    { x: box.x + 100, y: box.y + 60 },
  )
  await expect(note.getByTestId('note-stroke')).toHaveCount(1)

  await note.getByRole('button', { name: 'Clear note' }).click()
  await expect(note.getByTestId('note-stroke')).toHaveCount(0)

  // Undo brings it back.
  await page.keyboard.press('Control+z')
  await expect(note.getByTestId('note-stroke')).toHaveCount(1)
})

test('moves by its toolbar in edit mode and draws in view mode', async ({
  page,
}) => {
  const note = await addNote(page)
  const toolbar = note.getByTestId('note-toolbar')
  const before = (await note.boundingBox())!
  const handle = (await toolbar.boundingBox())!
  const grab = {
    x: handle.x + handle.width - 60,
    y: handle.y + handle.height / 2,
  }

  await page.mouse.move(grab.x, grab.y)
  await page.mouse.down()
  await page.mouse.move(grab.x + 60, grab.y + 30, { steps: 6 })
  await page.mouse.move(grab.x + 120, grab.y + 72, { steps: 6 })
  await page.mouse.up()

  await expect
    .poll(async () => (await note.boundingBox())!.x)
    .toBeGreaterThan(before.x + 60)

  await page.getByRole('button', { name: 'Toggle interaction mode' }).click()

  const box = (await note.getByTestId('note-pad').boundingBox())!

  await drawLine(
    page,
    { x: box.x + 30, y: box.y + 40 },
    { x: box.x + 150, y: box.y + 90 },
  )
  await expect(note.getByTestId('note-stroke')).toHaveCount(1)
})
