import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Accessibility,
  Camera,
  Database,
  Gauge,
  Hand,
  Info,
  Languages,
  Palette,
  ShieldCheck,
} from 'lucide-react'
import { PageHeader, pageStyles } from '@/components/layout/PageHeader'
import { Workspace } from '@/components/layout/Workspace'
import { Button } from '@/components/ui/Button'
import {
  ColorSwatch,
  Field,
  Segmented,
  SelectControl,
  Slider,
  Toggle,
} from '@/components/ui/Controls'
import { LanguagePicker } from '@/components/ui/LanguagePicker'
import { Panel } from '@/components/ui/Panel'
import { CameraPreview } from '@/components/vision/CameraPreview'
import { LOCALES, localeMeta, useI18n, type Locale } from '@/localization/i18n'
import type { MessageKey } from '@/localization/locales/en'
import {
  trackingPresets,
  useSettings,
  type AccentId,
  type DelegatePreference,
  type Density,
  type Handedness,
  type ProcessingQuality,
  type ThemeMode,
  type TrackingPreset,
} from '@/settings/settingsStore'
import { useVisionStatus } from '@/vision/visionStatus'
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

type SectionId =
  | 'appearance'
  | 'camera'
  | 'tracking'
  | 'performance'
  | 'language'
  | 'accessibility'
  | 'data'
  | 'about'

const SECTIONS: Array<{ id: SectionId; labelKey: MessageKey; icon: typeof Palette }> = [
  { id: 'appearance', labelKey: 'settings.navAppearance', icon: Palette },
  { id: 'camera', labelKey: 'settings.navCamera', icon: Camera },
  { id: 'tracking', labelKey: 'settings.navTracking', icon: Hand },
  { id: 'performance', labelKey: 'settings.navPerformance', icon: Gauge },
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
            {section === 'camera' ? <CameraSection /> : null}
            {section === 'tracking' ? <TrackingSection /> : null}
            {section === 'performance' ? <PerformanceSection /> : null}
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

function CameraSection() {
  const { t } = useI18n()
  const camera = useSettings((state) => state.camera)
  const setCamera = useSettings((state) => state.setCamera)
  const phase = useVisionStatus((state) => state.camera)
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])

  useEffect(() => {
    let alive = true
    const load = () => {
      const media = navigator.mediaDevices
      if (!media?.enumerateDevices) return
      media
        .enumerateDevices()
        .then((list) => {
          if (!alive) return
          const inputs = list
            .filter((device) => device.kind === 'videoinput')
            .filter((device) => device.deviceId)
          setDevices(inputs)
          const selected = camera.deviceId
          if (
            selected &&
            inputs.length > 0 &&
            !inputs.some((device) => device.deviceId === selected)
          ) {
            setCamera({ deviceId: null })
          }
        })
        .catch(() => undefined)
    }
    load()
    navigator.mediaDevices?.addEventListener?.('devicechange', load)
    return () => {
      alive = false
      navigator.mediaDevices?.removeEventListener?.('devicechange', load)
    }
  }, [camera.deviceId, phase, setCamera])

  const deviceOptions = [
    { value: '', label: t('settings.cameraDefault') },
    ...devices.map((device, index) => ({
      value: device.deviceId,
      label: device.label
        ? device.label
        : t('settings.cameraNumber', { number: index + 1 }),
    })),
  ]

  return (
    <Panel title={t('settings.navCamera')} flush>
      <div className={styles.rows}>
        <Field
          label={t('settings.cameraDevice')}
          hint={t('settings.cameraDeviceHint')}
          control={
            <SelectControl
              ariaLabel={t('settings.cameraDevice')}
              value={camera.deviceId ?? ''}
              onChange={(value) => setCamera({ deviceId: value || null })}
              options={deviceOptions}
            />
          }
        />
        <Field
          label={t('settings.cameraResolution')}
          hint={t('settings.cameraResolutionHint')}
          control={
            <SelectControl
              ariaLabel={t('settings.cameraResolution')}
              value={camera.resolution}
              onChange={(value) =>
                setCamera({ resolution: value as '480p' | '720p' | '1080p' })
              }
              options={[
                { value: '480p', label: t('settings.resolution480') },
                { value: '720p', label: t('settings.resolution720') },
                { value: '1080p', label: t('settings.resolution1080') },
              ]}
            />
          }
        />
        <Field
          label={t('settings.cameraFrameRate')}
          hint={t('settings.cameraFrameRateHint')}
          control={
            <SelectControl
              ariaLabel={t('settings.cameraFrameRate')}
              value={String(camera.frameRate)}
              onChange={(value) =>
                setCamera({ frameRate: Number(value) as 15 | 24 | 30 | 60 })
              }
              options={[
                { value: '15', label: '15 fps' },
                { value: '24', label: '24 fps' },
                { value: '30', label: '30 fps' },
                { value: '60', label: '60 fps' },
              ]}
            />
          }
        />
        <Field
          label={t('settings.cameraMirror')}
          hint={t('settings.cameraMirrorHint')}
          control={
            <Toggle
              label={t('settings.cameraMirror')}
              checked={camera.mirror}
              onChange={(mirror) => setCamera({ mirror })}
            />
          }
        />
        <Field
          label={t('settings.cameraAutoRelease')}
          hint={t('settings.cameraAutoReleaseHint')}
          control={
            <Toggle
              label={t('settings.cameraAutoRelease')}
              checked={camera.autoRelease}
              onChange={(autoRelease) => setCamera({ autoRelease })}
            />
          }
        />
      </div>
      <div className={styles.previewBlock}>
        <p className={styles.previewHint}>{t('settings.cameraTestHint')}</p>
        <CameraPreview compact />
      </div>
    </Panel>
  )
}

