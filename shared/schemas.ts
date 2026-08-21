import { z } from 'zod'

export const currencies = ['USD', 'VES', 'EUR'] as const
export const accountTypes = [
  'CASH',
  'INVESTMENT',
  'CRYPTO',
  'PROPERTY',
  'VEHICLE',
  'OTHER_ASSET',
  'CREDIT_CARD',
  'LOAN',
  'OTHER_LIABILITY',
] as const
export type AccountType = (typeof accountTypes)[number]

// Which types count as an asset vs a liability. Shared so the server and
// client agree on the Asset/Debt split (the UI also derives icons/labels from it).
export const accountTypeGroups = {
  asset: ['CASH', 'INVESTMENT', 'CRYPTO', 'PROPERTY', 'VEHICLE', 'OTHER_ASSET'],
  liability: ['CREDIT_CARD', 'LOAN', 'OTHER_LIABILITY'],
} as const satisfies Record<'asset' | 'liability', AccountType[]>

export function isLiabilityType(type: string): boolean {
  return (accountTypeGroups.liability as readonly string[]).includes(type)
}

export const transactionTypes = ['INCOME', 'EXPENSE'] as const
export type TransactionType = (typeof transactionTypes)[number]

// Cadences for scheduled/recurring transactions. Single source of truth —
// mirrored by the `recurring_cadence` pg enum and reused by the analytics
// detection heuristic (server/utils/recurring.ts).
export const cadences = ['WEEKLY', 'BIWEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY'] as const
export type Cadence = (typeof cadences)[number]

// Money columns are numeric(14, 2) — cap inputs so oversized values fail
// validation (422) instead of overflowing in Postgres (500).
const MAX_AMOUNT = 999_999_999_999

// Field sets are defined without defaults so the update (PATCH) schemas can be
// derived via `.partial()` safely: in Zod 4, `.partial()` on a field that has
// `.default()` still applies the default, which would silently reset omitted
// fields on partial updates.
const accountFields = {
  name: z.string().trim().min(1).max(60),
  type: z.enum(accountTypes),
  currency: z.enum(currencies),
  // Liabilities are stored positive (amount owed); assets may go negative (overdraft).
  initialBalance: z.coerce.number().finite().min(-MAX_AMOUNT).max(MAX_AMOUNT),
  archived: z.boolean(),
}

export const accountSchema = z.object({
  ...accountFields,
  type: accountFields.type.default('CASH'),
  currency: accountFields.currency.default('USD'),
  initialBalance: accountFields.initialBalance.default(0),
  archived: accountFields.archived.default(false),
})

export const accountUpdateSchema = z.object(accountFields).partial()

export const transactionSchema = z.object({
  accountId: z.uuid(),
  categoryId: z.uuid().nullish(),
  type: z.enum(transactionTypes),
  amount: z.coerce.number().positive().max(MAX_AMOUNT),
  date: z.coerce.date(),
  description: z.string().trim().max(200).nullish(),
  // Optional fees (platforms may charge an internal and an external one), each
  // stored as a separate linked EXPENSE row (see feeOfId/feeKind in the DB
  // schema). min(0) not positive(): 0/null both mean "no fee" (delete on update).
  internalFee: z.coerce.number().min(0).max(MAX_AMOUNT).nullish(),
  externalFee: z.coerce.number().min(0).max(MAX_AMOUNT).nullish(),
})

export const transactionUpdateSchema = transactionSchema.partial()

export const transactionQuerySchema = z.object({
  accountId: z.uuid().optional(),
  // 'none' = uncategorized (categoryId IS NULL) — a query string can't express null.
  categoryId: z.union([z.uuid(), z.literal('none')]).optional(),
  type: z.enum(transactionTypes).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
})

// --- Analytics (read-only aggregations; months are 'yyyy-MM', matching the
// DB's 'yyyy-MM-dd' date-string prefix) ---
export const analyticsSpendingQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(), // default: current month (server-side)
  type: z.enum(transactionTypes).default('EXPENSE'),
})

export const analyticsRangeQuerySchema = z.object({
  months: z.coerce.number().int().min(1).max(60).default(12),
})

export const categorySchema = z.object({
  name: z.string().trim().min(1).max(40),
  icon: z.string().trim().max(60).nullish(),
  type: z.enum(transactionTypes).nullish(),
})

