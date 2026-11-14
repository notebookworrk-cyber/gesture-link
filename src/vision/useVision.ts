import { useEffect } from 'react'
import { useSettings } from '@/settings/settingsStore'
import { getVisionEngine } from './VisionEngine'
import { visionConfigFromSettings } from './config'
import { useVisionStatus } from './visionStatus'

/**
 * Keeps the single engine aligned with persisted settings. Mounted once, at the
 * application root, so a settings change applies no matter which route is open.
 */
export function useVisionSettingsSync(): void {
  useEffect(() => {
    const engine = getVisionEngine()
    const apply = () => engine.configure(visionConfigFromSettings(useSettings.getState()))
    apply()
    return useSettings.subscribe((state, previous) => {
      if (
        state.camera !== previous.camera ||
        state.tracking !== previous.tracking ||
        state.performance !== previous.performance
      ) {
        apply()
      }
    })
  }, [])
}

export function useVisionEngine() {
  return getVisionEngine()
}

/** Convenience selector for surfaces that need the whole live status. */
export function useLiveStatus() {
  return useVisionStatus((state) => state)
}
