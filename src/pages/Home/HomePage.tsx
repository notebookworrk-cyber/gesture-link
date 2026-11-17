import type { LucideIcon } from 'lucide-react'
import {
  Box,
  Camera,
  ChevronRight,
  Cpu,
  Database,
  GraduationCap,
  Hand,
  PenLine,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { moduleStatus, type ModuleId } from '@/app/moduleStatus'
import { PageHeader, pageStyles } from '@/components/layout/PageHeader'
import { Workspace } from '@/components/layout/Workspace'
import { LinkButton, Button } from '@/components/ui/Button'
import { Badge, Panel } from '@/components/ui/Panel'
import { useSystemReport } from '@/hooks/useSystemReport'
import { useI18n } from '@/localization/i18n'
import type { MessageKey } from '@/localization/locales/en'
import { useSettings } from '@/settings/settingsStore'
import { formatBytes } from '@/utils/format'
import styles from './home.module.css'

const moduleIcons: Record<Exclude<ModuleId, 'gallery'>, LucideIcon> = {
  signReader: Hand,
  whiteboard: PenLine,
  camera: Camera,
  training: GraduationCap,
  engine: Cpu,
}

const moduleRoutes: Partial<Record<ModuleId, string>> = {
  signReader: '/sign-reader',
  whiteboard: '/whiteboard',
  camera: '/camera',
  training: '/training',
}

const moduleText: Record<ModuleId, { name: MessageKey; desc: MessageKey }> = {
  signReader: { name: 'module.signReader.name', desc: 'module.signReader.desc' },
  whiteboard: { name: 'module.whiteboard.name', desc: 'module.whiteboard.desc' },
  camera: { name: 'module.camera.name', desc: 'module.camera.desc' },
  training: { name: 'module.training.name', desc: 'module.training.desc' },
  engine: { name: 'module.engine.name', desc: 'module.engine.desc' },
  gallery: { name: 'nav.gallery', desc: 'page.gallery.lead' },
}

const statusKeys: Record<string, MessageKey> = {
  ready: 'status.ready',
  building: 'status.building',
  planned: 'status.planned',
  degraded: 'status.degraded',
}

const orderedModules: ModuleId[] = ['signReader', 'whiteboard', 'camera', 'training', 'engine']

type Tone = 'ok' | 'warn' | 'danger' | 'neutral'

export function HomePage() {
  const { t, tag } = useI18n()
  const { report, running, run } = useSystemReport()

  const cameraValue = (() => {
    if (!report) return t('home.systemChecking')
    if (report.camera === 'granted') return t('home.systemGranted')
    if (report.camera === 'denied') return t('home.systemDenied')
    return t('home.systemPrompt')
  })()

  const storageValue = (() => {
    if (!report) return t('home.systemChecking')
    if (!report.storage || report.storage.quota === 0) return t('home.systemUnavailable')
    return t('home.systemUsedOf', {
      used: formatBytes(report.storage.usage, tag),
      total: formatBytes(report.storage.quota, tag),
    })
  })()

  const modelsReady = Boolean(report?.models.hand && report?.models.face)
  const modelsValue = !report
    ? t('home.systemChecking')
    : modelsReady
      ? t('home.systemModelsReady')
      : t('home.systemModelsMissing')

  return (
    <Workspace inspector={<HomeInspector />}>
      <div className={pageStyles.page}>
        <PageHeader
          eyebrow={t('home.eyebrow')}
          title={t('home.title')}
          lead={t('home.lead')}
          size="display"
          actions={
            <>
              <LinkButton
                to="/sign-reader"
                variant="primary"
                icon={<Hand aria-hidden="true" />}
              >
                {t('home.primaryAction')}
              </LinkButton>
              <LinkButton
                to="/whiteboard"
                variant="secondary"
                icon={<PenLine aria-hidden="true" />}
              >
                {t('home.secondaryAction')}
              </LinkButton>
            </>
          }
        />

        <div className={pageStyles.columns}>
          <section className={styles.modules} aria-labelledby="modules-heading">
            <div className={styles.moduleHeader}>
              <h2 id="modules-heading" className={pageStyles.sectionTitle}>
                {t('home.modulesTitle')}
              </h2>
              <p className={styles.moduleHint}>{t('home.modulesHint')}</p>
            </div>
            <div className={styles.moduleList}>
              {orderedModules.map((id) => {
                const Icon = moduleIcons[id as Exclude<ModuleId, 'gallery'>]
                const state = moduleStatus[id]
                const to = moduleRoutes[id]
                const content = (
                  <>
                    <span className={styles.moduleIcon}>
                      <Icon aria-hidden="true" />
                    </span>
                    <span className={styles.moduleText}>
                      <span className={styles.moduleName}>{t(moduleText[id].name)}</span>
                      <span className={styles.moduleDesc}>{t(moduleText[id].desc)}</span>
                    </span>
                    <Badge
                      tone={state === 'ready' ? 'accent' : state === 'degraded' ? 'warning' : 'neutral'}
                      dot
                    >
                      {t(statusKeys[state] ?? 'status.unknown')}
                    </Badge>
                    {to ? <ChevronRight className={styles.chevron} aria-hidden="true" /> : <span />}
                  </>
                )
                return to ? (
                  <Link key={id} to={to} className={styles.moduleRow}>
                    {content}
                  </Link>
                ) : (
                  <div key={id} className={styles.moduleRow}>
                    {content}
                  </div>
                )
              })}
            </div>
          </section>

          <Panel
            title={t('home.systemTitle')}
            action={
              <Button
                size="sm"
                variant="ghost"
                onClick={() => void run()}
                disabled={running}
                icon={
                  <RefreshCw
                    aria-hidden="true"
                    width={12}
                    height={12}
                    className={running ? styles.spin : undefined}
                  />
                }
              >
                {running ? t('home.systemChecking') : t('home.systemRecheck')}
              </Button>
            }
          >
            <p
              style={{
                fontSize: 'var(--fs-xs)',
                color: 'var(--text-3)',
                marginBottom: 10,
                lineHeight: 1.45,
              }}
            >
              {t('home.systemLead')}
            </p>
            <div className={styles.checks}>
              <CheckRow
                label={t('home.systemWebgl')}
                value={
                  report
                    ? report.webgl.supported
                      ? t('home.systemSupported')
                      : t('home.systemUnsupported')
                    : t('home.systemChecking')
                }
                tone={report ? (report.webgl.supported ? 'ok' : 'danger') : 'neutral'}
                title={report?.webgl.renderer ?? undefined}
              />
              <CheckRow
                label={t('home.systemCamera')}
                value={cameraValue}
                tone={
                  !report
                    ? 'neutral'
                    : report.camera === 'granted'
                      ? 'ok'
                      : report.camera === 'denied'
                        ? 'danger'
                        : 'neutral'
                }
              />
              <CheckRow
                label={t('home.systemIndexeddb')}
                value={
                  report
                    ? report.indexedDb
                      ? t('home.systemDetected')
                      : t('home.systemNotDetected')
                    : t('home.systemChecking')
                }
                tone={report ? (report.indexedDb ? 'ok' : 'danger') : 'neutral'}
              />
              <CheckRow
                label={t('home.systemStorage')}
                value={storageValue}
                tone={report?.storage ? 'neutral' : 'warn'}
              />
              <CheckRow
                label={t('home.systemModels')}
                value={modelsValue}
                tone={!report ? 'neutral' : modelsReady ? 'ok' : 'warn'}
              />
            </div>
          </Panel>
        </div>

        <div className={styles.notes}>
          <div className={styles.note}>
            <ShieldCheck aria-hidden="true" />
            <span>{t('home.notePrivacy')}</span>
          </div>
          <div className={styles.note}>
            <Box aria-hidden="true" />
            <span>{t('home.noteModels')}</span>
          </div>
          <div className={styles.note}>
            <Database aria-hidden="true" />
            <span>{t('home.noteStorage')}</span>
          </div>
        </div>
      </div>
    </Workspace>
  )
}

function CheckRow({
  label,
  value,
  tone,
  title,
}: {
  label: string
  value: string
  tone: Tone
  title?: string
}) {
  return (
    <div className={styles.checkRow}>
      <span className={styles.checkLabel}>
        <span className={styles.checkDot} data-tone={tone} aria-hidden="true" />
        {label}
      </span>
      <span className={styles.checkValue} title={title}>
        {value}
      </span>
    </div>
  )
}

function HomeInspector() {
  const { t } = useI18n()
  const appearance = useSettings((state) => state.appearance)
  const language = useSettings((state) => state.language.interface)

  const themeKey: MessageKey =
    appearance.theme === 'dark'
      ? 'settings.themeDark'
      : appearance.theme === 'light'
        ? 'settings.themeLight'
        : 'settings.themeSystem'
  const densityKey: MessageKey =
    appearance.density === 'compact'
      ? 'settings.densityCompact'
      : appearance.density === 'spacious'
        ? 'settings.densitySpacious'
        : 'settings.densityComfortable'
  const accentKey: MessageKey =
    appearance.accent === 'mint'
      ? 'settings.accentMint'
      : appearance.accent === 'blue'
        ? 'settings.accentBlue'
        : appearance.accent === 'violet'
          ? 'settings.accentViolet'
          : appearance.accent === 'orange'
            ? 'settings.accentOrange'
            : appearance.accent === 'rose'
              ? 'settings.accentRose'
              : 'settings.accentCustom'

  return (
    <>
      <Panel title={t('settings.navAppearance')}>
        <div className={styles.inspectorRows}>
          <InspectorRow label={t('settings.theme')} value={t(themeKey)} />
          <InspectorRow label={t('settings.accent')} value={t(accentKey)} />
          <InspectorRow label={t('settings.density')} value={t(densityKey)} />
        </div>
      </Panel>
      <Panel title={t('settings.navLanguage')}>
        <div className={styles.inspectorRows}>
          <InspectorRow
            label={t('settings.interfaceLanguage')}
            value={t(`lang.${language}` as MessageKey)}
          />
        </div>
      </Panel>
      <Panel title={t('settings.aboutBuild')}>
        <div className={styles.inspectorRows}>
          <InspectorRow label={t('settings.aboutVersion')} value="3.0.0" />
          <InspectorRow label={t('settings.aboutEngine')} value={t('status.building')} />
        </div>
      </Panel>
    </>
  )
}

function InspectorRow({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.inspectorRow}>
      <span className={styles.inspectorKey}>{label}</span>
      <span className={styles.inspectorValue}>{value}</span>
    </div>
  )
}
