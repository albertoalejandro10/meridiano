import { db } from '@nuxthub/db'
import { tool } from 'ai'
import { z } from 'zod'

/**
 * A tool's output is fed straight back into the *next* step's prompt, where the
 * AI SDK validates it against a JSON-only `ModelMessage` schema. Drizzle rows
 * carry `Date` objects (`createdAt`/`updatedAt`/…), which fail that check and
 * abort the whole turn the moment the first tool returns — the user only ever
 * sees "Could not finish that response", and the logged prompt looks innocent
 * because the logger prints Dates as ISO strings. Round-tripping through JSON
 * gives the model the same ISO strings for real. Cheap: these payloads are a
 * few KB.
 */
function jsonSafe<T>(value: T): unknown {
  return JSON.parse(JSON.stringify(value))
}

/**
 * Read-only financial-query tools for the AI chat (Phase 4 — see
 * docs/AI_FEATURES.md). Every tool closes over `userId` captured here, never
 * accepting it as a model-supplied input — the same scoping rule every
 * /api/v1 handler follows, applied to tool calls too.
 */
export function buildChatTools(userId: string) {
  return {
    get_account_balances: tool({
      description: 'Get the user\'s accounts with their current derived balances, grouped by currency. Use this for questions about net worth, individual account balances, or what accounts the user has.',
      inputSchema: z.object({}),
      execute: async () => jsonSafe(await accountsWithBalance(userId)),
    }),

    get_cashflow: tool({
      description: 'Get monthly income vs. expense totals for the last N months, per currency. Use this for questions about cash flow, savings rate, or income/spending trends over time.',
      inputSchema: z.object({
        months: z.number().int().min(1).max(12).default(3).describe('How many recent months to include'),
      }),
      execute: async ({ months }) => jsonSafe(await computeCashflow(userId, months)),
    }),

    get_spending_by_category: tool({
      description: 'Get spending (or income) totals broken down by category for a single month. Use this for questions about where money went, top spending categories, or spending in a specific month.',
      inputSchema: z.object({
        month: z.string().regex(/^\d{4}-\d{2}$/).optional().describe('Month as yyyy-MM; defaults to the current month'),
        type: z.enum(['EXPENSE', 'INCOME']).default('EXPENSE'),
      }),
      execute: async ({ month, type }) => jsonSafe(await computeSpendingTotals(userId, month ?? lastMonths(1)[0]!, type)),
    }),

    get_recurring_items: tool({
      description: 'Get the user\'s recurring/subscription bills and income, including amount, cadence, and next due date. Use this for questions about subscriptions, recurring bills, or upcoming due dates.',
      inputSchema: z.object({}),
      execute: async () => jsonSafe(await gatherRecurringItems(userId)),
    }),

    get_goals: tool({
      description: 'Get the user\'s savings goals with progress: target amount, amount saved so far (from linked accounts), and recent monthly savings pace. Use this for questions about savings goals or progress toward them.',
      inputSchema: z.object({}),
      execute: async () => {
        const [goals, accounts, netByCurrency] = await Promise.all([
          db.query.goals.findMany({
            where: (g, { eq }) => eq(g.userId, userId),
            orderBy: (g, { asc }) => [asc(g.createdAt)],
            with: { links: true },
          }),
          accountsWithBalance(userId),
          recentMonthlyNetByCurrency(userId),
        ])
        const balanceByAccount = new Map(accounts.map(a => [a.id, a]))
        return jsonSafe(goals.map(goal => enrichGoal(goal, balanceByAccount, netByCurrency)))
      },
    }),
  }
}
