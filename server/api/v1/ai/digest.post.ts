import { aiDigestSchema } from '~~/shared/schemas'

// Generates the "explain my finances" digest shown on the Analytics page. The
// text is cached on the ai_generations row this already writes for rate
// limiting (see server/db/schema.ts), so navigating away doesn't discard a call
// that counted against the user's daily budget — digest.get.ts reads it back.
export default defineEventHandler(async (event) => {
  const userId = event.context.userId
  const body = await readValidatedBody(event, aiDigestSchema.parse)

  const config = useRuntimeConfig(event)
  if (!config.opencodeApiKey) {
    throw createError({ statusCode: 503, statusMessage: 'AI digest is not configured yet.' })
  }

  await assertUnderDailyAiLimit(userId)

  const context = await gatherDigestContext(userId)

  let digest: string
  try {
    digest = await generateFinancialDigest(config.opencodeApiKey, context, body.locale)
  }
  catch (err) {
    // Log before flattening to a 502 — otherwise an upstream 401 or a provider
    // rate-limit is indistinguishable from any other failure in production.
    console.error('[ai] digest generation failed', err)
    throw createError({ statusCode: 502, statusMessage: 'Could not generate the digest right now. Try again shortly.' })
  }

  await recordAiGeneration(userId, 'digest', { content: digest, locale: body.locale })

  return { digest, generatedAt: new Date().toISOString() }
})
