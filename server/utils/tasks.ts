import { db } from '@nuxthub/db'

// Postgres unique-violation → 409 so a duplicate task-category name surfaces
// as a friendly conflict instead of a 500. Drizzle may wrap the driver error,
// so check the cause chain too.
export function isUniqueViolation(err: unknown): boolean {
  const code = (err as { code?: string, cause?: { code?: string } } | null)
  return code?.code === '23505' || code?.cause?.code === '23505'
}

// A monthly task may link to a long task as its next action — the link target
// must belong to the same user (the FK alone can't enforce that).
export async function assertLongTaskOwnership(userId: string, longTaskId: string) {
  const longTask = await db.query.longTasks.findFirst({
    where: (lt, { and, eq }) => and(eq(lt.id, longTaskId), eq(lt.userId, userId)),
    columns: { id: true },
  })
  if (!longTask) throw createError({ statusCode: 404, statusMessage: 'Long task not found' })
}
