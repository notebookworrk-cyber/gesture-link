// Whiteboard browser check: drives the real built app in Chrome and verifies the
// board itself — drawing, selection, pages, autosave, every export format,
// presentation mode, the air-drawing dock and the responsive layouts.
//
// This proves wiring and rendering, not hand-tracking accuracy: the camera is a
// synthetic device with no hands in frame.
// Usage: node scripts/whiteboard-check.mjs [baseUrl]
import { chromium } from 'playwright-core'
import { mkdir, stat } from 'node:fs/promises'
import { resolve } from 'node:path'

const BASE = process.argv[2] ?? 'http://localhost:4173/'
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const OUT = resolve(process.cwd(), '.artifacts')
await mkdir(OUT, { recursive: true })

const browser = await chromium.launch({
  executablePath: CHROME,
  headless: true,
  args: [
    '--force-color-profile=srgb',
    '--hide-scrollbars',
    '--use-fake-device-for-media-stream',
    '--use-fake-ui-for-media-stream',
    '--autoplay-policy=no-user-gesture-required',
    '--enable-unsafe-swiftshader',
  ],
})

const failures = []
const consoleErrors = []

const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
  permissions: ['camera'],
  acceptDownloads: true,
})
const page = await context.newPage()
page.on('console', (message) => {
  if (message.type() === 'error') consoleErrors.push(message.text())
})
page.on('pageerror', (error) => consoleErrors.push(`pageerror: ${error.message}`))
page.on('requestfailed', (request) => {
  if (/\.(js|wasm|task)(\?|$)/.test(request.url())) {
    consoleErrors.push(`request failed: ${request.url()} (${request.failure()?.errorText})`)
  }
})

async function shot(name, locator) {
  if (locator) await locator.screenshot({ path: resolve(OUT, `${name}.png`) })
  else await page.screenshot({ path: resolve(OUT, `${name}.png`) })
  console.log(`shot ${name}`)
}

function check(condition, message) {
  if (!condition) failures.push(message)
}

const stage = page.getByRole('application', { name: 'Whiteboard canvas' })

async function box() {
  const rect = await stage.boundingBox()
  if (!rect) throw new Error('whiteboard stage has no box')
  return rect
}

async function status() {
  return page.evaluate(() => {
    const footer = document.querySelector('footer')
    if (!footer) return { objects: null, selected: 0, pages: null, zoom: null }
    const meta = footer.lastElementChild
    const spans = meta ? [...meta.children].map((element) => element.textContent ?? '') : []
    const objectsMatch = spans.join(' ').match(/(\d+)\s+objects?/)
    const selectedMatch = spans.join(' ').match(/(\d+)\s+selected/)
    return {
      objects: objectsMatch ? Number(objectsMatch[1]) : null,
      selected: selectedMatch ? Number(selectedMatch[1]) : 0,
      pages:
        footer.querySelector('button[aria-label="Open pages"]')?.textContent?.trim() ?? null,
      zoom: footer.querySelector('button[aria-label="Reset zoom to 100%"]')?.textContent?.trim(),
    }
  })
}

/** Dark pixels on the scene canvas: proof that ink actually rendered. */
async function ink() {
  return page.evaluate(() => {
    const canvas = document.querySelector('[role="application"] canvas')
    if (!(canvas instanceof HTMLCanvasElement)) return null
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    const { width, height } = canvas
    const data = ctx.getImageData(0, 0, width, height).data
    let count = 0
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const index = (y * width + x) * 4
        if (data[index] < 110 && data[index + 1] < 110 && data[index + 2] < 110) {
          count += 1
          if (x < minX) minX = x
          if (y < minY) minY = y
          if (x > maxX) maxX = x
          if (y > maxY) maxY = y
        }
      }
    }
    return { count, box: count ? { minX, minY, maxX, maxY } : null, width, height }
  })
}

async function waitStable() {
  await page.waitForTimeout(180)
}

async function drag(from, to, steps = 12) {
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  for (let step = 1; step <= steps; step += 1) {
    const t = step / steps
    await page.mouse.move(from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t)
  }
  await page.mouse.up()
  await waitStable()
}

