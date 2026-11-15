import type { FilterDefinition, FilterId } from './types'

/**
 * Filters are expressed as CSS filter functions so the preview and the saved
 * image run through exactly the same pipeline: the preview canvas is drawn
 * with `ctx.filter`, and the capture canvas is drawn with the same string.
 */
export const FILTERS: FilterDefinition[] = [
  {
    id: 'natural',
    labelKey: 'cam.filterNatural',
    ops: [],
    swatch: 'linear-gradient(135deg, #8fb8c9 0%, #d8c3a5 100%)',
  },
  {
    id: 'warm',
    labelKey: 'cam.filterWarm',
    ops: [
      { fn: 'sepia', from: 0, to: 0.42 },
      { fn: 'saturate', from: 1, to: 1.35 },
      { fn: 'hue-rotate', from: 0, to: -12, unit: 'deg' },
    ],
    swatch: 'linear-gradient(135deg, #d98b4f 0%, #f2c48c 100%)',
  },
  {
    id: 'cool',
    labelKey: 'cam.filterCool',
    ops: [
      { fn: 'hue-rotate', from: 0, to: 14, unit: 'deg' },
      { fn: 'saturate', from: 1, to: 1.18 },
      { fn: 'brightness', from: 1, to: 0.98 },
    ],
    swatch: 'linear-gradient(135deg, #4f7fd9 0%, #8cc8f2 100%)',
  },
  {
    id: 'bw',
    labelKey: 'cam.filterBw',
    ops: [{ fn: 'saturate', from: 1, to: 0 }],
    swatch: 'linear-gradient(135deg, #3a3f44 0%, #d7dade 100%)',
  },
  {
    id: 'vintage',
    labelKey: 'cam.filterVintage',
    ops: [
      { fn: 'sepia', from: 0, to: 0.46 },
      { fn: 'contrast', from: 1, to: 0.86 },
      { fn: 'brightness', from: 1, to: 1.06 },
      { fn: 'saturate', from: 1, to: 0.92 },
    ],
    swatch: 'linear-gradient(135deg, #7d6a4c 0%, #d8c49a 100%)',
  },
  {
    id: 'soft',
    labelKey: 'cam.filterSoft',
    ops: [
      { fn: 'contrast', from: 1, to: 0.84 },
      { fn: 'brightness', from: 1, to: 1.07 },
      { fn: 'saturate', from: 1, to: 0.94 },
    ],
    swatch: 'linear-gradient(135deg, #b9c2c9 0%, #f0ece7 100%)',
  },
  {
    id: 'contrast',
    labelKey: 'cam.filterContrast',
    ops: [
      { fn: 'contrast', from: 1, to: 1.5 },
      { fn: 'saturate', from: 1, to: 1.12 },
    ],
    swatch: 'linear-gradient(135deg, #11181d 0%, #f4f7f9 100%)',
  },
  {
    id: 'mono',
    labelKey: 'cam.filterMono',
    ops: [
      { fn: 'saturate', from: 1, to: 0 },
      { fn: 'contrast', from: 1, to: 1.18 },
      { fn: 'brightness', from: 1, to: 1.03 },
    ],
    swatch: 'linear-gradient(135deg, #2c3138 0%, #9aa3ad 100%)',
  },
]

const FILTER_MAP = new Map<FilterId, FilterDefinition>(FILTERS.map((filter) => [filter.id, filter]))

export function filterById(id: FilterId): FilterDefinition {
  return FILTER_MAP.get(id) ?? FILTERS[0]!
}

/** Builds the CSS filter string for a filter at a given strength (0…1). */
export function filterCss(filter: FilterDefinition, strength: number): string {
  if (filter.ops.length === 0) return 'none'
  const amount = Math.min(1, Math.max(0, strength))
  return filter.ops
    .map((op) => `${op.fn}(${lerp(op.from, op.to, amount).toFixed(3)}${op.unit ?? ''})`)
    .join(' ')
}

function lerp(from: number, to: number, amount: number): number {
  return from + (to - from) * amount
}
