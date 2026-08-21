import { relations } from 'drizzle-orm'
import {
  type AnyPgColumn,
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

// --- Enums (ported 1:1 from the former Prisma schema) ---
export const currencyEnum = pgEnum('currency', ['USD', 'VES', 'EUR'])
export const accountTypeEnum = pgEnum('account_type', [
  'CASH',
  'INVESTMENT',
  'CRYPTO',
  'PROPERTY',
  'VEHICLE',
  'OTHER_ASSET',
  'CREDIT_CARD',
  'LOAN',
  'OTHER_LIABILITY',
])
export const transactionTypeEnum = pgEnum('transaction_type', ['INCOME', 'EXPENSE'])
// Cadences for scheduled/recurring transactions (mirrors `cadences` in shared/schemas.ts).
export const cadenceEnum = pgEnum('recurring_cadence', ['WEEKLY', 'BIWEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY'])
// How the user answered a due recurring occurrence (mirrors `occurrenceStatuses`).
// PAID = it was charged to my account (a transaction exists); SKIPPED = no charge
// on my account this period (cancelled, waived, or someone else paid it).
export const recurringOccurrenceStatusEnum = pgEnum('recurring_occurrence_status', ['PAID', 'SKIPPED'])
// Which of a parent's two possible fees a fee row represents (see feeOfId).
export const feeKindEnum = pgEnum('fee_kind', ['INTERNAL', 'EXTERNAL'])
// Monthly-task priority (mirrors `taskPriorities` in shared/schemas.ts).
export const taskPriorityEnum = pgEnum('task_priority', ['HIGH', 'MEDIUM', 'LOW'])
// Settings → Financial profile enums (mirror the `*Types`/`*Statuses`/
// `*Tolerances` consts in shared/schemas.ts). All three are optional context
// for the AI features — see the comment on `users` below.
export const employmentTypeEnum = pgEnum('employment_type', ['EMPLOYEE', 'SELF_EMPLOYED', 'FREELANCER', 'BUSINESS_OWNER'])
export const maritalStatusEnum = pgEnum('marital_status', ['SINGLE', 'PARTNERED', 'MARRIED'])
export const riskToleranceEnum = pgEnum('risk_tolerance', ['CONSERVATIVE', 'MODERATE', 'AGGRESSIVE'])

// --- Tables ---
export const users = pgTable('users', {
  // App-generated UUID (previously the Supabase auth user id).
  id: uuid('id').primaryKey().defaultRandom(),
  // Email is the login identifier — now required and unique.
  email: text('email').notNull().unique(),
  name: text('name'),
  // nuxt-auth-utils hashed password (null for the dev-bypass user).
  passwordHash: text('password_hash'),
  // POST-MVP blob: user avatar object pathname (nullable until the feature ships).
  avatarPathname: text('avatar_pathname'),
  // Optional, edit-anytime context from Settings → Financial profile — never
  // collected at registration (a one-time capture goes stale the moment a
  // salary or life situation changes). Used only to personalize the AI
  // digest/chat prompts when present (see server/utils/digest.ts, aiChat.ts);
  // every AI feature works the same without any of it.
  jobTitle: text('job_title'),
  income: numeric('income', { precision: 14, scale: 2 }),
  incomeCurrency: currencyEnum('income_currency'),
  employmentType: employmentTypeEnum('employment_type'),
  maritalStatus: maritalStatusEnum('marital_status'),
  // Financial dependents (kids or others the user supports) — a plain count,
  // not tied to maritalStatus, since either can be set independently.
  dependents: integer('dependents'),
  riskTolerance: riskToleranceEnum('risk_tolerance'),
  // Free-text goals/concerns in the user's own words ("saving for a house,
  // worried about job stability") — the qualitative context a numeric Goal
  // row can't capture.
  financialNotes: text('financial_notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const accounts = pgTable('accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  type: accountTypeEnum('type').notNull().default('CASH'),
  currency: currencyEnum('currency').notNull().default('USD'),
  initialBalance: numeric('initial_balance', { precision: 14, scale: 2 }).notNull().default('0'),
  archived: boolean('archived').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().$onUpdate(() => new Date()),
}, t => [
  index('accounts_user_id_idx').on(t.userId),
])

export const categories = pgTable('categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  // Seeded categories carry a stable slug the UI translates (`categories.defaults.<slug>`,
  // see app/utils/categories.ts); their `name` is an internal English identity, not prose
  // the user reads. Categories the user creates keep a NULL slug and render `name` as-is.
  // Postgres unique constraints are NULLS DISTINCT, so any number of NULL-slug rows coexist
  // per user while each default can exist at most once (what makes restore-defaults idempotent
  // even after the user renames one).
  slug: text('slug'),
  icon: text('icon'),
  type: transactionTypeEnum('type'),
}, t => [
  unique('categories_user_id_name_key').on(t.userId, t.name),
  unique('categories_user_id_slug_key').on(t.userId, t.slug),
])

export const transactions = pgTable('transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  accountId: uuid('account_id').notNull().references(() => accounts.id, { onDelete: 'restrict' }),
  categoryId: uuid('category_id').references(() => categories.id, { onDelete: 'set null' }),
  type: transactionTypeEnum('type').notNull(),
  amount: numeric('amount', { precision: 14, scale: 2 }).notNull(),
  currency: currencyEnum('currency').notNull(),
  // Daily precision (no time component); stored/returned as 'yyyy-MM-dd' string.
  date: date('date').notNull(),
  description: text('description'),
  // Links the two sides of a transfer (one EXPENSE + one INCOME). Null for normal txns.
  transferId: uuid('transfer_id'),
  // Marks this row as the fee of another transaction (transferId stays NULL so
  // fees count as real expenses); removed with its parent via the FK cascade.
  feeOfId: uuid('fee_of_id').references((): AnyPgColumn => transactions.id, { onDelete: 'cascade' }),
  // NULL unless feeOfId is set; a parent can carry at most one fee of each kind.
  feeKind: feeKindEnum('fee_kind'),
  // POST-MVP blob: receipt object pathname (nullable until the feature ships).
  receiptPathname: text('receipt_pathname'),
  // Provenance: set when this row was materialized from a recurring template.
  // Informational only — the row copies the template's values at creation, so
  // editing/deleting the template never rewrites history (hence set null).
  recurringId: uuid('recurring_id').references((): AnyPgColumn => recurringTransactions.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().$onUpdate(() => new Date()),
}, t => [
  index('transactions_user_id_date_idx').on(t.userId, t.date),
  index('transactions_account_id_idx').on(t.accountId),
  index('transactions_transfer_id_idx').on(t.transferId),
  index('transactions_fee_of_id_idx').on(t.feeOfId),
  uniqueIndex('transactions_fee_of_id_kind_key').on(t.feeOfId, t.feeKind),
  index('transactions_recurring_id_idx').on(t.recurringId),
])

export const goals = pgTable('goals', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  targetAmount: numeric('target_amount', { precision: 14, scale: 2 }).notNull(),
  currency: currencyEnum('currency').notNull().default('USD'),
  // Progress is the combined balance of the linked asset accounts (see goalAccounts);
  // startDate is now informational ("saving since") — it no longer gates the sum.
  startDate: date('start_date').notNull(),
  targetDate: date('target_date'),
  // Per-goal identity: a curated Lucide icon name + accent color name (see shared/schemas.ts).
  icon: text('icon'),
  color: text('color'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().$onUpdate(() => new Date()),
}, t => [
  index('goals_user_id_idx').on(t.userId),
])

// Which asset accounts back a goal (many-to-many). A goal's "saved" is the sum of
// these accounts' derived balances; an account may back more than one goal.
export const goalAccounts = pgTable('goal_accounts', {
  goalId: uuid('goal_id').notNull().references(() => goals.id, { onDelete: 'cascade' }),
  accountId: uuid('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
}, t => [
  primaryKey({ columns: [t.goalId, t.accountId] }),
  index('goal_accounts_account_id_idx').on(t.accountId),
])

// Monthly budgets: one row per (user, category, currency) — the same limit
// applies every month; per-month progress is derived from transactions at read
// time (never stored, like balances). The row doubles as the envelope
// allocation in zero-based mode.
export const budgets = pgTable('budgets', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  categoryId: uuid('category_id').notNull().references(() => categories.id, { onDelete: 'cascade' }),
  currency: currencyEnum('currency').notNull().default('USD'),
  amount: numeric('amount', { precision: 14, scale: 2 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().$onUpdate(() => new Date()),
}, t => [
  unique('budgets_user_id_category_id_currency_key').on(t.userId, t.categoryId, t.currency),
  index('budgets_user_id_idx').on(t.userId),
])

// Expected monthly income per currency — the amount envelope (zero-based)
// budgeting distributes across categories. One row per (user, currency).
export const budgetIncomes = pgTable('budget_incomes', {
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  currency: currencyEnum('currency').notNull(),
  amount: numeric('amount', { precision: 14, scale: 2 }).notNull(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().$onUpdate(() => new Date()),
}, t => [
  primaryKey({ columns: [t.userId, t.currency] }),
])

// Shopping lists: items priced in VES; the app shows how many USD to sell to
// cover the total. Standalone — no link to accounts/transactions/balances.
export const shoppingLists = pgTable('shopping_lists', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  // Last-used VES-per-USD rates (auto-fetched, user-overridable). Null until
  // first fetch/entry. FX rates need more precision than money → numeric(14, 4).
  bcvRate: numeric('bcv_rate', { precision: 14, scale: 4 }),
  binanceRate: numeric('binance_rate', { precision: 14, scale: 4 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().$onUpdate(() => new Date()),
}, t => [
  index('shopping_lists_user_id_idx').on(t.userId),
])

export const shoppingListItems = pgTable('shopping_list_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  listId: uuid('list_id').notNull().references(() => shoppingLists.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  // Fractional quantities are common ("1.5 kg"); row total = quantity × unitPrice.
  quantity: numeric('quantity', { precision: 10, scale: 3 }).notNull().default('1'),
  unitPrice: numeric('unit_price', { precision: 14, scale: 2 }).notNull(),
  checked: boolean('checked').notNull().default(false),
  // Server-assigned (max + 1 per list) so rows keep their typing order.
  position: integer('position').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().$onUpdate(() => new Date()),
}, t => [
  index('shopping_list_items_list_id_idx').on(t.listId),
])

// Monthly-task topics (GTD contexts like "Casa", "Salud"). Separate from the
// finance `categories` table on purpose — those are INCOME/EXPENSE transaction
// categories and feed every transaction picker.
export const taskCategories = pgTable('task_categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  // Curated Lucide icon name + accent color name (see shared/schemas.ts).
  icon: text('icon'),
  color: text('color'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().$onUpdate(() => new Date()),
}, t => [
  unique('task_categories_user_id_name_key').on(t.userId, t.name),
  index('task_categories_user_id_idx').on(t.userId),
])

// Long tasks: GTD projects/commitments that outlive a month ("Learn English").
// Not month-scoped; targetDate is a free deadline. Monthly tasks may link here
// as next actions (tasks.longTaskId) — progress is derived from those links.
export const longTasks = pgTable('long_tasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  categoryId: uuid('category_id').references(() => taskCategories.id, { onDelete: 'set null' }),
  title: text('title').notNull(),
  notes: text('notes'),
  priority: taskPriorityEnum('priority').notNull().default('MEDIUM'),
  targetDate: date('target_date'),
  done: boolean('done').notNull().default(false),
  // Server-managed: set on the done false→true transition, cleared on true→false.
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().$onUpdate(() => new Date()),
}, t => [
  index('long_tasks_user_id_idx').on(t.userId),
])

// GTD-style monthly tasks: things to finish before month end. Standalone — no
// link to accounts/transactions/balances.
export const tasks = pgTable('tasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  // Deleting a topic keeps its tasks (they become uncategorized).
  categoryId: uuid('category_id').references(() => taskCategories.id, { onDelete: 'set null' }),
  // Optional next-action link to a long task; the monthly work is real history,
  // so deleting the long task only unlinks it.
  longTaskId: uuid('long_task_id').references(() => longTasks.id, { onDelete: 'set null' }),
  title: text('title').notNull(),
  notes: text('notes'),
  priority: taskPriorityEnum('priority').notNull().default('MEDIUM'),
  // The month the task belongs to, 'yyyy-MM' (same convention as analytics).
  // Text, not a first-day date: lexicographic order = chronological order, and
  // no date arithmetic is ever needed on it.
  month: text('month').notNull(),
  // Optional target day within `month`; stored/returned as 'yyyy-MM-dd' string.
  dueDate: date('due_date'),
  done: boolean('done').notNull().default(false),
  // Server-managed: set on the done false→true transition, cleared on true→false.
  completedAt: timestamp('completed_at'),
  // Provenance: the original month when the task was carried over. Null otherwise.
  carriedFromMonth: text('carried_from_month'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().$onUpdate(() => new Date()),
}, t => [
  // Serves both the month view and the "pending in earlier months" scan.
  index('tasks_user_id_month_idx').on(t.userId, t.month),
  index('tasks_category_id_idx').on(t.categoryId),
  index('tasks_long_task_id_idx').on(t.longTaskId),
])

// Personal notes: free-form markdown the user keeps for themselves — a saved
// command, a recipe, a password-less checklist. Deliberately unlinked to
// anything financial: notes reference no account, category or transaction.
// Organisation is by free-form `tags` rather than a folder table, so a note can
// belong to several themes at once and no extra CRUD surface is needed.
export const notes = pgTable('notes', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  // Markdown source, rendered with <Comark> on read and edited as plain text.
  content: text('content').notNull().default(''),
  // Lowercased, de-duplicated by the API so filtering by tag is exact-match.
  tags: text('tags').array().notNull().default([]),
  // Pinned notes sort first everywhere; the flag is the only ordering the user
  // controls (the rest is most-recently-updated).
  pinned: boolean('pinned').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().$onUpdate(() => new Date()),
}, t => [
  // The list query's default order: pinned first, then most recently touched.
  index('notes_user_id_pinned_updated_at_idx').on(t.userId, t.pinned, t.updatedAt),
  // Containment lookups for the tag filter (`tags @> ARRAY[...]`).
  index('notes_tags_idx').using('gin', t.tags),
])

export const passwordResetTokens = pgTable('password_reset_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  // SHA-256 hash of the emailed token — the raw token is never stored.
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  // Set when the token is consumed; single-use.
  usedAt: timestamp('used_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, t => [
  index('password_reset_tokens_user_id_idx').on(t.userId),
])

// Auto-categorization rules: "description contains keyword → set category".
// Matching is case-insensitive at apply time (keyword stored as typed); lower
// priority = matched first, first match wins. Rules only fill a missing
// category — they never override an explicit user choice.
export const transactionRules = pgTable('transaction_rules', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  keyword: text('keyword').notNull(),
  // A rule is meaningless without its category → cascade (same choice as budgets).
  categoryId: uuid('category_id').notNull().references(() => categories.id, { onDelete: 'cascade' }),
  enabled: boolean('enabled').notNull().default(true),
  // Server-assigned (max + 1 per user). Not unique — gaps after deletes are
  // fine, only the relative order matters; reorder rewrites all rows.
  priority: integer('priority').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().$onUpdate(() => new Date()),
}, t => [
  index('transaction_rules_user_id_idx').on(t.userId),
])

// Scheduled/recurring transaction templates (internet, gym, rent, salary).
//
// CONFIRM-FIRST, never auto-materialized: real-world bills change price and are
// sometimes not paid by the user at all (a family member covers one). Writing a
// transaction on a timer would invent charges that never happened, at amounts
// that are wrong. So a template only *derives* due dates (see
// server/utils/recurringSchedule.ts) — a due date with no recurringOccurrences
// row is "pending" and the user is asked. Answering is what writes data.
//
// No stored currency — inherited from the account when an occurrence is confirmed.
export const recurringTransactions = pgTable('recurring_transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  // Cascade (not restrict like transactions): a deleted account can never come due again.
  accountId: uuid('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  categoryId: uuid('category_id').references(() => categories.id, { onDelete: 'set null' }),
  type: transactionTypeEnum('type').notNull(),
  // Optional *estimate* only — it prefills the review form and feeds the forecast.
  // The charged figure is whatever the user types when confirming (prices drift).
  amount: numeric('amount', { precision: 14, scale: 2 }),
  // Required — doubles as the template's display name and the rules-matching text.
  description: text('description').notNull(),
  cadence: cadenceEnum('cadence').notNull(),
  // The anchor: occurrence n is startDate stepped n times by cadence.
  startDate: date('start_date').notNull(),
  endDate: date('end_date'),
  // Disabled templates stop coming due but keep their answered history.
  enabled: boolean('enabled').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().$onUpdate(() => new Date()),
}, t => [
  index('recurring_transactions_user_id_idx').on(t.userId),
])

// The answer log: one row per *answered* due date. Absence is the pending
// signal, so nothing here is ever pre-seeded — the row is written when the user
// says "paid" (with the transaction it created) or "skipped" (with why).
export const recurringOccurrences = pgTable('recurring_occurrences', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  recurringId: uuid('recurring_id').notNull().references(() => recurringTransactions.id, { onDelete: 'cascade' }),
  // The derived date this answers — not the date the user actually paid.
  dueDate: date('due_date').notNull(),
  status: recurringOccurrenceStatusEnum('status').notNull(),
  // Set only for PAID. `set null` keeps the answer if the transaction is deleted
  // elsewhere; undoing from the recurring page deletes both together.
  transactionId: uuid('transaction_id').references(() => transactions.id, { onDelete: 'set null' }),
  // Free-text reason, mostly for skips ("mom paid it").
  note: text('note'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, t => [
  // One answer per due date — the idempotency guard against a double-submitted review.
  unique('recurring_occurrences_recurring_id_due_date_key').on(t.recurringId, t.dueDate),
  index('recurring_occurrences_user_id_due_date_idx').on(t.userId, t.dueDate),
])

// Reconciliation checkpoints: "on this date the real bank/platform balance was
// X". The app never adjusts anything from them — they exist so the user can
// compare the derived balance against reality, spot unregistered transactions,
// and mark the moment an account was fully caught up. Full history is kept;
// the UI surfaces only the latest checkpoint per account.
export const accountReconciliations = pgTable('account_reconciliations', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  accountId: uuid('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  // The balance read off the real bank/platform that day. Same sign convention
  // as balances: liabilities store a positive "amount owed".
  statedBalance: numeric('stated_balance', { precision: 14, scale: 2 }).notNull(),
  date: date('date').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, t => [
  index('account_reconciliations_user_id_idx').on(t.userId),
  index('account_reconciliations_account_id_date_idx').on(t.accountId, t.date),
])

// Which AI feature produced a generation (mirrors the kinds narrated in
// server/utils/ai.ts). 'chat' is accounted separately from the other three —
// see server/utils/aiRateLimit.ts's dedicated chat limit.
export const aiGenerationKindEnum = pgEnum('ai_generation_kind', ['digest', 'debt_coaching', 'goal_coaching', 'chat'])

// One row per AI generation, across every AI feature. Primarily the shared
// per-user daily rate-limit counter (see server/utils/aiRateLimit.ts) — every
// row counts regardless of what else it holds.
//
// `content`/`locale` are set only for the digest, which doubles this table as
// its cache: the digest is derived entirely from the user's own data, costs a
// rate-limited call to produce, and would otherwise be discarded the moment
// they navigate away. Chat and the two coaching kinds leave both null —
// coaching deliberately, since its input is a what-if scenario from
// localStorage that a cached note would misdescribe.
export const aiGenerations = pgTable('ai_generations', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  kind: aiGenerationKindEnum('kind').notNull(),
  content: text('content'),
  // The locale the content was generated in — a cached English digest must not
  // be replayed to a user who has since switched to Spanish.
  locale: text('locale'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, t => [
  index('ai_generations_user_id_created_at_idx').on(t.userId, t.createdAt),
])

// Conversational AI chat (Phase 4 — see docs/AI_FEATURES.md). Pinned to the
// OpenCode Go model chosen at creation; switch models by starting a new
// conversation rather than changing it mid-thread.
export const chatConversations = pgTable('chat_conversations', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  // Derived from the first user message once the first turn completes — no
  // extra AI call just to name the conversation.
  title: text('title'),
  model: text('model').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().$onUpdate(() => new Date()),
}, t => [
  index('chat_conversations_user_id_idx').on(t.userId),
])

export const chatMessageRoleEnum = pgEnum('chat_message_role', ['user', 'assistant'])

// One row per turn. `parts` stores the AI SDK's UIMessage `parts` array
// as-is (text, tool-call, tool-result) so a conversation can be replayed
// straight back into `useChat` on the client.
export const chatMessages = pgTable('chat_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  conversationId: uuid('conversation_id').notNull().references(() => chatConversations.id, { onDelete: 'cascade' }),
  role: chatMessageRoleEnum('role').notNull(),
  parts: jsonb('parts').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, t => [
  index('chat_messages_conversation_id_created_at_idx').on(t.conversationId, t.createdAt),
])

// --- Relations (power Drizzle's relational query API, e.g. `with: { account, category }`) ---
export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  categories: many(categories),
  transactions: many(transactions),
  goals: many(goals),
  budgets: many(budgets),
  shoppingLists: many(shoppingLists),
  taskCategories: many(taskCategories),
  tasks: many(tasks),
  longTasks: many(longTasks),
  notes: many(notes),
  transactionRules: many(transactionRules),
  recurringTransactions: many(recurringTransactions),
  recurringOccurrences: many(recurringOccurrences),
  aiGenerations: many(aiGenerations),
  chatConversations: many(chatConversations),
  chatMessages: many(chatMessages),
}))

