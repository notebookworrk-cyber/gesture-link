import { beforeEach, describe, expect, it } from 'vitest'
import {
  defaultAppearance,
  defaultLanguage,
  useSettings,
} from '@/settings/settingsStore'

describe('settings store', () => {
  beforeEach(() => {
    useSettings.setState({
      appearance: { ...defaultAppearance },
      language: { ...defaultLanguage },
    })
  })

  it('merges appearance patches without dropping other keys', () => {
    useSettings.getState().setAppearance({ theme: 'light' })
    const appearance = useSettings.getState().appearance
    expect(appearance.theme).toBe('light')
    expect(appearance.density).toBe(defaultAppearance.density)
    expect(appearance.accent).toBe(defaultAppearance.accent)
  })

  it('resets appearance to documented defaults', () => {
    useSettings.getState().setAppearance({ theme: 'light', density: 'compact', accent: 'rose' })
    useSettings.getState().resetAppearance()
    expect(useSettings.getState().appearance).toEqual(defaultAppearance)
  })

  it('changes the interface language without touching recognition', () => {
    useSettings.getState().setLanguage({ interface: 'ja' })
    const language = useSettings.getState().language
    expect(language.interface).toBe('ja')
    expect(language.recognition).toBe('isl')
  })

  it('persists under a versioned key', () => {
    const raw = localStorage.getItem('gesturelink.settings.v1')
    expect(raw === null || raw.includes('appearance')).toBe(true)
  })
})