function TrackingSection() {
  const { t } = useI18n()
  const tracking = useSettings((state) => state.tracking)
  const setTracking = useSettings((state) => state.setTracking)

  const percent = (value: number) => t('settings.percent', { value: Math.round(value * 100) })
  const milliseconds = (value: number) => t('settings.milliseconds', { value })

  return (
    <Panel title={t('settings.navTracking')} flush>
      <div className={styles.rows}>
        <Field
          label={t('settings.trackingPreset')}
          hint={t('settings.trackingPresetHint')}
          control={
            <Segmented<TrackingPreset>
              ariaLabel={t('settings.trackingPreset')}
              value={tracking.preset}
              onChange={(preset) => setTracking({ preset, ...trackingPresets[preset] })}
              options={[
                { value: 'stable', label: t('settings.presetStable') },
                { value: 'balanced', label: t('settings.presetBalanced') },
                { value: 'responsive', label: t('settings.presetResponsive') },
              ]}
            />
          }
        />
        <Field
          label={t('settings.maxHands')}
          hint={t('settings.maxHandsHint')}
          control={
            <Segmented
              ariaLabel={t('settings.maxHands')}
              value={String(tracking.maxHands)}
              onChange={(value) => setTracking({ maxHands: value === '2' ? 2 : 1 })}
              options={[
                { value: '1', label: t('settings.maxHandsOne') },
                { value: '2', label: t('settings.maxHandsTwo') },
              ]}
            />
          }
        />
        <Field
          label={t('settings.detectionConfidence')}
          hint={t('settings.detectionConfidenceHint')}
          stacked
          control={
            <Slider
              hideLabel
              label={t('settings.detectionConfidence')}
              value={tracking.detectionConfidence}
              min={0.1}
              max={0.95}
              step={0.05}
              format={percent}
              onChange={(detectionConfidence) => setTracking({ detectionConfidence })}
            />
          }
        />
        <Field
          label={t('settings.trackingConfidence')}
          hint={t('settings.trackingConfidenceHint')}
          stacked
          control={
            <Slider
              hideLabel
              label={t('settings.trackingConfidence')}
              value={tracking.trackingConfidence}
              min={0.1}
              max={0.95}
              step={0.05}
              format={percent}
              onChange={(trackingConfidence) => setTracking({ trackingConfidence })}
            />
          }
        />
        <Field
          label={t('settings.smoothing')}
          hint={t('settings.smoothingHint')}
          stacked
          control={
            <Slider
              hideLabel
              label={t('settings.smoothing')}
              value={tracking.smoothing}
              min={0}
              max={1}
              step={0.01}
              format={percent}
              onChange={(smoothing) => setTracking({ smoothing })}
            />
          }
        />
        <Field
          label={t('settings.sensitivity')}
          hint={t('settings.sensitivityHint')}
          stacked
          control={
            <Slider
              hideLabel
              label={t('settings.sensitivity')}
              value={tracking.sensitivity}
              min={0}
              max={1}
              step={0.01}
              format={percent}
              onChange={(sensitivity) => setTracking({ sensitivity })}
            />
          }
        />
        <Field
          label={t('settings.pinchSensitivity')}
          hint={t('settings.pinchSensitivityHint')}
          stacked
          control={
            <Slider
              hideLabel
              label={t('settings.pinchSensitivity')}
              value={tracking.pinchSensitivity}
              min={0}
              max={1}
              step={0.01}
              format={percent}
              onChange={(pinchSensitivity) => setTracking({ pinchSensitivity })}
            />
          }
        />
        <Field
          label={t('settings.holdTime')}
          hint={t('settings.holdTimeHint')}
          stacked
          control={
            <Slider
              hideLabel
              label={t('settings.holdTime')}
              value={tracking.holdMs}
              min={80}
              max={800}
              step={10}
              format={milliseconds}
              onChange={(holdMs) => setTracking({ holdMs })}
            />
          }
        />
        <Field
          label={t('settings.cooldown')}
          hint={t('settings.cooldownHint')}
          stacked
          control={
            <Slider
              hideLabel
              label={t('settings.cooldown')}
              value={tracking.cooldownMs}
              min={0}
              max={1500}
              step={10}
              format={milliseconds}
              onChange={(cooldownMs) => setTracking({ cooldownMs })}
            />
          }
        />
        <Field
          label={t('settings.lossTolerance')}
          hint={t('settings.lossToleranceHint')}
          stacked
          control={
            <Slider
              hideLabel
              label={t('settings.lossTolerance')}
              value={tracking.lossToleranceMs}
              min={0}
              max={500}
              step={10}
              format={milliseconds}
              onChange={(lossToleranceMs) => setTracking({ lossToleranceMs })}
            />
          }
        />
        <Field
          label={t('settings.dominantHand')}
          hint={t('settings.dominantHandHint')}
          control={
            <Segmented<Handedness>
              ariaLabel={t('settings.dominantHand')}
              value={tracking.dominantHand}
              onChange={(dominantHand) => setTracking({ dominantHand })}
              options={[
                { value: 'any', label: t('settings.handAny') },
                { value: 'left', label: t('settings.handLeft') },
                { value: 'right', label: t('settings.handRight') },
              ]}
            />
          }
        />
        <Field
          label={t('settings.showLandmarks')}
          hint={t('settings.showLandmarksHint')}
          control={
            <Toggle
              label={t('settings.showLandmarks')}
              checked={tracking.showLandmarks}
              onChange={(showLandmarks) => setTracking({ showLandmarks })}
            />
          }
        />
      </div>
    </Panel>
  )
}

