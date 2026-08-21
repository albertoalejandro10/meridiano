// Full account snapshot as JSON — see server/utils/backup.ts for what's in it
// and what's deliberately left out. No Content-Disposition here: the client
// fetches this with $fetch and builds its own Blob + download link, so the
// header would never reach a browser navigation. app/composables/useBackup.ts
// owns the filename.
export default defineEventHandler(async (event) => {
  const userId = event.context.userId

  return await exportUserData(userId)
})