// Curated identity options for a goal — kept small so the pickers stay tidy and
// the accent classes can be statically enumerated for Tailwind (see app/utils/goals.ts).
export const goalIcons = [
  'i-lucide-target',
  'i-lucide-piggy-bank',
  'i-lucide-house',
  'i-lucide-plane',
  'i-lucide-car',
  'i-lucide-graduation-cap',
  'i-lucide-gem',
  'i-lucide-baby',
  'i-lucide-heart',
  'i-lucide-shield',
  'i-lucide-gift',
  'i-lucide-palmtree',
] as const
export type GoalIcon = (typeof goalIcons)[number]

export const goalColors = [
  'emerald',
  'sky',
  'violet',
  'amber',
  'rose',
  'teal',
  'pink',
  'indigo',
] as const
export type GoalColor = (typeof goalColors)[number]

const goalFields = {
  name: z.string().trim().min(1).max(60),
  targetAmount: z.coerce.number().positive().max(MAX_AMOUNT),
  currency: z.enum(currencies),
  startDate: z.coerce.date(),
  targetDate: z.coerce.date().nullish(),
  icon: z.enum(goalIcons),
  color: z.enum(goalColors),
  // The asset accounts backing this goal. On update, a provided list replaces the set.
  accountIds: z.array(z.uuid()),
}

export const goalSchema = z.object({
  ...goalFields,
  currency: goalFields.currency.default('USD'),
  icon: goalFields.icon.default('i-lucide-target'),
  color: goalFields.color.default('sky'),
  accountIds: goalFields.accountIds.default([]),
})

export const goalUpdateSchema = z.object(goalFields).partial()

// --- Budgets (monthly limit per category+currency; also the envelope
// allocation in zero-based mode) ---
const budgetFields = {
  categoryId: z.uuid(),
  currency: z.enum(currencies),
  amount: z.coerce.number().positive().max(MAX_AMOUNT),
}

export const budgetSchema = z.object({
  ...budgetFields,
  currency: budgetFields.currency.default('USD'),
})

export const budgetUpdateSchema = z.object(budgetFields).partial()

// Expected monthly income to allocate in envelope mode. amount = null clears
// the row (back to "not set").
export const budgetIncomeSchema = z.object({
  currency: z.enum(currencies),
  amount: z.coerce.number().positive().max(MAX_AMOUNT).nullable(),
})

// --- Transfers (move money between two own accounts; linked EXPENSE+INCOME pair) ---
export const transferSchema = z.object({
  fromAccountId: z.uuid(),
  toAccountId: z.uuid(),
  amount: z.coerce.number().positive().max(MAX_AMOUNT),
  // Cross-currency only: the exact amount that lands on the destination, in
  // its currency. The FX rate is implicit (receivedAmount / amount), never
  // stored. 0/null both mean "not set" (min(0) so a 0 form default passes);
  // the server requires it iff the account currencies differ.
  receivedAmount: z.coerce.number().min(0).max(MAX_AMOUNT).nullish(),
  date: z.coerce.date(),
  description: z.string().trim().max(200).nullish(),
  // Internal fee: what the source platform charges to send — an EXPENSE on the
  // source account, on top of the amount. External fee: lost in transit — an
  // EXPENSE on the destination (it nets the destination amount − externalFee),
  // so it must stay below what the destination receives.
  internalFee: z.coerce.number().min(0).max(MAX_AMOUNT).nullish(),
  externalFee: z.coerce.number().min(0).max(MAX_AMOUNT).nullish(),
}).refine(d => d.fromAccountId !== d.toAccountId, {
  message: 'Choose two different accounts',
  path: ['toAccountId'],
}).refine(d => !d.externalFee || d.externalFee < (d.receivedAmount || d.amount), {
  message: 'External fee must be less than the received amount',
  path: ['externalFee'],
})

// Sell an asset: proceeds go to a cash account and the asset is archived.
export const sellAssetSchema = z.object({
  toAccountId: z.uuid(),
  amount: z.coerce.number().positive().max(MAX_AMOUNT),
  date: z.coerce.date(),
  description: z.string().trim().max(200).nullish(),
  // Same fee model as transfers: internal is charged to the asset side on top
  // of the sale price; external is deducted from the proceeds, so it must stay
  // below the amount.
  internalFee: z.coerce.number().min(0).max(MAX_AMOUNT).nullish(),
  externalFee: z.coerce.number().min(0).max(MAX_AMOUNT).nullish(),
}).refine(d => !d.externalFee || d.externalFee < d.amount, {
  message: 'External fee must be less than the amount',
  path: ['externalFee'],
})

