import type { ChatModel } from '~~/shared/schemas'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'

// One provider instance per server instance, created lazily on first use —
// same shape as server/utils/ai.ts's getClient (the API key isn't known
// until a request provides runtimeConfig).
let provider: ReturnType<typeof createOpenAICompatible> | undefined

function getProvider(apiKey: string) {
  provider ??= createOpenAICompatible({ name: 'opencode-go', baseURL: OPENCODE_BASE_URL, apiKey })
  return provider
}

export function getChatModel(apiKey: string, modelId: ChatModel) {
  return getProvider(apiKey).chatModel(modelId)
}

// Raw Settings → Financial profile fields (the same columns index.get.ts/patch.ts
// expose), passed straight from the DB row — each is independently
// undefined/null when the user hasn't shared that part.
export interface ChatProfile {
  jobTitle?: string | null
  income?: string | null
  incomeCurrency?: string | null
  employmentType?: string | null
  maritalStatus?: string | null
  dependents?: number | null
  riskTolerance?: string | null
  financialNotes?: string | null
}

// Optional sentence appended to the system prompt when the user filled in
// any part of Settings → Financial profile — omitted entirely otherwise, so the
// prompt behaves exactly as before for every user who hasn't. Built as a list
// of "key: value" clauses (rather than a hand-joined sentence) since any
// subset of the up-to-seven fields may be present.
function describeProfile(profile?: ChatProfile): string {
  if (!profile) return ''
  const clauses: string[] = []
  if (profile.jobTitle) clauses.push(`job title: "${profile.jobTitle}"`)
  if (profile.income != null) clauses.push(`income: ~${Number(profile.income)} ${profile.incomeCurrency} per month`)
  if (profile.employmentType) clauses.push(`employment type: ${profile.employmentType}`)
  if (profile.maritalStatus || profile.dependents != null) {
    const household = [profile.maritalStatus, profile.dependents != null ? `${profile.dependents} dependent(s)` : null]
      .filter(Boolean)
      .join(', ')
    clauses.push(`household: ${household}`)
  }
  if (profile.riskTolerance) clauses.push(`risk tolerance: ${profile.riskTolerance}`)
  if (profile.financialNotes) clauses.push(`goals/concerns in their own words: "${profile.financialNotes}"`)
  if (clauses.length === 0) return ''
  return `\n\nThe user has optionally shared this context about themselves — ${clauses.join('; ')}. Use it only when it helps answer a question (e.g. whether their savings rate looks reasonable for their income and household) — don't bring it up unprompted, and never assume anything beyond what's listed here.`
}

/**
 * Chat's system prompt is rebuilt per request (unlike the one-shot generators
 * in server/utils/ai.ts, which append the language instruction to the user
 * message) since it also needs to describe the read-only tools available.
 */
export function buildChatSystemPrompt(locale: 'en' | 'es', profile?: ChatProfile): string {
  return `You are a calm, plain-spoken personal finance assistant inside Meridiano, a
personal finance tracking app. You are chatting with the user about their own
financial data.

You have tools to look up the user's real account balances, cashflow, spending
by category, recurring bills, and savings goals. Call a tool whenever
answering requires real numbers — never guess or invent figures. If a question
needs data from more than one tool, call all of the tools you need before
answering.

You are strictly read-only: you cannot create, edit, or delete accounts,
transactions, or anything else in the app. If asked to do something you can't
do, say so plainly and suggest the user do it themselves in the app.

Keep answers concise and conversational — this is a chat, not a report. Never
combine amounts from different currencies into one total; always keep
currencies separate.

Respond in ${languageNameFor(locale)}, using that language's normal number and
date phrasing.${describeProfile(profile)}`
}
