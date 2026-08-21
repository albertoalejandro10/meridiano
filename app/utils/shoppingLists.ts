// The "brecha": how far the parallel (Binance P2P) rate sits above the official
// (BCV) rate, as a percentage of the official rate. A wider gap means selling
// dollars on the parallel market stretches them further — you need fewer USD to
// cover the same bolívares, so it's a better moment to sell.

export type BrechaStatus = 'wide' | 'moderate' | 'narrow' | 'inverted'

// Thresholds (percentage points) for the sell-timing signal. Grounded in the
// typical BCV-vs-parallel gap in Venezuela; not a market prediction.
const WIDE_GAP = 15
const MODERATE_GAP = 6

export interface RateBrecha {
  /** (binance − bcv) / bcv, as a percentage (can be negative if inverted). */
  pct: number
  status: BrechaStatus
  /** Short pill; render with t(labelKey). */
  badge: { labelKey: string, color: 'success' | 'warning' | 'neutral' }
  /** Sentence advising whether it's a good time to sell; interpolates { pct }. */
  messageKey: string
}

export function rateBrecha(bcv?: number | null, binance?: number | null): RateBrecha | null {
  if (!bcv || !binance || bcv <= 0 || binance <= 0) return null

  const pct = ((binance - bcv) / bcv) * 100

  let status: BrechaStatus
  if (pct < 0) status = 'inverted'
  else if (pct >= WIDE_GAP) status = 'wide'
  else if (pct >= MODERATE_GAP) status = 'moderate'
  else status = 'narrow'

  const badge: Record<BrechaStatus, RateBrecha['badge']> = {
    wide: { labelKey: 'shoppingLists.brecha.badge.wide', color: 'success' },
    moderate: { labelKey: 'shoppingLists.brecha.badge.moderate', color: 'warning' },
    narrow: { labelKey: 'shoppingLists.brecha.badge.narrow', color: 'neutral' },
    inverted: { labelKey: 'shoppingLists.brecha.badge.inverted', color: 'neutral' },
  }

  return { pct, status, badge: badge[status], messageKey: `shoppingLists.brecha.${status}` }
}
