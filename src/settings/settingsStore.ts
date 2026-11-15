import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Locale } from '@/localization/i18n'
import type { StaticGestureId } from '@/vision/types'
import type { CaptionSettings } from '@/captions/types'
import { applyPreset, defaultCaptionSettings } from '@/captions/presets'

export type ThemeMode = 'dark' | 'light' | 'system'
export type AccentId = 'mint' | 'blue' | 'violet' | 'orange' | 'rose' | 'custom'
export type Density = 'compact' | 'comfortable' | 'spacious'
export type LayoutMode = 'standard' | 'focus' | 'expanded'
export type Handedness = 'left' | 'right' | 'any'
export type TrackingPreset = 'stable' | 'balanced' | 'responsive'
export type ProcessingQuality = 'low' | 'balanced' | 'high'
export type DelegatePreference = 'auto' | 'gpu' | 'cpu'

export interface AppearanceSettings {
  theme: ThemeMode
  accent: AccentId
  accentCustom: string
  density: Density
  layout: LayoutMode
  sidebarCollapsed: boolean
  reduceMotion: boolean
  transitions: boolean
  sounds: boolean
  largeText: boolean
  highContrast: boolean
}

export interface LanguageSettings {
  interface: Locale
  recognition: 'isl'
  captions: Locale
  translation: Locale | 'none'
  voice: string
}

export interface CameraSettings {
  deviceId: string | null
  resolution: '480p' | '720p' | '1080p'
  frameRate: 15 | 24 | 30 | 60
  mirror: boolean
  preview: boolean
  autoRelease: boolean
}

export interface TrackingSettings {
  preset: TrackingPreset
  detectionConfidence: number
  trackingConfidence: number
  maxHands: 1 | 2
  sensitivity: number
  smoothing: number
  pinchSensitivity: number
  holdMs: number
  cooldownMs: number
  lossToleranceMs: number
  dominantHand: Handedness
  showLandmarks: boolean
}

export interface PerformanceSettings {
  quality: ProcessingQuality
  adaptive: boolean
  delegate: DelegatePreference
  debug: boolean
  lowPower: boolean
}

export interface AccessibilitySettings {
  captionsVisible: boolean
  captionSize: 'sm' | 'md' | 'lg'
  keyboardShortcuts: boolean
  mouseAltControls: boolean
}

/** Actions a control gesture can be bound to in the Gesture Camera. */
export type CameraGestureAction =
  | 'capture'
  | 'nextFilter'
  | 'previousFilter'
  | 'toggleControls'
  | 'toggleEffect'

export type GestureBinding = StaticGestureId | 'none'

export interface GestureSettings {
  /** Master switch for the gesture controls. */
  enabled: boolean
  /** Which hand shape triggers which camera action. */
  bindings: Record<CameraGestureAction, GestureBinding>
}

export interface SettingsState {
  appearance: AppearanceSettings
  language: LanguageSettings
  camera: CameraSettings
  tracking: TrackingSettings
  performance: PerformanceSettings
  accessibility: AccessibilitySettings
  captions: CaptionSettings
  gestures: GestureSettings
  setAppearance: (patch: Partial<AppearanceSettings>) => void
  setLanguage: (patch: Partial<LanguageSettings>) => void
  setCamera: (patch: Partial<CameraSettings>) => void
  setTracking: (patch: Partial<TrackingSettings>) => void
  setPerformance: (patch: Partial<PerformanceSettings>) => void
  setAccessibility: (patch: Partial<AccessibilitySettings>) => void
  setCaptions: (patch: Partial<CaptionSettings>) => void
  setCaptionPreset: (preset: CaptionSettings['preset']) => void
  setGestures: (patch: Partial<GestureSettings>) => void
  setGestureBinding: (action: CameraGestureAction, gesture: GestureBinding) => void
  resetAppearance: () => void
}

export const defaultAppearance: AppearanceSettings = {
  theme: 'dark',
  accent: 'mint',
  accentCustom: '#5f8cff',
  density: 'comfortable',
  layout: 'standard',
  sidebarCollapsed: false,
  reduceMotion: false,
  transitions: true,
  sounds: false,
  largeText: false,
  highContrast: false,
}

export const defaultLanguage: LanguageSettings = {
  interface: 'en',
  recognition: 'isl',
  captions: 'en',
  translation: 'none',
  voice: 'browser-default',
}

export const defaultCamera: CameraSettings = {
  deviceId: null,
  resolution: '720p',
  frameRate: 30,
  mirror: true,
  preview: true,
  autoRelease: true,
}

export const defaultTracking: TrackingSettings = {
  preset: 'balanced',
  detectionConfidence: 0.5,
  trackingConfidence: 0.5,
  maxHands: 2,
  sensitivity: 0.55,
  smoothing: 0.5,
  pinchSensitivity: 0.5,
  holdMs: 220,
  cooldownMs: 420,
  lossToleranceMs: 180,
  dominantHand: 'any',
  showLandmarks: true,
}

