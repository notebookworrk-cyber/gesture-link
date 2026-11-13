import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { LOCALES, localeMeta, useI18n, type Locale } from '@/localization/i18n'
import type { MessageKey } from '@/localization/locales/en'
import styles from './LanguagePicker.module.css'

interface LanguagePickerProps {
  value: Locale
  onChange: (locale: Locale) => void
  id?: string
}

/**
 * Searchable language selector. Language names are always rendered in their
 * own script so a user can find their language without reading the current UI
 * language.
 */
export function LanguagePicker({ value, onChange, id }: LanguagePickerProps) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [focus, setFocus] = useState(0)
  const wrapRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const options = useMemo(() => {
    const search = query.trim().toLocaleLowerCase()
    return LOCALES.map((locale) => ({
      locale,
      nativeName: localeMeta[locale].nativeName,
      translatedName: t(`lang.${locale}` as MessageKey),
    })).filter((option) => {
      if (!search) return true
      return (
        option.nativeName.toLocaleLowerCase().includes(search) ||
        option.translatedName.toLocaleLowerCase().includes(search) ||
        option.locale.startsWith(search)
      )
    })
  }, [query, t])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  useEffect(() => {
    if (open) {
      setQuery('')
      setFocus(0)
      requestAnimationFrame(() => searchRef.current?.focus())
    }
  }, [open])

  const choose = (locale: Locale) => {
    onChange(locale)
    setOpen(false)
  }

  const onSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      setOpen(false)
      return
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setFocus((index) => Math.min(index + 1, options.length - 1))
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setFocus((index) => Math.max(index - 1, 0))
      return
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      const option = options[focus]
      if (option) choose(option.locale)
    }
  }

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        id={id}
        type="button"
        className={styles.trigger}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className={styles.triggerLabel}>{localeMeta[value].nativeName}</span>
        <ChevronDown aria-hidden="true" />
      </button>

      {open ? (
        <div className={styles.popover} role="dialog" aria-label={t('settings.searchLanguages')}>
          <input
            ref={searchRef}
            className={styles.search}
            type="search"
            value={query}
            placeholder={t('settings.searchLanguages')}
            aria-label={t('settings.searchLanguages')}
            onChange={(event) => {
              setQuery(event.target.value)
              setFocus(0)
            }}
            onKeyDown={onSearchKeyDown}
          />
          <div className={styles.list} role="listbox" aria-label={t('settings.searchLanguages')}>
            {options.length === 0 ? (
              <div className={styles.empty}>{t('common.search')} — 0</div>
            ) : (
              options.map((option, index) => (
                <button
                  key={option.locale}
                  type="button"
                  role="option"
                  aria-selected={option.locale === value}
                  data-focus={index === focus}
                  className={styles.option}
                  onMouseEnter={() => setFocus(index)}
                  onClick={() => choose(option.locale)}
                >
                  <span>{option.nativeName}</span>
                  <span className={styles.optionMeta}>{option.translatedName}</span>
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
