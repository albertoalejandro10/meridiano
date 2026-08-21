<script setup lang="ts">
import { transactionSchema, type TransactionInput } from '~~/shared/schemas'

const { t } = useI18n()
const { formatMoney } = useLocaleFormat()
const { categoryLabel, sortCategories } = useCategoryLabel()

const transactionsStore = useTransactionsStore()
// `editing` doubles as the mode switch: set → edit that transaction, unset → create.
const { modalOpen: open, editing: transaction } = storeToRefs(transactionsStore)
const { createTransaction, updateTransaction } = transactionsStore

const { accounts } = storeToRefs(useAccountsStore())
const { data: categories } = useCategories()
const { data: feeDefaults } = useFeeDefaults()

const state = reactive({
  type: 'EXPENSE' as TransactionInput['type'],
  amount: 0,
  internalFee: 0,
  externalFee: 0,
  accountId: '',
  categoryId: null as string | null,
  date: toISODate(new Date()),
  description: '',
})

const { saving, submit } = useModalForm(open, () => {
  state.type = transaction.value?.type ?? 'EXPENSE'
  state.amount = Number(transaction.value?.amount ?? 0) || 0
  state.internalFee = Number(transaction.value?.internalFee ?? 0) || 0
  state.externalFee = Number(transaction.value?.externalFee ?? 0) || 0
  state.accountId = transaction.value?.accountId ?? accounts.value.find(a => canTransact(a.type))?.id ?? ''
  state.categoryId = transaction.value?.categoryId ?? null
  state.date = transaction.value?.date ?? toISODate(new Date())
  state.description = transaction.value?.description ?? ''
})

// Switching Expense/Income narrows the category list — drop a selection that
// no longer belongs so an INCOME can't be saved with an EXPENSE category.
watch(() => state.type, (type) => {
  if (!state.categoryId) return
  const selected = (categories.value ?? []).find(c => c.id === state.categoryId)
  if (selected?.type && selected.type !== type) state.categoryId = null
})

const accountItems = computed(() =>
  accounts.value
    .filter(a => canTransact(a.type) || a.id === state.accountId)
    .filter(a => !a.archived || a.id === state.accountId)
    .map(a => ({ label: `${a.name} (${a.currency})`, value: a.id })),
)

const accountCurrency = computed(() => accounts.value.find(a => a.id === state.accountId)?.currency)

const categoryItems = computed(() => [
  { label: t('transactions.modal.noCategory'), value: null },
  ...sortCategories((categories.value ?? []).filter(c => !c.type || c.type === state.type))
    .map(c => ({ label: categoryLabel(c), value: c.id, icon: c.icon ?? undefined })),
])

const totalFees = computed(() => (Number(state.internalFee) || 0) + (Number(state.externalFee) || 0))

// A plain transaction's fees both land on its own account, so both hints key
// off that one account. Offered rather than filled in — a silently wrong fee is
// worse than a blank one.
const internalHint = computed(() => {
  const last = feeDefaults.value?.[state.accountId]?.internal
  return last && Number(state.internalFee) !== last ? last : null
})
const externalHint = computed(() => {
  const last = feeDefaults.value?.[state.accountId]?.external
  return last && Number(state.externalFee) !== last ? last : null
})

const onSubmit = () => submit(() => {
  const payload = {
    ...state,
    amount: Number(state.amount),
    // Fee rows can't carry fees of their own — omit the fields for them
    // (undefined keys are dropped from the JSON body).
    internalFee: transaction.value?.feeOfId ? undefined : Number(state.internalFee) || null,
    externalFee: transaction.value?.feeOfId ? undefined : Number(state.externalFee) || null,
    date: new Date(state.date),
    description: state.description || null,
  }
  return transaction.value
    ? updateTransaction(transaction.value.id, payload)
    : createTransaction(payload)
})
</script>

<template>
  <UModal v-model:open="open" :title="transaction ? $t('transactions.modal.editTitle') : $t('transactions.modal.newTitle')">
    <template #body>
      <UForm :schema="transactionSchema" :state="state" class="space-y-4" @submit="onSubmit">
        <UFormField name="type">
          <UTabs
            :model-value="state.type"
            :items="[
              { label: $t('transactions.expense'), value: 'EXPENSE' },
              { label: $t('transactions.income'), value: 'INCOME' },
            ]"
            class="w-full"
            @update:model-value="state.type = $event as 'INCOME' | 'EXPENSE'"
          />
        </UFormField>

        <UFormField :label="$t('common.amount')" name="amount" required>
          <UInput
            v-model.number="state.amount"
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            size="xl"
            class="w-full"
            autofocus
          />
        </UFormField>

        <UFormField :label="$t('transactions.modal.account')" name="accountId" required>
          <USelectMenu v-model="state.accountId" :items="accountItems" value-key="value" class="w-full" :placeholder="$t('transactions.modal.selectAccount')" />
        </UFormField>

        <div class="grid grid-cols-2 gap-4">
          <UFormField :label="$t('transactions.modal.category')" name="categoryId">
            <USelectMenu v-model="state.categoryId" :items="categoryItems" value-key="value" class="w-full" :placeholder="$t('transactions.modal.noCategory')" />
          </UFormField>
          <UFormField :label="$t('common.date')" name="date">
            <UInput v-model="state.date" type="date" class="w-full" />
          </UFormField>
        </div>

        <div v-if="!transaction?.feeOfId" class="grid grid-cols-2 gap-4">
          <UFormField :label="$t('common.internalFee')" name="internalFee" :hint="$t('common.optional')">
            <FeeInput v-model="state.internalFee" :base-amount="state.amount" :currency="accountCurrency" />
            <UButton
              v-if="internalHint && accountCurrency"
              color="neutral"
              variant="link"
              size="xs"
              class="mt-1 p-0"
              :label="$t('common.lastFee', { amount: formatMoney(internalHint, accountCurrency) })"
              @click="state.internalFee = internalHint"
            />
          </UFormField>
          <UFormField :label="$t('common.externalFee')" name="externalFee" :hint="$t('common.optional')">
            <FeeInput v-model="state.externalFee" :base-amount="state.amount" :currency="accountCurrency" />
            <UButton
              v-if="externalHint && accountCurrency"
              color="neutral"
              variant="link"
              size="xs"
              class="mt-1 p-0"
              :label="$t('common.lastFee', { amount: formatMoney(externalHint, accountCurrency) })"
              @click="state.externalFee = externalHint"
            />
          </UFormField>
        </div>

        <UFormField :label="$t('common.description')" name="description">
          <UInput v-model="state.description" :placeholder="$t('common.optionalNote')" class="w-full" />
        </UFormField>

        <p v-if="!transaction?.feeOfId && totalFees > 0 && accountCurrency" class="text-xs text-muted">
          {{ state.type === 'INCOME'
            ? $t('transactions.modal.netAfterFee', { amount: formatMoney(state.amount - totalFees, accountCurrency) })
            : $t('transactions.modal.totalWithFee', { amount: formatMoney(state.amount + totalFees, accountCurrency) }) }}
        </p>

        <!-- "Add" rather than the generic "Create" — this is the app's most-used form. -->
        <ModalActions
          :submit-label="transaction ? $t('common.save') : $t('common.add')"
          :saving="saving"
          @cancel="open = false"
        />
      </UForm>
    </template>
  </UModal>
</template>