export const aiGenerationsRelations = relations(aiGenerations, ({ one }) => ({
  user: one(users, { fields: [aiGenerations.userId], references: [users.id] }),
}))

export const chatConversationsRelations = relations(chatConversations, ({ one, many }) => ({
  user: one(users, { fields: [chatConversations.userId], references: [users.id] }),
  messages: many(chatMessages),
}))

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  user: one(users, { fields: [chatMessages.userId], references: [users.id] }),
  conversation: one(chatConversations, { fields: [chatMessages.conversationId], references: [chatConversations.id] }),
}))

export const accountsRelations = relations(accounts, ({ one, many }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
  transactions: many(transactions),
  goalLinks: many(goalAccounts),
  reconciliations: many(accountReconciliations),
}))

export const accountReconciliationsRelations = relations(accountReconciliations, ({ one }) => ({
  user: one(users, { fields: [accountReconciliations.userId], references: [users.id] }),
  account: one(accounts, { fields: [accountReconciliations.accountId], references: [accounts.id] }),
}))

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  user: one(users, { fields: [categories.userId], references: [users.id] }),
  transactions: many(transactions),
  budgets: many(budgets),
  rules: many(transactionRules),
}))

export const budgetsRelations = relations(budgets, ({ one }) => ({
  user: one(users, { fields: [budgets.userId], references: [users.id] }),
  category: one(categories, { fields: [budgets.categoryId], references: [categories.id] }),
}))

