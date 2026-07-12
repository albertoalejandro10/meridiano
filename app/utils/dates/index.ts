import { format, parseISO, startOfDay, subDays } from 'date-fns'
import type { Locale } from 'date-fns'

// Per-locale display patterns: English "Jun 11" / "Jun 11, 2026", Spanish
// "11 jun" / "11 jun 2026". `locale` drives month names, `patterns` the order.
export interface DateFormatOptions {
  locale?: Locale
  patterns?: { short: string, full: string }
}
const DEFAULT_PATTERNS = { short: 'MMM d', full: 'MMM d, yyyy' }

/**
 * Parse into a local Date. API dates are 'yyyy-MM-dd' strings; `new Date(str)`
 * would read them as UTC midnight, which shifts the calendar day for anyone
 * west of UTC — `parseISO` reads date-only strings as *local* midnight instead.
 */
export function parseDate(date: Date | number | string) {
  return typeof date === 'string' ? parseISO(date) : new Date(date)
}

/** "Jun 11" — chart axis ticks and compact UI dates */
export function formatShortDate(date: Date | number | string, opts?: DateFormatOptions) {
  return format(parseDate(date), opts?.patterns?.short ?? DEFAULT_PATTERNS.short, { locale: opts?.locale })
}

/** "Jun 11, 2026" — full display date */
export function formatFullDate(date: Date | number | string, opts?: DateFormatOptions) {
  return format(parseDate(date), opts?.patterns?.full ?? DEFAULT_PATTERNS.full, { locale: opts?.locale })
}

/** "2026-06-11" — API/form payloads (local calendar day) */
export function toISODate(date: Date | number | string) {
  return format(parseDate(date), 'yyyy-MM-dd')
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
