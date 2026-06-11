const DEFAULT_CATEGORIES = [
  { name: 'Salary', icon: 'i-lucide-briefcase', type: 'INCOME' },
  { name: 'Other Income', icon: 'i-lucide-plus-circle', type: 'INCOME' },
  { name: 'Food', icon: 'i-lucide-utensils', type: 'EXPENSE' },
  { name: 'Transport', icon: 'i-lucide-car', type: 'EXPENSE' },
  { name: 'Housing', icon: 'i-lucide-home', type: 'EXPENSE' },
  { name: 'Health', icon: 'i-lucide-heart-pulse', type: 'EXPENSE' },
  { name: 'Entertainment', icon: 'i-lucide-gamepad-2', type: 'EXPENSE' },
  { name: 'Services', icon: 'i-lucide-receipt', type: 'EXPENSE' },
] as const

export default defineEventHandler(async (event) => {
  const userId = event.context.userId as string

  const existing = await prisma.category.findMany({
    where: { userId },
    orderBy: { name: 'asc' },
  })
  if (existing.length > 0) return existing

  await prisma.category.createMany({
    data: DEFAULT_CATEGORIES.map(c => ({ ...c, userId })),
    skipDuplicates: true,
  })
  return prisma.category.findMany({ where: { userId }, orderBy: { name: 'asc' } })
})
