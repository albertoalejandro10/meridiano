import { db } from '@nuxthub/db'

// Detected recurring expenses (subscriptions/bills). Runs over the user's full
// expense history — detection needs every occurrence, which the paginated
// transactions endpoint can't provide. Nothing is stored; see gatherRecurringItems
// and detectRecurring (server/utils/recurring.ts).
export default defineEventHandler(async (event) => {
  const userId = event.context.userId

  const [items, categories] = await Promise.all([
    gatherRecurringItems(userId),
    db.query.categories.findMany({
      where: (c, { eq }) => eq(c.userId, userId),
      columns: { id: true, name: true, slug: true, icon: true },
    }),
  ])

  const categoryById = new Map(categories.map(c => [c.id, c]))
  return {
    items: items.map(item => ({
      ...item,
      categoryName: (item.categoryId && categoryById.get(item.categoryId)?.name) ?? null,
      // Seeded categories are rendered from the slug (categories.defaults.<slug>);
      // categoryName is the fallback for ones the user created.
      categorySlug: (item.categoryId && categoryById.get(item.categoryId)?.slug) ?? null,
      categoryIcon: (item.categoryId && categoryById.get(item.categoryId)?.icon) ?? null,
    })),
  }
})
