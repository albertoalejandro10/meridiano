// Drizzle's pg `numeric` columns are strings in and out. Format a JS number as a
// fixed(2) string for our numeric(14, 2) money columns (amount/balance/target).
export function toAmount(value: number): string {
  return value.toFixed(2)
}

// Drizzle's pg `date` columns use string mode ('yyyy-MM-dd', daily precision).
// `z.coerce.date()` parses a 'yyyy-MM-dd' input as UTC midnight, so we format the
// date part in UTC to round-trip without a timezone-induced off-by-one day.
// (This matches the previous Prisma `@db.Date` behaviour.)
export function toDateStr(value: Date): string {
  return value.toISOString().slice(0, 10)
}
