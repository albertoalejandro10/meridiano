import type { TransactionType } from '~~/shared/schemas'

// Where fee rows land (see ensureFeesCategory in server/utils/categories.ts).
// Shared with the seed list below so both stay one definition.
export const feesCategory: { name: string, icon: string, type: TransactionType } = {
  name: 'Fees',
  icon: 'i-lucide-receipt',
  type: 'EXPENSE',
}

// Starter categories every new user gets on register so the transaction form
// isn't empty. Names are unique per user (categories_user_id_name_key), and the
// icons match how the transaction UI renders `category.icon` (Lucide names).
export const defaultCategories: { name: string, icon: string, type: TransactionType }[] = [
  // Income
  { name: 'Salary', icon: 'i-lucide-briefcase', type: 'INCOME' },
  { name: 'Freelance', icon: 'i-lucide-laptop', type: 'INCOME' },
  { name: 'Gifts', icon: 'i-lucide-gift', type: 'INCOME' },
  { name: 'Other Income', icon: 'i-lucide-plus-circle', type: 'INCOME' },
  // Expenses
  { name: 'Groceries', icon: 'i-lucide-shopping-cart', type: 'EXPENSE' },
  { name: 'Dining', icon: 'i-lucide-utensils', type: 'EXPENSE' },
  { name: 'Transport', icon: 'i-lucide-car', type: 'EXPENSE' },
  { name: 'Housing', icon: 'i-lucide-house', type: 'EXPENSE' },
  { name: 'Utilities', icon: 'i-lucide-zap', type: 'EXPENSE' },
  { name: 'Health', icon: 'i-lucide-heart-pulse', type: 'EXPENSE' },
  { name: 'Shopping', icon: 'i-lucide-shopping-bag', type: 'EXPENSE' },
  { name: 'Entertainment', icon: 'i-lucide-gamepad-2', type: 'EXPENSE' },
  feesCategory,
  { name: 'Other', icon: 'i-lucide-ellipsis', type: 'EXPENSE' },
]
