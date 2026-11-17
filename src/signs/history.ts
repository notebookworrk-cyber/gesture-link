import type { PredictionSource } from '@/recognition/types'

/** One committed reading in the reader's in-memory history. */
export interface HistoryEntry {
  id: string
  text: string
  labelId: string
  confidence: number
  mode: PredictionSource
  at: number
}

/**
 * Serialises the reading history for export. Timestamps are ISO strings so the
 * file stays readable outside the browser; nothing is inferred or added.
 */
export function serializeHistory(entries: HistoryEntry[], exportedAt: number): string {
  return JSON.stringify(
    {
      app: 'GestureLink',
      exportedAt: new Date(exportedAt).toISOString(),
      entries: entries.map((entry) => ({
        id: entry.id,
        text: entry.text,
        labelId: entry.labelId,
        mode: entry.mode,
        confidence: entry.confidence,
        at: new Date(entry.at).toISOString(),
      })),
    },
    null,
    2,
  )
}