// Reconciliation checkpoint: the account's real bank/platform balance on a
// date. Same sign convention as balances — liabilities state a positive
// "amount owed"; assets may state a negative (overdraft).
export const reconcileSchema = z.object({
  statedBalance: z.coerce.number().finite().min(-MAX_AMOUNT).max(MAX_AMOUNT),
  date: z.coerce.date(),
  // Close the gap with a balancing transaction instead of only recording it.
  // Defaults to false so a caller that just wants a checkpoint (or that predates
  // the option) never silently writes a transaction.
  applyAdjustment: z.boolean().optional().default(false),
})

// --- Shopping lists (VES-priced items; USD needed at BCV / Binance P2P rates) ---
const shoppingListFields = {
  name: z.string().trim().min(1).max(60),
  // VES per USD. Nullish = "no rate yet" (external API down and no manual entry).
  bcvRate: z.coerce.number().positive().max(MAX_AMOUNT).nullish(),
  binanceRate: z.coerce.number().positive().max(MAX_AMOUNT).nullish(),
}

export const shoppingListSchema = z.object(shoppingListFields)
export const shoppingListUpdateSchema = z.object(shoppingListFields).partial()

const shoppingListItemFields = {
  name: z.string().trim().min(1).max(100),
  quantity: z.coerce.number().positive().max(999_999),
  // min(0) not positive(): a price is often unknown until at the store.
  unitPrice: z.coerce.number().min(0).max(MAX_AMOUNT),
  checked: z.boolean(),
}

export const shoppingListItemSchema = z.object({
  ...shoppingListItemFields,
  quantity: shoppingListItemFields.quantity.default(1),
  unitPrice: shoppingListItemFields.unitPrice.default(0),
  checked: shoppingListItemFields.checked.default(false),
})

export const shoppingListItemUpdateSchema = z.object(shoppingListItemFields).partial()

// --- Monthly tasks (GTD-style personal to-dos scoped to a 'yyyy-MM' month;
// standalone — no link to accounts/transactions/balances) ---
export const taskPriorities = ['HIGH', 'MEDIUM', 'LOW'] as const
export type TaskPriority = (typeof taskPriorities)[number]

const monthString = z.string().regex(/^\d{4}-\d{2}$/)

// Curated identity options for a task category — same idea as goalIcons: a
// small set keeps the picker tidy. Colors reuse the goalColors palette so the
// accent classes in app/utils/goals.ts cover both features.
export const taskCategoryIcons = [
  'i-lucide-folder',
  'i-lucide-house',
  'i-lucide-wallet',
  'i-lucide-heart-pulse',
  'i-lucide-briefcase',
  'i-lucide-dumbbell',
  'i-lucide-book-open',
  'i-lucide-users',
  'i-lucide-wrench',
  'i-lucide-sparkles',
  'i-lucide-shopping-bag',
  'i-lucide-plane',
] as const
export type TaskCategoryIcon = (typeof taskCategoryIcons)[number]

const taskCategoryFields = {
  name: z.string().trim().min(1).max(40),
  icon: z.enum(taskCategoryIcons),
  color: z.enum(goalColors),
}

export const taskCategorySchema = z.object({
  ...taskCategoryFields,
  icon: taskCategoryFields.icon.default('i-lucide-folder'),
  color: taskCategoryFields.color.default('sky'),
})

export const taskCategoryUpdateSchema = z.object(taskCategoryFields).partial()

const taskFields = {
  title: z.string().trim().min(1).max(120),
  notes: z.string().trim().max(500).nullish(),
  priority: z.enum(taskPriorities),
  categoryId: z.uuid().nullish(),
  // Optional GTD project link: this monthly task is a next action toward a
  // long task (e.g. "Do 3 English lessons" → "Learn English").
  longTaskId: z.uuid().nullish(),
  month: monthString,
  dueDate: z.coerce.date().nullish(),
  done: z.boolean(),
}

// dueDate must fall inside the task's month. 'yyyy-MM-dd' parses as UTC
// midnight, so the UTC ISO prefix is the right comparison (same reasoning as
// toDateStr in server/utils/serialize.ts). On PATCH the same check runs in the
// handler against the merged row — a .partial() refine can't see unchanged fields.
export const taskSchema = z.object({
  ...taskFields,
  priority: taskFields.priority.default('MEDIUM'),
  done: taskFields.done.default(false),
}).refine(d => !d.dueDate || d.dueDate.toISOString().slice(0, 7) === d.month, {
  message: 'Due date must fall within the task month',
  path: ['dueDate'],
})

