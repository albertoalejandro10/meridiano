import { accountTypeGroups, type AccountType } from '~~/shared/schemas'
import { daysSince } from './dates'

export type AccountGroup = 'asset' | 'liability'

// Single source of truth for how each account type is iconed and grouped in the
// UI. Labels live in i18n (`accountTypes.<TYPE>` in i18n/locales/*.json) —
// resolve them with `t(accountTypeLabelKey(type))` where rendering happens.
export const accountTypeMeta: Record<AccountType, { icon: string, group: AccountGroup }> = {
  CASH: { icon: 'i-lucide-banknote', group: 'asset' },
  INVESTMENT: { icon: 'i-lucide-trending-up', group: 'asset' },
  CRYPTO: { icon: 'i-lucide-bitcoin', group: 'asset' },
  PROPERTY: { icon: 'i-lucide-house', group: 'asset' },
  VEHICLE: { icon: 'i-lucide-car', group: 'asset' },
  OTHER_ASSET: { icon: 'i-lucide-wallet', group: 'asset' },
  CREDIT_CARD: { icon: 'i-lucide-credit-card', group: 'liability' },
  LOAN: { icon: 'i-lucide-landmark', group: 'liability' },
  OTHER_LIABILITY: { icon: 'i-lucide-receipt', group: 'liability' },
}

export function accountGroup(type: string): AccountGroup {
  return accountTypeMeta[type as AccountType]?.group ?? 'asset'
}

// Vehicles and other possessions are fixed-value items: their worth is entered by hand
// and doesn't fluctuate, so they show no value-trend chart and are realized by "selling".
// Market-priced assets (investments, crypto, property) and cash are excluded.
export function isFixedValueAsset(type: string): boolean {
  return type === 'VEHICLE' || type === 'OTHER_ASSET'
}

// Non-transactable possessions: their value is entered by hand and changes by
// editing the account or "selling" it, not by recording income/expenses against it,
// so they're hidden from the transaction account picker.
export function canTransact(type: string): boolean {
  return type !== 'PROPERTY' && type !== 'VEHICLE' && type !== 'OTHER_ASSET'
}

// Days without a registered transaction before an active account is flagged
// as needing catch-up.
export const STALE_AFTER_DAYS = 7

export interface AccountFreshness {
  type: string
  archived: boolean
  lastTransactionDate: string | null
  lastReconciliation: { date: string } | null
  createdAt: string | Date
}

// Days since the account last showed a sign of life: a registered transaction or
// the user confirming it's up to date (a reconciliation checkpoint). Creation
// counts as activity so brand-new accounts don't start out stale.
export function daysSinceActivity(account: AccountFreshness): number {
  const days = [account.lastTransactionDate, account.lastReconciliation?.date, account.createdAt]
    .filter(d => d != null)
    .map(d => daysSince(d))
  // Most recent sign of life wins; a future-dated checkpoint isn't negative days.
  return Math.max(0, Math.min(...days))
}

// Only transactable, active accounts can fall behind — fixed-value possessions
// (property, vehicles…) never take transactions, so they're never stale.
export function isStaleAccount(account: AccountFreshness): boolean {
  return !account.archived && canTransact(account.type) && daysSinceActivity(account) > STALE_AFTER_DAYS
}

export function accountTypeLabelKey(type: string): string {
  return `accountTypes.${type}`
}

export function accountTypeIcon(type: string): string {
  return accountTypeMeta[type as AccountType]?.icon ?? 'i-lucide-wallet'
}

export interface AccountTypeOption { value: AccountType, labelKey: string, icon: string }

// Options for the "What would you like to add?" tile picker, filtered by context.
// Consumers map `labelKey` through `t()` inside a computed so labels track the locale.
export function accountTypeOptions(group: AccountGroup | 'all'): AccountTypeOption[] {
  const types: readonly AccountType[]
    = group === 'all'
      ? [...accountTypeGroups.asset, ...accountTypeGroups.liability]
      : accountTypeGroups[group]
  return types.map(value => ({ value, labelKey: accountTypeLabelKey(value), icon: accountTypeMeta[value].icon }))
}
