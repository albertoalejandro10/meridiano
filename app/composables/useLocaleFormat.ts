import { es } from 'date-fns/locale'
import { formatFullDate, formatMoney, formatMoneyByCurrency, formatMonth, formatShortDate } from '~/utils'
import type { DateFormatOptions, DateWidth } from '~/utils/dates'

// Number grouping/decimals per app locale ("1,200.00" vs "1.200,00").
export const NUMBER_LOCALES: Record<string, string> = { en: 'en-US', es: 'es-ES' }

// date-fns locale per app locale (en uses date-fns defaults). The locale object
// localizes month names and the 'PP' full-date layout; only the year-less short
// date needs an explicit pattern (see DateFormatOptions).
const DATE_OPTIONS: Record<string, DateFormatOptions | undefined> = {
  en: undefined,
  es: { locale: es, shortPattern: 'd MMM' },
}

/**
 * Locale-aware drop-ins for the money/date formatters in `~/utils`. Destructure
 * in component setup — the setup binding shadows the auto-imported util, so
 * template call sites stay unchanged and re-render on locale switch (the
 * closures read `locale.value` at call time).
 */
export function useLocaleFormat() {
  const { locale } = useI18n()

  return {
    formatMoney: (amount: number, currency: string) =>
      formatMoney(amount, currency, NUMBER_LOCALES[locale.value]),
    formatMoneyByCurrency: (totals: { currency: string, total: number }[]) =>
      formatMoneyByCurrency(totals, NUMBER_LOCALES[locale.value]),
    formatShortDate: (date: Date | number | string) =>
      formatShortDate(date, DATE_OPTIONS[locale.value]),
    formatMonth: (month: Date | string) =>
      formatMonth(month, DATE_OPTIONS[locale.value]),
    formatFullDate: (date: Date | number | string, width?: DateWidth) =>
      formatFullDate(date, { ...DATE_OPTIONS[locale.value], width }),
    formatRelativeTime: (date: Date | number | string) =>
      formatRelativeTime(date, NUMBER_LOCALES[locale.value]),
  }
}

// Coarse "2 hours ago" / "hace 2 horas" for things whose exact timestamp
// doesn't matter, only their staleness (currently the cached AI digest).
// Anything older than a week reads better as a date, so callers get one.
function formatRelativeTime(date: Date | number | string, numberLocale = 'en-US'): string {
  const then = new Date(date).getTime()
  const diffSeconds = Math.round((then - Date.now()) / 1000)
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['second', 60],
    ['minute', 60],
    ['hour', 24],
    ['day', 7],
  ]

  let value = diffSeconds
  for (const [unit, step] of units) {
    if (Math.abs(value) < step) {
      return new Intl.RelativeTimeFormat(numberLocale, { numeric: 'auto' }).format(value, unit)
    }
    value = Math.round(value / step)
  }
  return new Intl.DateTimeFormat(numberLocale, { dateStyle: 'medium' }).format(then)
}