export const taskUpdateSchema = z.object(taskFields).partial()

export const taskQuerySchema = z.object({
  month: monthString.optional(), // default: current month (server-side)
})

// Carry unfinished tasks from previous months into toMonth (user-selected ids).
export const taskCarryOverSchema = z.object({
  ids: z.array(z.uuid()).min(1),
  toMonth: monthString,
})

// Long tasks: GTD projects/commitments that outlive a month ("Learn English").
// Not month-scoped; an optional targetDate is a free deadline, not month-bound.
const longTaskFields = {
  title: z.string().trim().min(1).max(120),
  notes: z.string().trim().max(500).nullish(),
  priority: z.enum(taskPriorities),
  categoryId: z.uuid().nullish(),
  targetDate: z.coerce.date().nullish(),
  done: z.boolean(),
}

export const longTaskSchema = z.object({
  ...longTaskFields,
  priority: longTaskFields.priority.default('MEDIUM'),
  done: longTaskFields.done.default(false),
})

export const longTaskUpdateSchema = z.object(longTaskFields).partial()

// --- Notes (free-form markdown the user keeps for themselves) ---
// Tags are the only organisation, so they must compare exactly: normalised to
// lowercase here (in the shared schema, so the client's filter chips and the
// server's stored values can never disagree), spaces collapsed to single
// hyphens, then de-duplicated with insertion order preserved.
export const MAX_NOTE_TAGS = 12
export const MAX_NOTE_CONTENT = 50_000

const noteTag = z.string()
  .trim()
  .toLowerCase()
  .transform(s => s.replace(/\s+/g, '-'))
  .pipe(z.string().min(1).max(30))

const noteFields = {
  title: z.string().trim().min(1).max(160),
  content: z.string().max(MAX_NOTE_CONTENT),
  tags: z.array(noteTag)
    .max(MAX_NOTE_TAGS)
    .transform(tags => [...new Set(tags)]),
  pinned: z.boolean(),
}

export const noteSchema = z.object({
  ...noteFields,
  content: noteFields.content.default(''),
  tags: noteFields.tags.default([]),
  pinned: noteFields.pinned.default(false),
})

export const noteUpdateSchema = z.object(noteFields).partial()

export const noteQuerySchema = z.object({
  // Case-insensitive substring match over title + content.
  search: z.string().trim().max(100).optional(),
  // Exact tag match; already-normalised values come back from the filter chips,
  // but a hand-typed query string gets the same treatment.
  tag: noteTag.optional(),
})

// --- Transaction rules (auto-categorization: "description contains keyword → category") ---
const transactionRuleFields = {
  keyword: z.string().trim().min(1).max(100),
  categoryId: z.uuid(),
  enabled: z.boolean(),
}

export const transactionRuleSchema = z.object({
  ...transactionRuleFields,
  enabled: transactionRuleFields.enabled.default(true),
})

export const transactionRuleUpdateSchema = z.object(transactionRuleFields).partial()

// Full ordered id list — the server validates it is exactly the user's rule set.
export const ruleReorderSchema = z.object({
  ids: z.array(z.uuid()).min(1),
})

// --- Recurring transaction templates (confirm-first — nothing is auto-created) ---
const recurringFields = {
  accountId: z.uuid(),
  categoryId: z.uuid().nullish(),
  type: z.enum(transactionTypes),
  // Optional *estimate* only: it prefills the review form and feeds the
  // forecast. Real bills drift, so the charged figure is whatever the user
  // types when confirming an occurrence.
  amount: z.coerce.number().positive().max(MAX_AMOUNT).nullish(),
  // Required (unlike transactions): it's the template's display name and what
  // categorization rules match against when no category is set.
  description: z.string().trim().min(1).max(200),
  cadence: z.enum(cadences),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().nullish(),
  enabled: z.boolean(),
}

export const recurringSchema = z.object({
  ...recurringFields,
  enabled: recurringFields.enabled.default(true),
}).refine(d => !d.endDate || d.endDate >= d.startDate, {
  message: 'End date must be on or after the start date',
  path: ['endDate'],
})

export const recurringUpdateSchema = z.object(recurringFields).partial()

