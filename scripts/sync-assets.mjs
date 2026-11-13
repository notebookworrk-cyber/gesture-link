import { copyFile, mkdir, readdir, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'

const root = process.cwd()

/**
 * Copies the MediaPipe wasm runtime out of node_modules so the app never
 * depends on a CDN. Runs before dev/build; safe to re-run.
 */
async function syncWasm() {
  const from = resolve(root, 'node_modules/@mediapipe/tasks-vision/wasm')
  const to = resolve(root, 'public/mediapipe/wasm')
  if (!existsSync(from)) {
    console.warn('[assets] mediapipe wasm not found yet, skipping (run pnpm install first)')
    return
  }
  await mkdir(to, { recursive: true })
  const entries = await readdir(from)
  let copied = 0
  for (const entry of entries) {
    const src = join(from, entry)
    const info = await stat(src)
    if (!info.isFile()) continue
    await copyFile(src, join(to, entry))
    copied += 1
  }
  console.log(`[assets] mediapipe wasm synced (${copied} files)`)
}

/**
 * Copies model files from a staging folder into public/models when present.
 * Models are downloaded once by scripts/fetch-models.mjs and committed.
 */
async function syncModels() {
  const staged = resolve(root, 'models')
  const to = resolve(root, 'public/models')
  if (!existsSync(staged)) return
  await mkdir(to, { recursive: true })
  for (const entry of await readdir(staged)) {
    if (!entry.endsWith('.task')) continue
    await copyFile(join(staged, entry), join(to, entry))
  }
}

await syncWasm()
await syncModels()
