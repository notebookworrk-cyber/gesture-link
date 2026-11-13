import { useCallback } from 'react'
import { en, type MessageKey } from './locales/en'
import { hi } from './locales/hi'
import { ja } from './locales/ja'
import { es } from './locales/es'
import { fr } from './locales/fr'
import { de } from './locales/de'
import { useSettings } from '@/settings/settingsStore'

export const LOCALES = ['en', 'hi', 'ja', 'es', 'fr', 'de'] as const
export type Locale = (typeof LOCALES)[number]

export const localeMeta: Record<Locale, { nativeName: string; tag: string; dir: 'ltr' | 'rtl' }> = {
  en: { nativeName: 'English', tag: 'en', dir: 'ltr' },
  hi: { nativeName: 'हिन्दी', tag: 'hi-IN', dir: 'ltr' },
  ja: { nativeName: '日本語', tag: 'ja-JP', dir: 'ltr' },
  es: { nativeName: 'Español', tag: 'es-ES', dir: 'ltr' },
  fr: { nativeName: 'Français', tag: 'fr-FR', dir: 'ltr' },
  de: { nativeName: 'Deutsch', tag: 'de-DE', dir: 'ltr' },
}

/**
 * Every catalogue is typed as a complete Record<MessageKey, string>, so a
 * missing translation fails the typecheck instead of silently rendering
 * English inside another locale.
 */
export const dictionaries: Record<Locale, Record<MessageKey, string>> = {
  en,
  hi,
  ja,
  es,
  fr,
  de,
}

export type TranslateFn = (key: MessageKey, vars?: Record<string, string | number>) => string

export function translate(
  locale: Locale,
  key: MessageKey,
  vars?: Record<string, string | number>,
): string {
  const template = dictionaries[locale]?.[key] ?? en[key]
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.hasOwn(vars, name) ? String(vars[name]) : match,
  )
}

export function useI18n() {
  const locale = useSettings((state) => state.language.interface)
  const tag = localeMeta[locale].tag

  const t = useCallback<TranslateFn>(
    (key, vars) => translate(locale, key, vars),
    [locale],
  )

  const formatNumber = useCallback(
    (value: number, options?: Intl.NumberFormatOptions) =>
      new Intl.NumberFormat(tag, options).format(value),
    [tag],
  )

  const formatDate = useCallback(
    (value: Date | number, options?: Intl.DateTimeFormatOptions) =>
      new Intl.DateTimeFormat(tag, options ?? { dateStyle: 'medium' }).format(value),
    [tag],
  )

  return { t, locale, tag, formatNumber, formatDate }
}
