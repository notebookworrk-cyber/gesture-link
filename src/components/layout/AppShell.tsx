import type { ReactNode } from 'react'
import { useEffect } from 'react'
import { useUI } from '@/app/uiStore'
import { useI18n } from '@/localization/i18n'
import { useSettings } from '@/settings/settingsStore'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import styles from './shell.module.css'

export function AppShell({ children }: { children: ReactNode }) {
  const { t } = useI18n()
  const collapsed = useSettings((state) => state.appearance.sidebarCollapsed)
  const mobileOpen = useUI((state) => state.mobileNavOpen)
  const setMobileOpen = useUI((state) => state.setMobileNavOpen)

  useEffect(() => {
    if (!mobileOpen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mobileOpen, setMobileOpen])

  return (
    <div className={styles.shell} data-collapsed={collapsed}>
      <a className={styles.skipLink} href="#main-content">
        {t('common.skipToContent')}
      </a>
      <Sidebar />
      <button
        type="button"
        className={styles.backdrop}
        data-open={mobileOpen}
        aria-label={t('common.close')}
        tabIndex={mobileOpen ? 0 : -1}
        onClick={() => setMobileOpen(false)}
      />
      <div className={styles.body}>
        <Topbar />
        <main id="main-content" className={styles.content} tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  )
}
