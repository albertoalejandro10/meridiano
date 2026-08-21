import { db } from '@nuxthub/db'
import type { TransactionType } from '~~/shared/schemas'

export interface CategorizationRule {
  keyword: string
  categoryId: string
  // The category's optional type: a typed category only fires on transactions
  // of that type (mirrors how the transaction modal filters category options).
  categoryType: TransactionType | null
}

// Enabled rules in priority order (lower first), ready for matchCategory.
// Loaded once per request/batch — matching itself is a pure in-memory loop.
export async function getActiveRules(userId: string): Promise<CategorizationRule[]> {
  const rules = await db.query.transactionRules.findMany({
    where: (r, { and, eq }) => and(eq(r.userId, userId), eq(r.enabled, true)),
    orderBy: (r, { asc }) => [asc(r.priority)],
    columns: { keyword: true, categoryId: true },
    with: { category: { columns: { type: true } } },
  })
  return rules.map(r => ({
    keyword: r.keyword,
    categoryId: r.categoryId,
    categoryType: r.category.type,
  }))
}

// First match wins: case-insensitive "description contains keyword".
// Returns the matched categoryId, or null when nothing applies.
export function matchCategory(
  description: string | null | undefined,
  txType: TransactionType,
  rules: CategorizationRule[],
): string | null {
  if (!description) return null
  const haystack = description.toLowerCase()
  for (const rule of rules) {
    if (rule.categoryType && rule.categoryType !== txType) continue
    if (haystack.includes(rule.keyword.toLowerCase())) return rule.categoryId
  }
  return null
}