export const budgetIncomesRelations = relations(budgetIncomes, ({ one }) => ({
  user: one(users, { fields: [budgetIncomes.userId], references: [users.id] }),
}))

export const transactionsRelations = relations(transactions, ({ one }) => ({
  user: one(users, { fields: [transactions.userId], references: [users.id] }),
  account: one(accounts, { fields: [transactions.accountId], references: [accounts.id] }),
  category: one(categories, { fields: [transactions.categoryId], references: [categories.id] }),
  recurring: one(recurringTransactions, { fields: [transactions.recurringId], references: [recurringTransactions.id] }),
}))

export const goalsRelations = relations(goals, ({ one, many }) => ({
  user: one(users, { fields: [goals.userId], references: [users.id] }),
  links: many(goalAccounts),
}))

export const goalAccountsRelations = relations(goalAccounts, ({ one }) => ({
  goal: one(goals, { fields: [goalAccounts.goalId], references: [goals.id] }),
  account: one(accounts, { fields: [goalAccounts.accountId], references: [accounts.id] }),
}))

export const shoppingListsRelations = relations(shoppingLists, ({ one, many }) => ({
  user: one(users, { fields: [shoppingLists.userId], references: [users.id] }),
  items: many(shoppingListItems),
}))

export const shoppingListItemsRelations = relations(shoppingListItems, ({ one }) => ({
  list: one(shoppingLists, { fields: [shoppingListItems.listId], references: [shoppingLists.id] }),
}))