export const defaultPerformance: PerformanceSettings = {
  quality: 'balanced',
  adaptive: true,
  delegate: 'auto',
  debug: false,
  lowPower: false,
}

export const defaultAccessibility: AccessibilitySettings = {
  captionsVisible: true,
  captionSize: 'md',
  keyboardShortcuts: true,
  mouseAltControls: true,
}

export const defaultGestures: GestureSettings = {
  enabled: true,
  bindings: {
    capture: 'peace',
    nextFilter: 'thumbs-up',
    previousFilter: 'none',
    toggleControls: 'open-palm',
    toggleEffect: 'pinch',
  },
}

/** Actions in the order the settings screen lists them. */
export const CAMERA_GESTURE_ACTIONS: CameraGestureAction[] = [
  'capture',
  'nextFilter',
  'previousFilter',
  'toggleControls',
  'toggleEffect',
]

/**
 * Finds actions that share the same hand shape. The camera runs the first
 * action of a conflicting pair, so the settings screen warns about it.
 */
export function conflictingBindings(
  bindings: Record<CameraGestureAction, GestureBinding>,
): CameraGestureAction[][] {
  const groups = new Map<GestureBinding, CameraGestureAction[]>()
  for (const action of CAMERA_GESTURE_ACTIONS) {
    const gesture = bindings[action]
    if (gesture === 'none') continue
    const list = groups.get(gesture) ?? []
    list.push(action)
    groups.set(gesture, list)
  }
  return [...groups.values()].filter((group) => group.length > 1)
}

/** Preset values are a starting point; sliders can move away from them. */
export const trackingPresets: Record<TrackingPreset, Partial<TrackingSettings>> = {
  stable: {
    sensitivity: 0.4,
    smoothing: 0.72,
    pinchSensitivity: 0.42,
    holdMs: 320,
    cooldownMs: 600,
    lossToleranceMs: 280,
  },
  balanced: {
    sensitivity: 0.55,
    smoothing: 0.5,
    pinchSensitivity: 0.5,
    holdMs: 220,
    cooldownMs: 420,
    lossToleranceMs: 180,
  },
  responsive: {
    sensitivity: 0.72,
    smoothing: 0.3,
    pinchSensitivity: 0.62,
    holdMs: 140,
    cooldownMs: 260,
    lossToleranceMs: 110,
  },
}

export const useSettings = create<SettingsState>()(
  persist(
    (set, get) => ({
      appearance: defaultAppearance,
      language: defaultLanguage,
      camera: defaultCamera,
      tracking: defaultTracking,
      performance: defaultPerformance,
      accessibility: defaultAccessibility,
      captions: { ...defaultCaptionSettings },
      gestures: defaultGestures,

      setAppearance: (patch) => set({ appearance: { ...get().appearance, ...patch } }),
      setLanguage: (patch) => set({ language: { ...get().language, ...patch } }),
      setCamera: (patch) => set({ camera: { ...get().camera, ...patch } }),
      setTracking: (patch) => set({ tracking: { ...get().tracking, ...patch } }),
      setPerformance: (patch) => set({ performance: { ...get().performance, ...patch } }),
      setAccessibility: (patch) =>
        set({ accessibility: { ...get().accessibility, ...patch } }),
      setCaptions: (patch) => set({ captions: { ...get().captions, ...patch } }),
      setCaptionPreset: (preset) => set({ captions: applyPreset(get().captions, preset) }),
      setGestures: (patch) => set({ gestures: { ...get().gestures, ...patch } }),
      setGestureBinding: (action, gesture) =>
        set({
          gestures: {
            ...get().gestures,
            bindings: { ...get().gestures.bindings, [action]: gesture },
          },
        }),
      resetAppearance: () => set({ appearance: { ...defaultAppearance } }),
    }),
    {
      name: 'gesturelink.settings.v1',
      version: 1,
      partialize: (state) => ({
        appearance: state.appearance,
        language: state.language,
        camera: state.camera,
        tracking: state.tracking,
        performance: state.performance,
        accessibility: state.accessibility,
        captions: state.captions,
        gestures: state.gestures,
      }),
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<SettingsState>
        return {
          ...current,
          appearance: { ...current.appearance, ...saved.appearance },
          language: { ...current.language, ...saved.language },
          camera: { ...current.camera, ...saved.camera },
          tracking: { ...current.tracking, ...saved.tracking },
          performance: { ...current.performance, ...saved.performance },
          accessibility: { ...current.accessibility, ...saved.accessibility },
          captions: { ...current.captions, ...saved.captions },
          gestures: {
            ...current.gestures,
            ...saved.gestures,
            bindings: {
              ...current.gestures.bindings,
              ...(saved.gestures?.bindings ?? {}),
            },
          },
        }
      },
    },
  ),
)
