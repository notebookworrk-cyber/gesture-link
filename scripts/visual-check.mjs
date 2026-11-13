// UI smoke check: opens the built app in system Chrome, exercises the shell,
// settings and navigation, and writes screenshots to .artifacts/.
// Usage: node scripts/visual-check.mjs [baseUrl]
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
  args: ['--force-color-profile=srgb', '--hide-scrollbars'],
})

const failures = []
const consoleErrors = []

const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
})
const page = await context.newPage()
page.on('console', (message) => {
  if (message.type() === 'error') consoleErrors.push(message.text())
})
page.on('pageerror', (error) => consoleErrors.push(`pageerror: ${error.message}`))
page.on('requestfailed', (request) => {
  consoleErrors.push(`request failed: ${request.url()} (${request.failure()?.errorText})`)
})
page.on('response', (response) => {
  if (response.status() >= 400) {
    consoleErrors.push(`HTTP ${response.status()}: ${response.url()}`)
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

async function dataset(name) {
  return page.evaluate((key) => document.documentElement.dataset[key], name)
}

try {
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await shot('01-home-1440')

  check((await dataset('theme')) === 'dark', 'default theme is not dark')
  check((await dataset('accent')) === 'mint', 'default accent is not mint')
  check(
    !(await page.getByRole('button', { name: 'Navigation' }).first().isVisible()),
    'mobile menu button is visible on desktop',
  )
  await page.getByText('Model files').waitFor()
  const modelsReady = await page.getByText('Ready', { exact: true }).first().isVisible()
  check(modelsReady, 'model files are not reported ready')

  await shot('02-home-sidebar', page.locator('aside').first())

  // ---- appearance ----
  await page.goto(`${BASE}#/settings?section=appearance`, { waitUntil: 'networkidle' })
  await shot('03-settings-appearance')

  await page.getByRole('button', { name: 'Light', exact: true }).click()
  await page.waitForTimeout(200)
  check((await dataset('theme')) === 'light', 'light theme did not apply')
  await shot('04-settings-light')

  await page.getByRole('button', { name: 'Dark', exact: true }).click()
  await page.getByRole('button', { name: 'Rose', exact: true }).click()
  await page.waitForTimeout(150)
  check((await dataset('accent')) === 'rose', 'rose accent did not apply')

  await page.getByRole('button', { name: 'Compact', exact: true }).click()
  await page.waitForTimeout(150)
  check((await dataset('density')) === 'compact', 'compact density did not apply')
  await shot('05-settings-rose-compact')

  await page.getByRole('button', { name: 'Comfortable', exact: true }).click()
  await page.getByRole('button', { name: 'Mint', exact: true }).click()
  await page.waitForTimeout(150)

  // ---- language ----
  await page.goto(`${BASE}#/settings?section=language`, { waitUntil: 'networkidle' })
  await shot('06-settings-language')
  await page.getByRole('button', { name: 'English' }).first().click()
  await page.getByPlaceholder('Search languages').fill('日本')
  await page.getByRole('dialog').getByRole('option', { name: /日本語/ }).click()
  await page.waitForTimeout(250)
  check((await page.evaluate(() => document.documentElement.lang)) === 'ja', 'ja locale did not apply')
  await shot('07-settings-language-ja')

  await page.goto(`${BASE}#/`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(150)
  await shot('08-home-ja')

  await page.reload({ waitUntil: 'networkidle' })
  check((await page.evaluate(() => document.documentElement.lang)) === 'ja', 'language did not persist')

  await page.goto(`${BASE}#/settings?section=language`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: '日本語' }).first().click()
  await page.getByRole('dialog').getByRole('option', { name: /English/ }).click()
  await page.waitForTimeout(250)
  check((await page.evaluate(() => document.documentElement.lang)) === 'en', 'english did not restore')

  // ---- responsive ----
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto(`${BASE}#/sign-reader`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(150)
  await shot('09-signreader-1280')

  await page.setViewportSize({ width: 1024, height: 768 })
  await page.waitForTimeout(250)
  await shot('10-signreader-1024')
  const inspectorToggle = page.getByRole('button', { name: 'Inspector' }).last()
  await inspectorToggle.click()
  await page.waitForTimeout(300)
  await shot('11-signreader-1024-inspector')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(250)

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`${BASE}#/`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(250)
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  )
  check(overflow <= 1, `horizontal overflow on mobile: ${overflow}px`)
  await shot('12-home-390')
  await page.getByRole('button', { name: 'Navigation' }).first().click()
  await page.waitForTimeout(300)
  await shot('13-home-390-nav')

  // The drawer must be above the backdrop, otherwise its links are dead.
  await page.locator('aside').first().getByRole('link', { name: 'Settings' }).click()
  await page.waitForTimeout(350)
  check(
    page.url().includes('#/settings'),
    `mobile drawer link did not navigate (url: ${page.url()})`,
  )
  check(
    !(await page.locator('aside').first().getAttribute('data-mobile-open')) ||
      (await page.locator('aside').first().getAttribute('data-mobile-open')) === 'false',
    'mobile drawer stayed open after navigation',
  )
  await shot('14-settings-390')

  // Settings sections must not overflow the viewport.
  const settingsOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  )
  check(settingsOverflow <= 1, `settings overflow on mobile: ${settingsOverflow}px`)

  // Japanese in a narrow inspector must wrap instead of overflow.
  await page.setViewportSize({ width: 1024, height: 768 })
  await page.goto(`${BASE}#/settings?section=language`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'English' }).first().click()
  await page.getByRole('dialog').getByRole('option', { name: /日本語/ }).click()
  await page.waitForTimeout(250)
  await page.goto(`${BASE}#/sign-reader`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'インスペクター' }).click()
  await page.waitForTimeout(300)
  const inspectorOverflow = await page.evaluate(() => {
    const asides = [...document.querySelectorAll('aside')]
    const inspector = asides[asides.length - 1]
    if (!inspector) return -1
    return inspector.scrollWidth - inspector.clientWidth
  })
  check(inspectorOverflow <= 1, `inspector overflows in Japanese: ${inspectorOverflow}px`)
  await shot('15-signreader-ja-inspector')

  // Devanagari needs a taller line box; verify it on the home surface too.
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(`${BASE}#/settings?section=language`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: '日本語' }).first().click()
  await page.getByRole('dialog').getByRole('option', { name: /हिन्दी/ }).click()
  await page.waitForTimeout(250)
  await page.goto(`${BASE}#/`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(150)
  check(
    (await page.evaluate(() => document.documentElement.lang)) === 'hi',
    'hindi locale did not apply',
  )
  await shot('16-home-hi')

  await page.goto(`${BASE}#/settings?section=language`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'हिन्दी' }).first().click()
  await page.getByRole('dialog').getByRole('option', { name: /English/ }).click()
  await page.waitForTimeout(250)

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
console.log('\nUI check passed.')