export const taskCategoriesRelations = relations(taskCategories, ({ one, many }) => ({
  user: one(users, { fields: [taskCategories.userId], references: [users.id] }),
  tasks: many(tasks),
  longTasks: many(longTasks),
}))

export const tasksRelations = relations(tasks, ({ one }) => ({
  user: one(users, { fields: [tasks.userId], references: [users.id] }),
  category: one(taskCategories, { fields: [tasks.categoryId], references: [taskCategories.id] }),
  longTask: one(longTasks, { fields: [tasks.longTaskId], references: [longTasks.id] }),
}))

export const longTasksRelations = relations(longTasks, ({ one, many }) => ({
  user: one(users, { fields: [longTasks.userId], references: [users.id] }),
  category: one(taskCategories, { fields: [longTasks.categoryId], references: [taskCategories.id] }),
  tasks: many(tasks),
}))

export const notesRelations = relations(notes, ({ one }) => ({
  user: one(users, { fields: [notes.userId], references: [users.id] }),
}))

export const passwordResetTokensRelations = relations(passwordResetTokens, ({ one }) => ({
  user: one(users, { fields: [passwordResetTokens.userId], references: [users.id] }),
}))

export const transactionRulesRelations = relations(transactionRules, ({ one }) => ({
  user: one(users, { fields: [transactionRules.userId], references: [users.id] }),
  category: one(categories, { fields: [transactionRules.categoryId], references: [categories.id] }),
}))

export const recurringTransactionsRelations = relations(recurringTransactions, ({ one, many }) => ({
  user: one(users, { fields: [recurringTransactions.userId], references: [users.id] }),
  account: one(accounts, { fields: [recurringTransactions.accountId], references: [accounts.id] }),
  category: one(categories, { fields: [recurringTransactions.categoryId], references: [categories.id] }),
  transactions: many(transactions),
  occurrences: many(recurringOccurrences),
}))

export const recurringOccurrencesRelations = relations(recurringOccurrences, ({ one }) => ({
  user: one(users, { fields: [recurringOccurrences.userId], references: [users.id] }),
  recurring: one(recurringTransactions, { fields: [recurringOccurrences.recurringId], references: [recurringTransactions.id] }),
  transaction: one(transactions, { fields: [recurringOccurrences.transactionId], references: [transactions.id] }),
}))
