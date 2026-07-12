export * from './dates'

const CURRENCY_SYMBOLS: Record<string, string> = { USD: '$', EUR: '€', VES: 'Bs.' }

export function formatMoney(amount: number, currency: string, locale = 'en-US') {
  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
  return `${CURRENCY_SYMBOLS[currency] ?? currency} ${formatted}`
}

export function currencySymbol(currency?: string | null) {
  return (currency && CURRENCY_SYMBOLS[currency]) || '$'
}

export function formatPercent(value: number, total: number) {
  if (total <= 0) return '0%'
  return `${((value / total) * 100).toFixed(0)}%`
}

// There are no FX rates in the app, so amounts in different currencies are never
// added together — totals are always reported per currency.
export function sumByCurrency<T extends { currency: string }>(
  items: T[],
  value: (item: T) => number,
): { currency: string, total: number }[] {
  const totals = new Map<string, number>()
  for (const item of items) {
    totals.set(item.currency, (totals.get(item.currency) ?? 0) + value(item))
  }
  return [...totals].map(([currency, total]) => ({ currency, total }))
}

/** "$ 1,200.00 · Bs. 3,000.00" — compact display for per-currency totals */
export function formatMoneyByCurrency(totals: { currency: string, total: number }[], locale?: string) {
  return totals.map(t => formatMoney(t.total, t.currency, locale)).join(' · ')
}

export function percentOf(value: number, total: number) {
  return total > 0 ? (value / total) * 100 : 0
}
