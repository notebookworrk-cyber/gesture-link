import type { VisionConfig } from './types'

export interface CameraStartResult {
  stream: MediaStream
  trackLabel: string
  width: number
  height: number
  frameRate: number
}

const RESOLUTION: Record<VisionConfig['camera']['resolution'], { width: number; height: number }> = {
  '480p': { width: 640, height: 480 },
  '720p': { width: 1280, height: 720 },
  '1080p': { width: 1920, height: 1080 },
}

export class CameraError extends Error {
  readonly reason: 'unsupported' | 'denied' | 'not-found' | 'in-use' | 'unknown'

  constructor(reason: CameraError['reason'], message: string) {
    super(message)
    this.name = 'CameraError'
    this.reason = reason
  }
}

/**
 * Owns exactly one MediaStream for the whole application. Workspaces borrow the
 * stream rather than calling getUserMedia themselves, which is what keeps the
 * camera indicator from multiplying as the user moves between pages.
 */
export class CameraManager {
  private stream: MediaStream | null = null
  private video: HTMLVideoElement | null = null

  getStream(): MediaStream | null {
    return this.stream
  }

  get videoElement(): HTMLVideoElement | null {
    return this.video
  }

  get isLive(): boolean {
    return this.stream !== null && this.stream.getVideoTracks().some((track) => track.readyState === 'live')
  }

  static isSupported(): boolean {
    return (
      typeof navigator !== 'undefined' &&
      typeof navigator.mediaDevices?.getUserMedia === 'function'
    )
  }

  async start(config: VisionConfig['camera']): Promise<CameraStartResult> {
    if (!CameraManager.isSupported()) {
      throw new CameraError(
        'unsupported',
        'Camera access needs a secure context (https or localhost) and a browser with getUserMedia.',
      )
    }

    this.stop()

    const size = RESOLUTION[config.resolution]
    const video: MediaTrackConstraints = {
      width: { ideal: size.width },
      height: { ideal: size.height },
      frameRate: { ideal: config.frameRate, max: config.frameRate },
    }
    if (config.deviceId) video.deviceId = { exact: config.deviceId }

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video,
        audio: false,
      })
    } catch (error) {
      throw toCameraError(error)
    }

    const track = this.stream.getVideoTracks()[0]
    const settings = track?.getSettings() ?? {}
    this.video = document.createElement('video')
    this.video.muted = true
    this.video.playsInline = true
    this.video.autoplay = true
    this.video.srcObject = this.stream
    try {
      await this.video.play()
    } catch {
      // Autoplay of a muted, invisible video can still be rejected in rare
      // power-saving modes; the track is live, so the loop can retry play().
    }

    return {
      stream: this.stream,
      trackLabel: track?.label ?? '',
      width: settings.width ?? size.width,
      height: settings.height ?? size.height,
      frameRate: settings.frameRate ?? config.frameRate,
    }
  }

  stop(): void {
    if (this.stream) {
      for (const track of this.stream.getTracks()) track.stop()
      this.stream = null
    }
    if (this.video) {
      this.video.pause()
      this.video.srcObject = null
      this.video = null
    }
  }

  async listDevices(): Promise<MediaDeviceInfo[]> {
    if (!navigator.mediaDevices?.enumerateDevices) return []
    const devices = await navigator.mediaDevices.enumerateDevices()
    return devices.filter((device) => device.kind === 'videoinput')
  }
}

function toCameraError(error: unknown): CameraError {
  const name = error instanceof DOMException ? error.name : ''
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return new CameraError('denied', 'Camera permission was blocked.')
    case 'NotFoundError':
    case 'OverconstrainedError':
      return new CameraError('not-found', 'No camera matches the requested device or resolution.')
    case 'NotReadableError':
    case 'AbortError':
      return new CameraError('in-use', 'The camera is already in use by another application.')
    default:
      return new CameraError('unknown', error instanceof Error ? error.message : 'Camera failed to start.')
  }
}
