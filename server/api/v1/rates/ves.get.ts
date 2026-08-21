// Current VES/USD reference rates. Each source degrades to null independently
// so the UI can fall back to manual entry for just the one that's down.
export default defineEventHandler(async () => {
  const [bcv, binance] = await Promise.allSettled([getBcvRate(), getBinanceRate()])
  return {
    bcv: bcv.status === 'fulfilled' ? bcv.value : null,
    binance: binance.status === 'fulfilled' ? binance.value : null,
  }
})