// How the user answered a due occurrence (mirrors the pg enum).
export const occurrenceStatuses = ['PAID', 'SKIPPED'] as const
export type OccurrenceStatus = (typeof occurrenceStatuses)[number]

// One answered occurrence, identified by its template + derived due date (the
// pair is unique in the DB, so re-submitting a review is a no-op).
const recurringConfirmItem = z.object({
  recurringId: z.uuid(),
  dueDate: z.coerce.date(),
  status: z.enum(occurrenceStatuses),
  // PAID only. `date` defaults to the due date server-side when omitted (the
  // bill's due day and the day it was actually paid often differ).
  amount: z.coerce.number().positive().max(MAX_AMOUNT).nullish(),
  date: z.coerce.date().nullish(),
  categoryId: z.uuid().nullish(),
  note: z.string().trim().max(200).nullish(),
}).refine(d => d.status !== 'PAID' || (d.amount != null && d.amount > 0), {
  message: 'An amount is required to mark an occurrence as paid',
  path: ['amount'],
})

// Batched: the review screen answers every pending occurrence in one submit.
export const recurringConfirmSchema = z.object({
  items: z.array(recurringConfirmItem).min(1).max(50),
})

// --- AI financial digest (one-shot narrative over the analytics data above) ---
export const aiDigestSchema = z.object({
  locale: z.enum(['en', 'es']).default('en'),
})

// --- AI coaching over planning simulations (app/utils/planning.ts) ---
// The client already ran the simulation (APR/payment/tried-amount are planner
// inputs with no server-side counterpart — see the comment on those functions);
// these endpoints only narrate the already-computed outcome.
const aiPayoffPlanSummary = z.object({
  months: z.coerce.number().int().min(0).max(1200),
  paidOff: z.boolean(),
  totalInterest: z.coerce.number().min(0).max(MAX_AMOUNT),
})

export const aiDebtCoachingSchema = z.object({
  locale: z.enum(['en', 'es']).default('en'),
  currency: z.enum(currencies),
  extraPerMonth: z.coerce.number().min(0).max(MAX_AMOUNT),
  chosenStrategy: z.enum(['snowball', 'avalanche']),
  snowballPlan: aiPayoffPlanSummary,
  avalanchePlan: aiPayoffPlanSummary,
  debts: z.array(z.object({
    name: z.string().trim().min(1).max(60),
    balance: z.coerce.number().min(0).max(MAX_AMOUNT),
    apr: z.coerce.number().min(0).max(100),
    payment: z.coerce.number().min(0).max(MAX_AMOUNT),
  })).min(1).max(50),
})

export const aiGoalCoachingSchema = z.object({
  locale: z.enum(['en', 'es']).default('en'),
  goalName: z.string().trim().min(1).max(60),
  currency: z.enum(currencies),
  targetAmount: z.coerce.number().positive().max(MAX_AMOUNT),
  saved: z.coerce.number().min(-MAX_AMOUNT).max(MAX_AMOUNT),
  targetDate: z.coerce.date().nullish(),
  monthlyTried: z.coerce.number().min(0).max(MAX_AMOUNT),
  recentMonthlyNet: z.coerce.number().min(-MAX_AMOUNT).max(MAX_AMOUNT),
  projectedMonths: z.coerce.number().int().min(0).max(1200).nullish(),
  requiredPerMonth: z.coerce.number().min(0).max(MAX_AMOUNT).nullish(),
})

// --- AI conversational chat (Phase 4 — see docs/AI_FEATURES.md) ---
// Curated subset of OpenCode Go's model catalog offered in the chat model
// picker — same gateway as the one-shot generators in server/utils/ai.ts.
// 'glm-5.2' is the model already used there; the other two are the alternates
// named in that file's comment as untested-but-available swaps.
export const chatModels = ['glm-5.2', 'deepseek-v4-pro', 'kimi-k3'] as const
export type ChatModel = (typeof chatModels)[number]
export const DEFAULT_CHAT_MODEL: ChatModel = 'glm-5.2'

export const aiChatCreateConversationSchema = z.object({
  model: z.enum(chatModels).default(DEFAULT_CHAT_MODEL),
})

export const aiChatRenameConversationSchema = z.object({
  title: z.string().trim().min(1).max(80),
})

// Opens a conversation seeded with the user's stored digest. Only the locale
// (which digest to look up) and the title travel — the digest text itself is
// read server-side, never posted, so a caller can't put words in the
// assistant's mouth.
export const aiChatFromDigestSchema = z.object({
  model: z.enum(chatModels).default(DEFAULT_CHAT_MODEL),
  locale: z.enum(['en', 'es']).default('en'),
  title: z.string().trim().min(1).max(80),
})

