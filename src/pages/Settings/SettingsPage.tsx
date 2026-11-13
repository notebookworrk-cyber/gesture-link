import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Accessibility, Database, Info, Languages, Palette, ShieldCheck } from 'lucide-react'
import { PageHeader, pageStyles } from '@/components/layout/PageHeader'
import { Workspace } from '@/components/layout/Workspace'
import { Button } from '@/components/ui/Button'
import { ColorSwatch, Field, Segmented, SelectControl, Toggle } from '@/components/ui/Controls'
import { LanguagePicker } from '@/components/ui/LanguagePicker'
import { Panel } from '@/components/ui/Panel'
import { LOCALES, localeMeta, useI18n, type Locale } from '@/localization/i18n'
import type { MessageKey } from '@/localization/locales/en'
import {
  useSettings,
  type AccentId,
  type Density,
  type ThemeMode,
} from '@/settings/settingsStore'
import { formatBytes } from '@/utils/format'
import styles from './settings.module.css'

const ACCENT_HEX: Record<Exclude<AccentId, 'custom'>, string> = {
  mint: '#3edc9b',
  blue: '#4e9df5',
  violet: '#a58bfa',
  orange: '#f59a4b',
  rose: '#f2698f',
}

const ACCENT_KEY: Record<AccentId, MessageKey> = {
  mint: 'settings.accentMint',
  blue: 'settings.accentBlue',
  violet: 'settings.accentViolet',
  orange: 'settings.accentOrange',
  rose: 'settings.accentRose',
  custom: 'settings.accentCustom',
}

type SectionId = 'appearance' | 'language' | 'accessibility' | 'data' | 'about'

const SECTIONS: Array<{ id: SectionId; labelKey: MessageKey; icon: typeof Palette }> = [
  { id: 'appearance', labelKey: 'settings.navAppearance', icon: Palette },
  { id: 'language', labelKey: 'settings.navLanguage', icon: Languages },
  { id: 'accessibility', labelKey: 'settings.navAccessibility', icon: Accessibility },
  { id: 'data', labelKey: 'settings.navData', icon: Database },
  { id: 'about', labelKey: 'settings.navAbout', icon: Info },
]

function isSection(value: string | null): value is SectionId {
  return SECTIONS.some((section) => section.id === value)
}

export function SettingsPage() {
  const { t } = useI18n()
  const [params, setParams] = useSearchParams()
  const raw = params.get('section')
  const section: SectionId = isSection(raw) ? raw : 'appearance'

  return (
    <Workspace>
      <div className={pageStyles.page} style={{ maxWidth: 1080 }}>
        <PageHeader
          eyebrow={t('nav.systemGroup')}
          title={t('settings.title')}
          lead={t('settings.lead')}
        />
        <div className={styles.layout}>
          <nav className={styles.nav} aria-label={t('settings.title')}>
            {SECTIONS.map((item) => {
              const Icon = item.icon
              return (
                <button
                  key={item.id}
                  type="button"
                  className={styles.navItem}
                  data-active={section === item.id}
                  aria-current={section === item.id ? 'true' : undefined}
                  onClick={() => setParams({ section: item.id }, { replace: false })}
                >
                  <Icon aria-hidden="true" />
                  {t(item.labelKey)}
                </button>
              )
            })}
          </nav>
          <div className={styles.panels}>
            {section === 'appearance' ? <AppearanceSection /> : null}
            {section === 'language' ? <LanguageSection /> : null}
            {section === 'accessibility' ? <AccessibilitySection /> : null}
            {section === 'data' ? <DataSection /> : null}
            {section === 'about' ? <AboutSection /> : null}
          </div>
        </div>
      </div>
    </Workspace>
  )
}

