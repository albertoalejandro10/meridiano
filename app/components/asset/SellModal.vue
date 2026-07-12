<script setup lang="ts">
import { sellAssetSchema } from '~~/shared/schemas'

const { formatMoney } = useLocaleFormat()

const accountsStore = useAccountsStore()
const { accounts, sellModalOpen: open, sellingAsset: asset } = storeToRefs(accountsStore)
const { sellAsset } = accountsStore

const state = reactive({
  toAccountId: '',
  amount: 0,
  fee: 0,
  date: toISODate(new Date()),
  description: '',
})

// Proceeds land in an active cash account of the asset's currency.
const cashItems = computed(() =>
  accounts.value
    .filter(a => !a.archived && a.type === 'CASH' && a.currency === asset.value?.currency)
    .map(a => ({ label: `${a.name} (${a.currency})`, value: a.id })),
)

watch(open, (isOpen) => {
  if (!isOpen) return
  state.toAccountId = cashItems.value[0]?.value ?? ''
  state.amount = asset.value?.balance ?? 0
  state.fee = 0
  state.date = toISODate(new Date())
  state.description = ''
})

const saving = ref(false)

async function onSubmit() {
  if (!asset.value) return
  saving.value = true
  try {
    await sellAsset(asset.value.id, {
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
  <UModal v-model:open="open" :title="asset ? $t('accounts.sell.titleNamed', { name: asset.name }) : $t('accounts.sell.title')">
    <template #body>
      <UForm :schema="sellAssetSchema" :state="state" class="space-y-4" @submit="onSubmit">
        <p v-if="asset" class="text-sm text-muted">
          {{ $t('accounts.sell.recordedValue', { amount: formatMoney(asset.balance, asset.currency) }) }}
        </p>

        <UFormField :label="$t('accounts.sell.depositInto')" name="toAccountId" required>
          <USelect v-model="state.toAccountId" :items="cashItems" value-key="value" class="w-full" :placeholder="$t('accounts.sell.cashAccount')" />
        </UFormField>

        <div class="grid grid-cols-2 gap-4">
          <UFormField :label="$t('accounts.sell.salePrice')" name="amount" required>
            <UInput v-model.number="state.amount" type="number" step="0.01" min="0" placeholder="0.00" class="w-full" autofocus />
          </UFormField>
          <UFormField :label="$t('common.date')" name="date">
            <UInput v-model="state.date" type="date" class="w-full" />
          </UFormField>
        </div>

        <UFormField :label="$t('common.fee')" name="fee" :hint="$t('common.optional')">
          <FeeInput v-model="state.fee" :base-amount="state.amount" :currency="asset?.currency" />
        </UFormField>

        <UFormField :label="$t('accounts.sell.note')" name="description">
          <UInput v-model="state.description" :placeholder="$t('common.optionalNote')" class="w-full" />
        </UFormField>

        <p v-if="asset && state.fee > 0 && state.amount > state.fee" class="text-xs text-muted">
          {{ $t('accounts.sell.netAfterFee', {
            net: formatMoney(state.amount - state.fee, asset.currency),
            fee: formatMoney(state.fee, asset.currency),
          }) }}
        </p>
        <p v-if="!cashItems.length" class="text-xs text-muted">
          {{ $t('accounts.sell.noCash', { currency: asset?.currency }) }}
        </p>

        <div class="flex justify-end gap-2 pt-2">
          <UButton :label="$t('common.cancel')" color="neutral" variant="ghost" @click="open = false" />
          <UButton type="submit" :label="$t('accounts.sell.submit')" :loading="saving" :disabled="!cashItems.length" />
        </div>
      </UForm>
    </template>
  </UModal>
</template>
