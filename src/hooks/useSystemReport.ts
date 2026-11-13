import { useCallback, useEffect, useState } from 'react'

export interface SystemReport {
  webgl: { supported: boolean; renderer: string | null }
  camera: 'granted' | 'denied' | 'prompt'
  indexedDb: boolean
  storage: { usage: number; quota: number } | null
  models: { hand: boolean; face: boolean }
}

function probeWebgl(): { supported: boolean; renderer: string | null } {
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl')
    if (!gl) return { supported: false, renderer: null }
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info')
    const renderer = debugInfo
      ? String(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL))
      : String(gl.getParameter(gl.RENDERER))
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    return { supported: true, renderer }
  } catch {
    return { supported: false, renderer: null }
  }
}

async function probeCameraPermission(): Promise<SystemReport['camera']> {
  try {
    if (!navigator.permissions?.query) return 'prompt'
    const status = await navigator.permissions.query({ name: 'camera' as PermissionName })
    return status.state
  } catch {
    return 'prompt'
  }
}

async function probeStorage(): Promise<SystemReport['storage']> {
  try {
    if (!navigator.storage?.estimate) return null
    const estimate = await navigator.storage.estimate()
    return { usage: estimate.usage ?? 0, quota: estimate.quota ?? 0 }
  } catch {
    return null
  }
}

async function probeModel(file: string): Promise<boolean> {
  try {
    const url = new URL(`${import.meta.env.BASE_URL}models/${file}`, window.location.href)
    const response = await fetch(url, { method: 'HEAD' })
    if (!response.ok) return false
    const contentType = response.headers.get('content-type') ?? ''
    // Vite's SPA fallback answers with index.html for missing files.
    if (contentType.includes('text/html')) return false
    const length = Number(response.headers.get('content-length') ?? '0')
    return length === 0 ? true : length > 100_000
  } catch {
    return false
  }
}

export function useSystemReport() {
  const [report, setReport] = useState<SystemReport | null>(null)
  const [running, setRunning] = useState(false)

  const run = useCallback(async () => {
    setRunning(true)
    const [camera, storage, hand, face] = await Promise.all([
      probeCameraPermission(),
      probeStorage(),
      probeModel('hand_landmarker.task'),
      probeModel('face_landmarker.task'),
    ])
    const indexedDb = typeof indexedDB !== 'undefined'
    setReport({ webgl: probeWebgl(), camera, indexedDb, storage, models: { hand, face } })
    setRunning(false)
  }, [])

  useEffect(() => {
    void run()
  }, [run])

  return { report, running, run }
}
