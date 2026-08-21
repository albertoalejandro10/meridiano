export default defineEventHandler(async (event) => {
  const userId = event.context.userId
  return accountsWithBalance(userId)
})
