import { describe, expect, it } from 'vitest'
import {
  cameraNeedsRestart,
  defaultVisionConfig,
  trackerNeedsReload,
  visionConfigFromSettings,
} from '@/vision/config'
import {
  defaultCamera,
  defaultPerformance,
  defaultTracking,
} from '@/settings/settingsStore'

describe('vision config', () => {
  it('mirrors the persisted settings without inventing values', () => {
    const config = visionConfigFromSettings({
      camera: { ...defaultCamera, resolution: '1080p', mirror: false },
      tracking: { ...defaultTracking, maxHands: 1, holdMs: 300 },
      performance: { ...defaultPerformance, quality: 'high', delegate: 'cpu' },
    })
    expect(config.camera.resolution).toBe('1080p')
    expect(config.camera.mirror).toBe(false)
    expect(config.tracking.maxHands).toBe(1)
    expect(config.tracking.holdMs).toBe(300)
    expect(config.performance.quality).toBe('high')
    expect(config.performance.delegate).toBe('cpu')
  })

  it('restarts the camera only for capture settings', () => {
    const base = defaultVisionConfig.camera
    expect(cameraNeedsRestart(base, { ...base, resolution: '480p' })).toBe(true)
    expect(cameraNeedsRestart(base, { ...base, frameRate: 15 })).toBe(true)
    expect(cameraNeedsRestart(base, { ...base, deviceId: 'abc' })).toBe(true)
    expect(cameraNeedsRestart(base, { ...base, mirror: !base.mirror })).toBe(false)
    expect(cameraNeedsRestart(base, { ...base, autoRelease: !base.autoRelease })).toBe(false)
  })

  it('reloads the model only for landmarker options', () => {
    const base = defaultVisionConfig
    expect(
      trackerNeedsReload(base, {
        ...base,
        tracking: { ...base.tracking, maxHands: 1 },
      }),
    ).toBe(true)
    expect(
      trackerNeedsReload(base, {
        ...base,
        tracking: { ...base.tracking, detectionConfidence: 0.7 },
      }),
    ).toBe(true)
    expect(
      trackerNeedsReload(base, {
        ...base,
        performance: { ...base.performance, delegate: 'cpu' },
      }),
    ).toBe(true)
    expect(
      trackerNeedsReload(base, {
        ...base,
        tracking: { ...base.tracking, smoothing: 0.9, holdMs: 400 },
      }),
    ).toBe(false)
  })
})
