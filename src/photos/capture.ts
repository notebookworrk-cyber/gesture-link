/** Converts a canvas into a blob, falling back to PNG when JPEG is refused. */
export async function canvasToBlob(
  canvas: HTMLCanvasElement,
  mimeType = 'image/jpeg',
  quality = 0.92,
): Promise<Blob> {
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((result) => resolve(result), mimeType, quality)
  })
  if (blob) return blob
  return new Promise<Blob>((resolve) => {
    canvas.toBlob((result) => resolve(result ?? new Blob()), 'image/png')
  })
}

/** Builds a small preview blob from a full size canvas. */
export async function makeThumbnail(
  canvas: HTMLCanvasElement,
  maxWidth = 360,
): Promise<Blob> {
  const width = Math.min(maxWidth, canvas.width)
  const height = Math.max(1, Math.round((canvas.height / canvas.width) * width))
  const thumb = document.createElement('canvas')
  thumb.width = width
  thumb.height = height
  const ctx = thumb.getContext('2d')
  if (!ctx) return canvasToBlob(canvas)
  ctx.drawImage(canvas, 0, 0, width, height)
  return canvasToBlob(thumb, 'image/jpeg', 0.82)
}

/** Triggers a browser download for a stored blob. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  // The download starts synchronously; the URL can be released right after.
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

/** Default name for a new photograph: the local time, safe for file names. */
export function defaultPhotoName(date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return [
    'Photo',
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    '-',
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join(' ')
}

/** File name used when a photograph is downloaded. */
export function photoFileName(name: string, extension = 'jpg'): string {
  const safe = name.trim().replace(/[^\p{L}\p{N} _-]+/gu, '-').replace(/\s+/g, ' ').trim()
  return `${safe || 'Photo'}.${extension}`
}
