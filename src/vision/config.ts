import {
  defaultCamera,
  defaultPerformance,
  defaultTracking,
  type SettingsState,
} from '@/settings/settingsStore'
import type { VisionConfig } from './types'

type Source = Pick<SettingsState, 'camera' | 'tracking' | 'performance'>

export const defaultVisionConfig: VisionConfig = {
  camera: {
    deviceId: defaultCamera.deviceId,
    resolution: defaultCamera.resolution,
    frameRate: defaultCamera.frameRate,
    mirror: defaultCamera.mirror,
    autoRelease: defaultCamera.autoRelease,
  },
  tracking: {
    maxHands: defaultTracking.maxHands,
    detectionConfidence: defaultTracking.detectionConfidence,
    trackingConfidence: defaultTracking.trackingConfidence,
    smoothing: defaultTracking.smoothing,
    sensitivity: defaultTracking.sensitivity,
    pinchSensitivity: defaultTracking.pinchSensitivity,
    holdMs: defaultTracking.holdMs,
    cooldownMs: defaultTracking.cooldownMs,
    lossToleranceMs: defaultTracking.lossToleranceMs,
    dominantHand: defaultTracking.dominantHand,
    pose: defaultTracking.pose,
    poseRateHz: defaultTracking.poseRateHz,
  },
  performance: {
    quality: defaultPerformance.quality,
    adaptive: defaultPerformance.adaptive,
    delegate: defaultPerformance.delegate,
    lowPower: defaultPerformance.lowPower,
  },
}

export function visionConfigFromSettings(settings: Source): VisionConfig {
  return {
    camera: {
      deviceId: settings.camera.deviceId,
      resolution: settings.camera.resolution,
      frameRate: settings.camera.frameRate,
      mirror: settings.camera.mirror,
      autoRelease: settings.camera.autoRelease,
    },
    tracking: {
      maxHands: settings.tracking.maxHands,
      detectionConfidence: settings.tracking.detectionConfidence,
      trackingConfidence: settings.tracking.trackingConfidence,
      smoothing: settings.tracking.smoothing,
      sensitivity: settings.tracking.sensitivity,
      pinchSensitivity: settings.tracking.pinchSensitivity,
      holdMs: settings.tracking.holdMs,
      cooldownMs: settings.tracking.cooldownMs,
      lossToleranceMs: settings.tracking.lossToleranceMs,
      dominantHand: settings.tracking.dominantHand,
      pose: settings.tracking.pose,
      poseRateHz: settings.tracking.poseRateHz,
    },
    performance: {
      quality: settings.performance.quality,
      adaptive: settings.performance.adaptive,
      delegate: settings.performance.delegate,
      lowPower: settings.performance.lowPower,
    },
  }
}

/**
 * Mirroring and auto-release are cosmetic or lifecycle settings: changing them
 * must not tear down a working stream.
 */
export function cameraNeedsRestart(
  a: VisionConfig['camera'],
  b: VisionConfig['camera'],
): boolean {
  return (
    a.deviceId !== b.deviceId ||
    a.resolution !== b.resolution ||
    a.frameRate !== b.frameRate
  )
}

/**
 * HandLandmarker options are fixed at creation time, so these values require a
 * model reload. Thresholds and gesture timings are applied every frame and do
 * not.
 */
export function trackerNeedsReload(a: VisionConfig, b: VisionConfig): boolean {
  return (
    a.tracking.maxHands !== b.tracking.maxHands ||
    a.tracking.detectionConfidence !== b.tracking.detectionConfidence ||
    a.tracking.trackingConfidence !== b.tracking.trackingConfidence ||
    a.performance.delegate !== b.performance.delegate
  )
}
