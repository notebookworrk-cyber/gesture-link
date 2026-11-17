import { describe, expect, it } from 'vitest'
import { serializeHistory, type HistoryEntry } from '@/signs/history'

const entry: HistoryEntry = {
  id: 'h_1',
  text: 'HELLO',
  labelId: 'label-1',
  confidence: 0.8,
  mode: 'model',
  at: Date.UTC(2026, 10, 17, 10, 30, 0),
}

describe('history export', () => {
  it('writes a valid JSON document with ISO timestamps', () => {
    const exported = Date.UTC(2026, 10, 17, 11, 0, 0)
    const payload = JSON.parse(serializeHistory([entry], exported))
    expect(payload.app).toBe('GestureLink')
    expect(payload.exportedAt).toBe('2026-11-17T11:00:00.000Z')
    expect(payload.entries).toHaveLength(1)
    expect(payload.entries[0]).toEqual({
      id: 'h_1',
      text: 'HELLO',
      labelId: 'label-1',
      mode: 'model',
      confidence: 0.8,
      at: '2026-11-17T10:30:00.000Z',
    })
  })

  it('keeps the reader order instead of sorting the entries', () => {
    const second: HistoryEntry = { ...entry, id: 'h_2', text: 'WORLD', at: entry.at + 1000 }
    const payload = JSON.parse(serializeHistory([second, entry], Date.now()))
    expect(payload.entries.map((item: { id: string }) => item.id)).toEqual(['h_2', 'h_1'])
  })

  it('exports an empty list honestly', () => {
    const payload = JSON.parse(serializeHistory([], Date.now()))
    expect(payload.entries).toEqual([])
  })
})
