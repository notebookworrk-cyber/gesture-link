import { create } from 'zustand'
import type { DiagnosticsSnapshot } from './TrackingDiagnostics'

export type CameraPhase = 'idle' | 'starting' | 'live' | 'paused' | 'error'
export type TrackingPhase = 'idle' | 'loading' | 'running' | 'lost' | 'error'

export type VisionErrorCode =
  | 'unsupported'
  | 'denied'
  | 'not-found'
  | 'in-use'
  | 'model'
  | 'unknown'

export interface VisionError {
  code: VisionErrorCode
  /** Technical detail for the diagnostics line; may be English engine text. */
  detail: string
}

export const emptyDiagnostics: DiagnosticsSnapshot = {
  handP50: 0,
  handP95: 0,
  poseP50: 0,
  poseP95: 0,
  faceP50: 0,
  faceP95: 0,
  processedFrames: 0,
  droppedFrames: 0,
  longTasks: 0,
  longestTaskMs: 0,
  modelLoadMs: 0,
  pipelineMs: 0,
}

export interface VisionStatus {
  camera: CameraPhase
  tracking: TrackingPhase
  hands: number
  fps: number
  inferenceMs: number
  delegate: 'gpu' | 'cpu' | null
  cameraLabel: string | null
  captureWidth: number
  captureHeight: number
  processingWidth: number
  /** Face landmarker state; 'off' until a workspace asks for faces. */
  faceTracking: TrackingPhase | 'off'
  faces: number
  faceDelegate: 'gpu' | 'cpu' | null
  faceMs: number
  /** Pose landmarker state; 'off' when the pose pass is disabled. */
  poseTracking: TrackingPhase | 'off'
  poseDelegate: 'gpu' | 'cpu' | null
  poseMs: number
  /** True once a pose frame has produced a usable shoulder frame. */
  shoulderFrameReady: boolean
  diagnostics: DiagnosticsSnapshot
  error: VisionError | null
  setStatus: (patch: Partial<Omit<VisionStatus, 'setStatus'>>) => void
  reset: () => void
}

const initial = {
  camera: 'idle' as CameraPhase,
  tracking: 'idle' as TrackingPhase,
  hands: 0,
  fps: 0,
  inferenceMs: 0,
  delegate: null,
  cameraLabel: null,
  captureWidth: 0,
  captureHeight: 0,
  processingWidth: 0,
  faceTracking: 'off' as VisionStatus['faceTracking'],
  faces: 0,
  faceDelegate: null,
  faceMs: 0,
  poseTracking: 'off' as VisionStatus['poseTracking'],
  poseDelegate: null,
  poseMs: 0,
  shoulderFrameReady: false,
  diagnostics: { ...emptyDiagnostics },
  error: null,
}

/**
 * Single source of truth for what the vision engine is actually doing.
 * Components read this instead of guessing from component-local state.
 */
export const useVisionStatus = create<VisionStatus>()((set) => ({
  ...initial,
  setStatus: (patch) => set(patch),
  reset: () => set({ ...initial, diagnostics: { ...emptyDiagnostics } }),
}))
