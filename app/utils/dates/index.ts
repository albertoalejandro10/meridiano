import { addMonths, differenceInCalendarDays, format, parseISO, startOfDay, subDays } from 'date-fns'
import type { Locale } from 'date-fns'

// `locale` is a date-fns Locale (e.g. `es` from 'date-fns/locale'): it drives
// month names AND the full-date layout via the localized 'P' tokens. Only the
// compact date needs `shortPattern` — date-fns has no localized token without
// a year ("Jun 11" vs "11 jun").
export interface DateFormatOptions {
  locale?: Locale
  shortPattern?: string
}

/** date-fns localized date widths: 'P' 06/11/2026 · 'PP' Jun 11, 2026 · 'PPP' June 11th, 2026 · 'PPPP' Thursday, June 11th, 2026 */
export type DateWidth = 'P' | 'PP' | 'PPP' | 'PPPP'

/**
 * Parse into a local Date. API dates are 'yyyy-MM-dd' strings; `new Date(str)`
 * would read them as UTC midnight, which shifts the calendar day for anyone
 * west of UTC — `parseISO` reads date-only strings as *local* midnight instead.
 */
export function parseDate(date: Date | number | string) {
  return typeof date === 'string' ? parseISO(date) : new Date(date)
}

/** "Jun 11" (en) / "11 jun" (es) — chart axis ticks and compact UI dates */
export function formatShortDate(date: Date | number | string, opts?: DateFormatOptions) {
  return format(parseDate(date), opts?.shortPattern ?? 'MMM d', { locale: opts?.locale })
}

/** "Jun 11, 2026" (en) / "11 jun 2026" (es) — localized via date-fns 'P' tokens; pass `width` for shorter/longer forms */
export function formatFullDate(date: Date | number | string, opts?: DateFormatOptions & { width?: DateWidth }) {
  return format(parseDate(date), opts?.width ?? 'PP', { locale: opts?.locale })
}

/** "Jun 2026" (en) / "jun 2026" (es) — month-bucket labels ('yyyy-MM' or a Date) */
export function formatMonth(month: Date | string, opts?: DateFormatOptions) {
  const date = typeof month === 'string' ? parseDate(`${month}-01`) : month
  return format(date, 'MMM yyyy', { locale: opts?.locale })
}

/** Shift a 'yyyy-MM' month bucket by `delta` months ("2026-07" + 1 → "2026-08") */
export function shiftMonthStr(month: string, delta: number) {
  return format(addMonths(parseDate(`${month}-01`), delta), 'yyyy-MM')
}

/** "2026-06-11" — API/form payloads (local calendar day) */
export function toISODate(date: Date | number | string) {
  return format(parseDate(date), 'yyyy-MM-dd')
}

/** Whole calendar days from `date` until today (0 = today, 1 = yesterday) */
export function daysSince(date: Date | number | string) {
  return differenceInCalendarDays(today(), parseDate(date))
}

/** Today at 00:00 local time */
export function today() {
  return startOfDay(new Date())
}

/** The last `n` days (oldest first), each at 00:00 local time */
export function lastNDays(n: number) {
  const end = today()
  return Array.from({ length: n }, (_, i) => subDays(end, n - 1 - i))
}
