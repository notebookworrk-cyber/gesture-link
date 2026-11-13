import type { ReactNode } from 'react'
import styles from './page.module.css'

interface PageHeaderProps {
  eyebrow?: ReactNode
  title: ReactNode
  lead?: ReactNode
  actions?: ReactNode
  size?: 'default' | 'display'
}

export function PageHeader({ eyebrow, title, lead, actions, size = 'default' }: PageHeaderProps) {
  return (
    <header className={styles.header}>
      {eyebrow ? <div className={styles.eyebrow}>{eyebrow}</div> : null}
      <div className={styles.headerRow}>
        <div style={{ display: 'grid', gap: 12, minWidth: 0 }}>
          <h1 className={size === 'display' ? styles.display : styles.title}>{title}</h1>
          {lead ? <p className={styles.lead}>{lead}</p> : null}
        </div>
        {actions ? <div className={styles.actions}>{actions}</div> : null}
      </div>
    </header>
  )
}

export { styles as pageStyles }
