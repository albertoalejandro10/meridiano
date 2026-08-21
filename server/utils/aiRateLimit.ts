import { db, schema } from '@nuxthub/db'
import { and, count, eq, gte, ne } from 'drizzle-orm'

export type AiGenerationKind = 'digest' | 'debt_coaching' | 'goal_coaching' | 'chat'

// Cheap safety net, not real cost control — at today's scale (a handful of
// trusted users) this is about catching a runaway client loop, not budget
// enforcement. One shared daily budget across the one-shot AI features
// (digest, debt coaching, goal coaching), not a separate cap per feature.
// Chat is accounted separately below — a multi-turn conversation would blow
// through this in a couple of messages otherwise.
const DAILY_LIMIT = 20
const DAY_MS = 24 * 60 * 60 * 1000

export async function assertUnderDailyAiLimit(userId: string): Promise<void> {
  const since = new Date(Date.now() - DAY_MS)
  const [usage] = await db
    .select({ value: count() })
    .from(schema.aiGenerations)
    .where(and(
      eq(schema.aiGenerations.userId, userId),
      gte(schema.aiGenerations.createdAt, since),
      ne(schema.aiGenerations.kind, 'chat'),
    ))
  if ((usage?.value ?? 0) >= DAILY_LIMIT) {
    throw createError({ statusCode: 429, statusMessage: 'Daily AI usage limit reached. Try again tomorrow.' })
  }
}

// Chat's own daily budget — one row per user-submitted message, regardless
// of how many tool round-trips happen inside that turn.
const CHAT_DAILY_LIMIT = 100

export async function assertUnderDailyChatLimit(userId: string): Promise<void> {
  const since = new Date(Date.now() - DAY_MS)
  const [usage] = await db
    .select({ value: count() })
    .from(schema.aiGenerations)
    .where(and(
      eq(schema.aiGenerations.userId, userId),
      eq(schema.aiGenerations.kind, 'chat'),
      gte(schema.aiGenerations.createdAt, since),
    ))
  if ((usage?.value ?? 0) >= CHAT_DAILY_LIMIT) {
    throw createError({ statusCode: 429, statusMessage: 'Daily chat usage limit reached. Try again tomorrow.' })
  }
}

/**
 * Records one generation against the daily budget. `content`/`locale` are only
 * passed by the digest, which reuses this row as its cache (see the table
 * comment in server/db/schema.ts) — every row counts toward the limit either
 * way.
 */
export async function recordAiGeneration(
  userId: string,
  kind: AiGenerationKind,
  cache?: { content: string, locale: 'en' | 'es' },
): Promise<void> {
  await db.insert(schema.aiGenerations).values({ userId, kind, ...cache })
}

/** Newest cached digest for this locale, or null if there isn't one yet. */
export async function findCachedDigest(userId: string, locale: 'en' | 'es') {
  const row = await db.query.aiGenerations.findFirst({
    where: (g, { and, eq, isNotNull }) => and(
      eq(g.userId, userId),
      eq(g.kind, 'digest'),
      eq(g.locale, locale),
      isNotNull(g.content),
    ),
    orderBy: (g, { desc }) => [desc(g.createdAt)],
    columns: { content: true, createdAt: true },
  })
  if (!row?.content) return null
  return { digest: row.content, generatedAt: row.createdAt.toISOString() }
}
