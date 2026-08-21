<script setup lang="ts">
import { sellAssetSchema } from '~~/shared/schemas'

const { formatMoney } = useLocaleFormat()

const accountsStore = useAccountsStore()
const { accounts, sellModalOpen: open, sellingAsset: asset } = storeToRefs(accountsStore)
const { sellAsset } = accountsStore

const state = reactive({
  toAccountId: '',
  amount: 0,
  internalFee: 0,
  externalFee: 0,
  date: toISODate(new Date()),
  description: '',
})

// Proceeds land in an active cash account of the asset's currency.
const cashItems = computed(() =>
  accounts.value
    .filter(a => !a.archived && a.type === 'CASH' && a.currency === asset.value?.currency)
    .map(a => ({ label: `${a.name} (${a.currency})`, value: a.id })),
)

const { saving, submit } = useModalForm(open, () => {
  state.toAccountId = cashItems.value[0]?.value ?? ''
  state.amount = asset.value?.balance ?? 0
  state.internalFee = 0
  state.externalFee = 0
  state.date = toISODate(new Date())
  state.description = ''
})

const internalFee = computed(() => Number(state.internalFee) || 0)
const externalFee = computed(() => Number(state.externalFee) || 0)

async function onSubmit() {
  const selling = asset.value
  if (!selling) return

  await submit(() => sellAsset(selling.id, {
    toAccountId: state.toAccountId,
    amount: Number(state.amount),
    internalFee: Number(state.internalFee) || null,
    externalFee: Number(state.externalFee) || null,
    date: new Date(state.date),
    description: state.description || null,
  }))
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
          <USelectMenu v-model="state.toAccountId" :items="cashItems" value-key="value" class="w-full" :placeholder="$t('accounts.sell.cashAccount')" />
        </UFormField>

        <div class="grid grid-cols-2 gap-4">
          <UFormField :label="$t('accounts.sell.salePrice')" name="amount" required>
            <UInput v-model.number="state.amount" type="number" step="0.01" min="0" placeholder="0.00" class="w-full" autofocus />
          </UFormField>
          <UFormField :label="$t('common.date')" name="date">
            <UInput v-model="state.date" type="date" class="w-full" />
          </UFormField>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <UFormField :label="$t('common.internalFee')" name="internalFee" :hint="$t('common.optional')">
            <FeeInput v-model="state.internalFee" :base-amount="state.amount" :currency="asset?.currency" />
          </UFormField>
          <UFormField :label="$t('common.externalFee')" name="externalFee" :hint="$t('common.optional')">
            <FeeInput v-model="state.externalFee" :base-amount="state.amount" :currency="asset?.currency" />
          </UFormField>
        </div>

        <UFormField :label="$t('accounts.sell.note')" name="description">
          <UInput v-model="state.description" :placeholder="$t('common.optionalNote')" class="w-full" />
        </UFormField>

        <p v-if="asset && internalFee > 0" class="text-xs text-muted">
          {{ $t('accounts.sell.internalFeeNote', { fee: formatMoney(internalFee, asset.currency) }) }}
        </p>
        <p v-if="asset && externalFee > 0 && state.amount > externalFee" class="text-xs text-muted">
          {{ $t('accounts.sell.netAfterFee', {
            net: formatMoney(state.amount - externalFee, asset.currency),
            fee: formatMoney(externalFee, asset.currency),
          }) }}
        </p>
        <p v-if="!cashItems.length" class="text-xs text-muted">
          {{ $t('accounts.sell.noCash', { currency: asset?.currency }) }}
        </p>

        <ModalActions
          :submit-label="$t('accounts.sell.submit')"
          :saving="saving"
          :disabled="!cashItems.length"
          @cancel="open = false"
        />
      </UForm>
    </template>
  </UModal>
</template>
