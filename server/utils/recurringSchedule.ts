import { db } from '@nuxthub/db'
import { addMonths, addWeeks, addYears } from 'date-fns'
import type { Cadence, OccurrenceStatus, TransactionType } from '~~/shared/schemas'

// Due dates for recurring templates are *derived*, never stored: occurrence n is
// the template's startDate stepped n times by its cadence. A due date on or
// before today with no recurring_occurrences row is "pending" — the user is
// asked whether they paid it (see the table comment in server/db/schema.ts).
//
// Nothing here writes: confirming is what creates transactions.

// How many pending occurrences one template may contribute. A template started
// years back would otherwise flood the review; the rest surface as the user
// answers (or skips) their way forward.
const MAX_PENDING_PER_TEMPLATE = 120
// Pure infinite-loop guard — the real bound is `upTo`/endDate.
const MAX_STEPS = 5000
// How far ahead `upcomingOccurrences` looks by default: enough to cover the rest
// of any month (the budgets "committed" figure) plus the next one.
export const UPCOMING_HORIZON_DAYS = 62

// --- 'yyyy-MM-dd' <-> Date, in local time ---
// pg `date` columns are plain calendar days with no timezone. date-fns steps
// operate on local calendar fields, so we parse and format with local
// components too — round-tripping through toISOString() would shift the day in
// any timezone behind UTC. (toDateStr() in serialize.ts is the UTC counterpart,
// correct for `z.coerce.date()` values, which parse 'yyyy-MM-dd' as UTC midnight.
// The two must never be mixed on the same value.)
export function parseDay(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number) as [number, number, number]
  return new Date(year, month - 1, day)
}

export function formatDay(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

export function todayStr(): string {
  return formatDay(new Date())
}

// Occurrence n, always measured from the anchor rather than by iterating the
// previous result — stepping month by month would let a Jan 31 template drift
// permanently to the 28th after one February. date-fns clamps overflow per step,
// so from the anchor Jan 31 gives Feb 28, then Mar 31 again.
export function stepFrom(anchor: Date, cadence: Cadence, n: number): Date {
  switch (cadence) {
    case 'WEEKLY': return addWeeks(anchor, n)
    case 'BIWEEKLY': return addWeeks(anchor, n * 2)
    case 'MONTHLY': return addMonths(anchor, n)
    case 'QUARTERLY': return addMonths(anchor, n * 3)
    case 'YEARLY': return addYears(anchor, n)
  }
}

export interface SchedulableTemplate {
  id: string
  cadence: Cadence
  startDate: string
  endDate: string | null
}

// Every due date in [from, to] (inclusive, 'yyyy-MM-dd' strings compare
// lexicographically because the format is zero-padded), bounded by endDate.
export function dueDatesFor(template: SchedulableTemplate, from: string, to: string): string[] {
  const limit = template.endDate && template.endDate < to ? template.endDate : to
  if (limit < template.startDate) return []

  const anchor = parseDay(template.startDate)
  const dates: string[] = []
  for (let n = 0; n < MAX_STEPS; n++) {
    const due = formatDay(stepFrom(anchor, template.cadence, n))
    if (due > limit) break
    if (due >= from) dates.push(due)
  }
  return dates
}

export interface PendingOccurrence {
  recurringId: string
  description: string
  dueDate: string
  type: TransactionType
  accountId: string
  accountName: string
  currency: string
  categoryId: string | null
  categoryName: string | null
  // Seeded categories are rendered from the slug (categories.defaults.<slug>);
  // categoryName is the fallback for ones the user created.
  categorySlug: string | null
  // The template's optional estimate, and what this bill actually cost last time
  // it was paid. The review form prefills `lastPaidAmount ?? estimate` — prices
  // drift, so the most recent real figure is the better guess.
  estimate: number | null
  lastPaidAmount: number | null
}

export interface AnsweredOccurrence {
  id: string
  recurringId: string
  description: string
  dueDate: string
  status: OccurrenceStatus
  note: string | null
  currency: string
  amount: number | null
  transactionId: string | null
}

// Templates that can come due: enabled, and not on an archived account (an
// archived account is a closed one — its bills can't still be arriving).
async function schedulableTemplates(userId: string) {
  const templates = await db.query.recurringTransactions.findMany({
    where: (r, { and, eq }) => and(eq(r.userId, userId), eq(r.enabled, true)),
    with: {
      account: { columns: { id: true, name: true, currency: true, archived: true } },
      category: { columns: { id: true, name: true, slug: true } },
    },
  })
  return templates.filter(t => !t.account.archived)
}

// All answered occurrences for the user, with the amount of the transaction a
// PAID answer created. Small per user — grouped in JS rather than in SQL.
async function answeredOccurrences(userId: string) {
  return db.query.recurringOccurrences.findMany({
    where: (o, { eq }) => eq(o.userId, userId),
    with: { transaction: { columns: { amount: true } } },
    orderBy: (o, { desc }) => [desc(o.dueDate), desc(o.createdAt)],
  })
}

interface TemplateHistory {
  answered: Set<string>
  lastPaidAmount: number | null
}

// Per template: which due dates already have an answer, and the most recent
// actually-paid amount (rows are pre-sorted by dueDate desc, so the first PAID
// hit wins).
function historyByTemplate(rows: Awaited<ReturnType<typeof answeredOccurrences>>) {
  const map = new Map<string, TemplateHistory>()
  for (const row of rows) {
    let history = map.get(row.recurringId)
    if (!history) {
      history = { answered: new Set(), lastPaidAmount: null }
      map.set(row.recurringId, history)
    }
    history.answered.add(row.dueDate)
    if (history.lastPaidAmount === null && row.status === 'PAID' && row.transaction) {
      history.lastPaidAmount = Number(row.transaction.amount)
    }
  }
  return map
}

// Everything due on or before today that the user hasn't answered yet, oldest
// first — the review queue.
export async function pendingOccurrences(userId: string): Promise<PendingOccurrence[]> {
  const [templates, answered] = await Promise.all([
    schedulableTemplates(userId),
    answeredOccurrences(userId),
  ])
  const history = historyByTemplate(answered)
  const today = todayStr()

  const pending: PendingOccurrence[] = []
  for (const template of templates) {
    const seen = history.get(template.id)
    const dates = dueDatesFor(template, template.startDate, today)
      .filter(due => !seen?.answered.has(due))
      .slice(0, MAX_PENDING_PER_TEMPLATE)

    for (const dueDate of dates) {
      pending.push({
        recurringId: template.id,
        description: template.description,
        dueDate,
        type: template.type,
        accountId: template.accountId,
        accountName: template.account.name,
        currency: template.account.currency,
        categoryId: template.categoryId,
        categoryName: template.category?.name ?? null,
        categorySlug: template.category?.slug ?? null,
        estimate: template.amount === null ? null : Number(template.amount),
        lastPaidAmount: seen?.lastPaidAmount ?? null,
      })
    }
  }

  return pending.sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.description.localeCompare(b.description))
}

