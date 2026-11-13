import type { ReactNode } from 'react'
import styles from './ui.module.css'

interface FieldProps {
  label: ReactNode
  hint?: ReactNode
  control: ReactNode
  htmlFor?: string
  stacked?: boolean
}

export function Field({ label, hint, control, htmlFor, stacked = false }: FieldProps) {
  return (
    <div className={stacked ? styles.fieldStacked : styles.field}>
      <div className={styles.fieldText}>
        <label className={styles.fieldLabel} htmlFor={htmlFor}>
          {label}
        </label>
        {hint ? <span className={styles.fieldHint}>{hint}</span> : null}
      </div>
      <div className={styles.fieldControl}>{control}</div>
    </div>
  )
}

interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  disabled?: boolean
  id?: string
}

export function Toggle({ checked, onChange, label, disabled, id }: ToggleProps) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      data-on={checked}
      className={styles.toggle}
      onClick={() => onChange(!checked)}
    />
  )
}

interface SegmentedOption<T extends string> {
  value: T
  label: ReactNode
  icon?: ReactNode
}

interface SegmentedProps<T extends string> {
  value: T
  options: ReadonlyArray<SegmentedOption<T>>
  onChange: (value: T) => void
  ariaLabel: string
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: SegmentedProps<T>) {
  return (
    <div className={styles.segmented} role="group" aria-label={ariaLabel}>
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            className={styles.segment}
            data-active={active}
            aria-pressed={active}
            onClick={() => onChange(option.value)}
          >
            {option.icon}
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

interface SelectControlProps {
  value: string
  onChange: (value: string) => void
  options: ReadonlyArray<{ value: string; label: string }>
  ariaLabel: string
  id?: string
}

export function SelectControl({ value, onChange, options, ariaLabel, id }: SelectControlProps) {
  return (
    <select
      id={id}
      className={styles.select}
      value={value}
      aria-label={ariaLabel}
      onChange={(event) => onChange(event.target.value)}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  )
}

interface SliderProps {
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
  label: string
  format?: (value: number) => string
  id?: string
}

export function Slider({ value, min, max, step, onChange, label, format, id }: SliderProps) {
  return (
    <div className={styles.sliderRow}>
      <div className={styles.sliderTop}>
        <label className={styles.fieldLabel} htmlFor={id}>
          {label}
        </label>
        <span className={styles.sliderValue}>{format ? format(value) : value}</span>
      </div>
      <input
        id={id}
        className={styles.slider}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
  )
}

interface ColorSwatchProps {
  color: string
  label: string
  active: boolean
  onSelect: () => void
}

export function ColorSwatch({ color, label, active, onSelect }: ColorSwatchProps) {
  return (
    <button
      type="button"
      className={styles.swatch}
      style={{ background: color }}
      data-active={active}
      aria-label={label}
      aria-pressed={active}
      title={label}
      onClick={onSelect}
    />
  )
}
