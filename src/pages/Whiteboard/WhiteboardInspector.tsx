import { useMemo, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignStartVertical,
  Camera,
  ChevronDown,
  ChevronUp,
  Copy,
  Group,
  ImagePlus,
  Lock,
  SendToBack,
  Trash2,
  Ungroup,
  Unlock,
  BringToFront,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import {
  ColorSwatch,
  Field,
  Segmented,
  SelectControl,
  Slider,
  Toggle,
} from '@/components/ui/Controls'
import { useI18n } from '@/localization/i18n'
import type { MessageKey } from '@/localization/locales/en'
import { getVisionEngine } from '@/vision/VisionEngine'
import { useVisionStatus } from '@/vision/visionStatus'
import {
  HIGHLIGHTER_COLORS,
  INK_COLORS,
  NOTE_COLORS,
  PAPER_COLORS,
  TOOLS,
  isInkTool,
  isShapeTool,
} from '@/whiteboard/defaults'
import {
  activePageOf,
  useWhiteboard,
  type AlignEdge,
  type ArrangeMode,
} from '@/whiteboard/store'
import type { FontWeight, PeaceAction, TextAlign, ToolId } from '@/whiteboard/types'
import styles from './whiteboard.module.css'

interface InspectorProps {
  onPickImage: () => void
}

const TOOL_HINTS: Partial<Record<ToolId, MessageKey>> = {
  select: 'wb.hintSelect',
  pan: 'wb.hintPan',
  lasso: 'wb.hintLasso',
  pen: 'wb.hintPen',
  pencil: 'wb.hintPencil',
  marker: 'wb.hintMarker',
  highlighter: 'wb.hintHighlighter',
  laser: 'wb.hintLaser',
  eraser: 'wb.hintEraser',
  line: 'wb.hintShape',
  arrow: 'wb.hintShape',
  'double-arrow': 'wb.hintShape',
  rect: 'wb.hintShape',
  'round-rect': 'wb.hintShape',
  circle: 'wb.hintShape',
  ellipse: 'wb.hintShape',
  triangle: 'wb.hintShape',
  polygon: 'wb.hintShape',
  text: 'wb.hintText',
  note: 'wb.hintNote',
  image: 'wb.hintImage',
  ruler: 'wb.hintRuler',
}

const OFFSETS: Array<{ id: ArrangeMode; labelKey: MessageKey; icon: LucideIcon }> = [
  { id: 'front', labelKey: 'wb.arrangeFront', icon: BringToFront },
  { id: 'forward', labelKey: 'wb.arrangeForward', icon: ChevronUp },
  { id: 'backward', labelKey: 'wb.arrangeBackward', icon: ChevronDown },
  { id: 'back', labelKey: 'wb.arrangeBack', icon: SendToBack },
]

const ALIGNMENTS: Array<{ id: AlignEdge; labelKey: MessageKey; icon: LucideIcon }> = [
  { id: 'left', labelKey: 'wb.alignLeft', icon: AlignStartVertical },
  { id: 'center', labelKey: 'wb.alignCenterX', icon: AlignCenterVertical },
  { id: 'right', labelKey: 'wb.alignRight', icon: AlignEndVertical },
  { id: 'top', labelKey: 'wb.alignTop', icon: AlignStartHorizontal },
  { id: 'middle', labelKey: 'wb.alignMiddle', icon: AlignCenterHorizontal },
  { id: 'bottom', labelKey: 'wb.alignBottom', icon: AlignEndHorizontal },
]

export function WhiteboardInspector({ onPickImage }: InspectorProps) {
  const { t, formatNumber } = useI18n()
  const tool = useWhiteboard((state) => state.tool)
  const brush = useWhiteboard((state) => state.brush)
  const eraser = useWhiteboard((state) => state.eraser)
  const laser = useWhiteboard((state) => state.laser)
  const gesture = useWhiteboard((state) => state.gesture)
  const ruler = useWhiteboard((state) => state.ruler)
  const setBrush = useWhiteboard((state) => state.setBrush)
  const setEraser = useWhiteboard((state) => state.setEraser)
  const setLaser = useWhiteboard((state) => state.setLaser)
  const setGesture = useWhiteboard((state) => state.setGesture)
  const setRuler = useWhiteboard((state) => state.setRuler)
  const toggleRuler = useWhiteboard((state) => state.toggleRuler)
  const setBackground = useWhiteboard((state) => state.setBackground)
  const setPaper = useWhiteboard((state) => state.setPaper)
  const background = useWhiteboard((state) => activePageOf(state)?.background ?? 'grid')
  const paper = useWhiteboard((state) => activePageOf(state)?.paper ?? '#f7f7f4')
  const pageName = useWhiteboard((state) => activePageOf(state)?.name ?? '')
  const pageId = useWhiteboard((state) => activePageOf(state)?.id ?? '')
  const renamePage = useWhiteboard((state) => state.renamePage)
  const clearPage = useWhiteboard((state) => state.clearPage)
  const fitView = useWhiteboard((state) => state.fitView)
  const viewport = useWhiteboard((state) => state.viewport)
  const selectionCount = useWhiteboard((state) => state.selection.length)
  const camera = useVisionStatus((state) => state.camera)

  const [confirmClear, setConfirmClear] = useState(false)

  const meta = TOOLS.find((item) => item.id === tool)
  const isInk = isInkTool(tool)
  const isShape = isShapeTool(tool)
  const isHighlighter = tool === 'highlighter'
  const isNote = tool === 'note'
  const palette = isHighlighter ? HIGHLIGHTER_COLORS : isNote ? NOTE_COLORS : INK_COLORS
  const activeColor = isNote ? brush.noteColor : brush.color

  const chooseColor = (color: string) => {
    if (isNote) setBrush({ noteColor: color })
    else setBrush({ color })
  }

  return (
    <div className={styles.inspector}>
      <section className={styles.inspectorSection}>
        <div className={styles.toolHead}>
          <h3>{meta ? t(meta.labelKey as MessageKey) : t('wb.tools')}</h3>
          {meta?.shortcut ? <kbd>{meta.shortcut}</kbd> : null}
        </div>
        <p className={styles.hint}>{t(TOOL_HINTS[tool] ?? 'wb.hintSelect')}</p>
      </section>

      {(isInk || isShape || isNote) ? (
        <section className={styles.inspectorSection}>
          <h3>{isNote ? t('wb.noteColor') : t('wb.color')}</h3>
          <div className={styles.swatchRow}>
            {palette.map((color) => (
              <ColorSwatch
                key={color}
                color={color}
                label={`${t('wb.color')} ${color}`}
                active={activeColor.toLowerCase() === color.toLowerCase()}
                onSelect={() => chooseColor(color)}
              />
            ))}
            <label className={styles.customColor} title={t('wb.customColor')}>
              <input
                type="color"
                value={activeColor}
                aria-label={t('wb.customColor')}
                onChange={(event) => chooseColor(event.target.value)}
              />
              <span>+</span>
            </label>
          </div>

          {isInk ? (
            <>
              <Field
                label={t('wb.thickness')}
                control={
                  <Slider
                    value={brush.width}
                    min={1}
                    max={isHighlighter ? 48 : 28}
                    step={1}
                    onChange={(value) => setBrush({ width: value })}
                    label={t('wb.thickness')}
                    hideLabel
                    format={(value) => `${formatNumber(value)} px`}
                  />
                }
              />
              <Field
                label={t('wb.opacity')}
                control={
                  <Slider
                    value={Math.round(brush.opacity * 100)}
                    min={10}
                    max={100}
                    step={5}
                    onChange={(value) => setBrush({ opacity: value / 100 })}
                    label={t('wb.opacity')}
                    hideLabel
                    format={(value) => `${formatNumber(value)}%`}
                  />
                }
              />
            </>
          ) : null}

          {isShape ? (
            <>
              <Field
                label={t('wb.strokeWidth')}
                control={
                  <Slider
                    value={brush.width}
                    min={1}
                    max={28}
                    step={1}
                    onChange={(value) => setBrush({ width: value })}
                    label={t('wb.strokeWidth')}
                    hideLabel
                    format={(value) => `${formatNumber(value)} px`}
                  />
                }
              />
              <Field
                label={t('wb.fill')}
                control={
                  <Toggle
                    checked={brush.fill !== null}
                    onChange={(checked) =>
                      setBrush({ fill: checked ? brush.color : null })
                    }
                    label={t('wb.fill')}
                  />
                }
              />
              {brush.fill ? (
                <>
                  <div className={styles.swatchRow}>
                    {INK_COLORS.map((color) => (
                      <ColorSwatch
                        key={color}
                        color={color}
                        label={`${t('wb.fillColor')} ${color}`}
                        active={brush.fill?.toLowerCase() === color.toLowerCase()}
                        onSelect={() => setBrush({ fill: color })}
                      />
                    ))}
                  </div>
                  <Field
                    label={t('wb.fillOpacity')}
                    control={
                      <Slider
                        value={Math.round(brush.fillOpacity * 100)}
                        min={0}
                        max={100}
                        step={5}
                        onChange={(value) => setBrush({ fillOpacity: value / 100 })}
                        label={t('wb.fillOpacity')}
                        hideLabel
                        format={(value) => `${formatNumber(value)}%`}
                      />
                    }
                  />
                </>
              ) : null}
              {tool === 'round-rect' ? (
                <Field
                  label={t('wb.cornerRadius')}
                  control={
                    <Slider
                      value={brush.radius}
                      min={0}
                      max={64}
                      step={1}
                      onChange={(value) => setBrush({ radius: value })}
                      label={t('wb.cornerRadius')}
                      hideLabel
                      format={(value) => `${formatNumber(value)} px`}
                    />
                  }
                />
              ) : null}
              <Field
                label={t('wb.opacity')}
                control={
                  <Slider
                    value={Math.round(brush.opacity * 100)}
                    min={10}
                    max={100}
                    step={5}
                    onChange={(value) => setBrush({ opacity: value / 100 })}
                    label={t('wb.opacity')}
                    hideLabel
                    format={(value) => `${formatNumber(value)}%`}
                  />
                }
              />
            </>
          ) : null}
        </section>
      ) : null}

      {tool === 'text' ? (
        <section className={styles.inspectorSection}>
          <h3>{t('wb.textStyle')}</h3>
          <div className={styles.swatchRow}>
            {INK_COLORS.map((color) => (
              <ColorSwatch
                key={color}
                color={color}
                label={`${t('wb.color')} ${color}`}
                active={brush.color.toLowerCase() === color.toLowerCase()}
                onSelect={() => setBrush({ color })}
              />
            ))}
            <label className={styles.customColor} title={t('wb.customColor')}>
              <input
                type="color"
                value={brush.color}
                aria-label={t('wb.customColor')}
                onChange={(event) => setBrush({ color: event.target.value })}
              />
              <span>+</span>
            </label>
          </div>
          <Field
            label={t('wb.fontSize')}
            control={
              <Slider
                value={brush.fontSize}
                min={8}
                max={96}
                step={1}
                onChange={(value) => setBrush({ fontSize: value })}
                label={t('wb.fontSize')}
                hideLabel
                format={(value) => `${formatNumber(value)} px`}
              />
            }
          />
          <Field
            label={t('wb.fontWeight')}
            control={
              <Segmented
                value={String(brush.fontWeight)}
                ariaLabel={t('wb.fontWeight')}
                onChange={(value) => setBrush({ fontWeight: Number(value) as FontWeight })}
                options={[
                  { value: '400', label: '400' },
                  { value: '500', label: '500' },
                  { value: '600', label: '600' },
                  { value: '700', label: '700' },
                ]}
              />
            }
          />
          <Field
            label={t('wb.align')}
            control={
              <Segmented<TextAlign>
                value={brush.align}
                ariaLabel={t('wb.align')}
                onChange={(value) => setBrush({ align: value })}
                options={[
                  { value: 'left', label: t('wb.alignLeft') },
                  { value: 'center', label: t('wb.alignCenter') },
                  { value: 'right', label: t('wb.alignRight') },
                ]}
              />
            }
          />
          <Field
            label={t('wb.textBackground')}
            control={
              <Toggle
                checked={brush.textBackground !== null}
                onChange={(checked) =>
                  setBrush({ textBackground: checked ? '#ffffff' : null })
                }
                label={t('wb.textBackground')}
              />
            }
          />
          {brush.textBackground ? (
            <label className={styles.inlineColor}>
              <input
                type="color"
                value={brush.textBackground}
                aria-label={t('wb.textBackground')}
                onChange={(event) => setBrush({ textBackground: event.target.value })}
              />
              <span>{brush.textBackground}</span>
            </label>
          ) : null}
        </section>
      ) : null}

      {tool === 'eraser' ? (
        <section className={styles.inspectorSection}>
          <h3>{t('wb.eraser')}</h3>
          <Field
            label={t('wb.eraserMode')}
            control={
              <Segmented
                value={eraser.mode}
                ariaLabel={t('wb.eraserMode')}
                onChange={(value) => setEraser({ mode: value })}
                options={[
                  { value: 'stroke', label: t('wb.eraserStroke') },
                  { value: 'object', label: t('wb.eraserObject') },
                ]}
              />
            }
          />
          <Field
            label={t('wb.eraserSize')}
            control={
              <Slider
                value={eraser.size}
                min={6}
                max={64}
                step={2}
                onChange={(value) => setEraser({ size: value })}
                label={t('wb.eraserSize')}
                hideLabel
                format={(value) => `${formatNumber(value)} px`}
              />
            }
          />
          <p className={styles.hint}>{t('wb.hintEraser')}</p>
        </section>
      ) : null}

      {tool === 'laser' ? (
        <section className={styles.inspectorSection}>
          <h3>{t('wb.laser')}</h3>
          <Field
            label={t('wb.laserDuration')}
            control={
              <Slider
                value={laser.duration}
                min={200}
                max={2500}
                step={100}
                onChange={(value) => setLaser({ duration: value })}
                label={t('wb.laserDuration')}
                hideLabel
                format={(value) => `${formatNumber(Math.round(value / 100) / 10)} s`}
              />
            }
          />
          <p className={styles.hint}>{t('wb.hintLaser')}</p>
        </section>
      ) : null}

      {tool === 'ruler' || ruler.visible ? (
        <section className={styles.inspectorSection}>
          <h3>{t('wb.ruler')}</h3>
          <Field
            label={t('wb.rulerVisible')}
            control={
              <Toggle checked={ruler.visible} onChange={() => toggleRuler()} label={t('wb.rulerVisible')} />
            }
          />
          <Field
            label={t('wb.rulerAngle')}
            control={
              <Slider
                value={ruler.angle}
                min={-90}
                max={90}
                step={1}
                onChange={(value) => setRuler({ angle: value })}
                label={t('wb.rulerAngle')}
                hideLabel
                format={(value) => `${formatNumber(value)}°`}
              />
            }
          />
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              const viewportNow = useWhiteboard.getState().viewport
              setRuler({ x: viewportNow.width / 2, y: viewportNow.height / 2 })
            }}
          >
            {t('wb.centerRuler')}
          </Button>
          <p className={styles.hint}>{t('wb.hintRuler')}</p>
        </section>
      ) : null}

      {tool === 'image' ? (
        <section className={styles.inspectorSection}>
          <h3>{t('wb.image')}</h3>
          <Button size="sm" variant="primary" icon={<ImagePlus aria-hidden="true" />} onClick={onPickImage}>
            {t('wb.insertImage')}
          </Button>
          <p className={styles.hint}>{t('wb.hintImage')}</p>
        </section>
      ) : null}

      {selectionCount > 0 ? <SelectionPanel /> : null}

      <section className={styles.inspectorSection}>
        <h3>{t('wb.pageSection')}</h3>
        <Field
          label={t('wb.pageName')}
          control={
            <input
              className={styles.textInput}
              value={pageName}
              placeholder={t('wb.untitledPage')}
              aria-label={t('wb.pageName')}
              onChange={(event) => {
                if (pageId) renamePage(pageId, event.target.value)
              }}
              onKeyDown={(event) => event.stopPropagation()}
            />
          }
        />
        <Field
          label={t('wb.background')}
          stacked
          control={
            <Segmented
              value={background}
              ariaLabel={t('wb.background')}
              onChange={(value) => setBackground(value)}
              options={[
                { value: 'blank', label: t('wb.backgroundBlank') },
                { value: 'grid', label: t('wb.backgroundGrid') },
                { value: 'dots', label: t('wb.backgroundDots') },
                { value: 'graph', label: t('wb.backgroundGraph') },
              ]}
            />
          }
        />
        <div className={styles.swatchRow} aria-label={t('wb.paper')}>
          {PAPER_COLORS.map((color) => (
            <ColorSwatch
              key={color}
              color={color}
              label={`${t('wb.paper')} ${color}`}
              active={paper.toLowerCase() === color.toLowerCase()}
              onSelect={() => setPaper(color)}
            />
          ))}
          <label className={styles.customColor} title={t('wb.customColor')}>
            <input
              type="color"
              value={paper}
              aria-label={t('wb.paper')}
              onChange={(event) => setPaper(event.target.value)}
            />
            <span>+</span>
          </label>
        </div>
        <div className={styles.inlineButtons}>
          <Button size="sm" variant="secondary" onClick={() => fitView(viewport)}>
            {t('wb.fitToContent')}
          </Button>
          {confirmClear ? (
            <>
              <Button
                size="sm"
                variant="danger"
                onClick={() => {
                  clearPage()
                  setConfirmClear(false)
                }}
              >
                {t('wb.clearPageConfirm')}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmClear(false)}>
                {t('common.cancel')}
              </Button>
            </>
          ) : (
            <Button size="sm" variant="ghost" onClick={() => setConfirmClear(true)}>
              {t('wb.clearPage')}
            </Button>
          )}
        </div>
      </section>

      <section className={styles.inspectorSection}>
        <div className={styles.sectionHeadRow}>
          <h3>{t('wb.gestureSection')}</h3>
          <Toggle
            checked={gesture.enabled}
            onChange={(checked) => setGesture({ enabled: checked })}
            label={t('wb.gestureEnabled')}
          />
        </div>
        <p className={styles.hint}>{t('wb.gestureHowTo')}</p>
        {gesture.enabled ? (
          <>
            <Field
              label={t('wb.reach')}
              hint={t('wb.reachHint')}
              control={
                <Slider
                  value={Math.round(gesture.reach * 100)}
                  min={50}
                  max={100}
                  step={1}
                  onChange={(value) => setGesture({ reach: value / 100 })}
                  label={t('wb.reach')}
                  hideLabel
                  format={(value) => `${formatNumber(value)}%`}
                />
              }
            />
            <Field
              label={t('wb.twoFingerPan')}
              control={
                <Toggle
                  checked={gesture.twoFingerPan}
                  onChange={(checked) => setGesture({ twoFingerPan: checked })}
                  label={t('wb.twoFingerPan')}
                />
              }
            />
            <Field
              label={t('wb.fistEraser')}
              control={
                <Toggle
                  checked={gesture.fistEraser}
                  onChange={(checked) => setGesture({ fistEraser: checked })}
                  label={t('wb.fistEraser')}
                />
              }
            />
            <Field
              label={t('wb.peaceAction')}
              stacked
              control={
                <SelectControl
                  value={gesture.peaceAction}
                  onChange={(value) => setGesture({ peaceAction: value as PeaceAction })}
                  ariaLabel={t('wb.peaceAction')}
                  options={[
                    { value: 'none', label: t('wb.peaceNone') },
                    { value: 'undo', label: t('wb.peaceUndo') },
                    { value: 'previous-page', label: t('wb.peacePrevious') },
                    { value: 'next-page', label: t('wb.peaceNext') },
                  ]}
                />
              }
            />
            <Field
              label={t('wb.showCursor')}
              control={
                <Toggle
                  checked={gesture.showCursor}
                  onChange={(checked) => setGesture({ showCursor: checked })}
                  label={t('wb.showCursor')}
                />
              }
            />
            <div className={styles.inlineButtons}>
              <Button
                size="sm"
                variant="secondary"
                icon={<Camera aria-hidden="true" />}
                onClick={() => void getVisionEngine().start()}
                disabled={camera === 'live' || camera === 'starting'}
              >
                {camera === 'live'
                  ? t('wb.cameraRunning')
                  : camera === 'starting'
                    ? t('wb.cameraStarting')
                    : t('wb.startCamera')}
              </Button>
            </div>
            <p className={styles.hint}>{t('wb.gestureAccuracy')}</p>
          </>
        ) : null}
      </section>

      <details className={styles.shortcuts}>
        <summary>{t('wb.shortcutsSection')}</summary>
        <ul>
          <li><kbd>V</kbd> {t('wb.toolSelect')}</li>
          <li><kbd>P</kbd> {t('wb.toolPen')}</li>
          <li><kbd>E</kbd> {t('wb.toolEraser')}</li>
          <li><kbd>L</kbd> {t('wb.toolLasso')}</li>
          <li><kbd>T</kbd> {t('wb.toolText')}</li>
          <li><kbd>N</kbd> {t('wb.toolNote')}</li>
          <li><kbd>Ctrl</kbd>+<kbd>Z</kbd> {t('wb.undo')}</li>
          <li><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Z</kbd> {t('wb.redo')}</li>
          <li><kbd>Delete</kbd> {t('wb.delete')}</li>
          <li><kbd>Space</kbd> {t('wb.toolPan')}</li>
        </ul>
      </details>
    </div>
  )
}

