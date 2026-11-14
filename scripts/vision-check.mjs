// Vision pipeline check: launches Chrome with a synthetic camera, starts the
// real MediaPipe hand landmarker, and asserts on values reported by the running
// engine (frame rate, inference time, delegate, processing width).
//
// The fake device has no hands in frame, so this verifies wiring, lifecycle and
// honest status reporting — never recognition accuracy. Those numbers must come
// from a real webcam and a person's hand.
// Usage: node scripts/vision-check.mjs [baseUrl]
import { chromium } from 'playwright-core'
import { mkdir } from 'node:fs/promises'
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
})
const page = await context.newPage()
page.on('console', (message) => {
  if (message.type() === 'error') consoleErrors.push(message.text())
})
page.on('pageerror', (error) => consoleErrors.push(`pageerror: ${error.message}`))
page.on('requestfailed', (request) => {
  // MediaPipe probing optional wasm variants can abort harmlessly; only real
  // app assets matter here.
  if (/\.(js|wasm|task)(\?|$)/.test(request.url())) {
    consoleErrors.push(`request failed: ${request.url()} (${request.failure()?.errorText})`)
  }
})

async function shot(name, locator) {
  if (locator) {
    await locator.screenshot({ path: resolve(OUT, `${name}.png`) })
  } else {
    await page.screenshot({ path: resolve(OUT, `${name}.png`) })
  }
  console.log(`shot ${name}`)
}

function check(condition, message) {
  if (!condition) failures.push(message)
}

const preview = page.locator('[data-camera]').first()

async function previewState() {
  return preview.evaluate((element) => ({
    camera: element.getAttribute('data-camera'),
    tracking: element.getAttribute('data-tracking'),
    hands: Number(element.getAttribute('data-hands')),
    fps: Number(element.getAttribute('data-fps')),
    inference: Number(element.getAttribute('data-inference-ms')),
    processingWidth: Number(element.getAttribute('data-processing-width')),
    captureWidth: Number(element.getAttribute('data-capture-width')),
    captureHeight: Number(element.getAttribute('data-capture-height')),
    delegate: element.getAttribute('data-delegate'),
  }))
}

async function waitForLive(label) {
  await preview.waitFor({ state: 'visible', timeout: 15000 })
  const deadline = Date.now() + 90000
  let last = null
  while (Date.now() < deadline) {
    last = await previewState()
    // With no hand in front of the synthetic camera the tracker reports
    // "lost" after a moment. Live camera plus a loaded model and a real frame
    // rate is what proves the loop is running.
    const modelReady =
      last.tracking === 'running' || last.tracking === 'lost'
    if (last.camera === 'live' && modelReady && last.fps >= 5) {
      console.log(
        `${label}: live (fps=${last.fps}, ${last.inference}ms, ${last.processingWidth}px, ${last.delegate}, tracking=${last.tracking})`,
      )
      return
    }
    await page.waitForTimeout(1000)
  }
  throw new Error(
    `${label}: camera did not become live. Last state: ${JSON.stringify(last)}; errors: ${consoleErrors.join(' | ')}`,
  )
}

