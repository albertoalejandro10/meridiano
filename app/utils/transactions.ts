// A logical operation can span several DB rows: a transfer is an EXPENSE +
// INCOME pair sharing a transferId, and fees are child EXPENSE rows pointing
// at their parent via feeOfId. Collapse those into one display row per
// operation. Rows whose counterpart/parent isn't loaded (filters, pagination)
// are left as-is, so nothing silently disappears from the list.
interface GroupableTransaction {
  id: string
  type: 'INCOME' | 'EXPENSE'
  transferId: string | null
  feeOfId: string | null
  fee: string | number | null
}

export function groupTransactionRows<T extends GroupableTransaction>(items: T[]): (T & { transferPair?: boolean })[] {
  const loadedIds = new Set(items.map(i => i.id))
  const collapsedTransfers = new Set<string>()
  const rows: (T & { transferPair?: boolean })[] = []

  for (const tx of items) {
    // Fee rows fold into their parent, which carries the amount as `fee`.
    if (tx.feeOfId && loadedIds.has(tx.feeOfId)) continue

    if (!tx.transferId) {
      rows.push(tx)
      continue
    }
    if (collapsedTransfers.has(tx.transferId)) continue
    collapsedTransfers.add(tx.transferId)

    const sibling = items.find(s => s.transferId === tx.transferId && s.id !== tx.id)
    if (!sibling) {
      rows.push(tx)
      continue
    }
    // Represent the pair by its EXPENSE (source) leg so the direction is
    // stable, and take the fee from whichever leg the API attached it to.
    const source = tx.type === 'EXPENSE' ? tx : sibling
    rows.push({ ...source, fee: tx.fee ?? sibling.fee, transferPair: true })
  }
  return rows
}
