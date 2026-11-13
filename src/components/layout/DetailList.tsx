import type { ReactNode } from 'react'
import styles from './detail.module.css'

export interface DetailItem {
  label: ReactNode
  value: ReactNode
  title?: string
}

export function DetailList({ items }: { items: DetailItem[] }) {
  return (
    <dl className={styles.list}>
      {items.map((item, index) => (
        <div key={index} className={styles.row}>
          <dt className={styles.key}>{item.label}</dt>
          <dd className={styles.value} title={item.title} style={{ margin: 0 }}>
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  )
}
