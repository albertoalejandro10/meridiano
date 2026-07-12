import { relations } from 'drizzle-orm'
import {
  type AnyPgColumn,
  boolean,
  date,
  index,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
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
  icon: text('icon'),
  type: transactionTypeEnum('type'),
}, t => [
  unique('categories_user_id_name_key').on(t.userId, t.name),
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
  // POST-MVP blob: receipt object pathname (nullable until the feature ships).
  receiptPathname: text('receipt_pathname'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().$onUpdate(() => new Date()),
}, t => [
  index('transactions_user_id_date_idx').on(t.userId, t.date),
  index('transactions_account_id_idx').on(t.accountId),
  index('transactions_transfer_id_idx').on(t.transferId),
  index('transactions_fee_of_id_idx').on(t.feeOfId),
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

// --- Relations (power Drizzle's relational query API, e.g. `with: { account, category }`) ---
export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  categories: many(categories),
  transactions: many(transactions),
  goals: many(goals),
}))

export const accountsRelations = relations(accounts, ({ one, many }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
  transactions: many(transactions),
  goalLinks: many(goalAccounts),
}))

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  user: one(users, { fields: [categories.userId], references: [users.id] }),
  transactions: many(transactions),
}))

export const transactionsRelations = relations(transactions, ({ one }) => ({
  user: one(users, { fields: [transactions.userId], references: [users.id] }),
  account: one(accounts, { fields: [transactions.accountId], references: [accounts.id] }),
  category: one(categories, { fields: [transactions.categoryId], references: [categories.id] }),
}))

export const goalsRelations = relations(goals, ({ one, many }) => ({
  user: one(users, { fields: [goals.userId], references: [users.id] }),
  links: many(goalAccounts),
}))

export const goalAccountsRelations = relations(goalAccounts, ({ one }) => ({
  goal: one(goals, { fields: [goalAccounts.goalId], references: [goals.id] }),
  account: one(accounts, { fields: [goalAccounts.accountId], references: [accounts.id] }),
}))

export const passwordResetTokensRelations = relations(passwordResetTokens, ({ one }) => ({
  user: one(users, { fields: [passwordResetTokens.userId], references: [users.id] }),
}))
