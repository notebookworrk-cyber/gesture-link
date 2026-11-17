import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, GraduationCap, Hand } from 'lucide-react'
import { SelectControl, Segmented } from '@/components/ui/Controls'
import { Badge, EmptyState, Panel } from '@/components/ui/Panel'
import { Workspace } from '@/components/layout/Workspace'
import { useI18n } from '@/localization/i18n'
import type { MessageKey } from '@/localization/locales/en'
import { buildDictionary } from '@/signs/dictionary'
import { useSigns } from '@/signs/store'
import type { SignCategory } from '@/signs/types'
import styles from './dictionary.module.css'

type Filter = 'all' | 'ready' | 'missing'
type CategoryFilter = 'all' | SignCategory

const CATEGORIES: SignCategory[] = ['alphabet', 'number', 'vocabulary', 'custom']

const CATEGORY_KEY: Record<SignCategory, MessageKey> = {
  alphabet: 'training.categoryAlphabet',
  number: 'training.categoryNumber',
  vocabulary: 'training.categoryVocabulary',
  custom: 'training.categoryCustom',
}

const STATUS_KEY: Record<'ready' | 'notInModel' | 'noSamples', MessageKey> = {
  ready: 'dictionary.statusReady',
  notInModel: 'dictionary.statusNotInModel',
  noSamples: 'dictionary.statusNoSamples',
}

/**
 * What the user has taught, and what the current classifier actually covers.
 * "In model" means prototypes exist for the label; it is deliberately not a
 * claim about accuracy, which only a held-out evaluation measures.
 */
export function DictionaryPage() {
  const { t, formatNumber, formatDate } = useI18n()

  const labels = useSigns((state) => state.labels)
  const samples = useSigns((state) => state.samples)
  const model = useSigns((state) => state.model)

  const [filter, setFilter] = useState<Filter>('all')
  const [category, setCategory] = useState<CategoryFilter>('all')

  useEffect(() => {
    void useSigns.getState().init()
  }, [])

  const rows = useMemo(
    () => buildDictionary(labels, samples, model),
    [labels, samples, model],
  )

  const visible = rows.filter((row) => {
    if (category !== 'all' && row.label.category !== category) return false
    if (filter === 'ready') return row.inModel
    if (filter === 'missing') return !row.inModel
    return true
  })

  const readyCount = rows.filter((row) => row.inModel).length

  return (
    <Workspace>
      <div className={styles.page}>
        <header className={styles.header}>
          <div className={styles.headerText}>
            <span className={styles.eyebrow}>{t('nav.workspaceGroup')}</span>
            <h1>{t('page.dictionary.title')}</h1>
            <p>{t('page.dictionary.lead')}</p>
          </div>
          <div className={styles.headerTools}>
            <span className={styles.count}>
              {t('dictionary.summary', {
                ready: formatNumber(readyCount),
                total: formatNumber(rows.length),
              })}
            </span>
            <Segmented
              ariaLabel={t('dictionary.filter')}
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'all', label: t('dictionary.filterAll') },
                { value: 'ready', label: t('dictionary.filterReady') },
                { value: 'missing', label: t('dictionary.filterMissing') },
              ]}
            />
          </div>
        </header>

        <div className={styles.body}>
          <div className={styles.toolbar}>
            <span className={styles.toolbarLabel}>{t('dictionary.category')}</span>
            <SelectControl
              ariaLabel={t('dictionary.category')}
              value={category}
              onChange={(value) => setCategory(value as CategoryFilter)}
              options={[
                { value: 'all', label: t('dictionary.allCategories') },
                ...CATEGORIES.map((value) => ({ value, label: t(CATEGORY_KEY[value]) })),
              ]}
            />
          </div>

          {model ? (
            <p className={styles.note}>
              {t(
                model.featureKind === 'window'
                  ? 'dictionary.modelKindWindow'
                  : 'dictionary.modelKindFrame',
              )}{' '}
              {t('dictionary.modelNote')}
            </p>
          ) : (
            <p className={styles.note}>{t('dictionary.noModel')}</p>
          )}

          {rows.length === 0 ? (
            <Panel>
              <EmptyState
                icon={<BookOpen aria-hidden="true" />}
                title={t('dictionary.emptyTitle')}
                body={t('dictionary.emptyBody')}
                action={
                  <Link className={styles.emptyAction} to="/training">
                    <GraduationCap aria-hidden="true" />
                    {t('dictionary.openTraining')}
                  </Link>
                }
              />
            </Panel>
          ) : visible.length === 0 ? (
            <Panel>
              <EmptyState
                icon={<BookOpen aria-hidden="true" />}
                title={t('dictionary.emptyFilterTitle')}
                body={t('dictionary.emptyFilterBody')}
                action={
                  <button
                    type="button"
                    className={styles.resetAll}
                    onClick={() => {
                      setFilter('all')
                      setCategory('all')
                    }}
                  >
                    {t('dictionary.clearFilter')}
                  </button>
                }
              />
            </Panel>
          ) : (
            <ul className={styles.list}>
              {visible.map((row) => (
                <li key={row.label.id} className={styles.row}>
                  <div className={styles.rowMain}>
                    <div className={styles.rowTitle}>
                      <span className={styles.name}>{row.label.name}</span>
                      <Badge>{t(CATEGORY_KEY[row.label.category])}</Badge>
                      <Badge
                        tone={
                          row.status === 'ready'
                            ? 'accent'
                            : row.status === 'noSamples'
                              ? 'warning'
                              : 'neutral'
                        }
                        dot
                      >
                        {t(STATUS_KEY[row.status])}
                      </Badge>
                    </div>
                    {row.label.description ? (
                      <p className={styles.description}>{row.label.description}</p>
                    ) : null}
                    <p className={styles.meta}>
                      {row.sampleCount === 0
                        ? t('dictionary.noSamples')
                        : t('dictionary.samples', { count: formatNumber(row.sampleCount) })}
                      {row.lastAt
                        ? ` · ${t('dictionary.lastSample', {
                            date: formatDate(row.lastAt, { dateStyle: 'medium' }),
                          })}`
                        : null}
                    </p>
                  </div>
                  <div className={styles.rowActions}>
                    <Link className={styles.action} to="/training">
                      <GraduationCap aria-hidden="true" />
                      {t('dictionary.record')}
                    </Link>
                    <Link className={styles.action} to="/sign-reader">
                      <Hand aria-hidden="true" />
                      {t('dictionary.openReader')}
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Workspace>
  )
}
