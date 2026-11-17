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
export type RecognitionPreset = 'beginner' | 'balanced' | 'responsive'
export type NumberOperation = 'independent' | 'addition' | 'subtraction' | 'concatenation'
export type SpeechMode = 'manual' | 'word' | 'sentence' | 'auto'

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
  /** Upper-body pose pass: needed for shoulder-normalised hand features. */
  pose: 'off' | 'lite'
  /** Target pose rate; the hand pass always runs at video rate. */
  poseRateHz: number
}

export interface PerformanceSettings {
  quality: ProcessingQuality
  adaptive: boolean
  delegate: DelegatePreference
  debug: boolean
  lowPower: boolean
}

/** Advanced recognition controls consumed by the recognition event pipeline. */
export interface RecognitionSettingsState {
  preset: RecognitionPreset
  minConfidence: number
  stabilityMs: number
  minDurationMs: number
  maxDurationMs: number
  releaseMs: number
  transitionMs: number
  jitterDistance: number
  handLossMs: number
  duplicateSuppression: boolean
  twoHandMode: boolean
  numberOperation: NumberOperation
  motionSmoothing: number
  windowMs: number
}

/** Speech output controls; only committed recognition events can be spoken. */
export interface SpeechSettingsState {
  mode: SpeechMode
  preview: boolean
  autoEnabled: boolean
  gapMs: number
  rate: number
  pitch: number
  volume: number
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
  recognition: RecognitionSettingsState
  speech: SpeechSettingsState
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
  setRecognition: (patch: Partial<RecognitionSettingsState>) => void
  setRecognitionPreset: (preset: RecognitionPreset) => void
  setSpeech: (patch: Partial<SpeechSettingsState>) => void
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
  pose: 'lite',
  poseRateHz: 8,
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

export const defaultRecognition: RecognitionSettingsState = {
  preset: 'balanced',
  minConfidence: 0.45,
  stabilityMs: 260,
  minDurationMs: 320,
  maxDurationMs: 4000,
  releaseMs: 220,
  transitionMs: 200,
  jitterDistance: 0.035,
  handLossMs: 260,
  duplicateSuppression: true,
  twoHandMode: true,
  numberOperation: 'independent',
  motionSmoothing: 0.5,
  windowMs: 1100,
}

export const defaultSpeech: SpeechSettingsState = {
  mode: 'manual',
  preview: true,
  autoEnabled: false,
  gapMs: 140,
  rate: 1,
  pitch: 1,
  volume: 1,
}

export const recognitionPresets: Record<RecognitionPreset, Partial<RecognitionSettingsState>> = {
  beginner: {
    minConfidence: 0.6,
    stabilityMs: 420,
    minDurationMs: 520,
    releaseMs: 360,
    transitionMs: 320,
    jitterDistance: 0.05,
    handLossMs: 340,
    duplicateSuppression: true,
  },
  balanced: {
    minConfidence: 0.45,
    stabilityMs: 260,
    minDurationMs: 320,
    releaseMs: 220,
    transitionMs: 200,
    jitterDistance: 0.035,
    handLossMs: 260,
    duplicateSuppression: true,
  },
  responsive: {
    minConfidence: 0.38,
    stabilityMs: 170,
    minDurationMs: 210,
    releaseMs: 150,
    transitionMs: 130,
    jitterDistance: 0.025,
    handLossMs: 180,
    duplicateSuppression: true,
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
      recognition: { ...defaultRecognition },
      speech: { ...defaultSpeech },

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
      setRecognition: (patch) => set({ recognition: { ...get().recognition, ...patch } }),
      setRecognitionPreset: (preset) =>
        set({
          recognition: {
            ...get().recognition,
            ...recognitionPresets[preset],
            preset,
          },
        }),
      setSpeech: (patch) => set({ speech: { ...get().speech, ...patch } }),
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
        recognition: state.recognition,
        speech: state.speech,
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
          recognition: { ...current.recognition, ...saved.recognition },
          speech: { ...current.speech, ...saved.speech },
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
