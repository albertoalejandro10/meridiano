# AI Features — Status & Gap Analysis

> Last updated: 2026-08-01. Companion to [MVP_GAP.md](MVP_GAP.md) / [STATUS.md](STATUS.md) — **those two are dated 2026-06-29 and stale**: Transfers, Budgets, Recurring, Analytics, and Planning have all shipped since their last update but aren't reflected there. This doc doesn't attempt to refresh them; it's scoped to the AI work only.

## Shipped

| # | Feature | Status | Notes |
| --- | --- | --- | --- |
| 1 | Financial digest (Phase 1) | ✅ Done | `POST /api/v1/ai/digest` — one-shot narrative over cashflow/spending/net-worth/recurring. Card on the Analytics page. Cached: `GET /api/v1/ai/digest` replays the last one per locale. |
| 2 | Debt-payoff coaching (Phase 2a) | ✅ Done | `POST /api/v1/ai/debt-coaching` — narrates the `DebtPayoff.vue` snowball/avalanche simulation. |
| 3 | Goal coaching (Phase 2b) | ✅ Done | `POST /api/v1/ai/goal-coaching` — narrates the `WhatIf.vue` goal scenario. |
| 4 | Conversational chat (Phase 4) | ✅ Done | `/app/chat` — streaming, tool-calling, Postgres-persisted. See the section below. |
| — | Shared UI | ✅ Done | `<AiInsightCard>` (button → skeleton → prose result → regenerate), backs cards 1–3. Holds no copy of its own; callers pass every string and fill the `#meta`/`#actions` slots. |
| — | Rate limiting | ✅ Done | `ai_generations` table with a `kind` enum. One shared daily cap (20/day) across the one-shot features, plus a separate 100/day for chat. The digest reuses its row to cache the generated text. |

## Architecture decisions already locked in

