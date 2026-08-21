import type { H3Event } from 'h3'
import type { UIMessage } from 'ai'
import { db, schema } from '@nuxthub/db'
import { convertToModelMessages, generateId, stepCountIs, streamText } from 'ai'
import { eq } from 'drizzle-orm'
import { aiChatSendMessageSchema, type ChatModel } from '~~/shared/schemas'

// A whole turn including up to 5 tool round-trips — generous, but bounded,
// where before nothing in the streaming path had a ceiling at all.
const CHAT_TIMEOUT_MS = 120_000

// Aborts when the client goes away mid-stream (navigated off, hit stop, lost
// the connection), so we stop paying for tokens nobody will read. Driven off
// the raw Node response rather than toWebRequest(event).signal: under the Node
// preset that builds a fresh Request whose signal never fires. `close` also
// fires on a normal finish, hence the writableFinished guard.
function clientDisconnectSignal(event: H3Event): AbortSignal {
  const controller = new AbortController()
  event.node.res.once('close', () => {
    if (!event.node.res.writableFinished) controller.abort()
  })
  return controller.signal
}

// The streaming turn. The client only sends the new message's text (see
// prepareSendMessagesRequest in app/pages/app/chat/[id].vue) — history is
// loaded from Postgres here, not trusted from the client.
export default defineEventHandler(async (event) => {
  const userId = event.context.userId
  const conversationId = getRouterParam(event, 'id')!
  const body = await readValidatedBody(event, aiChatSendMessageSchema.parse)

  const config = useRuntimeConfig(event)
  if (!config.opencodeApiKey) {
    throw createError({ statusCode: 503, statusMessage: 'AI chat is not configured yet.' })
  }

  await assertUnderDailyChatLimit(userId)

  const [conversation, profile] = await Promise.all([
    db.query.chatConversations.findFirst({
      where: (c, { and, eq }) => and(eq(c.id, conversationId), eq(c.userId, userId)),
      with: {
        messages: {
          orderBy: (m, { asc }) => [asc(m.createdAt)],
          columns: { id: true, role: true, parts: true },
        },
      },
    }),
    db.query.users.findFirst({
      where: (u, { eq }) => eq(u.id, userId),
      columns: {
        jobTitle: true,
        income: true,
        incomeCurrency: true,
        employmentType: true,
        maritalStatus: true,
        dependents: true,
        riskTolerance: true,
        financialNotes: true,
      },
    }),
  ])
  if (!conversation) throw createError({ statusCode: 404, statusMessage: 'Conversation not found' })

  const isFirstTurn = conversation.messages.length === 0
  const priorMessages = conversation.messages as UIMessage[]

  // A retry re-answers the message already sitting at the end of the stored
  // history, so it must not write it again — otherwise every failed turn the
  // user retries leaves a duplicate question in the conversation. Guarded on
  // the history actually ending in a user turn: if it doesn't, there's nothing
  // to re-answer and this is an ordinary send.
  const isRetry = body.retry && priorMessages[priorMessages.length - 1]?.role === 'user'

  const userMessage: UIMessage = {
    id: generateId(),
    role: 'user',
    parts: [{ type: 'text', text: body.text }],
  }
  const allMessages = isRetry ? priorMessages : [...priorMessages, userMessage]

  // Persist the user's message and charge the turn *before* streaming, not in
  // onFinish: pressing stop or dropping the connection used to lose what they
  // typed and skip the rate-limit row entirely. An aborted turn now leaves
  // their message standing with no reply, which is what every chat app does.
  if (!isRetry) {
    await db.insert(schema.chatMessages).values({ userId, conversationId, role: 'user', parts: userMessage.parts })
    await db
      .update(schema.chatConversations)
      .set({
        updatedAt: new Date(),
        ...(isFirstTurn && { title: body.text.slice(0, 80) }),
      })
      .where(eq(schema.chatConversations.id, conversationId))
  }
  // A retry is a second call to the model, so it costs the same as any turn.
  await recordAiGeneration(userId, 'chat')

  const model = getChatModel(config.opencodeApiKey, conversation.model as ChatModel)
  const tools = buildChatTools(userId)

  const result = streamText({
    model,
    system: buildChatSystemPrompt(body.locale, profile),
    messages: await convertToModelMessages(allMessages, { tools }),
    tools,
    stopWhen: stepCountIs(5),
    // Up to 5 tool round-trips deep, so more headroom than the one-shot
    // generators get.
    abortSignal: AbortSignal.any([
      AbortSignal.timeout(CHAT_TIMEOUT_MS),
      clientDisconnectSignal(event),
    ]),
  })

  // onError runs before onFinish, so this reliably tells the finalizer whether
  // the turn actually produced an answer.
  let failed = false

  return result.toUIMessageStreamResponse({
    originalMessages: allMessages,
    onFinish: async ({ responseMessage }) => {
      // A failed turn is usually cut off mid-thought — often nothing but a
      // tool call and no reply at all. Storing that would leave a dead stub in
      // the history the model has to reason around, and would make the "Try
      // again" button pile a second answer on top of the first. The user's
      // question stays; only the broken reply is dropped.
      if (failed) return
      // Only the reply is left to store. Guarded because a throw inside a
      // stream finalizer is otherwise entirely silent — the client would show
      // a complete answer that was never saved.
      try {
        await db.insert(schema.chatMessages).values({ userId, conversationId, role: 'assistant', parts: responseMessage.parts })
        await db
          .update(schema.chatConversations)
          .set({ updatedAt: new Date() })
          .where(eq(schema.chatConversations.id, conversationId))
      }
      catch (err) {
        console.error('[ai] failed to persist assistant message', { conversationId }, err)
      }
    },
    onError: (err) => {
      failed = true
      console.error('[ai] chat stream failed', { conversationId }, err)
      // Returned to the client as the stream's error text; useChat surfaces it
      // in a toast (see app/components/chat/Conversation.vue).
      return 'Could not finish that response. Try again shortly.'
    },
  })
})
