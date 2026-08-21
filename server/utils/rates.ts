// VES/USD reference rates from public endpoints (BCV official + Binance P2P).
// Each source is cached independently and THROWS on failure — Nitro never caches
// a thrown error, so a down API is retried on the next request while the other
// source keeps serving from its cache.

const RATE_TTL = 60 * 5 // seconds

export interface VesRate {
  /** VES per 1 USD */
  rate: number
  /** ISO timestamp of the source's last update (Binance: fetch time) */
  updatedAt: string
}

export const getBcvRate = defineCachedFunction(async (): Promise<VesRate> => {
  const res = await $fetch<{ promedio: number, fechaActualizacion: string }>(
    'https://ve.dolarapi.com/v1/dolares/oficial',
    { timeout: 5000, retry: 0 },
  )
  if (!Number.isFinite(res.promedio) || res.promedio <= 0) {
    throw new Error('BCV rate: unexpected payload')
  }
  return { rate: res.promedio, updatedAt: res.fechaActualizacion }
}, { name: 'rates', getKey: () => 'bcv', maxAge: RATE_TTL })

export const getBinanceRate = defineCachedFunction(async (): Promise<VesRate> => {
  // Public (unauthenticated) P2P ad search. SELL = ads selling USDT for VES,
  // i.e. the rate at which the user's USD(T) converts into bolívares.
  const res = await $fetch<{ data?: { adv: { price: string } }[] }>(
    'https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search',
    {
      method: 'POST',
      timeout: 5000,
      retry: 0,
      body: { asset: 'USDT', fiat: 'VES', tradeType: 'SELL', page: 1, rows: 10, payTypes: [], publisherType: null },
    },
  )
  const prices = (res.data ?? [])
    .map(ad => Number(ad.adv?.price))
    .filter(p => Number.isFinite(p) && p > 0)
    .sort((a, b) => a - b)
  if (prices.length === 0) throw new Error('Binance P2P rate: no usable ads')

  // Median of the first page of ads — robust against a single outlier ad.
  const mid = Math.floor(prices.length / 2)
  const median = prices.length % 2 ? prices[mid]! : (prices[mid - 1]! + prices[mid]!) / 2
  return { rate: median, updatedAt: new Date().toISOString() }
}, { name: 'rates', getKey: () => 'binance', maxAge: RATE_TTL })
