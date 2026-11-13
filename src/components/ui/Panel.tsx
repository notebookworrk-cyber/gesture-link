import type { ReactNode } from 'react'
import styles from './ui.module.css'

interface PanelProps {
  title?: ReactNode
  action?: ReactNode
  children: ReactNode
  flush?: boolean
  className?: string
}

export function Panel({ title, action, children, flush, className }: PanelProps) {
  return (
    <section className={[styles.panel, className].filter(Boolean).join(' ')}>
      {title || action ? (
        <header className={styles.panelHeader}>
          <h2 className={styles.panelTitle}>{title}</h2>
          {action}
        </header>
      ) : null}
      <div className={styles.panelBody} style={flush ? { padding: 0 } : undefined}>
        {children}
      </div>
    </section>
  )
}

interface SectionProps {
  title?: ReactNode
  description?: ReactNode
  children: ReactNode
  className?: string
}

export function Section({ title, description, children, className }: SectionProps) {
  return (
    <section className={[styles.section, className].filter(Boolean).join(' ')}>
      {title ? (
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>{title}</h2>
          {description ? <p className={styles.sectionDesc}>{description}</p> : null}
        </div>
      ) : null}
      {children}
    </section>
  )
}

export function Rows({ children }: { children: ReactNode }) {
  return <div className={styles.rows}>{children}</div>
}

type BadgeTone = 'neutral' | 'accent' | 'warning' | 'danger'

export function Badge({
  children,
  tone = 'neutral',
  dot = false,
}: {
  children: ReactNode
  tone?: BadgeTone
  dot?: boolean
}) {
  return (
    <span className={styles.badge} data-tone={tone}>
      {dot ? <span className={styles.dot} /> : null}
      {children}
    </span>
  )
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon?: ReactNode
  title: ReactNode
  body?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className={styles.empty}>
      {icon ? <div className={styles.emptyIcon}>{icon}</div> : null}
      <div className={styles.emptyTitle}>{title}</div>
      {body ? <p className={styles.emptyBody}>{body}</p> : null}
      {action}
    </div>
  )
}
