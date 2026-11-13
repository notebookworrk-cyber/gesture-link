import { describe, expect, it } from 'vitest'
import { LOCALES, dictionaries, translate } from '@/localization/i18n'
import type { MessageKey } from '@/localization/locales/en'

const englishKeys = Object.keys(dictionaries.en).sort()

function placeholders(value: string): string[] {
  return [...value.matchAll(/\{(\w+)\}/g)].map((match) => match[1] as string).sort()
}

describe('message catalogues', () => {
  it('ships a dictionary for every advertised locale', () => {
    expect(Object.keys(dictionaries).sort()).toEqual([...LOCALES].sort())
  })

  it.each(LOCALES)('%s contains every key and no extra keys', (locale) => {
    expect(Object.keys(dictionaries[locale]).sort()).toEqual(englishKeys)
  })

  it.each(LOCALES)('%s keeps interpolation placeholders intact', (locale) => {
    for (const key of englishKeys as MessageKey[]) {
      expect(placeholders(dictionaries[locale][key]), key).toEqual(
        placeholders(dictionaries.en[key]),
      )
    }
  })

  it('interpolates variables and leaves unknown variables untouched', () => {
    const used = translate('en', 'home.systemUsedOf', { used: '12 MB', total: '2 GB' })
    expect(used).toBe('12 MB of 2 GB')
  })

  it('renders Devanagari and Japanese without dropping characters', () => {
    expect(dictionaries.hi['home.title']).toContain('आपके हाथ')
    expect(dictionaries.ja['home.title']).toContain('手がそのまま')
  })
})
