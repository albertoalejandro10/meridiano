export default defineEventHandler(async (event) => {
  const userId = event.context.userId as string
  return accountsWithBalance(userId)
})
