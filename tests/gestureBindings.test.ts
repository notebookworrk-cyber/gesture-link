import { beforeEach, describe, expect, it } from 'vitest'
import {
  CAMERA_GESTURE_ACTIONS,
  conflictingBindings,
  defaultGestures,
  useSettings,
  type CameraGestureAction,
} from '@/settings/settingsStore'

describe('gesture bindings', () => {
  beforeEach(() => {
    useSettings.setState({ gestures: { ...defaultGestures, bindings: { ...defaultGestures.bindings } } })
  })

  it('binds the documented defaults', () => {
    expect(defaultGestures.bindings.capture).toBe('peace')
    expect(defaultGestures.bindings.nextFilter).toBe('thumbs-up')
    expect(defaultGestures.bindings.toggleControls).toBe('open-palm')
    expect(defaultGestures.bindings.toggleEffect).toBe('pinch')
    expect(defaultGestures.bindings.previousFilter).toBe('none')
  })

  it('lists every camera action', () => {
    expect(CAMERA_GESTURE_ACTIONS).toEqual([
      'capture',
      'nextFilter',
      'previousFilter',
      'toggleControls',
      'toggleEffect',
    ])
  })

  it('changes one binding without touching the others', () => {
    useSettings.getState().setGestureBinding('capture', 'point')
    const bindings = useSettings.getState().gestures.bindings
    expect(bindings.capture).toBe('point')
    expect(bindings.nextFilter).toBe('thumbs-up')
  })

  it('detects two actions bound to the same hand shape', () => {
    const conflicts = conflictingBindings({
      capture: 'peace',
      nextFilter: 'peace',
      previousFilter: 'none',
      toggleControls: 'open-palm',
      toggleEffect: 'pinch',
    })
    expect(conflicts).toHaveLength(1)
    expect(conflicts[0]).toEqual(['capture', 'nextFilter'])
  })

  it('reports no conflict for the default bindings', () => {
    expect(conflictingBindings(defaultGestures.bindings)).toHaveLength(0)
  })

  it('ignores actions that are not bound', () => {
    const bindings: Record<CameraGestureAction, 'none'> = {
      capture: 'none',
      nextFilter: 'none',
      previousFilter: 'none',
      toggleControls: 'none',
      toggleEffect: 'none',
    }
    expect(conflictingBindings(bindings)).toHaveLength(0)
  })
})
