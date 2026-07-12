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
  // Optional fee, stored as a separate linked EXPENSE row (see feeOfId in the
  // DB schema). min(0) not positive(): 0/null both mean "no fee" (delete on update).
  fee: z.coerce.number().min(0).max(MAX_AMOUNT).nullish(),
})

export const transactionUpdateSchema = transactionSchema.partial()

export const transactionQuerySchema = z.object({
  accountId: z.uuid().optional(),
  type: z.enum(transactionTypes).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
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

// --- Transfers (move money between two own accounts; linked EXPENSE+INCOME pair) ---
export const transferSchema = z.object({
  fromAccountId: z.uuid(),
  toAccountId: z.uuid(),
  amount: z.coerce.number().positive().max(MAX_AMOUNT),
  date: z.coerce.date(),
  description: z.string().trim().max(200).nullish(),
  // Fee deducted from what the destination receives (amount − fee), so it must
  // stay below the amount. Recorded as an EXPENSE row on the destination.
  fee: z.coerce.number().min(0).max(MAX_AMOUNT).nullish(),
}).refine(d => d.fromAccountId !== d.toAccountId, {
  message: 'Choose two different accounts',
  path: ['toAccountId'],
}).refine(d => !d.fee || d.fee < d.amount, {
  message: 'Fee must be less than the amount',
  path: ['fee'],
})

// Sell an asset: proceeds go to a cash account and the asset is archived.
export const sellAssetSchema = z.object({
  toAccountId: z.uuid(),
  amount: z.coerce.number().positive().max(MAX_AMOUNT),
  date: z.coerce.date(),
  description: z.string().trim().max(200).nullish(),
  // Sale commission deducted from the proceeds (same rule as transfer fees).
  fee: z.coerce.number().min(0).max(MAX_AMOUNT).nullish(),
}).refine(d => !d.fee || d.fee < d.amount, {
  message: 'Fee must be less than the amount',
  path: ['fee'],
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
export type AccountInput = z.infer<typeof accountSchema>
export type TransactionInput = z.infer<typeof transactionSchema>
export type CategoryInput = z.infer<typeof categorySchema>
export type RegisterInput = z.infer<typeof registerSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type PasswordResetRequestInput = z.infer<typeof passwordResetRequestSchema>
export type PasswordResetInput = z.infer<typeof passwordResetSchema>
export type TransferInput = z.infer<typeof transferSchema>
export type SellAssetInput = z.infer<typeof sellAssetSchema>
