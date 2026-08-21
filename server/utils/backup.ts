import { db, schema } from '@nuxthub/db'
import { eq, inArray } from 'drizzle-orm'
import type { BackupImportInput } from '~~/shared/schemas'

// --- Export ---------------------------------------------------------------

export interface BackupExport {
  version: 1
  exportedAt: string
  profile: {
    name: string | null
    jobTitle: string | null
    income: string | null
    incomeCurrency: string | null
    employmentType: string | null
    maritalStatus: string | null
    dependents: number | null
    riskTolerance: string | null
    financialNotes: string | null
  }
  accounts: (typeof schema.accounts.$inferSelect)[]
  categories: (typeof schema.categories.$inferSelect)[]
  transactions: (typeof schema.transactions.$inferSelect)[]
  goals: (typeof schema.goals.$inferSelect)[]
  goalAccounts: (typeof schema.goalAccounts.$inferSelect)[]
  budgets: (typeof schema.budgets.$inferSelect)[]
  budgetIncomes: (typeof schema.budgetIncomes.$inferSelect)[]
  shoppingLists: (typeof schema.shoppingLists.$inferSelect)[]
  shoppingListItems: (typeof schema.shoppingListItems.$inferSelect)[]
  taskCategories: (typeof schema.taskCategories.$inferSelect)[]
  longTasks: (typeof schema.longTasks.$inferSelect)[]
  tasks: (typeof schema.tasks.$inferSelect)[]
  notes: (typeof schema.notes.$inferSelect)[]
  transactionRules: (typeof schema.transactionRules.$inferSelect)[]
  recurringTransactions: (typeof schema.recurringTransactions.$inferSelect)[]
  recurringOccurrences: (typeof schema.recurringOccurrences.$inferSelect)[]
  accountReconciliations: (typeof schema.accountReconciliations.$inferSelect)[]
}

// Everything the user created, minus auth/session secrets (passwordHash,
// password reset tokens) and AI chat/rate-limit bookkeeping (excluded by
// product decision — chat is treated as disposable, ai_generations is a pure
// counter with no content). Balances/derived figures are never included —
// they're recomputed from accounts+transactions on the other end, same as
// everywhere else in the app.
export async function exportUserData(userId: string): Promise<BackupExport> {
  const [
    user,
    accounts,
    categories,
    transactions,
    goals,
    budgets,
    budgetIncomes,
    shoppingLists,
    taskCategories,
    longTasks,
    tasks,
    notes,
    transactionRules,
    recurringTransactions,
    recurringOccurrences,
    accountReconciliations,
  ] = await Promise.all([
    db.query.users.findFirst({ where: (u, { eq }) => eq(u.id, userId) }),
    db.query.accounts.findMany({ where: (a, { eq }) => eq(a.userId, userId) }),
    db.query.categories.findMany({ where: (c, { eq }) => eq(c.userId, userId) }),
    db.query.transactions.findMany({ where: (t, { eq }) => eq(t.userId, userId) }),
    db.query.goals.findMany({ where: (g, { eq }) => eq(g.userId, userId) }),
    db.query.budgets.findMany({ where: (b, { eq }) => eq(b.userId, userId) }),
    db.query.budgetIncomes.findMany({ where: (i, { eq }) => eq(i.userId, userId) }),
    db.query.shoppingLists.findMany({ where: (l, { eq }) => eq(l.userId, userId) }),
    db.query.taskCategories.findMany({ where: (c, { eq }) => eq(c.userId, userId) }),
    db.query.longTasks.findMany({ where: (t, { eq }) => eq(t.userId, userId) }),
    db.query.tasks.findMany({ where: (t, { eq }) => eq(t.userId, userId) }),
    db.query.notes.findMany({ where: (n, { eq }) => eq(n.userId, userId) }),
    db.query.transactionRules.findMany({ where: (r, { eq }) => eq(r.userId, userId) }),
    db.query.recurringTransactions.findMany({ where: (r, { eq }) => eq(r.userId, userId) }),
    db.query.recurringOccurrences.findMany({ where: (o, { eq }) => eq(o.userId, userId) }),
    db.query.accountReconciliations.findMany({ where: (r, { eq }) => eq(r.userId, userId) }),
  ])

  // goalAccounts/shoppingListItems have no userId of their own — scoped via parent.
  const goalIds = goals.map(g => g.id)
  const listIds = shoppingLists.map(l => l.id)
  const [goalAccounts, shoppingListItems] = await Promise.all([
    goalIds.length ? db.query.goalAccounts.findMany({ where: inArray(schema.goalAccounts.goalId, goalIds) }) : [],
    listIds.length ? db.query.shoppingListItems.findMany({ where: inArray(schema.shoppingListItems.listId, listIds) }) : [],
  ])

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    profile: {
      name: user?.name ?? null,
      jobTitle: user?.jobTitle ?? null,
      income: user?.income ?? null,
      incomeCurrency: user?.incomeCurrency ?? null,
      employmentType: user?.employmentType ?? null,
      maritalStatus: user?.maritalStatus ?? null,
      dependents: user?.dependents ?? null,
      riskTolerance: user?.riskTolerance ?? null,
      financialNotes: user?.financialNotes ?? null,
    },
    accounts,
    categories,
    transactions,
    goals,
    goalAccounts,
    budgets,
    budgetIncomes,
    shoppingLists,
    shoppingListItems,
    taskCategories,
    longTasks,
    tasks,
    notes,
    transactionRules,
    recurringTransactions,
    recurringOccurrences,
    accountReconciliations,
  }
}

