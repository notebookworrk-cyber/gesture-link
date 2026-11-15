export type ModuleId = 'signReader' | 'whiteboard' | 'camera' | 'training' | 'engine' | 'gallery'
export type ModuleState = 'ready' | 'building' | 'planned' | 'degraded'

/**
 * Build manifest. This is the only place a module may claim to be finished;
 * the home page and inspectors read it directly. Update it as milestones land.
 */
export const moduleStatus: Record<ModuleId, ModuleState> = {
  engine: 'building',
  signReader: 'ready',
  whiteboard: 'ready',
  camera: 'ready',
  training: 'ready',
  gallery: 'ready',
}

export const engineBuild = '2.0.0'
