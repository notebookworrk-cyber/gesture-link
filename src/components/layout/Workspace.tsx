import type { ReactNode } from 'react'
import { useEffect } from 'react'
import { X } from 'lucide-react'
import { useUI } from '@/app/uiStore'
import { useI18n } from '@/localization/i18n'
import styles from './workspace.module.css'

interface WorkspaceProps {
  children: ReactNode
  inspector?: ReactNode
}

export function Workspace({ children, inspector }: WorkspaceProps) {
  const { t } = useI18n()
  const open = useUI((state) => state.inspectorOpen)
  const setOpen = useUI((state) => state.setInspectorOpen)
  const setAvailable = useUI((state) => state.setInspectorAvailable)
  const hasInspector = Boolean(inspector)

  useEffect(() => {
    setAvailable(hasInspector)
    return () => setAvailable(false)
  }, [hasInspector, setAvailable])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, setOpen])

  return (
    <div className={styles.workspace} data-has-inspector={hasInspector} data-open={open}>
      <div className={styles.main}>{children}</div>
      {hasInspector ? (
        <>
          <button
            type="button"
            className={styles.inspectorBackdrop}
            aria-label={t('common.close')}
            tabIndex={open ? 0 : -1}
            onClick={() => setOpen(false)}
          />
          <aside className={styles.inspector} aria-label={t('topbar.inspector')}>
            <div className={styles.inspectorHead}>
              <span className={styles.inspectorTitle}>{t('topbar.inspector')}</span>
              <button
                type="button"
                className={styles.closeButton}
                onClick={() => setOpen(false)}
                aria-label={t('common.close')}
              >
                <X aria-hidden="true" />
              </button>
            </div>
            <div className={styles.inspectorBody}>{inspector}</div>
          </aside>
        </>
      ) : null}
    </div>
  )
}