// --- Import (merge-only: always adds rows, never deletes/overwrites) ------

export interface BackupImportResult {
  accounts: number
  categoriesAdded: number
  categoriesMatched: number
  transactions: number
  goals: number
  goalAccounts: number
  budgets: number
  budgetIncomes: number
  shoppingLists: number
  shoppingListItems: number
  taskCategoriesAdded: number
  taskCategoriesMatched: number
  longTasks: number
  tasks: number
  notes: number
  transactionRules: number
  recurringTransactions: number
  recurringOccurrences: number
  accountReconciliations: number
}

interface MergeByKeyResult<TInsert> {
  idMap: Map<string, string>
  toInsert: TInsert[]
  added: number
  matched: number
}

// postgres-js binds every column of every row as a query parameter and hard
// throws past 65534 of them, so a single bulk insert really caps out at
// 65534/columns rows — only ~4.3k transactions at 15 columns, far under the
// MAX_BACKUP_ROWS the schema advertises. Chunking makes the schema limit the
// real ceiling instead of the driver's. 500 keeps the widest table (15 cols)
// at 7.5k parameters, comfortably clear with room for wider tables later.
const INSERT_CHUNK_SIZE = 500

function chunked<T>(rows: T[]): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < rows.length; i += INSERT_CHUNK_SIZE) chunks.push(rows.slice(i, i + INSERT_CHUNK_SIZE))
  return chunks
}

// Runs `insert` once per chunk and sums what it reports back. Callers that
// care about how many rows actually landed (the onConflictDoNothing ones)
// return a number per chunk; the rest hand back the Drizzle query itself,
// which resolves to a result object we ignore.
async function insertChunked<T>(rows: T[], insert: (chunk: T[]) => PromiseLike<number | unknown>): Promise<number> {
  let total = 0
  for (const chunk of chunked(rows)) {
    const inserted = await insert(chunk)
    if (typeof inserted === 'number') total += inserted
  }
  return total
}

// Categories are pre-seeded for every user (see defaultCategories.ts), so a
// naive insert would collide with the user's existing defaults on every
// import. Match by slug first (stable identity for defaults), else by name
// (covers user-made categories and legacy rows), and reuse the existing id
// instead of duplicating — mirrors the find-or-create idiom in
// server/utils/categories.ts (ensureFeesCategory/restoreDefaultCategories).
function mergeCategories(
  existing: (typeof schema.categories.$inferSelect)[],
  rows: BackupImportInput['categories'],
  userId: string,
): MergeByKeyResult<typeof schema.categories.$inferInsert> {
  const bySlug = new Map(existing.filter(c => c.slug).map(c => [c.slug as string, c.id]))
  const byName = new Map(existing.map(c => [c.name, c.id]))
  const idMap = new Map<string, string>()
  const toInsert: (typeof schema.categories.$inferInsert)[] = []

  for (const row of rows) {
    // Normalize "" to null up front: the unique index treats NULLs as distinct
    // but not empty strings, so two blank-slug rows from a hand-edited file
    // would collide. Doing it here also keeps the slug-then-name fallback
    // honest — `('' && …) ?? byName…` would short-circuit to "" and skip it.
    const slug = row.slug || null
    const existingId = (slug && bySlug.get(slug)) ?? byName.get(row.name)
    if (existingId) {
      idMap.set(row.id, existingId)
      continue
    }
    const id = crypto.randomUUID()
    idMap.set(row.id, id)
    toInsert.push({ id, userId, name: row.name, slug, icon: row.icon ?? null, type: row.type ?? null })
    if (slug) bySlug.set(slug, id)
    byName.set(row.name, id)
  }

  return { idMap, toInsert, added: toInsert.length, matched: rows.length - toInsert.length }
}