- **Provider**: OpenCode Go — an already-paid $10/month subscription — not a direct Anthropic key. `server/utils/ai.ts` uses the `openai` npm package pointed at `https://opencode.ai/zen/go/v1`.
- **Model**: `glm-5.2`, picked without a direct benchmark for financial-narrative writing (OpenCode's docs only benchmark these models for coding). User feedback (2026-07-30): output is "concise and clear" — one confirmed data point in its favor.
- **i18n**: AI-generated prose does **not** go through translation keys (it doesn't exist until runtime) — the active locale is passed into the prompt and the model is told to respond in that language. Surrounding UI chrome (buttons, labels) still uses the normal i18n system.
- **Data flow — digest**: fully server-authoritative. Gathers its own context from existing analytics utils (`accountsWithBalance`, `computeCashflow`, `computeSpendingTotals`, `gatherRecurringItems`) — never trusts client-supplied numbers.
- **Data flow — coaching**: client-computed. `app/utils/planning.ts` simulations are client-side only (APR/monthly-payment terms live in `localStorage`, never the DB), so the client sends its already-computed plan/scenario numbers instead. There's nothing to gain from moving that logic server-side, since the DB has no record of the inputs either way.

## Known gaps

- **BYOK** — `Settings → API Key` is still just a placeholder page (`SettingsPlaceholder`), never wired up. Only becomes worth building if usage scale changes (see the original brainstorm's funding-model tradeoffs in memory).
- **Anomaly narration** — the *other* ranked Phase 2 candidate (proactively flag unusual spending, e.g. as a dashboard banner like `<RecurringPendingBanner>`). Not built — the user picked budget/goal coaching instead.
- **Cost/usage visibility** — nothing shows how much AI usage is happening or costing, beyond the blunt daily rate-limit counters. Fine while cost is trivial, but there's no way to *see* it trend up if usage patterns change.
- **Model quality validation** — `glm-5.2` was picked from a tier-ranking proxy (OpenCode's per-model request-limit numbers), not a real benchmark. One positive feedback signal so far; no structured comparison against the noted fallback candidates (`deepseek-v4-pro`, `kimi-k3`) — though chat now lets a user pick between all three per conversation, so comparison is at least possible by hand.
- **Rate-limit accounting is approximate** — the check and the insert aren't atomic, so two concurrent requests can both pass a check that only one should. Deliberate: it's a runaway-loop guard, not billing.
- **Server `statusMessage`s stay English** — they surface as the toast *description* under a localized title. Consistent with the rest of the API (see CLAUDE.md), not specific to AI.

Closed since the last revision: the **data-sharing disclosure** gap — `chat.disclosure` sits under the chat prompt and `settings.financialProfile.disclosure` under the profile form.

## Shipped: conversational chat (Phase 4)

Triggered by user feedback (2026-07-30): the one-shot cards read well but aren't interactive. Ask: replicate the official [Nuxt UI Chat template](https://github.com/nuxt-ui-templates/chat).

**How the open decisions resolved:**

1. **Persistence** → Postgres. `chat_conversations` + `chat_messages`, the latter storing the AI SDK's `UIMessage.parts` array verbatim so a conversation replays straight back into `useChat()`.
2. **Tool scope** → five tools, all strictly read-only: `get_account_balances`, `get_cashflow`, `get_spending_by_category`, `get_recurring_items`, `get_goals` (`server/utils/chatTools.ts`). Each closes over `userId` captured server-side — never a model-supplied input. The system prompt tells the model it cannot act, so it says so plainly rather than pretending.
3. **Nav/UI placement** → `/app/chat` + `/app/chat/[id]`, second in the sidebar. The one-shot cards **stay**, and the digest now bridges into chat: "Ask a follow-up" (`POST /api/v1/ai/chat/conversations/from-digest`) opens a conversation seeded with the stored digest as the opening assistant turn. The digest text is read server-side from `ai_generations`, never posted, so a caller can't seed arbitrary assistant content.
4. **Cost shape** → accepted, with a separate 100/day chat cap. A turn is charged once regardless of how many tool round-trips it makes, and charged *before* streaming so an aborted turn still counts.

**Other behaviours worth knowing:**

- A conversation row isn't created until the first message is actually sent, so "New chat" never litters the sidebar with empties (`prepareSendMessagesRequest` in `ChatConversation.vue`).
- The client sends only the new message text + locale; history is reloaded from Postgres each turn rather than trusted from the client.
- The user's message is persisted *before* streaming starts. Pressing stop or dropping the connection therefore leaves their message standing with no reply, instead of losing the turn entirely.
- Streaming is bounded by a 120s timeout plus a client-disconnect abort, so a hung upstream call can't run indefinitely.
- Model is pinned per conversation at creation; switching means starting a new one.

**Stack research** (verified against actual package sources, not assumed):

- Template stack: Vercel AI SDK (`ai` + `@ai-sdk/vue` on the frontend, `@comark/nuxt` for streaming markdown rendering), Nuxt UI's dedicated chat components (`UChatMessages`, `UChatPrompt`, `UChatPromptSubmit`, `UChatReasoning`, `UChatTool`, `UChatPalette`), a `UDashboardSidebar` + `UNavigationMenu` conversation list.
- Current package versions: `ai@7.0.44`, `@ai-sdk/vue@4.0.44`, `@ai-sdk/openai-compatible@3.0.18`, `@comark/nuxt@0.5.1`.
- Confirmed exact APIs by reading the actual `.d.ts`/README in each package (not guessed from training data, since the AI SDK's surface has changed across major versions): `createOpenAICompatible({ baseURL, name, apiKey }).chatModel(modelId)` to point at OpenCode Go the same way `server/utils/ai.ts` already does; `tool({ description, inputSchema: z.object({...}), execute })` — the current (v5+) field is `inputSchema`, not the older `parameters`.
- Template features **not relevant here, won't be replicated**: GitHub OAuth (Meridiano has its own auth), SQLite/Turso (would use the existing Postgres/Drizzle setup instead), file uploads, the weather/charts tool-calling demo.
- Template features that **are** relevant: the general tool-calling *pattern* — mapped onto Meridiano's own data via tools that call the already-existing utils (`accountsWithBalance`, `computeCashflow`, `computeSpendingTotals`, `gatherRecurringItems`, `enrichGoal`), so the model can query the user's real data on demand instead of working from one fixed snapshot like the digest does.
- `@comark/nuxt` sets `@nuxt/ui`'s `prose: true` default, so streamed markdown renders through Nuxt UI's themed `Prose*` components. No `@tailwindcss/typography` involved.
