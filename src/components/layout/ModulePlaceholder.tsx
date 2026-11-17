import type { MessageKey } from '@/localization/locales/en'
import { moduleStatus, type ModuleId } from '@/app/moduleStatus'
import { PageHeader, pageStyles } from '@/components/layout/PageHeader'
import { DetailList } from '@/components/layout/DetailList'
import { Workspace } from '@/components/layout/Workspace'
import { EmptyState, Panel } from '@/components/ui/Panel'
import { Boxes, Info } from 'lucide-react'
import { useI18n } from '@/localization/i18n'
import styles from './placeholder.module.css'
interface ModulePlaceholderProps {
  moduleId: ModuleId
  nameKey: MessageKey
  titleKey: MessageKey
  leadKey: MessageKey
}

/**
 * Honest intermediate state for a workspace that has not landed yet. It
 * contains no controls that pretend to work; only real build status.
 */
export function ModulePlaceholder({
  moduleId,
  nameKey,
  titleKey,
  leadKey,
}: ModulePlaceholderProps) {
  const { t } = useI18n()
  const state = moduleStatus[moduleId]

  return (
    <Workspace
      inspector={
        <>
          <Panel title={t(nameKey)}>
            <DetailList
              items={[
                { label: t('status.label'), value: t(statusKey(state)) },
                { label: t('settings.aboutBuild'), value: '4.0.0' },
              ]}
            />
          </Panel>
          <Panel title={t('home.systemTitle')}>
            <p className={styles.inspectorNote}>
              <Info aria-hidden="true" />
              <span>{t('page.placeholderBody')}</span>
            </p>
          </Panel>
        </>
      }
    >
      <div className={pageStyles.page}>
        <PageHeader eyebrow={t('nav.workspaceGroup')} title={t(titleKey)} lead={t(leadKey)} />
        <Panel>
          <EmptyState
            icon={<Boxes aria-hidden="true" />}
            title={t('page.placeholderTitle')}
            body={t('page.placeholderBody')}
          />
        </Panel>
      </div>
    </Workspace>
  )
}

function statusKey(state: string): MessageKey {
  switch (state) {
    case 'ready':
      return 'status.ready'
    case 'building':
      return 'status.building'
    case 'degraded':
      return 'status.degraded'
    default:
      return 'status.planned'
  }
}