// Task categories aren't pre-seeded, but do carry a (userId, name) unique
// constraint — dedupe the same way so a repeat import of the same backup
// doesn't 409 on the second run.
function mergeTaskCategories(
  existing: (typeof schema.taskCategories.$inferSelect)[],
  rows: BackupImportInput['taskCategories'],
  userId: string,
): MergeByKeyResult<typeof schema.taskCategories.$inferInsert> {
  const byName = new Map(existing.map(c => [c.name, c.id]))
  const idMap = new Map<string, string>()
  const toInsert: (typeof schema.taskCategories.$inferInsert)[] = []

  for (const row of rows) {
    const existingId = byName.get(row.name)
    if (existingId) {
      idMap.set(row.id, existingId)
      continue
    }
    const id = crypto.randomUUID()
    idMap.set(row.id, id)
    toInsert.push({ id, userId, name: row.name, icon: row.icon ?? null, color: row.color ?? null, createdAt: row.createdAt, updatedAt: row.updatedAt })
    byName.set(row.name, id)
  }

  return { idMap, toInsert, added: toInsert.length, matched: rows.length - toInsert.length }
}

export async function importUserData(userId: string, payload: BackupImportInput): Promise<BackupImportResult> {
  const [existingCategories, existingTaskCategories, currentUser] = await Promise.all([
    db.query.categories.findMany({ where: (c, { eq }) => eq(c.userId, userId) }),
    db.query.taskCategories.findMany({ where: (c, { eq }) => eq(c.userId, userId) }),
    db.query.users.findFirst({ where: (u, { eq }) => eq(u.id, userId) }),
  ])
  if (!currentUser) throw createError({ statusCode: 404, statusMessage: 'User not found' })

  const categoryMerge = mergeCategories(existingCategories, payload.categories, userId)
  const taskCategoryMerge = mergeTaskCategories(existingTaskCategories, payload.taskCategories, userId)

  try {
    return await db.transaction(async (tx) => {
      await insertChunked(categoryMerge.toInsert, chunk => tx.insert(schema.categories).values(chunk))
      const categoryIds = categoryMerge.idMap

      // Accounts — always inserted fresh, no dedupe (two accounts can share a name).
      const accountIds = new Map<string, string>()
      if (payload.accounts.length) {
        const rows = payload.accounts.map((a) => {
          const id = crypto.randomUUID()
          accountIds.set(a.id, id)
          return { id, userId, name: a.name, type: a.type, currency: a.currency, initialBalance: a.initialBalance, archived: a.archived, createdAt: a.createdAt, updatedAt: a.updatedAt }
        })
        await insertChunked(rows, chunk => tx.insert(schema.accounts).values(chunk))
      }

      await insertChunked(taskCategoryMerge.toInsert, chunk => tx.insert(schema.taskCategories).values(chunk))
      const taskCategoryIds = taskCategoryMerge.idMap

      // Long tasks (needs taskCategoryIds).
      const longTaskIds = new Map<string, string>()
      if (payload.longTasks.length) {
        const rows = payload.longTasks.map((t) => {
          const id = crypto.randomUUID()
          longTaskIds.set(t.id, id)
          return {
            id,
            userId,
            categoryId: t.categoryId ? (taskCategoryIds.get(t.categoryId) ?? null) : null,
            title: t.title,
            notes: t.notes ?? null,
            priority: t.priority,
            targetDate: t.targetDate ?? null,
            done: t.done,
            completedAt: t.completedAt ?? null,
            createdAt: t.createdAt,
            updatedAt: t.updatedAt,
          }
        })
        await insertChunked(rows, chunk => tx.insert(schema.longTasks).values(chunk))
      }

      // Goals.
      const goalIds = new Map<string, string>()
      if (payload.goals.length) {
        const rows = payload.goals.map((g) => {
          const id = crypto.randomUUID()
          goalIds.set(g.id, id)
          return { id, userId, name: g.name, targetAmount: g.targetAmount, currency: g.currency, startDate: g.startDate, targetDate: g.targetDate ?? null, icon: g.icon ?? null, color: g.color ?? null, createdAt: g.createdAt, updatedAt: g.updatedAt }
        })
        await insertChunked(rows, chunk => tx.insert(schema.goals).values(chunk))
      }

      // Recurring transactions (needs accountIds, categoryIds) — a template
      // whose account didn't make it in (corrupt/hand-edited file) is dropped.
      const recurringIds = new Map<string, string>()
      {
        const importable = payload.recurringTransactions.filter(r => accountIds.has(r.accountId))
        const rows = importable.map((r) => {
          const id = crypto.randomUUID()
          recurringIds.set(r.id, id)
          return {
            id,
            userId,
            accountId: accountIds.get(r.accountId)!,
            categoryId: r.categoryId ? (categoryIds.get(r.categoryId) ?? null) : null,
            type: r.type,
            amount: r.amount ?? null,
            description: r.description,
            cadence: r.cadence,
            startDate: r.startDate,
            endDate: r.endDate ?? null,
            enabled: r.enabled,
            createdAt: r.createdAt,
            updatedAt: r.updatedAt,
          }
        })
        await insertChunked(rows, chunk => tx.insert(schema.recurringTransactions).values(chunk))
      }

      // Shopping lists.
      const shoppingListIds = new Map<string, string>()
      if (payload.shoppingLists.length) {
        const rows = payload.shoppingLists.map((l) => {
          const id = crypto.randomUUID()
          shoppingListIds.set(l.id, id)
          return { id, userId, name: l.name, bcvRate: l.bcvRate ?? null, binanceRate: l.binanceRate ?? null, createdAt: l.createdAt, updatedAt: l.updatedAt }
        })
        await insertChunked(rows, chunk => tx.insert(schema.shoppingLists).values(chunk))
      }

      // Transaction rules (needs categoryIds).
      let transactionRulesInserted = 0
      {
        const rows = payload.transactionRules
          .filter(r => categoryIds.has(r.categoryId))
          .map(r => ({ id: crypto.randomUUID(), userId, keyword: r.keyword, categoryId: categoryIds.get(r.categoryId)!, enabled: r.enabled, priority: r.priority, createdAt: r.createdAt, updatedAt: r.updatedAt }))
        await insertChunked(rows, chunk => tx.insert(schema.transactionRules).values(chunk))
        transactionRulesInserted = rows.length
      }

      // Goal↔account links (needs goalIds, accountIds) — count what actually
      // landed, since a pair the user already has is skipped by the composite PK.
      let goalAccountsInserted = 0
      {
        const rows = payload.goalAccounts
          .map(ga => ({ goalId: goalIds.get(ga.goalId), accountId: accountIds.get(ga.accountId) }))
          .filter((r): r is { goalId: string, accountId: string } => !!r.goalId && !!r.accountId)
        goalAccountsInserted = await insertChunked(rows, async (chunk) => {
          const inserted = await tx.insert(schema.goalAccounts).values(chunk).onConflictDoNothing().returning({ goalId: schema.goalAccounts.goalId })
          return inserted.length
        })
      }

      // Budgets (needs categoryIds) — skip rather than 409 if the user already
      // has a budget for that category+currency (merge, not overwrite).
      let budgetsInserted = 0
      {
        const rows = payload.budgets
          .filter(b => categoryIds.has(b.categoryId))
          .map(b => ({ id: crypto.randomUUID(), userId, categoryId: categoryIds.get(b.categoryId)!, currency: b.currency, amount: b.amount, createdAt: b.createdAt, updatedAt: b.updatedAt }))
        budgetsInserted = await insertChunked(rows, async (chunk) => {
          const inserted = await tx.insert(schema.budgets).values(chunk).onConflictDoNothing().returning({ id: schema.budgets.id })
          return inserted.length
        })
      }

      // Budget incomes — same skip-if-already-set idea (composite PK userId+currency).
      let budgetIncomesInserted = 0
      {
        const rows = payload.budgetIncomes.map(i => ({ userId, currency: i.currency, amount: i.amount, updatedAt: i.updatedAt }))
        budgetIncomesInserted = await insertChunked(rows, async (chunk) => {
          const inserted = await tx.insert(schema.budgetIncomes).values(chunk).onConflictDoNothing().returning({ currency: schema.budgetIncomes.currency })
          return inserted.length
        })
      }

      // Shopping list items (needs shoppingListIds).
      let shoppingListItemsInserted = 0
      {
        const rows = payload.shoppingListItems
          .filter(i => shoppingListIds.has(i.listId))
          .map(i => ({ id: crypto.randomUUID(), listId: shoppingListIds.get(i.listId)!, name: i.name, quantity: i.quantity, unitPrice: i.unitPrice, checked: i.checked, position: i.position, createdAt: i.createdAt, updatedAt: i.updatedAt }))
        await insertChunked(rows, chunk => tx.insert(schema.shoppingListItems).values(chunk))
        shoppingListItemsInserted = rows.length
      }

      // Tasks (needs taskCategoryIds, longTaskIds).
      let tasksInserted = 0
      {
        const rows = payload.tasks.map(t => ({
          id: crypto.randomUUID(),
          userId,
          categoryId: t.categoryId ? (taskCategoryIds.get(t.categoryId) ?? null) : null,
          longTaskId: t.longTaskId ? (longTaskIds.get(t.longTaskId) ?? null) : null,
          title: t.title,
          notes: t.notes ?? null,
          priority: t.priority,
          month: t.month,
          dueDate: t.dueDate ?? null,
          done: t.done,
          completedAt: t.completedAt ?? null,
          carriedFromMonth: t.carriedFromMonth ?? null,
          createdAt: t.createdAt,
          updatedAt: t.updatedAt,
        }))
        await insertChunked(rows, chunk => tx.insert(schema.tasks).values(chunk))
        tasksInserted = rows.length
      }

      // Notes — standalone, no FKs to remap.
      let notesInserted = 0
      {
        const rows = payload.notes.map(n => ({
          id: crypto.randomUUID(),
          userId,
          title: n.title,
          content: n.content,
          tags: n.tags,
          pinned: n.pinned,
          createdAt: n.createdAt,
          updatedAt: n.updatedAt,
        }))
        await insertChunked(rows, chunk => tx.insert(schema.notes).values(chunk))
        notesInserted = rows.length
      }

      // Transactions (needs accountIds, categoryIds, recurringIds). Postgres
      // checks FK constraints at statement end (see
      // server/api/v1/transfers/index.post.ts), so a fee row's feeOfId can
      // reference a sibling inserted by the same statement — but only the same
      // statement, and this table is chunked across several. Fee rows are
      // therefore sorted last so a fee's parent is always in this chunk or an
      // earlier one (a fee is never itself a fee's parent, so two phases are
      // enough). transferId isn't a real FK, just a value shared by exactly two
      // sibling rows (a fresh id of its own, distinct from either leg — same
      // convention transfers/index.post.ts uses) — mint one new id per distinct
      // old transferId and apply it to both legs.
      const transactionIds = new Map<string, string>()
      {
        const importable = payload.transactions.filter(t => accountIds.has(t.accountId))
        for (const t of importable) transactionIds.set(t.id, crypto.randomUUID())

        const transferIdMap = new Map<string, string>()
        for (const t of importable) {
          if (t.transferId && !transferIdMap.has(t.transferId)) transferIdMap.set(t.transferId, crypto.randomUUID())
        }

        const ordered = [...importable.filter(t => !t.feeOfId), ...importable.filter(t => t.feeOfId)]
        const rows = ordered.map(t => ({
          id: transactionIds.get(t.id)!,
          userId,
          accountId: accountIds.get(t.accountId)!,
          categoryId: t.categoryId ? (categoryIds.get(t.categoryId) ?? null) : null,
          type: t.type,
          amount: t.amount,
          currency: t.currency,
          date: t.date,
          description: t.description ?? null,
          transferId: t.transferId ? transferIdMap.get(t.transferId)! : null,
          feeOfId: t.feeOfId ? (transactionIds.get(t.feeOfId) ?? null) : null,
          feeKind: t.feeKind ?? null,
          recurringId: t.recurringId ? (recurringIds.get(t.recurringId) ?? null) : null,
          createdAt: t.createdAt,
          updatedAt: t.updatedAt,
        }))
        await insertChunked(rows, chunk => tx.insert(schema.transactions).values(chunk))
      }

      // Recurring occurrences (needs recurringIds, transactionIds).
      let recurringOccurrencesInserted = 0
      {
        const rows = payload.recurringOccurrences
          .filter(o => recurringIds.has(o.recurringId))
          .map(o => ({
            id: crypto.randomUUID(),
            userId,
            recurringId: recurringIds.get(o.recurringId)!,
            dueDate: o.dueDate,
            status: o.status,
            transactionId: o.transactionId ? (transactionIds.get(o.transactionId) ?? null) : null,
            note: o.note ?? null,
            createdAt: o.createdAt,
          }))
        await insertChunked(rows, chunk => tx.insert(schema.recurringOccurrences).values(chunk))
        recurringOccurrencesInserted = rows.length
      }

      // Account reconciliations (needs accountIds).
      let accountReconciliationsInserted = 0
      {
        const rows = payload.accountReconciliations
          .filter(r => accountIds.has(r.accountId))
          .map(r => ({ id: crypto.randomUUID(), userId, accountId: accountIds.get(r.accountId)!, statedBalance: r.statedBalance, date: r.date, createdAt: r.createdAt }))
        await insertChunked(rows, chunk => tx.insert(schema.accountReconciliations).values(chunk))
        accountReconciliationsInserted = rows.length
      }

      // Profile — merge semantics for a singleton row: only fill fields
      // currently null, never overwrite an existing answer.
      if (payload.profile) {
        const p = payload.profile
        const patch: Partial<typeof schema.users.$inferInsert> = {}
        if (currentUser.name == null && p.name != null) patch.name = p.name
        if (currentUser.jobTitle == null && p.jobTitle != null) patch.jobTitle = p.jobTitle
        if (currentUser.income == null && p.income != null) patch.income = p.income
        if (currentUser.incomeCurrency == null && p.incomeCurrency != null) patch.incomeCurrency = p.incomeCurrency
        if (currentUser.employmentType == null && p.employmentType != null) patch.employmentType = p.employmentType
        if (currentUser.maritalStatus == null && p.maritalStatus != null) patch.maritalStatus = p.maritalStatus
        if (currentUser.dependents == null && p.dependents != null) patch.dependents = p.dependents
        if (currentUser.riskTolerance == null && p.riskTolerance != null) patch.riskTolerance = p.riskTolerance
        if (currentUser.financialNotes == null && p.financialNotes != null) patch.financialNotes = p.financialNotes
        if (Object.keys(patch).length) await tx.update(schema.users).set(patch).where(eq(schema.users.id, userId))
      }

      return {
        accounts: accountIds.size,
        categoriesAdded: categoryMerge.added,
        categoriesMatched: categoryMerge.matched,
        transactions: transactionIds.size,
        goals: goalIds.size,
        goalAccounts: goalAccountsInserted,
        budgets: budgetsInserted,
        budgetIncomes: budgetIncomesInserted,
        shoppingLists: shoppingListIds.size,
        shoppingListItems: shoppingListItemsInserted,
        taskCategoriesAdded: taskCategoryMerge.added,
        taskCategoriesMatched: taskCategoryMerge.matched,
        longTasks: longTaskIds.size,
        tasks: tasksInserted,
        notes: notesInserted,
        transactionRules: transactionRulesInserted,
        recurringTransactions: recurringIds.size,
        recurringOccurrences: recurringOccurrencesInserted,
        accountReconciliations: accountReconciliationsInserted,
      }
    })
  }
  catch (err) {
    if (isUniqueViolation(err)) throw createError({ statusCode: 409, statusMessage: 'This backup conflicts with your existing data' })
    throw err
  }
}
