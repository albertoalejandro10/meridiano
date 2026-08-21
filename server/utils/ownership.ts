import { db } from '@nuxthub/db'
import { and, eq } from 'drizzle-orm'
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core'

// The categories FK only requires the row to exist, so cross-tenant ids would
// pass Zod + the constraint. Reject any categoryId the user doesn't own.
export async function requireOwnCategory(userId: string, categoryId: string): Promise<void> {
  const category = await db.query.categories.findFirst({
    where: (c, { and, eq }) => and(eq(c.id, categoryId), eq(c.userId, userId)),
    columns: { id: true },
  })
  if (!category) throw createError({ statusCode: 404, statusMessage: 'Category not found' })
}

// A user-scoped table: every row belongs to exactly one user (there is no
// SQL-level RLS, so ownership is enforced in the WHERE clause).
type OwnedTable = PgTable & { id: PgColumn, userId: PgColumn }

/**
 * Delete one row scoped to its owner, 404-ing when it isn't theirs or doesn't
 * exist — the two cases are deliberately indistinguishable, so a foreign id
 * can't be probed for existence.
 *
 * Related rows follow the FK rules declared in server/db/schema.ts (cascade or
 * set-null); handlers document whichever applies to them.
 */
export async function deleteOwned(table: OwnedTable, id: string, userId: string, notFound: string): Promise<void> {
  const deleted = await db
    .delete(table)
    .where(and(eq(table.id, id), eq(table.userId, userId)))
    .returning({ id: table.id })
  if (deleted.length === 0) throw createError({ statusCode: 404, statusMessage: notFound })
}

/**
 * Guard a PATCH body that Zod left empty — `.partial()` accepts `{}`, which
 * would otherwise reach Drizzle as a no-column UPDATE and throw a 500.
 *
 * `alsoPresent` covers fields handled outside the column set (a goal's linked
 * accounts, a transaction's fees): any of them being defined means there *is*
 * something to update, even with no columns to set.
 */
export function assertNotEmpty(columns: object, ...alsoPresent: unknown[]): void {
  if (Object.keys(columns).length === 0 && alsoPresent.every(v => v === undefined)) {
    throw createError({ statusCode: 400, statusMessage: 'Nothing to update' })
  }
}
