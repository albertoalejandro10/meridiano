import { aiDigestSchema } from '~~/shared/schemas'

// The last digest this user generated, so the Analytics card renders filled in
// on arrival instead of asking them to spend another rate-limited call on text
// the server already has. Nulls rather than a bare `null` body: returning null
// makes Nitro send a 204 with no body, which reads as "missing" on the client
// in a way an explicit shape doesn't. The card falls back to its empty state
// and offers to generate.
//
// Deliberately does not check opencodeApiKey — reading back a stored digest
// works even when the provider is currently unconfigured.
export default defineEventHandler(async (event) => {
  const userId = event.context.userId
  const { locale } = await getValidatedQuery(event, aiDigestSchema.parse)

  return await findCachedDigest(userId, locale) ?? { digest: null, generatedAt: null }
})