// Message length is capped to bound cost/token exposure per turn — chat's
// cost shape (multi-turn, tool-calling) is meaningfully different from the
// one-shot generators above.
export const aiChatSendMessageSchema = z.object({
  text: z.string().trim().min(1).max(4000),
  locale: z.enum(['en', 'es']).default('en'),
  // Re-answering a message that's already stored (the "Try again" button on a
  // failed turn) rather than sending a new one — the handler skips persisting
  // `text` a second time.
  retry: z.boolean().default(false),
})

// --- User profile (optional context — Settings → Financial profile). Every field
// is independently editable any time and nullable; income implies a
// currency. Reused by the AI features when present (see server/utils/digest.ts
// and aiChat.ts) — never required for them to work. ---
export const employmentTypes = ['EMPLOYEE', 'SELF_EMPLOYED', 'FREELANCER', 'BUSINESS_OWNER'] as const
export type EmploymentType = (typeof employmentTypes)[number]

export const maritalStatuses = ['SINGLE', 'PARTNERED', 'MARRIED'] as const
export type MaritalStatus = (typeof maritalStatuses)[number]

export const riskTolerances = ['CONSERVATIVE', 'MODERATE', 'AGGRESSIVE'] as const
export type RiskTolerance = (typeof riskTolerances)[number]

export const userProfileSchema = z.object({
  jobTitle: z.string().trim().min(1).max(100).nullish(),
  income: z.coerce.number().min(0).max(MAX_AMOUNT).nullish(),
  incomeCurrency: z.enum(currencies).nullish(),
  employmentType: z.enum(employmentTypes).nullish(),
  maritalStatus: z.enum(maritalStatuses).nullish(),
  // Kids or others financially supported — independent of maritalStatus.
  dependents: z.coerce.number().int().min(0).max(50).nullish(),
  riskTolerance: z.enum(riskTolerances).nullish(),
  financialNotes: z.string().trim().max(500).nullish(),
}).refine(d => d.income == null || d.incomeCurrency != null, {
  message: 'Choose a currency for your income',
  path: ['incomeCurrency'],
})

// --- Full account backup (Settings → Imports). Export is unvalidated JSON;
// this validates a file re-uploaded for import. Row schemas mirror the raw DB
// shape (numeric/date columns as strings, matching server/utils/serialize.ts)
// rather than the API input shape, since export round-trips DB values as-is.
// Each row's `id` is the *old* id from the file — used only to remap
// references during import (transferId/feeOfId/categoryId/accountId/...),
// then discarded; import always mints fresh ids. A generous per-table cap
// bounds a malformed file without constraining any real personal dataset.
export const MAX_BACKUP_ROWS = 20_000

const backupUuid = z.uuid()
const backupNumericStr = z.string().regex(/^-?\d+(\.\d+)?$/, 'Invalid number')
const backupDateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date')
const backupTimestamp = z.coerce.date()

const backupAccountSchema = z.object({
  id: backupUuid,
  name: z.string(),
  type: z.enum(accountTypes),
  currency: z.enum(currencies),
  initialBalance: backupNumericStr,
  archived: z.boolean(),
  createdAt: backupTimestamp,
  updatedAt: backupTimestamp,
})

const backupCategorySchema = z.object({
  id: backupUuid,
  name: z.string(),
  slug: z.string().nullish(),
  icon: z.string().nullish(),
  type: z.enum(transactionTypes).nullish(),
})

const backupTransactionSchema = z.object({
  id: backupUuid,
  accountId: backupUuid,
  categoryId: backupUuid.nullish(),
  type: z.enum(transactionTypes),
  amount: backupNumericStr,
  currency: z.enum(currencies),
  date: backupDateStr,
  description: z.string().nullish(),
  transferId: backupUuid.nullish(),
  feeOfId: backupUuid.nullish(),
  feeKind: z.enum(['INTERNAL', 'EXTERNAL']).nullish(),
  recurringId: backupUuid.nullish(),
  createdAt: backupTimestamp,
  updatedAt: backupTimestamp,
})

