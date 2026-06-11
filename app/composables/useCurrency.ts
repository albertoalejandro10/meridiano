const SYMBOLS: Record<string, string> = { USD: '$', EUR: '€', VES: 'Bs.' }

export function formatMoney(amount: number, currency: string) {
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
  return `${SYMBOLS[currency] ?? currency} ${formatted}`
}
