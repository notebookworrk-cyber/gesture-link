import { Link, useLocation } from 'react-router-dom'
import { Menu, PanelRight, Settings as SettingsIcon } from 'lucide-react'
import { ChevronRight } from 'lucide-react'
import { navItemForPath } from '@/app/navigation'
import { useUI } from '@/app/uiStore'
import { useI18n } from '@/localization/i18n'
import type { MessageKey } from '@/localization/locales/en'
import { useVisionStatus } from '@/vision/visionStatus'
import type { VisionStatus } from '@/vision/visionStatus'
import styles from './shell.module.css'

type Tone = 'neutral' | 'ok' | 'warn' | 'danger'

function cameraChip(phase: VisionStatus['camera']): { labelKey: MessageKey; tone: Tone } {
  switch (phase) {
    case 'live':
      return { labelKey: 'topbar.cameraOn', tone: 'ok' }
    case 'starting':
      return { labelKey: 'topbar.cameraPending', tone: 'warn' }
    case 'error':
      return { labelKey: 'topbar.cameraBlocked', tone: 'danger' }
    default:
      return { labelKey: 'topbar.cameraOff', tone: 'neutral' }
  }
}

function trackingChip(phase: VisionStatus['tracking']): { labelKey: MessageKey; tone: Tone } {
  switch (phase) {
    case 'running':
      return { labelKey: 'topbar.trackingActive', tone: 'ok' }
    case 'loading':
      return { labelKey: 'topbar.trackingActive', tone: 'warn' }
    case 'lost':
      return { labelKey: 'topbar.trackingIdle', tone: 'warn' }
    case 'error':
      return { labelKey: 'topbar.trackingUnavailable', tone: 'danger' }
    default:
      return { labelKey: 'topbar.trackingUnavailable', tone: 'neutral' }
  }
}

export function Topbar() {
  const { t } = useI18n()
  const location = useLocation()
  const current = navItemForPath(location.pathname)
  const camera = useVisionStatus((state) => state.camera)
  const tracking = useVisionStatus((state) => state.tracking)
  const inspectorAvailable = useUI((state) => state.inspectorAvailable)
  const inspectorOpen = useUI((state) => state.inspectorOpen)
  const toggleInspector = useUI((state) => state.toggleInspector)
  const setMobileNavOpen = useUI((state) => state.setMobileNavOpen)

  const cameraState = cameraChip(camera)
  const trackingState = trackingChip(tracking)

  return (
    <header className={styles.topbar}>
      <button
        id="nav-menu-button"
        type="button"
        className={`${styles.iconButton} ${styles.menuButton}`}
        onClick={() => setMobileNavOpen(true)}
        aria-label={t('nav.menu')}
      >
        <Menu aria-hidden="true" />
      </button>

      <nav className={styles.breadcrumb} aria-label={t('topbar.workspace')}>
        <Link to="/" className={styles.crumbRoot}>
          {t('app.name')}
        </Link>
        <ChevronRight aria-hidden="true" />
        <span className={styles.crumbCurrent} aria-current="page">
          {current ? t(current.titleKey) : t('app.name')}
        </span>
      </nav>

      <div className={styles.statusCluster}>
        <span className={styles.chip} data-tone={cameraState.tone} title={t(cameraState.labelKey)}>
          <span className={styles.chipDot} aria-hidden="true" />
          <span>{t(cameraState.labelKey)}</span>
        </span>
        <span
          className={styles.chip}
          data-tone={trackingState.tone}
          title={t(trackingState.labelKey)}
        >
          <span className={styles.chipDot} aria-hidden="true" />
          <span>{t(trackingState.labelKey)}</span>
        </span>
      </div>

      <span className={styles.spacer} />

      {inspectorAvailable ? (
        <button
          type="button"
          className={styles.iconButton}
          aria-pressed={inspectorOpen}
          aria-label={t('topbar.inspector')}
          title={t('topbar.inspector')}
          onClick={toggleInspector}
        >
          <PanelRight aria-hidden="true" />
        </button>
      ) : null}

      <span className={styles.divider} aria-hidden="true" />

      <Link
        to="/settings"
        className={styles.iconButton}
        aria-label={t('nav.settings')}
        title={t('nav.settings')}
      >
        <SettingsIcon aria-hidden="true" />
      </Link>
    </header>
  )
}