const backupGoalSchema = z.object({
  id: backupUuid,
  name: z.string(),
  targetAmount: backupNumericStr,
  currency: z.enum(currencies),
  startDate: backupDateStr,
  targetDate: backupDateStr.nullish(),
  icon: z.string().nullish(),
  color: z.string().nullish(),
  createdAt: backupTimestamp,
  updatedAt: backupTimestamp,
})

const backupGoalAccountSchema = z.object({
  goalId: backupUuid,
  accountId: backupUuid,
})

const backupBudgetSchema = z.object({
  id: backupUuid,
  categoryId: backupUuid,
  currency: z.enum(currencies),
  amount: backupNumericStr,
  createdAt: backupTimestamp,
  updatedAt: backupTimestamp,
})

const backupBudgetIncomeSchema = z.object({
  currency: z.enum(currencies),
  amount: backupNumericStr,
  updatedAt: backupTimestamp,
})

const backupShoppingListSchema = z.object({
  id: backupUuid,
  name: z.string(),
  bcvRate: backupNumericStr.nullish(),
  binanceRate: backupNumericStr.nullish(),
  createdAt: backupTimestamp,
  updatedAt: backupTimestamp,
})

const backupShoppingListItemSchema = z.object({
  id: backupUuid,
  listId: backupUuid,
  name: z.string(),
  quantity: backupNumericStr,
  unitPrice: backupNumericStr,
  checked: z.boolean(),
  position: z.number().int(),
  createdAt: backupTimestamp,
  updatedAt: backupTimestamp,
})

const backupTaskCategorySchema = z.object({
  id: backupUuid,
  name: z.string(),
  icon: z.string().nullish(),
  color: z.string().nullish(),
  createdAt: backupTimestamp,
  updatedAt: backupTimestamp,
})

const backupLongTaskSchema = z.object({
  id: backupUuid,
  categoryId: backupUuid.nullish(),
  title: z.string(),
  notes: z.string().nullish(),
  priority: z.enum(taskPriorities),
  targetDate: backupDateStr.nullish(),
  done: z.boolean(),
  completedAt: backupTimestamp.nullish(),
  createdAt: backupTimestamp,
  updatedAt: backupTimestamp,
})

const backupTaskSchema = z.object({
  id: backupUuid,
  categoryId: backupUuid.nullish(),
  longTaskId: backupUuid.nullish(),
  title: z.string(),
  notes: z.string().nullish(),
  priority: z.enum(taskPriorities),
  month: monthString,
  dueDate: backupDateStr.nullish(),
  done: z.boolean(),
  completedAt: backupTimestamp.nullish(),
  carriedFromMonth: monthString.nullish(),
  createdAt: backupTimestamp,
  updatedAt: backupTimestamp,
})

const backupNoteSchema = z.object({
  id: backupUuid,
  title: z.string(),
  content: z.string(),
  tags: z.array(z.string()),
  pinned: z.boolean(),
  createdAt: backupTimestamp,
  updatedAt: backupTimestamp,
})

const backupTransactionRuleSchema = z.object({
  id: backupUuid,
  keyword: z.string(),
  categoryId: backupUuid,
  enabled: z.boolean(),
  priority: z.number().int(),
  createdAt: backupTimestamp,
  updatedAt: backupTimestamp,
})

const backupRecurringTransactionSchema = z.object({
  id: backupUuid,
  accountId: backupUuid,
  categoryId: backupUuid.nullish(),
  type: z.enum(transactionTypes),
  amount: backupNumericStr.nullish(),
  description: z.string(),
  cadence: z.enum(cadences),
  startDate: backupDateStr,
  endDate: backupDateStr.nullish(),
  enabled: z.boolean(),
  createdAt: backupTimestamp,
  updatedAt: backupTimestamp,
})

const backupRecurringOccurrenceSchema = z.object({
  id: backupUuid,
  recurringId: backupUuid,
  dueDate: backupDateStr,
  status: z.enum(occurrenceStatuses),
  transactionId: backupUuid.nullish(),
  note: z.string().nullish(),
  createdAt: backupTimestamp,
})

const backupAccountReconciliationSchema = z.object({
  id: backupUuid,
  accountId: backupUuid,
  statedBalance: backupNumericStr,
  date: backupDateStr,
  createdAt: backupTimestamp,
})

