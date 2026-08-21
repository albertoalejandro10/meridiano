// Categorical chart palette — CSS variables defined in app/assets/css/main.css
// (light and dark pick their own validated steps). Slots are assigned by rank
// in fixed order and never cycled: anything past the 8th folds into "Other".
export const chartColors = Array.from({ length: 8 }, (_, i) => `var(--chart-${i + 1})`)
export const chartOtherColor = 'var(--chart-other)'

// Buckets for the net-worth-by-type stacked chart (mirrors NetWorthGroup on the
// server). Liabilities wear the error color — they pull net worth down.
export const netWorthGroupColors = {
  cash: 'var(--chart-1)',
  investments: 'var(--chart-3)',
  property: 'var(--chart-2)',
  liabilities: 'var(--ui-error)',
} as const
export type NetWorthGroupKey = keyof typeof netWorthGroupColors
