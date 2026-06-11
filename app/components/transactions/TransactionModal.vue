<script setup lang="ts">
import { transactionSchema, type TransactionInput } from '~~/shared/schemas'

interface TransactionRow {
  id: string
  accountId: string
  categoryId: string | null
  type: 'INCOME' | 'EXPENSE'
  amount: string | number
  date: string
  description: string | null
}

const props = defineProps<{ transaction?: TransactionRow }>()
const emit = defineEmits<{ saved: [] }>()
const open = defineModel<boolean>('open', { default: false })

const { accounts } = useAccounts()
const { data: categories } = useCategories()
const { createTransaction, updateTransaction } = useTransactions()

const state = reactive({
  type: 'EXPENSE' as TransactionInput['type'],
  amount: 0,
  accountId: '',
  categoryId: null as string | null,
  date: new Date().toISOString().slice(0, 10),
  description: '',
})

watch(open, (isOpen) => {
  if (!isOpen) return
  state.type = props.transaction?.type ?? 'EXPENSE'
  state.amount = Number(props.transaction?.amount ?? 0) || 0
  state.accountId = props.transaction?.accountId ?? accounts.value[0]?.id ?? ''
  state.categoryId = props.transaction?.categoryId ?? null
  state.date = (props.transaction?.date ?? new Date().toISOString()).slice(0, 10)
  state.description = props.transaction?.description ?? ''
})

const accountItems = computed(() =>
  accounts.value
    .filter(a => !a.archived || a.id === state.accountId)
    .map(a => ({ label: `${a.name} (${a.currency})`, value: a.id })),
)

const categoryItems = computed(() => [
  { label: 'No category', value: null },
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
      date: new Date(state.date),
      description: state.description || null,
    }
    if (props.transaction) await updateTransaction(props.transaction.id, payload)
    else await createTransaction(payload)
    open.value = false
    emit('saved')
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <UModal v-model:open="open" :title="transaction ? 'Edit transaction' : 'New transaction'">
    <template #body>
      <UForm :schema="transactionSchema" :state="state" class="space-y-4" @submit="onSubmit">
        <UFormField name="type">
          <UTabs
            :model-value="state.type"
            :items="[
              { label: 'Expense', value: 'EXPENSE' },
              { label: 'Income', value: 'INCOME' },
            ]"
            class="w-full"
            @update:model-value="state.type = $event as 'INCOME' | 'EXPENSE'"
          />
        </UFormField>

        <UFormField label="Amount" name="amount" required>
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

        <UFormField label="Account" name="accountId" required>
          <USelect v-model="state.accountId" :items="accountItems" value-key="value" class="w-full" placeholder="Select account" />
        </UFormField>

        <div class="grid grid-cols-2 gap-4">
          <UFormField label="Category" name="categoryId">
            <USelect v-model="state.categoryId" :items="categoryItems" value-key="value" class="w-full" />
          </UFormField>
          <UFormField label="Date" name="date">
            <UInput v-model="state.date" type="date" class="w-full" />
          </UFormField>
        </div>

        <UFormField label="Description" name="description">
          <UInput v-model="state.description" placeholder="Optional note" class="w-full" />
        </UFormField>

        <div class="flex justify-end gap-2 pt-2">
          <UButton label="Cancel" color="neutral" variant="ghost" @click="open = false" />
          <UButton type="submit" :label="transaction ? 'Save' : 'Add'" :loading="saving" />
        </div>
      </UForm>
    </template>
  </UModal>
</template>
