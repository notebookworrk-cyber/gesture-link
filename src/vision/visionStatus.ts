import { create } from 'zustand'

export type CameraPhase = 'idle' | 'starting' | 'live' | 'paused' | 'error'
export type TrackingPhase = 'idle' | 'loading' | 'running' | 'lost' | 'error'

export interface VisionStatus {
  camera: CameraPhase
  tracking: TrackingPhase
  hands: number
  fps: number
  inferenceMs: number
  delegate: 'gpu' | 'cpu' | null
  error: string | null
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
  error: null,
}

/**
 * Single source of truth for what the vision engine is actually doing.
 * Components read this instead of guessing from component-local state.
 */
export const useVisionStatus = create<VisionStatus>()((set) => ({
  ...initial,
  setStatus: (patch) => set(patch),
  reset: () => set(initial),
}))
