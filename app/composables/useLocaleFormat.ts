import { es } from 'date-fns/locale'
import { formatFullDate, formatMoney, formatMoneyByCurrency, formatShortDate } from '~/utils'
import type { DateFormatOptions } from '~/utils/dates'

// Number grouping/decimals per app locale ("1,200.00" vs "1.200,00").
export const NUMBER_LOCALES: Record<string, string> = { en: 'en-US', es: 'es-VE' }

// date-fns locale + pattern order per app locale (en uses date-fns defaults).
const DATE_OPTIONS: Record<string, DateFormatOptions | undefined> = {
  en: undefined,
  es: { locale: es, patterns: { short: 'd MMM', full: 'd MMM yyyy' } },
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
    formatFullDate: (date: Date | number | string) =>
      formatFullDate(date, DATE_OPTIONS[locale.value]),
  }
}