try {
  await page.goto(`${BASE}#/whiteboard`, { waitUntil: 'networkidle' })
  await stage.waitFor({ state: 'visible', timeout: 20000 })
  await waitStable()

  // ------------------------------------------------------------ empty board
  await shot('24-wb-empty-1440')
  const initial = await status()
  check(initial.objects === 0, `new board is not empty: ${initial.objects} objects`)
  check(initial.pages === '1 / 2' || initial.pages === '1 / 1', `unexpected page counter: ${initial.pages}`)
  check(initial.zoom === '100%', `expected 100% zoom, saw ${initial.zoom}`)
  check(
    (await page.getByPlaceholder('Untitled board').isVisible()),
    'the untitled board placeholder is missing',
  )
  const emptyInk = await ink()
  check(Boolean(emptyInk), 'scene canvas is not readable')
  check(emptyInk.count === 0, `empty page already has ${emptyInk.count} dark pixels`)

  // ------------------------------------------------------------------ draw
  const rect = await box()
  const cx = rect.x + rect.width / 2
  const cy = rect.y + rect.height / 2
  await page.getByRole('button', { name: 'Pen (P)', exact: true }).click()
  await drag({ x: cx - 200, y: cy - 60 }, { x: cx + 160, y: cy + 40 })
  const drawn = await status()
  check(drawn.objects === 1, `pen stroke did not create one object: ${drawn.objects}`)
  const inkAfterStroke = await ink()
  check(inkAfterStroke.count > 200, `stroke rendered only ${inkAfterStroke.count} dark pixels`)
  await shot('25-wb-stroke')

  // Keyboard undo/redo must match the header buttons.
  await page.keyboard.press('Control+z')
  await waitStable()
  check((await status()).objects === 0, 'Ctrl+Z did not remove the stroke')
  check((await ink()).count === 0, 'undo left ink on the canvas')
  await page.keyboard.press('Control+Shift+z')
  await waitStable()
  check((await status()).objects === 1, 'Ctrl+Shift+Z did not restore the stroke')

  // Tool shortcuts stay live outside text fields.
  await page.keyboard.press('v')
  check(
    (await page.getByRole('button', { name: 'Select (V)', exact: true }).getAttribute('aria-pressed')) === 'true',
    'the V shortcut did not activate the select tool',
  )
  await page.keyboard.press('p')
  check(
    (await page.getByRole('button', { name: 'Pen (P)', exact: true }).getAttribute('aria-pressed')) === 'true',
    'the P shortcut did not activate the pen tool',
  )

  // The inspector's colour swatches must reach the brush, not just look decorative.
  await page.getByRole('button', { name: 'Colour #e2483f', exact: true }).click()
  await drag({ x: cx - 200, y: cy + 120 }, { x: cx + 120, y: cy + 150 })
  const red = await page.evaluate(() => {
    const canvas = document.querySelector('[role="application"] canvas')
    if (!(canvas instanceof HTMLCanvasElement)) return 0
    const ctx = canvas.getContext('2d')
    if (!ctx) return 0
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data
    let count = 0
    for (let index = 0; index < data.length; index += 4) {
      if (data[index] > 180 && data[index + 1] < 110 && data[index + 2] < 110) count += 1
    }
    return count
  })
  check(red > 100, `the red swatch did not reach the canvas: ${red} red pixels`)
  check((await status()).objects === 2, 'the second stroke was not stored')
  await shot('25b-wb-red-stroke')

  // Zoom shortcuts update the real view state.
  await page.keyboard.press('Control+=')
  await waitStable()
  const zoomed = await status()
  check(zoomed.zoom !== '100%', `zoom shortcut did not change the zoom: ${zoomed.zoom}`)
  await page.keyboard.press('Control+0')
  await waitStable()
  check((await status()).zoom === '100%', 'Ctrl+0 did not reset the zoom')

  // ----------------------------------------------------------------- pages
  const firstPage = (await status()).pages
  await page.getByRole('button', { name: 'Add page' }).click()
  await waitStable()
  const secondPage = await status()
  check(secondPage.pages === '2 / 2', `adding a page did not switch to it: ${secondPage.pages}`)
  check(secondPage.objects === 0, `the new page is not empty: ${secondPage.objects}`)
  check(secondPage.pages !== firstPage, 'page counter did not change after adding a page')
  check((await ink()).count === 0, 'the new page still renders the previous page ink')

  await page.getByRole('button', { name: 'Rectangle', exact: true }).click()
  // Return to the default ink so the dark-pixel probes below measure the shape.
  await page.getByRole('button', { name: 'Colour #1b2124', exact: true }).click()
  await drag({ x: cx - 170, y: cy - 90 }, { x: cx + 90, y: cy + 50 })
  check((await status()).objects === 1, 'the rectangle tool did not create a shape')
  const rectInk = await ink()
  check(rectInk.count > 100, `the rectangle rendered only ${rectInk.count} dark pixels`)
  await shot('26-wb-shape')

  // ------------------------------------------------------------- selection
  await page.getByRole('button', { name: 'Select (V)', exact: true }).click()
  const leftEdge = { x: rectInk.box.minX + 1, y: (rectInk.box.minY + rectInk.box.maxY) / 2 }
  await page.mouse.click(rect.x + leftEdge.x, rect.y + leftEdge.y)
  await waitStable()
  const selected = await status()
  check(selected.selected === 1, `clicking the shape selected ${selected.selected} objects`)

  const beforeResize = await ink()
  await drag(
    { x: rect.x + leftEdge.x, y: rect.y + leftEdge.y },
    { x: rect.x + leftEdge.x + 60, y: rect.y + leftEdge.y },
  )
  const afterResize = await ink()
  check(
    afterResize.box.minX - beforeResize.box.minX > 40,
    `the west handle did not resize the shape (${beforeResize.box.minX} → ${afterResize.box.minX})`,
  )

  // Arrow keys nudge the selection by a pixel, or ten with Shift.
  await page.keyboard.press('Shift+ArrowRight')
  await waitStable()
  const afterNudge = await ink()
  check(
    afterNudge.box.minX - afterResize.box.minX >= 9,
    `Shift+ArrowRight did not nudge the selection (${afterResize.box.minX} → ${afterNudge.box.minX})`,
  )

  await page.keyboard.press('Escape')
  await waitStable()
  check((await status()).selected === 0, 'Escape did not clear the selection')
  await shot('27-wb-selection')

  // ------------------------------------------------------------ text + note
  await page.getByRole('button', { name: 'Text (T)', exact: true }).click()
  await page.mouse.click(cx - 180, cy + 120)
  await page.waitForTimeout(250)
  await page.keyboard.type('GestureLink whiteboard')
  await page.getByRole('button', { name: 'Done', exact: true }).click()
  await waitStable()
  check((await status()).objects === 2, 'the text tool did not add a text object')

  await page.getByRole('button', { name: 'Sticky note (N)', exact: true }).click()
  await page.mouse.click(cx + 160, cy + 140)
  await page.waitForTimeout(250)
  await page.keyboard.type('Ship it')
  await page.getByRole('button', { name: 'Done', exact: true }).click()
  await waitStable()
  const withNote = await status()
  check(withNote.objects === 3, `note creation ended with ${withNote.objects} objects`)
  await shot('28-wb-text-note')

  // The inspector must reflect the page rather than a placeholder.
  check(
    (await page.getByRole('heading', { name: 'Page', exact: true }).isVisible()) ||
      (await page.getByText('Page', { exact: true }).first().isVisible()),
    'the inspector lost its page section',
  )

  // ------------------------------------------------------------- autosave
  await page.getByRole('button', { name: 'Save now' }).click()
  await page.waitForTimeout(500)
  const savedLabel = await page.locator('[role="status"]').first().textContent()
  check(/Saved/.test(savedLabel ?? ''), `save state is not reported: ${savedLabel}`)

  await page.reload({ waitUntil: 'networkidle' })
  await stage.waitFor({ state: 'visible', timeout: 20000 })
  await waitStable()
  const reloaded = await status()
  check(reloaded.objects === 3, `reload lost objects: ${reloaded.objects} of 3`)
  check(reloaded.pages === secondPage.pages, `reload lost the active page: ${reloaded.pages}`)
  check((await ink()).count > 100, 'reload did not repaint the board')
  await shot('29-wb-after-reload')

  // --------------------------------------------------------------- exports
  const dialog = page.getByRole('dialog', { name: 'Export page' })
  await page.getByRole('button', { name: 'Export', exact: true }).click()
  await dialog.waitFor({ state: 'visible' })
  await shot('30-wb-export-dialog')

  // Transparency is only offered where the format supports it.
  await dialog.getByRole('radio', { name: 'JPEG' }).click()
  check(
    await dialog.getByRole('switch', { name: 'Transparent background' }).isDisabled(),
    'JPEG still allows a transparent background',
  )
  await dialog.getByRole('radio', { name: 'SVG' }).click()
  check(
    !(await dialog.getByRole('switch', { name: 'Transparent background' }).isDisabled()),
    'SVG does not allow a transparent background',
  )

  const formats = [
    ['PNG', '.png'],
    ['JPEG', '.jpg'],
    ['SVG', '.svg'],
    ['PDF', '.pdf'],
  ]
  for (const [label, extension] of formats) {
    await dialog.getByRole('radio', { name: label, exact: true }).click()
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 30000 }),
      dialog.getByRole('button', { name: 'Export', exact: true }).click(),
    ])
    const name = download.suggestedFilename()
    const target = resolve(OUT, `wb-export${extension}`)
    await download.saveAs(target)
    const info = await stat(target)
    check(
      name.toLowerCase().endsWith(extension),
      `${label} export produced the wrong filename: ${name}`,
    )
    check(info.size > 1024, `${label} export is suspiciously small: ${info.size} bytes`)
    console.log(`export ${label}: ${name} (${info.size} bytes)`)
    await page.waitForTimeout(200)
  }
  await shot('31-wb-exported')
  await dialog.getByRole('button', { name: 'Close' }).last().click()
  await dialog.waitFor({ state: 'hidden' })

  // --------------------------------------------------------- presentation
  const editorView = await page.evaluate(() => {
    const zoom = document.querySelector('button[aria-label="Reset zoom to 100%"]')
    return zoom?.textContent?.trim() ?? null
  })
  await page.getByRole('button', { name: 'Present', exact: true }).click()
  await page.waitForTimeout(600)
  check(
    (await page.getByRole('button', { name: 'Boards' }).count()) === 0,
    'the editor header is still visible in presentation mode',
  )
  check(
    await page.getByText('Presenting', { exact: true }).isVisible(),
    'presentation mode did not show its badge',
  )
  // Presentation must frame the drawing instead of reusing the editor's pan.
  const presented = await ink()
  check(
    Boolean(presented?.box) &&
      presented.box.minX > 8 &&
      presented.box.minY > 8 &&
      presented.box.maxX < presented.width - 9 &&
      presented.box.maxY < presented.height - 9,
    `presentation clipped the drawing: ${JSON.stringify(presented?.box)} of ${presented?.width}x${presented?.height}`,
  )
  if (presented?.box) {
    const offsetX = Math.abs(
      (presented.box.minX + presented.box.maxX) / 2 - presented.width / 2,
    )
    const offsetY = Math.abs(
      (presented.box.minY + presented.box.maxY) / 2 - presented.height / 2,
    )
    check(
      offsetX < presented.width * 0.2 && offsetY < presented.height * 0.2,
      `presentation did not centre the drawing (off by ${Math.round(offsetX)}x${Math.round(offsetY)})`,
    )
  }
  await shot('32-wb-presentation')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(500)
  check(
    await page.getByRole('button', { name: 'Boards' }).isVisible(),
    'Escape did not leave presentation mode',
  )
  const restoredView = await page.evaluate(
    () =>
      document.querySelector('button[aria-label="Reset zoom to 100%"]')?.textContent?.trim() ?? null,
  )
  check(
    restoredView === editorView,
    `leaving presentation did not restore the editor zoom: ${editorView} → ${restoredView}`,
  )

  // ------------------------------------------------------------ documents
  await page.getByRole('button', { name: 'Boards', exact: true }).click()
  const docs = page.getByRole('dialog', { name: 'Documents' })
  await docs.waitFor({ state: 'visible' })
  await shot('33-wb-boards')
  const boardMeta = await docs.getByText(/pages? ·/).first().textContent()
  check(
    /\b2 pages\b/.test(boardMeta ?? ''),
    `board row does not summarise its pages: ${boardMeta}`,
  )
  // Two ink strokes on page 1 plus the rectangle, text box and note on page 2.
  const totalObjects = 5
  check(
    new RegExp(`\\b${totalObjects} objects\\b`).test(boardMeta ?? ''),
    `board row does not summarise its objects: ${boardMeta}`,
  )

  await docs.getByRole('button', { name: 'Rename' }).first().click()
  const nameInput = docs.getByLabel('Board name')
  await nameInput.fill('Checklist')
  await nameInput.press('Enter')
  await waitStable()
  check(
    (await page.getByLabel('Board name').first().inputValue()) === 'Checklist',
    'board rename did not apply',
  )

  await docs.getByRole('button', { name: 'New board' }).click()
  await docs.waitFor({ state: 'hidden' })
  await waitStable()
  check(
    (await page.getByLabel('Board name').first().inputValue()) === 'Untitled board',
    'a new board did not open',
  )
  check((await status()).objects === 0, 'the new board is not empty')

  await page.getByRole('button', { name: 'Boards', exact: true }).click()
  await docs.waitFor({ state: 'visible' })
  const activeRow = docs.locator('li[data-active="true"]')
  await activeRow.getByRole('button', { name: 'Delete' }).click()
  await docs.getByRole('alert').getByRole('button', { name: 'Delete' }).click()
  await page.waitForTimeout(500)
  check(
    (await docs.getByRole('listitem').count()) === 1,
    'deleting the extra board did not remove its row',
  )
  await docs.getByRole('button', { name: 'Close' }).last().click()
  await docs.waitFor({ state: 'hidden' })
  await waitStable()
  check(
    (await page.getByLabel('Board name').first().inputValue()) === 'Checklist',
    'deleting the extra board did not return to the checklist board',
  )
  await shot('34-wb-back-to-checklist')

  // ------------------------------------------------------------- air drawing
  const inspector = page.getByRole('complementary', { name: 'Inspector' })
  const gestureToggle = inspector.getByRole('switch', { name: 'Enable air drawing' })
  await gestureToggle.scrollIntoViewIfNeeded()
  await gestureToggle.click()
  await page.waitForTimeout(300)
  const hud = stage.locator(':scope > div[role="status"]')
  await hud.waitFor({ state: 'visible' })
  check(
    /Camera off/.test((await hud.textContent()) ?? ''),
    `the HUD does not explain that the camera is off: ${await hud.textContent()}`,
  )
  check(
    (await page.locator('[data-camera]').count()) > 0,
    'the gesture camera preview did not open',
  )
  await shot('35-wb-gesture-idle')

  await inspector.getByRole('button', { name: 'Start camera' }).click()
  const preview = page.locator('[data-camera]').first()
  const deadline = Date.now() + 90000
  let live = false
  while (Date.now() < deadline) {
    const state = await preview.evaluate((element) => ({
      camera: element.getAttribute('data-camera'),
      tracking: element.getAttribute('data-tracking'),
    }))
    if (state.camera === 'live' && (state.tracking === 'running' || state.tracking === 'lost')) {
      live = true
      break
    }
    await page.waitForTimeout(1000)
  }
  check(live, 'the air-drawing camera never became live')
  await page.waitForTimeout(1500)
  const hudText = (await hud.textContent()) ?? ''
  check(
    /No hand in view|Hand tracked|Hand lost/.test(hudText),
    `the HUD does not report tracking state: ${hudText}`,
  )
  await shot('36-wb-gesture-live')

  await page.getByRole('button', { name: 'Hide camera preview' }).click()
  await waitStable()
  check(
    (await page.locator('[data-camera]').count()) === 0,
    'hiding the camera preview did not remove it',
  )
  await page.getByRole('button', { name: 'Show camera' }).click()
  await waitStable()
  check(
    (await page.locator('[data-camera]').count()) > 0,
    'showing the camera preview again failed',
  )
  await gestureToggle.click()
  await page.waitForTimeout(400)
  check(
    (await page.locator('[data-camera]').count()) === 0,
    'disabling air drawing left the camera dock open',
  )

  // ------------------------------------------------------------- responsive
  await page.setViewportSize({ width: 1280, height: 800 })
  await waitStable()
  await shot('37-wb-1280')

  await page.setViewportSize({ width: 1024, height: 768 })
  await waitStable()
  const overflow1024 = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  )
  check(overflow1024 <= 1, `whiteboard overflows at 1024px: ${overflow1024}px`)
  await shot('38-wb-1024')

  await page.getByRole('button', { name: 'Inspector' }).last().click()
  await page.waitForTimeout(350)
  await shot('39-wb-1024-inspector')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)

  await page.setViewportSize({ width: 390, height: 844 })
  await waitStable()
  const overflow390 = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  )
  check(overflow390 <= 1, `whiteboard overflows at 390px: ${overflow390}px`)
  await shot('40-wb-390')
  check(await stage.isVisible(), 'the canvas disappeared at 390px')

  await page.getByRole('button', { name: 'Open pages' }).click()
  await page.waitForTimeout(350)
  await shot('41-wb-390-pages')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)

  // --------------------------------------------------------- non-Latin UI
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(`${BASE}#/settings?section=language`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'English' }).first().click()
  await page.getByRole('dialog').getByRole('option', { name: /日本語/ }).click()
  await page.waitForTimeout(300)
  await page.goto(`${BASE}#/whiteboard`, { waitUntil: 'networkidle' })
  // The canvas label is translated, so locate it structurally once the UI is Japanese.
  const jaStage = page.getByRole('application')
  await jaStage.waitFor({ state: 'visible', timeout: 20000 })
  await waitStable()
  await shot('42-wb-ja')
  const jaOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  )
  check(jaOverflow <= 1, `whiteboard overflows in Japanese: ${jaOverflow}px`)
  const jaInspectorOverflow = await page.evaluate(() => {
    const asides = [...document.querySelectorAll('aside')]
    const inspector = asides[asides.length - 1]
    return inspector ? inspector.scrollWidth - inspector.clientWidth : -1
  })
  check(jaInspectorOverflow <= 1, `the inspector overflows in Japanese: ${jaInspectorOverflow}px`)

  await page.setViewportSize({ width: 1024, height: 768 })
  await waitStable()
  await page.locator('header button[aria-pressed]').last().click()
  await page.waitForTimeout(350)
  await shot('43-wb-ja-1024-inspector')
  const jaDrawerOverflow = await page.evaluate(() => {
    const asides = [...document.querySelectorAll('aside')]
    const inspector = asides[asides.length - 1]
    return inspector ? inspector.scrollWidth - inspector.clientWidth : -1
  })
  check(jaDrawerOverflow <= 1, `the narrow inspector overflows in Japanese: ${jaDrawerOverflow}px`)

  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(`${BASE}#/settings?section=language`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: '日本語' }).first().click()
  await page.getByRole('dialog').getByRole('option', { name: /English/ }).click()
  await page.waitForTimeout(300)

  if (consoleErrors.length) {
    failures.push(`console errors: ${consoleErrors.slice(0, 5).join(' | ')}`)
  }
} catch (error) {
  // Report everything gathered so far, then surface the throw that stopped the run.
  failures.push(`aborted: ${error instanceof Error ? error.message.split('\n')[0] : String(error)}`)
  if (error instanceof Error && error.stack) console.error(error.stack)
} finally {
  await browser.close().catch(() => {})
}

if (failures.length) {
  console.error('\nFAILURES:')
  for (const failure of failures) console.error(` - ${failure}`)
  process.exit(1)
}
console.log('\nWhiteboard check passed.')
