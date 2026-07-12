<script setup lang="ts">
import { transactionSchema, type TransactionInput } from '~~/shared/schemas'

const { t } = useI18n()
const { formatMoney } = useLocaleFormat()

const transactionsStore = useTransactionsStore()
// `editing` doubles as the mode switch: set → edit that transaction, unset → create.
const { modalOpen: open, editing: transaction } = storeToRefs(transactionsStore)
const { createTransaction, updateTransaction } = transactionsStore

const { accounts } = storeToRefs(useAccountsStore())
const { data: categories } = useCategories()

const state = reactive({
  type: 'EXPENSE' as TransactionInput['type'],
  amount: 0,
  fee: 0,
  accountId: '',
  categoryId: null as string | null,
  date: toISODate(new Date()),
  description: '',
})

watch(open, (isOpen) => {
  if (!isOpen) return
  state.type = transaction.value?.type ?? 'EXPENSE'
  state.amount = Number(transaction.value?.amount ?? 0) || 0
  state.fee = Number(transaction.value?.fee ?? 0) || 0
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
  ...(categories.value ?? [])
    .filter(c => !c.type || c.type === state.type)
    .map(c => ({ label: c.name, value: c.id, icon: c.icon ?? undefined })),
])

const saving = ref(false)

async function onSubmit() {
  saving.value = true
  try {
    const payload = {
      ...state,
      amount: Number(state.amount),
      // Fee rows can't carry a fee of their own — omit the field for them
      // (undefined keys are dropped from the JSON body).
      fee: transaction.value?.feeOfId ? undefined : Number(state.fee) || null,
      date: new Date(state.date),
      description: state.description || null,
    }
    if (transaction.value) await updateTransaction(transaction.value.id, payload)
    else await createTransaction(payload)
    open.value = false
  }
  catch {
    // toast handled in the store; keep the modal open for another attempt
  }
  finally {
    saving.value = false
  }
}
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
          <USelect v-model="state.accountId" :items="accountItems" value-key="value" class="w-full" :placeholder="$t('transactions.modal.selectAccount')" />
        </UFormField>

        <div class="grid grid-cols-2 gap-4">
          <UFormField :label="$t('transactions.modal.category')" name="categoryId">
            <USelect v-model="state.categoryId" :items="categoryItems" value-key="value" class="w-full" />
          </UFormField>
          <UFormField :label="$t('common.date')" name="date">
            <UInput v-model="state.date" type="date" class="w-full" />
          </UFormField>
        </div>

        <UFormField v-if="!transaction?.feeOfId" :label="$t('common.fee')" name="fee" :hint="$t('common.optional')">
          <FeeInput v-model="state.fee" :base-amount="state.amount" :currency="accountCurrency" />
        </UFormField>

        <UFormField :label="$t('common.description')" name="description">
          <UInput v-model="state.description" :placeholder="$t('common.optionalNote')" class="w-full" />
        </UFormField>

        <p v-if="!transaction?.feeOfId && state.fee > 0 && accountCurrency" class="text-xs text-muted">
          {{ state.type === 'INCOME'
            ? $t('transactions.modal.netAfterFee', { amount: formatMoney(state.amount - state.fee, accountCurrency) })
            : $t('transactions.modal.totalWithFee', { amount: formatMoney(state.amount + state.fee, accountCurrency) }) }}
        </p>

        <div class="flex justify-end gap-2 pt-2">
          <UButton :label="$t('common.cancel')" color="neutral" variant="ghost" @click="open = false" />
          <UButton type="submit" :label="transaction ? $t('common.save') : $t('common.add')" :loading="saving" />
        </div>
      </UForm>
    </template>
  </UModal>
</template>