const backupProfileSchema = z.object({
  name: z.string().trim().min(1).max(60).nullish(),
  jobTitle: z.string().trim().min(1).max(100).nullish(),
  income: backupNumericStr.nullish(),
  incomeCurrency: z.enum(currencies).nullish(),
  employmentType: z.enum(employmentTypes).nullish(),
  maritalStatus: z.enum(maritalStatuses).nullish(),
  dependents: z.number().int().min(0).max(50).nullish(),
  riskTolerance: z.enum(riskTolerances).nullish(),
  financialNotes: z.string().trim().max(500).nullish(),
})

export const backupImportSchema = z.object({
  version: z.literal(1),
  profile: backupProfileSchema.nullish(),
  accounts: z.array(backupAccountSchema).max(MAX_BACKUP_ROWS),
  categories: z.array(backupCategorySchema).max(MAX_BACKUP_ROWS),
  transactions: z.array(backupTransactionSchema).max(MAX_BACKUP_ROWS),
  goals: z.array(backupGoalSchema).max(MAX_BACKUP_ROWS),
  goalAccounts: z.array(backupGoalAccountSchema).max(MAX_BACKUP_ROWS),
  budgets: z.array(backupBudgetSchema).max(MAX_BACKUP_ROWS),
  budgetIncomes: z.array(backupBudgetIncomeSchema).max(MAX_BACKUP_ROWS),
  shoppingLists: z.array(backupShoppingListSchema).max(MAX_BACKUP_ROWS),
  shoppingListItems: z.array(backupShoppingListItemSchema).max(MAX_BACKUP_ROWS),
  taskCategories: z.array(backupTaskCategorySchema).max(MAX_BACKUP_ROWS),
  longTasks: z.array(backupLongTaskSchema).max(MAX_BACKUP_ROWS),
  tasks: z.array(backupTaskSchema).max(MAX_BACKUP_ROWS),
  notes: z.array(backupNoteSchema).max(MAX_BACKUP_ROWS),
  transactionRules: z.array(backupTransactionRuleSchema).max(MAX_BACKUP_ROWS),
  recurringTransactions: z.array(backupRecurringTransactionSchema).max(MAX_BACKUP_ROWS),
  recurringOccurrences: z.array(backupRecurringOccurrenceSchema).max(MAX_BACKUP_ROWS),
  accountReconciliations: z.array(backupAccountReconciliationSchema).max(MAX_BACKUP_ROWS),
})

// --- Auth (nuxt-auth-utils, email/password) ---
export const registerSchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  email: z.email(),
  password: z.string().min(8).max(128),
})

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
})

export const passwordResetRequestSchema = z.object({
  email: z.email(),
})

export const passwordResetSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8).max(128),
})

export type GoalInput = z.infer<typeof goalSchema>
export type BudgetInput = z.infer<typeof budgetSchema>
export type BudgetIncomeInput = z.infer<typeof budgetIncomeSchema>
export type AccountInput = z.infer<typeof accountSchema>
export type TransactionInput = z.infer<typeof transactionSchema>
export type CategoryInput = z.infer<typeof categorySchema>
export type RegisterInput = z.infer<typeof registerSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type PasswordResetRequestInput = z.infer<typeof passwordResetRequestSchema>
export type PasswordResetInput = z.infer<typeof passwordResetSchema>
export type TransferInput = z.infer<typeof transferSchema>
export type SellAssetInput = z.infer<typeof sellAssetSchema>
export type ReconcileInput = z.infer<typeof reconcileSchema>
export type ShoppingListInput = z.infer<typeof shoppingListSchema>
export type ShoppingListItemInput = z.infer<typeof shoppingListItemSchema>
export type TaskInput = z.infer<typeof taskSchema>
export type TaskCategoryInput = z.infer<typeof taskCategorySchema>
export type TaskCarryOverInput = z.infer<typeof taskCarryOverSchema>
export type LongTaskInput = z.infer<typeof longTaskSchema>
export type NoteInput = z.infer<typeof noteSchema>
export type TransactionRuleInput = z.infer<typeof transactionRuleSchema>
export type RecurringInput = z.infer<typeof recurringSchema>
export type RecurringConfirmInput = z.infer<typeof recurringConfirmSchema>
export type RecurringConfirmItem = z.infer<typeof recurringConfirmItem>
export type BackupImportInput = z.infer<typeof backupImportSchema>
export type UserProfileInput = z.infer<typeof userProfileSchema>
export type AiDigestInput = z.infer<typeof aiDigestSchema>
export type AiDebtCoachingInput = z.infer<typeof aiDebtCoachingSchema>
export type AiGoalCoachingInput = z.infer<typeof aiGoalCoachingSchema>
