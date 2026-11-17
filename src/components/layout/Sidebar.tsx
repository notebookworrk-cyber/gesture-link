import { useEffect, useRef } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { PanelLeftClose, PanelLeftOpen, X } from 'lucide-react'
import { navigation } from '@/app/navigation'
import { useUI } from '@/app/uiStore'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { useI18n } from '@/localization/i18n'
import { useSettings } from '@/settings/settingsStore'
import { LogoMark } from './LogoMark'
import styles from './shell.module.css'

const MOBILE_QUERY = '(max-width: 980px)'

export function Sidebar() {
  const { t } = useI18n()
  const collapsed = useSettings((state) => state.appearance.sidebarCollapsed)
  const setAppearance = useSettings((state) => state.setAppearance)
  const mobileOpen = useUI((state) => state.mobileNavOpen)
  const setMobileOpen = useUI((state) => state.setMobileNavOpen)
  const isMobile = useMediaQuery(MOBILE_QUERY)
  const closeRef = useRef<HTMLButtonElement>(null)
  const wasOpen = useRef(false)
  const location = useLocation()

  // The rail is a desktop mode; on a phone the drawer always shows labels.
  const showLabels = isMobile || !collapsed

  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname, setMobileOpen])

  useEffect(() => {
    if (isMobile && mobileOpen) closeRef.current?.focus()
  }, [isMobile, mobileOpen])

  // Returning focus to the trigger keeps keyboard and screen-reader order intact.
  useEffect(() => {
    if (wasOpen.current && !mobileOpen) {
      document.getElementById('nav-menu-button')?.focus()
    }
    wasOpen.current = mobileOpen
  }, [mobileOpen])

  const onToggle = () => {
    if (isMobile) {
      setMobileOpen(false)
      return
    }
    setAppearance({ sidebarCollapsed: !collapsed })
  }

  return (
    <aside
      className={styles.sidebar}
      data-mobile-open={mobileOpen}
      aria-label={t('nav.menu')}
    >
      <div className={styles.brand}>
        <span className={styles.mark}>
          <LogoMark />
        </span>
        {showLabels ? (
          <span className={styles.brandText}>
            <span className={styles.brandName}>{t('app.name')}</span>
            <span className={styles.brandMeta}>4.0 · LOCAL</span>
          </span>
        ) : null}
        {isMobile ? (
          <button
            ref={closeRef}
            type="button"
            className={styles.brandClose}
            onClick={() => setMobileOpen(false)}
            aria-label={t('nav.closeMenu')}
          >
            <X aria-hidden="true" />
          </button>
        ) : null}
      </div>

      <nav className={styles.nav}>
        {navigation.map((group) => (
          <div key={group.labelKey} className={styles.group}>
            {showLabels ? <div className={styles.groupLabel}>{t(group.labelKey)}</div> : null}
            {group.items.map((item) => {
              const Icon = item.icon
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={styles.navLink}
                  title={showLabels ? undefined : t(item.labelKey)}
                >
                  <Icon aria-hidden="true" />
                  {showLabels ? <span>{t(item.labelKey)}</span> : null}
                  {showLabels ? null : <span className="sr-only">{t(item.labelKey)}</span>}
                </NavLink>
              )
            })}
          </div>
        ))}
      </nav>

      <div className={styles.sidebarFooter}>
        <button
          type="button"
          className={styles.collapseButton}
          onClick={onToggle}
          title={isMobile ? t('nav.closeMenu') : collapsed ? t('nav.expand') : t('nav.collapse')}
          aria-label={isMobile ? t('nav.closeMenu') : collapsed ? t('nav.expand') : t('nav.collapse')}
        >
          {isMobile ? (
            <X aria-hidden="true" />
          ) : collapsed ? (
            <PanelLeftOpen aria-hidden="true" />
          ) : (
            <PanelLeftClose aria-hidden="true" />
          )}
          {showLabels ? (
            <span>
              {isMobile
                ? t('nav.closeMenu')
                : collapsed
                  ? t('nav.expand')
                  : t('nav.collapse')}
            </span>
          ) : null}
        </button>
        {showLabels ? (
          <div className={styles.localNote}>
            <span className={styles.localDot} aria-hidden="true" />
            {t('footer.local')}
          </div>
        ) : null}
      </div>
    </aside>
  )
}