// Same shape as a pending one — only the side of "today" it falls on differs.
export type UpcomingOccurrence = PendingOccurrence

// Due dates still ahead of us, for the forecast and the budgets "committed"
// figure. Same shape as pending so both can share the estimate helper.
export async function upcomingOccurrences(
  userId: string,
  horizonDays = UPCOMING_HORIZON_DAYS,
): Promise<UpcomingOccurrence[]> {
  const [templates, answered] = await Promise.all([
    schedulableTemplates(userId),
    answeredOccurrences(userId),
  ])
  const history = historyByTemplate(answered)

  const now = new Date()
  const from = formatDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1))
  const to = formatDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() + horizonDays))

  const upcoming: UpcomingOccurrence[] = []
  for (const template of templates) {
    const seen = history.get(template.id)
    for (const dueDate of dueDatesFor(template, from, to)) {
      if (seen?.answered.has(dueDate)) continue
      upcoming.push({
        recurringId: template.id,
        description: template.description,
        dueDate,
        type: template.type,
        accountId: template.accountId,
        accountName: template.account.name,
        currency: template.account.currency,
        categoryId: template.categoryId,
        categoryName: template.category?.name ?? null,
        categorySlug: template.category?.slug ?? null,
        estimate: template.amount === null ? null : Number(template.amount),
        lastPaidAmount: seen?.lastPaidAmount ?? null,
      })
    }
  }

  return upcoming.sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.description.localeCompare(b.description))
}

// The best available guess at what an occurrence will cost: what it cost last
// time, else the template's estimate. Null when the user has given us neither.
export function expectedAmount(occurrence: Pick<PendingOccurrence, 'estimate' | 'lastPaidAmount'>): number | null {
  return occurrence.lastPaidAmount ?? occurrence.estimate
}
