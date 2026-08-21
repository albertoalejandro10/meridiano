// Top up the user's categories with any default they're missing — the seed in
// categories/index.get.ts only fires for a user with *zero* categories, so
// anyone who registered before a default was added would never see it.
//
// No unique-violation handling on purpose: restoreDefaultCategories inserts with
// an untargeted ON CONFLICT DO NOTHING, so re-running is a no-op that reports 0
// rather than a 409.
export default defineEventHandler(async (event) => {
  const userId = event.context.userId

  return { added: await restoreDefaultCategories(userId) }
})
