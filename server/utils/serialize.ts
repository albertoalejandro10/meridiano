// Drizzle's pg `numeric` columns are strings in and out. Format a JS number as a
// fixed(2) string for our numeric(14, 2) money columns (amount/balance/target).
export function toAmount(value: number): string {
  return value.toFixed(2)
}

// FX-rate variant for numeric(14, 4) columns (VES per USD needs sub-cent precision).
export function toRate(value: number): string {
  return value.toFixed(4)
}

// Fractional item quantities ("1.5 kg") for numeric(10, 3) columns.
export function toQty(value: number): string {
  return value.toFixed(3)
}

// Drizzle's pg `date` columns use string mode ('yyyy-MM-dd', daily precision).
// `z.coerce.date()` parses a 'yyyy-MM-dd' input as UTC midnight, so we format the
// date part in UTC to round-trip without a timezone-induced off-by-one day.
// (This matches the previous Prisma `@db.Date` behaviour.)
export function toDateStr(value: Date): string {
  return value.toISOString().slice(0, 10)
}