function AppearanceSection() {
  const { t } = useI18n()
  const appearance = useSettings((state) => state.appearance)
  const setAppearance = useSettings((state) => state.setAppearance)
  const resetAppearance = useSettings((state) => state.resetAppearance)

  return (
    <Panel
      title={t('settings.navAppearance')}
      action={
        <Button size="sm" variant="ghost" onClick={resetAppearance}>
          {t('settings.resetAppearance')}
        </Button>
      }
      flush
    >
      <div className={styles.rows}>
        <Field
          label={t('settings.theme')}
          hint={t('settings.themeHint')}
          control={
            <Segmented<ThemeMode>
              ariaLabel={t('settings.theme')}
              value={appearance.theme}
              onChange={(theme) => setAppearance({ theme })}
              options={[
                { value: 'dark', label: t('settings.themeDark') },
                { value: 'light', label: t('settings.themeLight') },
                { value: 'system', label: t('settings.themeSystem') },
              ]}
            />
          }
        />
        <Field
          label={t('settings.accent')}
          hint={t('settings.accentHint')}
          control={
            <div className={styles.inlineSwatches}>
              {(Object.keys(ACCENT_HEX) as Array<keyof typeof ACCENT_HEX>).map((id) => (
                <ColorSwatch
                  key={id}
                  color={ACCENT_HEX[id]}
                  label={t(ACCENT_KEY[id])}
                  active={appearance.accent === id}
                  onSelect={() => setAppearance({ accent: id })}
                />
              ))}
              <input
                type="color"
                aria-label={t('settings.accentCustomLabel')}
                title={t('settings.accentCustomLabel')}
                value={appearance.accentCustom}
                onChange={(event) =>
                  setAppearance({ accent: 'custom', accentCustom: event.target.value })
                }
                className={styles.colorInput}
                style={
                  appearance.accent === 'custom'
                    ? {
                        boxShadow: '0 0 0 2px var(--canvas), 0 0 0 3px var(--text-2)',
                      }
                    : undefined
                }
              />
            </div>
          }
        />
        <Field
          label={t('settings.density')}
          hint={t('settings.densityHint')}
          control={
            <Segmented<Density>
              ariaLabel={t('settings.density')}
              value={appearance.density}
              onChange={(density) => setAppearance({ density })}
              options={[
                { value: 'compact', label: t('settings.densityCompact') },
                { value: 'comfortable', label: t('settings.densityComfortable') },
                { value: 'spacious', label: t('settings.densitySpacious') },
              ]}
            />
          }
        />
        <Field
          label={t('settings.sidebarCollapsed')}
          hint={t('settings.sidebarCollapsedHint')}
          control={
            <Toggle
              label={t('settings.sidebarCollapsed')}
              checked={appearance.sidebarCollapsed}
              onChange={(sidebarCollapsed) => setAppearance({ sidebarCollapsed })}
            />
          }
        />
        <Field
          label={t('settings.transitions')}
          hint={t('settings.transitionsHint')}
          control={
            <Toggle
              label={t('settings.transitions')}
              checked={appearance.transitions}
              onChange={(transitions) => setAppearance({ transitions })}
            />
          }
        />
      </div>
    </Panel>
  )
}

function LanguageSection() {
  const { t } = useI18n()
  const language = useSettings((state) => state.language)
  const setLanguage = useSettings((state) => state.setLanguage)
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
    const synth = window.speechSynthesis
    const load = () => setVoices(synth.getVoices())
    load()
    synth.addEventListener('voiceschanged', load)
    return () => synth.removeEventListener('voiceschanged', load)
  }, [])

  return (
    <>
      <Panel title={t('settings.navLanguage')} flush>
        <div className={styles.rows}>
          <Field
            label={t('settings.interfaceLanguage')}
            hint={t('settings.interfaceLanguageHint')}
            control={
              <LanguagePicker
                value={language.interface}
                onChange={(locale) => setLanguage({ interface: locale })}
              />
            }
          />
          <Field
            label={t('settings.recognitionLanguage')}
            hint={t('settings.recognitionLanguageHint')}
            control={
              <SelectControl
                ariaLabel={t('settings.recognitionLanguage')}
                value={language.recognition}
                onChange={() => undefined}
                options={[{ value: 'isl', label: t('settings.isl') }]}
              />
            }
          />
          <Field
            label={t('settings.captionLanguage')}
            hint={t('settings.captionLanguageHint')}
            control={
              <LanguagePicker
                value={language.captions}
                onChange={(locale) => setLanguage({ captions: locale })}
              />
            }
          />
          <Field
            label={t('settings.translationLanguage')}
            hint={t('settings.translationLanguageHint')}
            control={
              <SelectControl
                ariaLabel={t('settings.translationLanguage')}
                value={language.translation}
                onChange={(value) =>
                  setLanguage({ translation: value === 'none' ? 'none' : (value as Locale) })
                }
                options={[
                  { value: 'none', label: t('settings.noTranslation') },
                  ...LOCALES.map((locale) => ({
                    value: locale,
                    label: localeMeta[locale].nativeName,
                  })),
                ]}
              />
            }
          />
          <Field
            label={t('settings.voiceLanguage')}
            hint={t('settings.voiceLanguageHint')}
            control={
              <SelectControl
                ariaLabel={t('settings.voiceLanguage')}
                value={language.voice}
                onChange={(voice) => setLanguage({ voice })}
                options={[
                  { value: 'browser-default', label: t('settings.voiceDefault') },
                  ...voices.map((voice) => ({
                    value: voice.voiceURI,
                    label: `${voice.name} (${voice.lang})`,
                  })),
                ]}
              />
            }
          />
        </div>
      </Panel>
      <div className={styles.notes}>
        <div className={styles.note}>
          <Info aria-hidden="true" />
          <span>{t('settings.languageNote')}</span>
        </div>
        <div className={styles.note}>
          <ShieldCheck aria-hidden="true" />
          <span>{t('settings.recognitionNote')}</span>
        </div>
      </div>
    </>
  )
}

