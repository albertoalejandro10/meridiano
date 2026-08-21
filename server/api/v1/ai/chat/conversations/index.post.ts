import { db, schema } from '@nuxthub/db'
import { aiChatCreateConversationSchema } from '~~/shared/schemas'

export default defineEventHandler(async (event) => {
  const userId = event.context.userId
  const body = await readValidatedBody(event, aiChatCreateConversationSchema.parse)

  const config = useRuntimeConfig(event)
  if (!config.opencodeApiKey) {
    throw createError({ statusCode: 503, statusMessage: 'AI chat is not configured yet.' })
  }

  const [created] = await db
    .insert(schema.chatConversations)
    .values({ userId, model: body.model })
    .returning()

  return created!
})
