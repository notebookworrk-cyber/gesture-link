import { describe, expect, it } from 'vitest'
import { FILTERS, filterById, filterCss } from '@/photos/filters'

describe('photo filters', () => {
  it('ships the eight filters from the specification', () => {
    expect(FILTERS.map((filter) => filter.id)).toEqual([
      'natural',
      'warm',
      'cool',
      'bw',
      'vintage',
      'soft',
      'contrast',
      'mono',
    ])
  })

  it('gives every filter a unique id and a translation key', () => {
    const ids = new Set(FILTERS.map((filter) => filter.id))
    expect(ids.size).toBe(FILTERS.length)
    for (const filter of FILTERS) {
      expect(filter.labelKey.startsWith('cam.filter')).toBe(true)
    }
  })

  it('leaves the natural filter untouched', () => {
    expect(filterCss(filterById('natural'), 1)).toBe('none')
  })

  it('applies the start values at strength zero', () => {
    const css = filterCss(filterById('warm'), 0)
    expect(css).toContain('sepia(0.000)')
    expect(css).toContain('saturate(1.000)')
    expect(css).toContain('hue-rotate(0.000deg)')
  })

  it('applies the end values at strength one', () => {
    const css = filterCss(filterById('warm'), 1)
    expect(css).toContain('sepia(0.420)')
    expect(css).toContain('saturate(1.350)')
    expect(css).toContain('hue-rotate(-12.000deg)')
  })

  it('clamps the strength into the 0…1 range', () => {
    expect(filterCss(filterById('contrast'), -2)).toBe(
      filterCss(filterById('contrast'), 0),
    )
    expect(filterCss(filterById('contrast'), 5)).toBe(
      filterCss(filterById('contrast'), 1),
    )
  })

  it('keeps a mid strength between the two ends', () => {
    const css = filterCss(filterById('vintage'), 0.5)
    expect(css).toContain('sepia(0.230)')
    expect(css).toContain('contrast(0.930)')
  })

  it('desaturates the black and white filter completely', () => {
    expect(filterCss(filterById('bw'), 1)).toContain('saturate(0.000)')
  })
})
