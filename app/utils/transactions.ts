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
  internalFee: string | number | null
  externalFee: string | number | null
}

export function groupTransactionRows<T extends GroupableTransaction>(items: T[]): (T & { transferPair?: boolean })[] {
  const loadedIds = new Set(items.map(i => i.id))
  const collapsedTransfers = new Set<string>()
  const rows: (T & { transferPair?: boolean })[] = []

  for (const tx of items) {
    // Fee rows fold into their parent, which carries the amounts as
    // `internalFee`/`externalFee`.
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
    // stable, and take the fees from whichever leg the API attached them to.
    const source = tx.type === 'EXPENSE' ? tx : sibling
    rows.push({
      ...source,
      internalFee: tx.internalFee ?? sibling.internalFee,
      externalFee: tx.externalFee ?? sibling.externalFee,
      transferPair: true,
    })
  }
  return rows
}

// Amount label for a collapsed transfer pair. Cross-currency shows both sides
// ("$100.00 → Bs 16,450.00"); same-currency stays a single amount. The format
// function is injected because locale-aware formatting lives in a composable.
export function transferPairAmount(
  tx: { amount: string | number, currency: string, transferAmount?: string | number | null, transferCurrency?: string | null },
  format: (amount: number, currency: string) => string,
): string {
  const source = format(Number(tx.amount), tx.currency)
  if (!tx.transferAmount || !tx.transferCurrency || tx.transferCurrency === tx.currency) return source
  return `${source} → ${format(Number(tx.transferAmount), tx.transferCurrency)}`
}
