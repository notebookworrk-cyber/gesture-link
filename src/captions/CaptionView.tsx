import type { CaptionLine, CaptionSettings } from './types'
import styles from './captions.module.css'

export interface CaptionViewProps {
  lines: CaptionLine[]
  settings: CaptionSettings
  /** Accessibility size override from the settings store. */
  size: 'sm' | 'md' | 'lg'
  /** Text shown when there is nothing to display yet. */
  placeholder?: string
}

const SIZE_SCALE: Record<'sm' | 'md' | 'lg', number> = {
  sm: 0.85,
  md: 1,
  lg: 1.25,
}

/**
 * Renders the caption lines. The appearance comes entirely from the caption
 * settings, so the same component is used by the reader and by the settings
 * preview.
 */
export function CaptionView({ lines, settings, size, placeholder }: CaptionViewProps) {
  const scale = SIZE_SCALE[size]
  const visible = lines.slice(-settings.maxLines)

  return (
    <div
      className={styles.caption}
      data-position={settings.position}
      data-visible={settings.visible}
      data-outline={settings.outline}
      style={{
        fontSize: `${Math.round(settings.fontSize * scale)}px`,
        fontWeight: settings.fontWeight,
        color: settings.textColor,
        backgroundColor: hexToRgba(settings.backgroundColor, settings.backgroundOpacity),
        fontFamily:
          settings.fontFamily === 'mono'
            ? 'var(--font-mono)'
            : settings.fontFamily === 'serif'
              ? 'Georgia, "Times New Roman", serif'
              : 'var(--font-ui)',
        lineHeight: 1 + settings.lineSpacing / 20,
        wordSpacing: `${settings.wordSpacing}px`,
      }}
      aria-live={settings.mode === 'live' ? 'polite' : 'off'}
    >
      {visible.length === 0 ? (
        <span className={styles.placeholder}>{placeholder ?? ''}</span>
      ) : (
        visible.map((line) => (
          <span key={line.id} className={styles.line} data-final={line.final}>
            <span className={styles.text}>{line.text}</span>
            {line.secondary ? <span className={styles.secondary}>{line.secondary}</span> : null}
          </span>
        ))
      )}
    </div>
  )
}

/** Converts a hex colour into an rgba string with the given opacity. */
export function hexToRgba(hex: string, opacity: number): string {
  const value = hex.replace('#', '')
  const full =
    value.length === 3
      ? value
          .split('')
          .map((char) => char + char)
          .join('')
      : value
  if (full.length !== 6) return hex
  const red = parseInt(full.slice(0, 2), 16)
  const green = parseInt(full.slice(2, 4), 16)
  const blue = parseInt(full.slice(4, 6), 16)
  const alpha = Math.max(0, Math.min(1, opacity))
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`
}