function PerformanceSection() {
  const { t } = useI18n()
  const performance = useSettings((state) => state.performance)
  const setPerformance = useSettings((state) => state.setPerformance)

  return (
    <Panel title={t('settings.navPerformance')} flush>
      <div className={styles.rows}>
        <Field
          label={t('settings.quality')}
          hint={t('settings.qualityHint')}
          control={
            <Segmented<ProcessingQuality>
              ariaLabel={t('settings.quality')}
              value={performance.quality}
              onChange={(quality) => setPerformance({ quality })}
              options={[
                { value: 'low', label: t('settings.qualityLow') },
                { value: 'balanced', label: t('settings.qualityBalanced') },
                { value: 'high', label: t('settings.qualityHigh') },
              ]}
            />
          }
        />
        <Field
          label={t('settings.adaptiveQuality')}
          hint={t('settings.adaptiveQualityHint')}
          control={
            <Toggle
              label={t('settings.adaptiveQuality')}
              checked={performance.adaptive}
              onChange={(adaptive) => setPerformance({ adaptive })}
            />
          }
        />
        <Field
          label={t('settings.delegate')}
          hint={t('settings.delegateHint')}
          control={
            <Segmented<DelegatePreference>
              ariaLabel={t('settings.delegate')}
              value={performance.delegate}
              onChange={(delegate) => setPerformance({ delegate })}
              options={[
                { value: 'auto', label: t('settings.delegateAuto') },
                { value: 'gpu', label: t('settings.delegateGpu') },
                { value: 'cpu', label: t('settings.delegateCpu') },
              ]}
            />
          }
        />
        <Field
          label={t('settings.lowPower')}
          hint={t('settings.lowPowerHint')}
          control={
            <Toggle
              label={t('settings.lowPower')}
              checked={performance.lowPower}
              onChange={(lowPower) => setPerformance({ lowPower })}
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
          control={<span className="mono">MediaPipe Tasks 0.10.35</span>}
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
