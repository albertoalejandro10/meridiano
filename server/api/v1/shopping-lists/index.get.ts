import { db } from '@nuxthub/db'

export default defineEventHandler(async (event) => {
  const userId = event.context.userId

  const lists = await db.query.shoppingLists.findMany({
    where: (l, { eq }) => eq(l.userId, userId),
    orderBy: (l, { desc }) => [desc(l.createdAt)],
    with: { items: true },
  })

  // Index cards only need counts + the VES total. Checked items are already in
  // the cart, so they drop out of the total — same "what's left to buy" figure
  // the detail page shows.
  return lists.map(({ items, ...list }) => ({
    ...list,
    itemCount: items.length,
    checkedCount: items.filter(i => i.checked).length,
    totalVes: items
      .filter(i => !i.checked)
      .reduce((sum, i) => sum + Number(i.quantity) * Number(i.unitPrice), 0),
  }))
})
