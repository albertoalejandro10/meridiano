<script setup lang="ts">
import { transferSchema } from '~~/shared/schemas'

const { formatMoney } = useLocaleFormat()

const transactionsStore = useTransactionsStore()
const { transferModalOpen: open } = storeToRefs(transactionsStore)
const { createTransfer } = transactionsStore

const { accounts } = storeToRefs(useAccountsStore())

const state = reactive({
  fromAccountId: '',
  toAccountId: '',
  amount: 0,
  fee: 0,
  date: toISODate(new Date()),
  description: '',
})

const activeAccounts = computed(() => accounts.value.filter(a => !a.archived))
const fromCurrency = computed(() => activeAccounts.value.find(a => a.id === state.fromAccountId)?.currency)

const fromItems = computed(() =>
  activeAccounts.value.map(a => ({ label: `${a.name} (${a.currency})`, value: a.id })),
)
// You can only transfer between accounts of the same currency (no FX yet).
const toItems = computed(() =>
  activeAccounts.value
    .filter(a => a.id !== state.fromAccountId && a.currency === fromCurrency.value)
    .map(a => ({ label: `${a.name} (${a.currency})`, value: a.id })),
)

watch(open, (isOpen) => {
  if (!isOpen) return
  state.fromAccountId = activeAccounts.value[0]?.id ?? ''
  state.toAccountId = ''
  state.amount = 0
  state.fee = 0
  state.date = toISODate(new Date())
  state.description = ''
})

// Drop a destination that no longer matches the source currency.
watch(() => state.fromAccountId, () => {
  if (!toItems.value.some(i => i.value === state.toAccountId)) state.toAccountId = ''
})

const saving = ref(false)

async function onSubmit() {
  saving.value = true
  try {
    await createTransfer({
      fromAccountId: state.fromAccountId,
      toAccountId: state.toAccountId,
      amount: Number(state.amount),
      fee: Number(state.fee) || null,
      date: new Date(state.date),
      description: state.description || null,
    })
    open.value = false
  }
  catch {
    // toast handled in the store
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <UModal v-model:open="open" :title="$t('transfers.modal.title')">
    <template #body>
      <UForm :schema="transferSchema" :state="state" class="space-y-4" @submit="onSubmit">
        <div class="grid grid-cols-2 gap-4">
          <UFormField :label="$t('transfers.modal.from')" name="fromAccountId" required>
            <USelect v-model="state.fromAccountId" :items="fromItems" value-key="value" class="w-full" :placeholder="$t('transfers.modal.source')" />
          </UFormField>
          <UFormField :label="$t('transfers.modal.to')" name="toAccountId" required>
            <USelect v-model="state.toAccountId" :items="toItems" value-key="value" class="w-full" :placeholder="$t('transfers.modal.destination')" />
          </UFormField>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <UFormField :label="$t('common.amount')" name="amount" required>
            <UInput v-model.number="state.amount" type="number" step="0.01" min="0" placeholder="0.00" class="w-full" />
          </UFormField>
          <UFormField :label="$t('common.date')" name="date">
            <UInput v-model="state.date" type="date" class="w-full" />
          </UFormField>
        </div>

        <UFormField :label="$t('common.fee')" name="fee" :hint="$t('common.optional')">
          <FeeInput v-model="state.fee" :base-amount="state.amount" :currency="fromCurrency" />
        </UFormField>

        <UFormField :label="$t('common.description')" name="description">
          <UInput v-model="state.description" :placeholder="$t('common.optionalNote')" class="w-full" />
        </UFormField>

        <p v-if="state.fee > 0 && state.amount > state.fee && fromCurrency" class="text-xs text-muted">
          {{ $t('transfers.modal.netAfterFee', {
            net: formatMoney(state.amount - state.fee, fromCurrency),
            fee: formatMoney(state.fee, fromCurrency),
          }) }}
        </p>
        <p v-if="!toItems.length" class="text-xs text-muted">
          {{ $t('transfers.modal.noDestination') }}
        </p>

        <div class="flex justify-end gap-2 pt-2">
          <UButton :label="$t('common.cancel')" color="neutral" variant="ghost" @click="open = false" />
          <UButton type="submit" :label="$t('transfers.modal.submit')" :loading="saving" :disabled="!toItems.length" />
        </div>
      </UForm>
    </template>
  </UModal>
</template>
