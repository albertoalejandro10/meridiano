import type { TransactionType } from '~~/shared/schemas'

// A seeded category. `slug` is the stable identity: the UI renders
// `categories.defaults.<slug>` (see app/utils/categories.ts), so `name` is *not*
// user-facing prose — it's the English identity that backs the
// `categories_user_id_name_key` unique index and the fallback if a key goes missing.
// Categories the user creates keep a NULL slug and render their own `name`.
export interface DefaultCategory {
  slug: string
  name: string
  icon: string
  // Omitted for categories that fit either side (see adjustmentCategory) — the
  // column is nullable and the pickers already treat NULL as "either".
  type?: TransactionType
}

// Where fee rows land (see ensureFeesCategory in server/utils/categories.ts).
// Shared with the seed list below so both stay one definition.
export const feesCategory: DefaultCategory = {
  slug: 'fees',
  name: 'Fees',
  icon: 'i-lucide-receipt',
  type: 'EXPENSE',
}

// Where reconciliation adjustments land (see ensureAdjustmentCategory).
// Deliberately untyped: an account can drift either way, so the row is INCOME or
// EXPENSE depending on which side the real balance ended up on.
export const adjustmentCategory: DefaultCategory = {
  slug: 'adjustment',
  name: 'Balance Adjustment',
  icon: 'i-lucide-scale',
}

// Starter categories every new user gets on register, and the set that
// restoreDefaultCategories tops up for users who predate an addition. Icons are
// Lucide names, matching how the transaction UI renders `category.icon`.
//
// Deliberately absent: "Debt payment" and "Savings". Both are *transfers* here
// (a liability payment is the INCOME leg of a transfer, savings move between own
// accounts), so they must not become expense categories or they'd double-count.
//
// The `name` values of the original 14 are load-bearing — migration 0013 matches
// them to backfill slugs onto existing rows. Never rename one.
export const defaultCategories: DefaultCategory[] = [
  // Income
  { slug: 'salary', name: 'Salary', icon: 'i-lucide-briefcase', type: 'INCOME' },
  { slug: 'freelance', name: 'Freelance', icon: 'i-lucide-laptop', type: 'INCOME' },
  { slug: 'bonus', name: 'Bonus', icon: 'i-lucide-award', type: 'INCOME' },
  { slug: 'investments', name: 'Investment Income', icon: 'i-lucide-trending-up', type: 'INCOME' },
  { slug: 'rentalIncome', name: 'Rental Income', icon: 'i-lucide-key-round', type: 'INCOME' },
  { slug: 'remittances', name: 'Remittances', icon: 'i-lucide-hand-coins', type: 'INCOME' },
  { slug: 'refunds', name: 'Refunds', icon: 'i-lucide-undo-2', type: 'INCOME' },
  { slug: 'gifts', name: 'Gifts', icon: 'i-lucide-gift', type: 'INCOME' },
  { slug: 'otherIncome', name: 'Other Income', icon: 'i-lucide-plus-circle', type: 'INCOME' },
  // Expenses
  { slug: 'groceries', name: 'Groceries', icon: 'i-lucide-shopping-cart', type: 'EXPENSE' },
  { slug: 'dining', name: 'Dining', icon: 'i-lucide-utensils', type: 'EXPENSE' },
  { slug: 'transport', name: 'Transport', icon: 'i-lucide-car', type: 'EXPENSE' },
  { slug: 'fuel', name: 'Fuel', icon: 'i-lucide-fuel', type: 'EXPENSE' },
  { slug: 'housing', name: 'Housing', icon: 'i-lucide-house', type: 'EXPENSE' },
  { slug: 'utilities', name: 'Utilities', icon: 'i-lucide-zap', type: 'EXPENSE' },
  { slug: 'internetPhone', name: 'Internet & Phone', icon: 'i-lucide-wifi', type: 'EXPENSE' },
  { slug: 'health', name: 'Health', icon: 'i-lucide-heart-pulse', type: 'EXPENSE' },
  { slug: 'insurance', name: 'Insurance', icon: 'i-lucide-shield-check', type: 'EXPENSE' },
  { slug: 'education', name: 'Education', icon: 'i-lucide-graduation-cap', type: 'EXPENSE' },
  { slug: 'childcare', name: 'Childcare', icon: 'i-lucide-baby', type: 'EXPENSE' },
  { slug: 'shopping', name: 'Shopping', icon: 'i-lucide-shopping-bag', type: 'EXPENSE' },
  { slug: 'clothing', name: 'Clothing', icon: 'i-lucide-shirt', type: 'EXPENSE' },
  { slug: 'personalCare', name: 'Personal Care', icon: 'i-lucide-scissors', type: 'EXPENSE' },
  { slug: 'fitness', name: 'Fitness', icon: 'i-lucide-dumbbell', type: 'EXPENSE' },
  { slug: 'entertainment', name: 'Entertainment', icon: 'i-lucide-gamepad-2', type: 'EXPENSE' },
  { slug: 'subscriptions', name: 'Subscriptions', icon: 'i-lucide-repeat', type: 'EXPENSE' },
  { slug: 'travel', name: 'Travel', icon: 'i-lucide-plane', type: 'EXPENSE' },
  { slug: 'pets', name: 'Pets', icon: 'i-lucide-paw-print', type: 'EXPENSE' },
  { slug: 'giftsGiven', name: 'Gifts Given', icon: 'i-lucide-gift', type: 'EXPENSE' },
  { slug: 'donations', name: 'Donations', icon: 'i-lucide-hand-heart', type: 'EXPENSE' },
  { slug: 'taxes', name: 'Taxes', icon: 'i-lucide-landmark', type: 'EXPENSE' },
  feesCategory,
  { slug: 'other', name: 'Other', icon: 'i-lucide-ellipsis', type: 'EXPENSE' },
  // Untyped, so it sorts with neither header in the pickers.
  adjustmentCategory,
]
