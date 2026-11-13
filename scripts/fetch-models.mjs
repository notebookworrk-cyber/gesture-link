/**
 * Downloads the two MediaPipe model bundles used by GestureLink into ./models.
 * Run once: `pnpm models`. Files are then synced into public/models by
 * scripts/sync-assets.mjs so the app runs fully offline afterwards.
 */
import { createWriteStream } from 'node:fs'
import { mkdir, stat } from 'node:fs/promises'
import { resolve } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'

const BASE = 'https://storage.googleapis.com/mediapipe-models'
const MODELS = [
  {
    file: 'hand_landmarker.task',
    url: `${BASE}/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
    minBytes: 5_000_000,
  },
  {
    file: 'face_landmarker.task',
    url: `${BASE}/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
    minBytes: 2_000_000,
  },
]

const outDir = resolve(process.cwd(), 'models')
await mkdir(outDir, { recursive: true })

for (const model of MODELS) {
  const target = resolve(outDir, model.file)
  try {
    const info = await stat(target)
    if (info.size >= model.minBytes) {
      console.log(`[models] ${model.file} already present (${(info.size / 1e6).toFixed(1)} MB)`)
      continue
    }
  } catch {
    /* not downloaded yet */
  }
  process.stdout.write(`[models] downloading ${model.file} ... `)
  const res = await fetch(model.url)
  if (!res.ok || !res.body) throw new Error(`download failed: ${res.status} ${res.statusText}`)
  await pipeline(Readable.fromWeb(res.body), createWriteStream(target))
  const info = await stat(target)
  if (info.size < model.minBytes) throw new Error(`suspiciously small file: ${info.size} bytes`)
  console.log(`done (${(info.size / 1e6).toFixed(1)} MB)`)
}
