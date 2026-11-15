// Gesture Camera and Gallery browser check: drives the real built app in Chrome
// and verifies the studio — live preview, real filters on the canvas, capture,
// persistence, the gallery (rename, download, delete) and the gesture bindings.
//
// This proves wiring and rendering, not hand-tracking accuracy: the camera is a
// synthetic device with no hands in frame, so the gesture readout must honestly
// report "No shape".
// Usage: node scripts/camera-check.mjs [baseUrl]
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
  // MediaPipe logs its TFLite info lines as errors; they are not app failures.
  if (message.type() === 'error' && !message.text().startsWith('INFO:')) {
    consoleErrors.push(message.text())
  }
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

/** Average colour of the preview canvas: proof that the video actually renders. */
async function previewSignature() {
  return page.evaluate(() => {
    const canvas = document.querySelector('canvas[role="img"]')
    if (!(canvas instanceof HTMLCanvasElement)) return null
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    const { width, height } = canvas
    const step = 12
    let r = 0
    let g = 0
    let b = 0
    let count = 0
    const data = ctx.getImageData(0, 0, width, height).data
    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += step) {
        const index = (y * width + x) * 4
        r += data[index]
        g += data[index + 1]
        b += data[index + 2]
        count += 1
      }
    }
    return count === 0 ? null : [r / count, g / count, b / count]
  })
}

function colourDistance(a, b) {
  if (!a || !b) return Infinity
  return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2])
}

async function waitStable(ms = 350) {
  await page.waitForTimeout(ms)
}

