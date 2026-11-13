import { useEffect } from 'react'
import { localeMeta } from '@/localization/i18n'
import { useSettings } from './settingsStore'

function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
}

/**
 * Applies appearance and language settings to the document root. Kept as a
 * single effect so every surface (including native form controls and
 * scrollbars) updates in the same frame.
 */
export function useAppearanceSync() {
  const appearance = useSettings((state) => state.appearance)
  const language = useSettings((state) => state.language.interface)

  useEffect(() => {
    const root = document.documentElement

    const applyTheme = () => {
      const resolved =
        appearance.theme === 'system' ? (systemPrefersDark() ? 'dark' : 'light') : appearance.theme
      root.dataset.theme = resolved
    }

    applyTheme()
    root.dataset.accent = appearance.accent
    root.dataset.density = appearance.density
    root.dataset.reduceMotion = String(appearance.reduceMotion)
    root.dataset.transitions = String(appearance.transitions)
    root.dataset.largeText = String(appearance.largeText)
    root.dataset.highContrast = String(appearance.highContrast)
    root.lang = language
    root.dir = localeMeta[language].dir

    if (appearance.accent === 'custom') {
      root.style.setProperty('--accent', appearance.accentCustom)
    } else {
      root.style.removeProperty('--accent')
    }

    if (appearance.theme !== 'system') return
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyTheme()
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [appearance, language])
}
