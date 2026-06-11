export default defineEventHandler(async (event) => {
  const userId = event.context.userId as string

  const [accounts, sums] = await Promise.all([
    prisma.account.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.transaction.groupBy({
      by: ['accountId', 'type'],
      where: { userId },
      _sum: { amount: true },
    }),
  ])

  return accounts.map((account) => {
    let balance = Number(account.initialBalance)
    for (const s of sums) {
      if (s.accountId !== account.id) continue
      const sum = Number(s._sum.amount ?? 0)
      balance += s.type === 'INCOME' ? sum : -sum
    }
    return { ...account, balance }
  })
})
