import { db, schema } from '@nuxthub/db'
import { aiChatFromDigestSchema } from '~~/shared/schemas'

// Turns the Analytics digest into a conversation the user can actually reply
// to, instead of a card that dead-ends.
//
// The digest text is read from the user's own stored ai_generations row rather
// than accepted from the request body — posting it would let any caller seed a
// conversation with arbitrary text attributed to the assistant.
export default defineEventHandler(async (event) => {
  const userId = event.context.userId
  const body = await readValidatedBody(event, aiChatFromDigestSchema.parse)

  const config = useRuntimeConfig(event)
  if (!config.opencodeApiKey) {
    throw createError({ statusCode: 503, statusMessage: 'AI chat is not configured yet.' })
  }

  const cached = await findCachedDigest(userId, body.locale)
  if (!cached) {
    throw createError({ statusCode: 404, statusMessage: 'No digest to follow up on. Generate one first.' })
  }

  return await db.transaction(async (tx) => {
    const [conversation] = await tx
      .insert(schema.chatConversations)
      .values({ userId, model: body.model, title: body.title })
      .returning()

    // Same parts shape messages.post.ts persists, so this replays straight
    // into useChat as the opening assistant turn — the user's first message
    // then arrives as a follow-up with the digest already in context.
    await tx.insert(schema.chatMessages).values({
      userId,
      conversationId: conversation!.id,
      role: 'assistant',
      parts: [{ type: 'text', text: cached.digest }],
    })

    return conversation!
  })
})
