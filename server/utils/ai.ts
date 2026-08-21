import OpenAI from 'openai'
import type { DigestContext } from './digest'

// OpenCode Go's OpenAI-compatible gateway (https://opencode.ai/docs/go/) — an
// already-paid-for flat subscription, used in place of a direct Anthropic key.
// The SDK sends `apiKey` as a standard `Authorization: Bearer` header, which is
// what OpenCode Go expects. Exported so server/utils/aiChat.ts's AI-SDK
// provider points at the same gateway.
export const OPENCODE_BASE_URL = 'https://opencode.ai/zen/go/v1'

// General-purpose flagship (not the code-specialized "kimi-k2.7-code" variant)
// on OpenCode Go's OpenAI-compatible model list. Chosen without a direct
// benchmark for financial-narrative writing specifically — swap this constant
// if output quality disappoints (e.g. try 'deepseek-v4-pro' or 'kimi-k3').
const AI_MODEL = 'glm-5.2'

// One client per server instance, created lazily on first use (the API key
// isn't known until a request provides runtimeConfig).
let client: OpenAI | undefined

function getClient(apiKey: string): OpenAI {
  client ??= new OpenAI({ apiKey, baseURL: OPENCODE_BASE_URL })
  return client
}

// Someone is staring at a spinner for the whole of this, so the SDK's defaults
// (10 minutes, 2 retries) are far too patient — better to fail into the card's
// error state and let them press the button again.
const REQUEST_TIMEOUT_MS = 60_000

async function complete(apiKey: string, systemPrompt: string, userContent: string): Promise<string> {
  const openai = getClient(apiKey)
  const response = await openai.chat.completions.create({
    model: AI_MODEL,
    max_tokens: 1024,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ],
  }, { timeout: REQUEST_TIMEOUT_MS, maxRetries: 1 })
  return response.choices[0]?.message?.content?.trim() ?? ''
}

// Exported for server/utils/aiChat.ts (chat's system prompt is built fresh per
// request rather than appended per message, but wants the same phrasing).
export function languageNameFor(locale: 'en' | 'es'): string {
  return locale === 'es' ? 'Spanish' : 'English'
}

const DIGEST_SYSTEM_PROMPT = `You are a calm, plain-spoken personal finance assistant inside Meridiano, a
personal finance tracking app. You are given a JSON snapshot of the user's net
worth, cash flow, top spending categories, and recurring bills.

Write a short digest — 3 to 5 short paragraphs, no headings, no markdown
formatting — that:
- Highlights what stands out: trends, notable changes, anything unusual.
- Notes the current savings rate and whether it looks healthy.
- Mentions recurring bills only if something is worth flagging (a large total,
  many small subscriptions adding up, etc.) — don't just list them.
- Is specific and references real numbers from the data, not generic advice.
- Never invents numbers that aren't in the data, and never combines amounts
  from different currencies into one total — always keep currencies separate.
- If the JSON includes an optional "profile" field (any of: job title,
  income, employment type, marital status, dependents, risk tolerance, or
  free-text goals/concerns the user chose to share), use it to make advice
  more specific — e.g. whether the savings rate looks reasonable for that
  income and household. Never assume anything about the user's job, income,
  or household that isn't in the field, and treat each part of it as
  independently optional (only some may be present).
- Is warm but concise — this is a quick read, not a report.

Respond in the language named in the user's message, using that language's
normal number and date phrasing.`

/**
 * One-shot narrative digest of a user's financial snapshot. Follows the same
 * stub-then-wire-in shape as server/utils/mail.ts, except the provider is
 * already wired up — callers just need NUXT_OPENCODE_API_KEY configured.
 */
export async function generateFinancialDigest(apiKey: string, context: DigestContext, locale: 'en' | 'es'): Promise<string> {
  const userContent = `Respond in ${languageNameFor(locale)}. Here is my financial snapshot as JSON:\n${JSON.stringify(context)}`
  return complete(apiKey, DIGEST_SYSTEM_PROMPT, userContent)
}

export interface DebtCoachingContext {
  currency: string
  extraPerMonth: number
  chosenStrategy: 'snowball' | 'avalanche'
  snowballPlan: { months: number, paidOff: boolean, totalInterest: number }
  avalanchePlan: { months: number, paidOff: boolean, totalInterest: number }
  debts: { name: string, balance: number, apr: number, payment: number }[]
}

const DEBT_COACHING_SYSTEM_PROMPT = `You are a calm, plain-spoken personal finance coach inside Meridiano, a
personal finance tracking app. You are given a user's debt-payoff plan: their
debts (name, balance, APR, monthly payment), how much extra they're putting
toward payoff each month, and the projected outcome under both the snowball
(smallest balance first) and avalanche (highest APR first) strategies. All
amounts are in one single currency.

Write a short coaching note — 2 to 4 short paragraphs, no headings, no
markdown formatting — that:
- States plainly when they'll be debt-free and the total interest under their
  currently chosen strategy.
- Compares the two strategies honestly: if the numbers favor switching, say so
  directly with the actual interest difference; if the difference is small,
  say that too rather than manufacturing urgency.
- Calls out anything worth flagging (a very high-APR debt not being
  prioritized, a plan that never pays off within the projection window).
- Never invents numbers that aren't in the data.
- Is warm and encouraging, not alarmist — this is a nudge, not a lecture.

Respond in the language named in the user's message, using that language's
normal number and date phrasing.`

/** Narrates a debt-payoff plan the client already computed — see app/utils/planning.ts. */
export async function generateDebtCoaching(apiKey: string, context: DebtCoachingContext, locale: 'en' | 'es'): Promise<string> {
  const userContent = `Respond in ${languageNameFor(locale)}. Here is my debt payoff plan as JSON:\n${JSON.stringify(context)}`
  return complete(apiKey, DEBT_COACHING_SYSTEM_PROMPT, userContent)
}

export interface GoalCoachingContext {
  goalName: string
  currency: string
  targetAmount: number
  saved: number
  targetDate: string | null
  monthlyTried: number
  recentMonthlyNet: number
  projectedMonths: number | null
  requiredPerMonth: number | null
}

const GOAL_COACHING_SYSTEM_PROMPT = `You are a calm, plain-spoken personal finance coach inside Meridiano, a
personal finance tracking app. You are given one savings goal: its name,
target amount, amount already saved, an optional target date, the monthly
amount the user is trying in a "what if" calculator, their actual recent
average monthly saving pace, and (if the goal has a target date) the monthly
amount that date actually requires.

Write a short coaching note — 2 to 4 short paragraphs, no headings, no
markdown formatting — that:
- States plainly whether the tried monthly amount gets them there, and when.
- Compares the tried amount against their actual recent pace and (if given)
  what the target date requires — call out any meaningful gap between them.
- Suggests a concrete, realistic adjustment only if the numbers clearly call
  for one; otherwise affirms the plan is on track.
- Never invents numbers that aren't in the data.
- Is warm and encouraging, not alarmist.

Respond in the language named in the user's message, using that language's
normal number and date phrasing.`

/** Narrates a goal "what if" scenario the client already computed — see app/utils/planning.ts. */
export async function generateGoalCoaching(apiKey: string, context: GoalCoachingContext, locale: 'en' | 'es'): Promise<string> {
  const userContent = `Respond in ${languageNameFor(locale)}. Here is my goal scenario as JSON:\n${JSON.stringify(context)}`
  return complete(apiKey, GOAL_COACHING_SYSTEM_PROMPT, userContent)
}
