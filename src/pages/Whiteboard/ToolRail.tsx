import type { LucideIcon } from 'lucide-react'
import {
  ArrowLeftRight,
  Brush,
  Circle,
  CircleDashed,
  Eraser,
  Hand,
  Highlighter,
  ImagePlus,
  LassoSelect,
  Minus,
  MoveUpRight,
  MousePointer2,
  PenLine,
  Pencil,
  Pentagon,
  RectangleHorizontal,
  Ruler,
  Square,
  StickyNote,
  Triangle,
  Type,
  Zap,
} from 'lucide-react'
import { TOOLS } from '@/whiteboard/defaults'
import { useWhiteboard } from '@/whiteboard/store'
import type { ToolId } from '@/whiteboard/types'
import { useI18n } from '@/localization/i18n'
import type { MessageKey } from '@/localization/locales/en'
import styles from './whiteboard.module.css'

const TOOL_ICONS: Record<ToolId, LucideIcon> = {
  select: MousePointer2,
  pan: Hand,
  lasso: LassoSelect,
  pen: PenLine,
  pencil: Pencil,
  marker: Brush,
  highlighter: Highlighter,
  laser: Zap,
  eraser: Eraser,
  line: Minus,
  arrow: MoveUpRight,
  'double-arrow': ArrowLeftRight,
  rect: Square,
  'round-rect': RectangleHorizontal,
  circle: Circle,
  ellipse: CircleDashed,
  triangle: Triangle,
  polygon: Pentagon,
  text: Type,
  note: StickyNote,
  image: ImagePlus,
  ruler: Ruler,
}

const GROUPS: ToolId[][] = [
  ['select', 'pan', 'lasso'],
  ['pen', 'pencil', 'marker', 'highlighter', 'laser'],
  ['eraser'],
  ['line', 'arrow', 'double-arrow', 'rect', 'round-rect', 'circle', 'ellipse', 'triangle', 'polygon'],
  ['text', 'note', 'image'],
  ['ruler'],
]

const byId = new Map(TOOLS.map((tool) => [tool.id, tool]))

export function ToolRail() {
  const { t } = useI18n()
  const tool = useWhiteboard((state) => state.tool)
  const rulerVisible = useWhiteboard((state) => state.ruler.visible)
  const setTool = useWhiteboard((state) => state.setTool)
  const toggleRuler = useWhiteboard((state) => state.toggleRuler)

  const activate = (id: ToolId) => {
    if (id === 'ruler' && tool === 'ruler' && rulerVisible) {
      toggleRuler()
      return
    }
    setTool(id)
  }

  return (
    <nav className={styles.toolRail} aria-label={t('wb.tools')}>
      {GROUPS.map((group, index) => (
        <div className={styles.toolGroup} key={group.join('-')} data-first={index === 0}>
          {group.map((id) => {
            const meta = byId.get(id)
            if (!meta) return null
            const Icon = TOOL_ICONS[id]
            const label = t(meta.labelKey as MessageKey)
            const active = tool === id
            return (
              <button
                key={id}
                type="button"
                className={styles.toolButton}
                data-active={active}
                data-ruler-visible={id === 'ruler' && rulerVisible}
                aria-pressed={active}
                aria-label={meta.shortcut ? `${label} (${meta.shortcut})` : label}
                title={meta.shortcut ? `${label} (${meta.shortcut})` : label}
                onClick={() => activate(id)}
              >
                <Icon aria-hidden="true" />
              </button>
            )
          })}
        </div>
      ))}
    </nav>
  )
}