try {
  // ------------------------------------------------------------------- studio
  await page.goto(`${BASE}#/camera`, { waitUntil: 'networkidle' })
  await page.getByRole('heading', { name: 'Gesture Camera' }).waitFor({ state: 'visible' })
  await shot('50-camera-idle')

  await page.getByRole('button', { name: 'Start camera' }).click()
  // The synthetic camera is live as soon as the stream starts; the tracker then
  // loads the hand and face models.
  await page.waitForFunction(
    () => document.querySelector('canvas[role="img"]')?.width > 0,
    undefined,
    { timeout: 30000 },
  )
  await page.waitForTimeout(2500)

  const signature = await previewSignature()
  check(
    signature !== null && colourDistance(signature, [11, 14, 17]) > 30,
    `the studio preview does not show the camera image: ${JSON.stringify(signature)}`,
  )

  // The synthetic device has no hand, so the readout must say so.
  const gestureText = await page.locator('[data-active]').first().textContent()
  check(
    (gestureText ?? '').includes('No shape'),
    `the gesture readout does not report the honest state: ${gestureText}`,
  )
  await shot('51-camera-live')

  // --------------------------------------------------------------- real filter
  const natural = await previewSignature()
  await page.getByRole('button', { name: 'Warm' }).click()
  await waitStable(500)
  const warm = await previewSignature()
  check(
    colourDistance(natural, warm) > 6,
    `the warm filter did not change the rendered pixels: ${JSON.stringify(natural)} → ${JSON.stringify(warm)}`,
  )
  const warmPressed = await page.getByRole('button', { name: 'Warm' }).getAttribute('aria-pressed')
  check(warmPressed === 'true', 'the warm filter is not marked as selected')

  await page.getByRole('button', { name: 'Black and white' }).click()
  await page.getByRole('slider', { name: 'Filter strength' }).fill('100')
  await waitStable(600)
  const mono = await previewSignature()
  check(
    colourDistance(warm, mono) > 6,
    'the black and white filter did not change the rendered pixels',
  )
  // A greyscale frame has (almost) equal channels.
  check(
    mono !== null && Math.abs(mono[0] - mono[1]) < 12 && Math.abs(mono[1] - mono[2]) < 12,
    `the black and white filter is not greyscale: ${JSON.stringify(mono)}`,
  )
  await shot('52-camera-filter')

  // The filter strength slider has to reach the canvas.
  const beforeStrength = await previewSignature()
  await page.getByRole('slider', { name: 'Filter strength' }).fill('20')
  await waitStable(600)
  const afterStrength = await previewSignature()
  check(
    colourDistance(beforeStrength, afterStrength) > 3,
    'the filter strength slider did not change the rendered pixels',
  )

  await page.getByRole('button', { name: 'Natural' }).click()
  await waitStable(300)

  // ------------------------------------------------------------------- stickers
  const sticker = page.getByRole('button', { name: 'Crown' })
  await sticker.click()
  check(
    (await sticker.getAttribute('aria-pressed')) === 'true',
    'the crown sticker was not selected',
  )
  // Without a face the sticker cannot be drawn; the note must say so.
  const stickerNote = await page.getByText(/follow the face landmarks/i).textContent()
  check(Boolean(stickerNote), 'the sticker note does not explain the face requirement')

  // ------------------------------------------------------------------- capture
  await page.getByRole('button', { name: 'Take photo' }).click()
  const recent = page.locator('figure')
  await recent.first().waitFor({ state: 'visible', timeout: 15000 }).catch(() => {})
  check((await recent.count()) === 1, `the capture did not add a recent shot: ${await recent.count()}`)
  await shot('53-camera-captured')

  // A second capture must add a second entry.
  await page.getByRole('button', { name: 'Take photo' }).click()
  await page.waitForTimeout(2500)
  check((await recent.count()) === 2, 'the second capture was not stored')

  // -------------------------------------------------------------------- gallery
  await page.goto(`${BASE}#/gallery`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  const cards = page.locator('ul li button')
  check((await cards.count()) === 2, `the gallery did not list both photos: ${await cards.count()}`)
  await shot('54-gallery')

  // Date filter.
  await page.getByRole('button', { name: 'Today' }).click()
  await waitStable(300)
  check((await cards.count()) === 2, 'the today filter hid photos taken today')
  await page.getByRole('button', { name: 'All' }).click()
  await waitStable(300)

  // Full size preview, rename and download.
  await cards.first().click()
  const dialog = page.getByRole('dialog')
  await dialog.waitFor({ state: 'visible' })
  await shot('55-gallery-preview')

  const nameInput = dialog.getByLabel('Name')
  await nameInput.fill('Studio test shot')
  await dialog.getByRole('button', { name: 'Rename' }).click()
  await waitStable(500)
  check(
    (await dialog.getByLabel('Name').inputValue()) === 'Studio test shot',
    'the rename did not apply',
  )

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 30000 }),
    dialog.getByRole('button', { name: 'Download' }).click(),
  ])
  const target = resolve(OUT, 'gallery-photo.jpg')
  await download.saveAs(target)
  const info = await stat(target)
  check(info.size > 2048, `the downloaded photograph is suspiciously small: ${info.size} bytes`)
  console.log(`download: ${download.suggestedFilename()} (${info.size} bytes)`)

  // Delete needs a confirmation.
  await dialog.getByRole('button', { name: 'Delete' }).click()
  await dialog.getByRole('alert').waitFor({ state: 'visible' })
  await shot('56-gallery-delete-confirm')
  await dialog.getByRole('alert').getByRole('button', { name: 'Delete' }).click()
  await waitStable(700)
  check((await cards.count()) === 1, 'the photograph was not deleted')

  // The deleted photograph must not come back after a reload.
  await page.reload({ waitUntil: 'networkidle' })
  await waitStable(900)
  check((await cards.count()) === 1, 'the deleted photograph came back after a reload')

  // ------------------------------------------------------------ gesture binding
  await page.goto(`${BASE}#/settings?section=tracking`, { waitUntil: 'networkidle' })
  await waitStable(600)
  const captureBinding = page.getByLabel('Take photo', { exact: true }).last()
  await captureBinding.selectOption('thumbs-up')
  await waitStable(400)
  const conflict = await page.getByRole('alert').first().textContent()
  check(
    Boolean(conflict && /same hand shape/i.test(conflict)),
    `a conflicting binding did not raise a warning: ${conflict}`,
  )
  await shot('57-settings-binding-conflict')
  await captureBinding.selectOption('peace')
  await waitStable(300)

  // ----------------------------------------------------------------- responsive
  for (const size of [
    { width: 1280, height: 800 },
    { width: 1024, height: 768 },
    { width: 390, height: 844 },
  ]) {
    await page.goto(`${BASE}#/camera`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(900)
    await page.setViewportSize(size)
    await waitStable(700)
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    )
    check(overflow <= 1, `the camera page overflows at ${size.width}px: ${overflow}px`)
    await shot(`58-camera-${size.width}`)
  }

  // ------------------------------------------------------------------- Japanese
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(`${BASE}#/settings?section=language`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'English' }).first().click()
  await page.getByRole('dialog').getByRole('option', { name: /日本語/ }).click()
  await waitStable(400)
  await page.goto(`${BASE}#/camera`, { waitUntil: 'networkidle' })
  await waitStable(900)
  const jaOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  )
  check(jaOverflow <= 1, `the camera page overflows in Japanese: ${jaOverflow}px`)
  await shot('59-camera-ja')

  await page.goto(`${BASE}#/gallery`, { waitUntil: 'networkidle' })
  await waitStable(700)
  await shot('60-gallery-ja')

  if (consoleErrors.length) {
    failures.push(`console errors: ${consoleErrors.slice(0, 5).join(' | ')}`)
  }
} catch (error) {
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

console.log('\nCamera and gallery check passed.')