try {
  await page.goto(`${BASE}#/settings?section=camera`, { waitUntil: 'networkidle' })
  await preview.waitFor({ state: 'visible', timeout: 15000 })
  await shot('17-camera-1440-idle')

  const idle = await previewState()
  check(idle.camera === 'idle', `camera should start idle, saw ${idle.camera}`)
  check(
    await page.getByRole('button', { name: 'Start camera' }).isVisible(),
    'start camera button is missing',
  )

  await page.getByRole('button', { name: 'Start camera' }).click()
  await waitForLive('first run')

  const live = await previewState()
  check(live.fps > 0, `reported fps is not positive: ${live.fps}`)
  check(live.inference > 0, `reported inference time is not positive: ${live.inference}`)
  check(live.hands === 0, `the synthetic camera contains no hand but ${live.hands} were reported`)
  check(
    live.captureWidth > 0 && live.captureHeight > 0,
    `capture size was not reported: ${live.captureWidth}×${live.captureHeight}`,
  )
  check(
    live.processingWidth === 480 || live.processingWidth === 640 || live.processingWidth === 320,
    `unexpected processing width: ${live.processingWidth}`,
  )
  check(
    live.delegate === 'cpu' || live.delegate === 'gpu',
    `delegate was not reported: ${live.delegate}`,
  )
  check(
    await page.getByRole('button', { name: 'Stop camera' }).isVisible(),
    'stop camera button is missing while live',
  )
  console.log(
    `stats: fps=${live.fps} inference=${live.inference}ms width=${live.processingWidth} delegate=${live.delegate}`,
  )
  await page.waitForTimeout(1200)
  await shot('18-camera-1440-live')

  // The overlay canvas covers the stage at device pixel ratio, not at CSS size,
  // otherwise the skeleton and the video would drift apart on high-DPI screens.
  const canvas = await page.evaluate(() => {
    const element = document.querySelector('[data-camera] canvas')
    if (!element) return null
    const rect = element.getBoundingClientRect()
    return {
      cssWidth: Math.round(rect.width),
      cssHeight: Math.round(rect.height),
      width: element.width,
      height: element.height,
      dpr: Math.min(window.devicePixelRatio || 1, 2),
    }
  })
  check(Boolean(canvas), 'landmark overlay canvas is missing')
  if (canvas) {
    check(
      Math.abs(canvas.width - canvas.cssWidth * canvas.dpr) <= 2,
      `overlay canvas width ${canvas.width} does not match stage ${canvas.cssWidth} × ${canvas.dpr}`,
    )
    check(
      Math.abs(canvas.height - canvas.cssHeight * canvas.dpr) <= 2,
      `overlay canvas height ${canvas.height} does not match stage ${canvas.cssHeight} × ${canvas.dpr}`,
    )
  }

  // The mirrored preview must be a CSS transform only: the canvas and the video
  // share a box, so a mismatch here would show the skeleton flipped the wrong way.
  const mirrorTransform = await page.evaluate(() => {
    const video = document.querySelector('[data-camera] video')
    return video ? window.getComputedStyle(video).transform : 'none'
  })
  check(
    mirrorTransform !== 'none',
    'mirror is on by default but the preview is not transformed',
  )

  // Changing the capture resolution restarts the stream and must recover.
  await page.getByLabel('Capture resolution').selectOption('720p')
  await page.waitForTimeout(400)
  await waitForLive('after resolution change')
  const after720 = await previewState()
  check(after720.fps > 0, 'fps is not reported after a resolution change')
  check(
    after720.processingWidth > 0,
    'inference width is not reported after a resolution change',
  )
  console.log(`720p capture: width=${after720.processingWidth} fps=${after720.fps}`)

  await page.getByLabel('Capture resolution').selectOption('480p')
  await page.waitForTimeout(400)
  await waitForLive('after resolution restore')

  // Turning the mirror off must not restart the camera.
  await page.getByRole('switch', { name: 'Mirror the preview' }).click()
  await page.waitForTimeout(600)
  const unmirrored = await previewState()
  check(unmirrored.camera === 'live', 'turning mirror off stopped the camera')
  const transformOff = await page.evaluate(() => {
    const video = document.querySelector('[data-camera] video')
    return video ? window.getComputedStyle(video).transform : 'none'
  })
  check(transformOff === 'none', `mirror off still transforms the preview: ${transformOff}`)
  await page.getByRole('switch', { name: 'Mirror the preview' }).click()

  // Stop, then start again.
  await page.getByRole('button', { name: 'Stop camera' }).click()
  await page.locator('[data-camera="idle"]').first().waitFor({ timeout: 10000 })
  check(
    await page.getByRole('button', { name: 'Start camera' }).isVisible(),
    'start button did not return after stopping',
  )
  await page.getByRole('button', { name: 'Start camera' }).click()
  await waitForLive('restart')
  const restarted = await previewState()
  check(
    restarted.processingWidth > 0,
    'inference width is not reported after stopping and starting again',
  )
  check(
    restarted.captureWidth > 0,
    'capture size is not reported after stopping and starting again',
  )

  // Persisted values survive a reload.
  await page.getByLabel('Frame rate').selectOption('24')
  await page.waitForTimeout(300)
  await page.reload({ waitUntil: 'networkidle' })
  await preview.waitFor({ state: 'visible', timeout: 15000 })
  check(
    (await page.getByLabel('Frame rate').inputValue()) === '24',
    'frame rate did not persist across reload',
  )
  await page.getByLabel('Frame rate').selectOption('30')
  await page.waitForTimeout(200)

  // Responsive layouts: the preview must not overflow its panel.
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.waitForTimeout(250)
  await shot('19-camera-1280')

  await page.setViewportSize({ width: 1024, height: 768 })
  await page.waitForTimeout(250)
  await shot('20-camera-1024')
  check(
    (await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)) <= 1,
    'camera settings overflow horizontally at 1024px',
  )

  await page.setViewportSize({ width: 390, height: 844 })
  await page.waitForTimeout(300)
  await shot('21-camera-390')
  check(
    (await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)) <= 1,
    'camera settings overflow horizontally at 390px',
  )

  // Non-Latin label lengths must not break the preview header.
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(`${BASE}#/settings?section=language`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'English' }).first().click()
  await page.getByRole('dialog').getByRole('option', { name: /日本語/ }).click()
  await page.waitForTimeout(250)
  await page.goto(`${BASE}#/settings?section=camera`, { waitUntil: 'networkidle' })
  await preview.waitFor({ state: 'visible', timeout: 15000 })
  await shot('22-camera-ja-idle')
  check(
    (await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)) <= 1,
    'camera settings overflow horizontally in Japanese',
  )

  await page.goto(`${BASE}#/settings?section=language`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: '日本語' }).first().click()
  await page.getByRole('dialog').getByRole('option', { name: /English/ }).click()
  await page.waitForTimeout(250)

  // Auto-release: leaving the only workspace that uses the camera stops it.
  // Starting from another route keeps the check honest — the camera must be
  // started on the settings page, then released on navigation.
  await page.goto(`${BASE}#/settings?section=camera`, { waitUntil: 'networkidle' })
  await preview.waitFor({ state: 'visible', timeout: 15000 })

  if ((await previewState()).camera !== 'live') {
    await page.getByRole('button', { name: 'Start camera' }).click()
  }
  await waitForLive('before auto-release')
  await page.goto(`${BASE}#/`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(2200)
  const cameraChip = await page
    .getByText('Camera off', { exact: true })
    .first()
    .isVisible()
    .catch(() => false)
  check(cameraChip, 'camera was not released after leaving the workspace')

  // Returning and starting again must work after an auto-release.
  await page.goto(`${BASE}#/settings?section=camera`, { waitUntil: 'networkidle' })
  await preview.waitFor({ state: 'visible', timeout: 15000 })
  const afterRelease = await previewState()
  check(
    afterRelease.camera === 'idle',
    `camera restarted by itself after auto-release: ${afterRelease.camera}`,
  )
  await page.getByRole('button', { name: 'Start camera' }).click()
  await waitForLive('after auto-release')

  // Mobile live preview: the stats row wraps instead of overflowing, and the
  // stage keeps its own aspect ratio inside the panel.
  await page.setViewportSize({ width: 390, height: 844 })
  await page.waitForTimeout(400)
  await preview.scrollIntoViewIfNeeded()
  await page.waitForTimeout(300)
  await shot('23-camera-390-live', preview)
  const previewOverflow = await preview.evaluate(
    (element) => element.scrollWidth - element.clientWidth,
  )
  check(previewOverflow <= 1, `live preview overflows on mobile: ${previewOverflow}px`)
  await page.getByRole('button', { name: 'Stop camera' }).click()
  await page.waitForTimeout(300)

  if (consoleErrors.length) {
    failures.push(`console errors: ${consoleErrors.slice(0, 5).join(' | ')}`)
  }
} finally {
  await browser.close()
}

if (failures.length) {
  console.error('\nFAILURES:')
  for (const failure of failures) console.error(` - ${failure}`)
  process.exit(1)
}
console.log('\nVision pipeline check passed.')