function SelectionPanel() {
  const { t, formatNumber } = useI18n()
  // Selecting a derived array inside the store selector would return a fresh
  // reference on every snapshot check and loop the renderer, so the stable
  // page array and the id list are selected separately and joined here.
  const pageObjects = useWhiteboard((state) => activePageOf(state)?.objects)
  const selection = useWhiteboard((state) => state.selection)
  const objects = useMemo(() => {
    if (!pageObjects) return []
    const ids = new Set(selection)
    return pageObjects.filter((object) => ids.has(object.id))
  }, [pageObjects, selection])
  const updateSelectionStyle = useWhiteboard((state) => state.updateSelectionStyle)
  const duplicateSelection = useWhiteboard((state) => state.duplicateSelection)
  const deleteSelection = useWhiteboard((state) => state.deleteSelection)
  const groupSelection = useWhiteboard((state) => state.groupSelection)
  const ungroupSelection = useWhiteboard((state) => state.ungroupSelection)
  const lockSelection = useWhiteboard((state) => state.lockSelection)
  const arrange = useWhiteboard((state) => state.arrange)
  const align = useWhiteboard((state) => state.align)
  const setSelection = useWhiteboard((state) => state.setSelection)

  if (objects.length === 0) return null
  const kinds = new Set(objects.map((object) => object.type))
  const onlyNotes = kinds.size === 1 && kinds.has('note')
  const onlyText = kinds.size === 1 && kinds.has('text')
  const onlyShapes = kinds.size === 1 && kinds.has('shape')
  const sized = objects.every((object) => object.type === 'stroke' || object.type === 'shape')
  const first = objects[0]!
  const color = first.type === 'stroke' ? first.color : first.type === 'shape' ? first.stroke : first.type === 'text' ? first.color : first.type === 'note' ? first.color : '#000000'
  const opacity = 'opacity' in first ? first.opacity : 1
  const width = first.type === 'stroke' ? first.width : first.type === 'shape' ? first.strokeWidth : 2
  const allLocked = objects.every((object) => object.locked)
  const grouped = objects.some((object) => object.groupId)

  return (
    <section className={styles.inspectorSection} data-selection="true">
      <div className={styles.sectionHeadRow}>
        <h3>{t('wb.selectionSection')}</h3>
        <span className={styles.badge}>{formatNumber(objects.length)}</span>
      </div>

      {onlyNotes ? (
        <>
          <h4 className={styles.subhead}>{t('wb.noteColor')}</h4>
          <div className={styles.swatchRow}>
            {NOTE_COLORS.map((swatch) => (
              <ColorSwatch
                key={swatch}
                color={swatch}
                label={`${t('wb.noteColor')} ${swatch}`}
                active={color.toLowerCase() === swatch.toLowerCase()}
                onSelect={() => updateSelectionStyle({ noteColor: swatch })}
              />
            ))}
          </div>
        </>
      ) : (
        <div className={styles.swatchRow}>
          {INK_COLORS.map((swatch) => (
            <ColorSwatch
              key={swatch}
              color={swatch}
              label={`${t('wb.color')} ${swatch}`}
              active={color.toLowerCase() === swatch.toLowerCase()}
              onSelect={() => updateSelectionStyle({ color: swatch })}
            />
          ))}
          <label className={styles.customColor} title={t('wb.customColor')}>
            <input
              type="color"
              value={color}
              aria-label={t('wb.customColor')}
              onChange={(event) => updateSelectionStyle({ color: event.target.value })}
            />
            <span>+</span>
          </label>
        </div>
      )}

      {sized ? (
        <Field
          label={t('wb.strokeWidth')}
          control={
            <Slider
              value={Math.round(width)}
              min={1}
              max={48}
              step={1}
              onChange={(value) => updateSelectionStyle({ strokeWidth: value })}
              label={t('wb.strokeWidth')}
              hideLabel
              format={(value) => `${formatNumber(value)} px`}
            />
          }
        />
      ) : null}

      <Field
        label={t('wb.opacity')}
        control={
          <Slider
            value={Math.round(opacity * 100)}
            min={10}
            max={100}
            step={5}
            onChange={(value) => updateSelectionStyle({ opacity: value / 100 })}
            label={t('wb.opacity')}
            hideLabel
            format={(value) => `${formatNumber(value)}%`}
          />
        }
      />

      {onlyShapes ? (
        <>
          <Field
            label={t('wb.fill')}
            control={
              <Toggle
                checked={objects.some((object) => object.type === 'shape' && object.fill !== null)}
                onChange={(checked) => updateSelectionStyle({ fill: checked ? color : null })}
                label={t('wb.fill')}
              />
            }
          />
          <Field
            label={t('wb.fillOpacity')}
            control={
              <Slider
                value={Math.round(
                  (objects.find((object) => object.type === 'shape') as { fillOpacity?: number })
                    ?.fillOpacity ?? 0.16,
                ) * 100}
                min={0}
                max={100}
                step={5}
                onChange={(value) => updateSelectionStyle({ fillOpacity: value / 100 })}
                label={t('wb.fillOpacity')}
                hideLabel
                format={(value) => `${formatNumber(value)}%`}
              />
            }
          />
        </>
      ) : null}

      {onlyText ? (
        <>
          <Field
            label={t('wb.fontSize')}
            control={
              <Slider
                value={first.type === 'text' ? Math.round(first.fontSize) : 22}
                min={8}
                max={96}
                step={1}
                onChange={(value) => updateSelectionStyle({ fontSize: value })}
                label={t('wb.fontSize')}
                hideLabel
                format={(value) => `${formatNumber(value)} px`}
              />
            }
          />
          <Field
            label={t('wb.align')}
            control={
              <Segmented<TextAlign>
                value={first.type === 'text' ? first.align : 'left'}
                ariaLabel={t('wb.align')}
                onChange={(value) => updateSelectionStyle({ align: value })}
                options={[
                  { value: 'left', label: t('wb.alignLeft') },
                  { value: 'center', label: t('wb.alignCenter') },
                  { value: 'right', label: t('wb.alignRight') },
                ]}
              />
            }
          />
        </>
      ) : null}

      <div className={styles.buttonGrid}>
        <Button size="sm" variant="secondary" icon={<Copy aria-hidden="true" />} onClick={() => duplicateSelection()}>
          {t('wb.duplicate')}
        </Button>
        <Button size="sm" variant="danger" icon={<Trash2 aria-hidden="true" />} onClick={() => deleteSelection()}>
          {t('wb.delete')}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          icon={<Group aria-hidden="true" />}
          disabled={objects.length < 2}
          onClick={() => groupSelection()}
        >
          {t('wb.group')}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          icon={<Ungroup aria-hidden="true" />}
          disabled={!grouped}
          onClick={() => ungroupSelection()}
        >
          {t('wb.ungroup')}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          icon={allLocked ? <Unlock aria-hidden="true" /> : <Lock aria-hidden="true" />}
          onClick={() => lockSelection(!allLocked)}
        >
          {allLocked ? t('wb.unlock') : t('wb.lock')}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setSelection([])}>
          {t('wb.deselect')}
        </Button>
      </div>

      <h4 className={styles.subhead}>{t('wb.arrange')}</h4>
      <div className={styles.iconRow}>
        {OFFSETS.map((item) => {
          const Icon = item.icon
          return (
            <button
              key={item.id}
              type="button"
              className={styles.iconButton}
              aria-label={t(item.labelKey)}
              title={t(item.labelKey)}
              onClick={() => arrange(item.id)}
            >
              <Icon aria-hidden="true" />
            </button>
          )
        })}
      </div>

      {objects.length > 1 ? (
        <>
          <h4 className={styles.subhead}>{t('wb.align')}</h4>
          <div className={styles.iconRow}>
            {ALIGNMENTS.map((item) => {
              const Icon = item.icon
              return (
                <button
                  key={item.id}
                  type="button"
                  className={styles.iconButton}
                  aria-label={t(item.labelKey)}
                  title={t(item.labelKey)}
                  onClick={() => align(item.id)}
                >
                  <Icon aria-hidden="true" />
                </button>
              )
            })}
          </div>
        </>
      ) : null}
    </section>
  )
}
