import { db, schema } from '@nuxthub/db'
import { and, arrayContains, eq, ilike, or } from 'drizzle-orm'
import { noteQuerySchema } from '~~/shared/schemas'

// The (optionally filtered) note list plus the user's full tag vocabulary.
// The vocabulary is computed over *all* their notes, never the filtered set:
// the chips have to keep offering the tags you could switch to, and the one
// you already picked — a filtered aggregate would hide both.
export default defineEventHandler(async (event) => {
  const userId = event.context.userId
  const q = await getValidatedQuery(event, noteQuerySchema.parse)

  const n = schema.notes
  const conditions = [eq(n.userId, userId)]
  if (q.tag) conditions.push(arrayContains(n.tags, [q.tag]))
  if (q.search) {
    // Unescaped LIKE wildcards in user input would silently widen the match
    // ('%' matching everything); backslash is Postgres' default LIKE escape.
    const term = `%${q.search.replace(/[\\%_]/g, c => `\\${c}`)}%`
    conditions.push(or(ilike(n.title, term), ilike(n.content, term))!)
  }

  const [notes, tagRows] = await Promise.all([
    db.query.notes.findMany({
      where: and(...conditions),
      orderBy: (t, { desc }) => [desc(t.pinned), desc(t.updatedAt)],
    }),
    db.query.notes.findMany({
      where: (t, { eq }) => eq(t.userId, userId),
      columns: { tags: true },
    }),
  ])

  const counts = new Map<string, number>()
  for (const row of tagRows) {
    for (const tag of row.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1)
  }
  // Most-used first, alphabetical within a tie so the chip row never reshuffles.
  const tags = [...counts]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))

  return { notes, tags }
})