function AccessibilitySection() {
  const { t } = useI18n()
  const appearance = useSettings((state) => state.appearance)
  const setAppearance = useSettings((state) => state.setAppearance)

  return (
    <Panel title={t('settings.navAccessibility')} flush>
      <div className={styles.rows}>
        <Field
          label={t('settings.largeText')}
          hint={t('settings.largeTextHint')}
          control={
            <Toggle
              label={t('settings.largeText')}
              checked={appearance.largeText}
              onChange={(largeText) => setAppearance({ largeText })}
            />
          }
        />
        <Field
          label={t('settings.contrast')}
          hint={t('settings.contrastHint')}
          control={
            <Toggle
              label={t('settings.contrast')}
              checked={appearance.highContrast}
              onChange={(highContrast) => setAppearance({ highContrast })}
            />
          }
        />
        <Field
          label={t('settings.reduceMotion')}
          hint={t('settings.reduceMotionHint')}
          control={
            <Toggle
              label={t('settings.reduceMotion')}
              checked={appearance.reduceMotion}
              onChange={(reduceMotion) => setAppearance({ reduceMotion })}
            />
          }
        />
      </div>
    </Panel>
  )
}

function DataSection() {
  const { t, tag } = useI18n()
  const [estimate, setEstimate] = useState<{ usage: number; quota: number } | null>(null)

  useEffect(() => {
    let alive = true
    navigator.storage
      ?.estimate?.()
      .then((value) => {
        if (alive) setEstimate({ usage: value.usage ?? 0, quota: value.quota ?? 0 })
      })
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [])

  const ratio = estimate && estimate.quota > 0 ? Math.min(1, estimate.usage / estimate.quota) : 0

  return (
    <>
      <Panel title={t('settings.navData')}>
        <div className={styles.storageHead}>
          <span style={{ color: 'var(--text-2)' }}>{t('settings.dataUsage')}</span>
          <span className={styles.storageValue}>
            {estimate
              ? t('home.systemUsedOf', {
                  used: formatBytes(estimate.usage, tag),
                  total: formatBytes(estimate.quota, tag),
                })
              : t('home.systemChecking')}
          </span>
        </div>
        <div
          className={styles.meter}
          role="progressbar"
          aria-label={t('settings.dataUsage')}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(ratio * 100)}
        >
          <div
            className={styles.meterFill}
            style={{ width: `${Math.max(ratio * 100, ratio > 0 ? 1.5 : 0)}%` }}
          />
        </div>
        <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-3)', lineHeight: 1.5 }}>
          {t('settings.dataEmpty')} {t('settings.dataNote')}
        </p>
      </Panel>
    </>
  )
}

function AboutSection() {
  const { t } = useI18n()
  const runtime = describeRuntime()

  return (
    <Panel title={t('settings.navAbout')} flush>
      <div className={styles.rows}>
        <Field label={t('settings.aboutVersion')} control={<span className="mono">2.0.0</span>} />
        <Field label={t('settings.aboutRuntime')} control={<span>{runtime}</span>} />
        <Field
          label={t('settings.aboutEngine')}
          control={<span>{t('settings.aboutUnavailable')}</span>}
        />
        <Field
          label={t('settings.aboutBuild')}
          control={<span className="mono">dev</span>}
        />
      </div>
    </Panel>
  )
}

function describeRuntime(): string {
  if (typeof navigator === 'undefined') return '—'
  const ua = navigator.userAgent
  const browser = ua.includes('Edg/')
    ? 'Edge'
    : ua.includes('Firefox/')
      ? 'Firefox'
      : ua.includes('Chrome/')
        ? 'Chrome'
        : ua.includes('Safari/')
          ? 'Safari'
          : 'Browser'
  const platform = navigator.platform || 'Unknown'
  return `${browser} · ${platform}`
}
