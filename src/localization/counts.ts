import type { TranslateFn } from './i18n'
import type { MessageKey } from './locales/en'

type NumberFormatter = (value: number, options?: Intl.NumberFormatOptions) => string

function countLabel(
  t: TranslateFn,
  formatNumber: NumberFormatter,
  keys: { one: MessageKey; other: MessageKey },
  count: number,
): string {
  return t(count === 1 ? keys.one : keys.other, { count: formatNumber(count) })
}

/**
 * Counted nouns are phrased explicitly instead of relying on the browser's
 * plural rules: the catalogue has one labelled form per number, so a single
 * object never renders as "1 objects" in any shipped language.
 */
export const objectsLabel = (t: TranslateFn, formatNumber: NumberFormatter, count: number) =>
  countLabel(t, formatNumber, { one: 'wb.objectCountOne', other: 'wb.objectCount' }, count)

export const pagesLabel = (t: TranslateFn, formatNumber: NumberFormatter, count: number) =>
  countLabel(t, formatNumber, { one: 'wb.pageCountOne', other: 'wb.pageCount' }, count)
