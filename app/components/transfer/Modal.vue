<script setup lang="ts">
import { transferSchema } from '~~/shared/schemas'

const { formatMoney } = useLocaleFormat()

const transactionsStore = useTransactionsStore()
const { transferModalOpen: open } = storeToRefs(transactionsStore)
const { createTransfer } = transactionsStore

const { accounts } = storeToRefs(useAccountsStore())
const { data: routes } = useTransferRoutes()
const { data: feeDefaults } = useFeeDefaults()

const state = reactive({
  fromAccountId: '',
  toAccountId: '',
  amount: 0,
  receivedAmount: 0,
  internalFee: 0,
  externalFee: 0,
  date: toISODate(new Date()),
  description: '',
})

const activeAccounts = computed(() => accounts.value.filter(a => !a.archived))
const fromCurrency = computed(() => activeAccounts.value.find(a => a.id === state.fromAccountId)?.currency)
const toCurrency = computed(() => activeAccounts.value.find(a => a.id === state.toAccountId)?.currency)
// Cross-currency transfers (e.g. selling USDT for VES on Binance P2P) ask for
// the exact amount received on the destination; the FX rate stays implicit.
const crossCurrency = computed(() => !!fromCurrency.value && !!toCurrency.value && fromCurrency.value !== toCurrency.value)

const fromItems = computed(() =>
  activeAccounts.value.map(a => ({ label: `${a.name} (${a.currency})`, value: a.id })),
)
const toItems = computed(() =>
  activeAccounts.value
    .filter(a => a.id !== state.fromAccountId)
    .map(a => ({ label: `${a.name} (${a.currency})`, value: a.id })),
)

const { saving, submit } = useModalForm(open, () => {
  state.fromAccountId = activeAccounts.value[0]?.id ?? ''
  state.toAccountId = ''
  state.amount = 0
  state.receivedAmount = 0
  state.internalFee = 0
  state.externalFee = 0
  state.date = toISODate(new Date())
  state.description = ''
})

watch(() => state.fromAccountId, () => {
  if (state.toAccountId === state.fromAccountId) state.toAccountId = ''
})
watch(crossCurrency, (v) => {
  if (!v) state.receivedAmount = 0
})

const accountName = (id: string) => accounts.value.find(a => a.id === id)?.name ?? ''

// Only routes whose accounts still exist on the client — the endpoint already
// drops archived ones, but the two lists can be a refresh apart.
const routeItems = computed(() =>
  (routes.value ?? []).filter(r =>
    activeAccounts.value.some(a => a.id === r.fromAccountId)
    && activeAccounts.value.some(a => a.id === r.toAccountId),
  ),
)

// Repeating a route is an explicit "same as last time", so it fills everything
// it knows and leaves the amount — the one thing that genuinely changes.
function applyRoute(route: typeof routeItems.value[number]) {
  state.fromAccountId = route.fromAccountId
  state.toAccountId = route.toAccountId
  state.description = route.description ?? ''
  state.internalFee = route.internalFee ?? 0
  state.externalFee = route.externalFee ?? 0
}

// Picking accounts by hand gets a hint rather than a filled field: a silently
// wrong fee is worse than a blank one. Suggested only while the field is still
// untouched, and never when it already matches.
const internalHint = computed(() => {
  const last = feeDefaults.value?.[state.fromAccountId]?.internal
  return last && Number(state.internalFee) !== last ? last : null
})
const externalHint = computed(() => {
  const last = feeDefaults.value?.[state.toAccountId]?.external
  return last && Number(state.externalFee) !== last ? last : null
})

const internalFee = computed(() => Number(state.internalFee) || 0)
const externalFee = computed(() => Number(state.externalFee) || 0)
// What the destination leg is credited: the received amount when currencies
// differ, else the amount sent. Fees and previews net against this.
const destinationAmount = computed(() => crossCurrency.value ? Number(state.receivedAmount) || 0 : Number(state.amount) || 0)

// Oriented so the displayed number is ≥ 1 ("1 USD = Bs 164.50" either direction).
const impliedRate = computed(() => {
  const sent = Number(state.amount)
  const received = Number(state.receivedAmount)
  if (!crossCurrency.value || sent <= 0 || received <= 0) return null
  return received / sent >= 1
    ? { base: fromCurrency.value!, quote: toCurrency.value!, rate: received / sent }
    : { base: toCurrency.value!, quote: fromCurrency.value!, rate: sent / received }
})

// Binance P2P USDT/VES reference next to the implied rate, fetched lazily the
// first time the pair is USD↔VES. A down source degrades to null (line hidden).
const isUsdVes = computed(() => crossCurrency.value
  && [fromCurrency.value, toCurrency.value].sort().join('/') === 'USD/VES')
const { data: rates, execute: fetchRates } = useFetch('/api/v1/rates/ves', {
  immediate: false,
  default: () => ({ bcv: null, binance: null }),
})
watch(isUsdVes, (v) => {
  if (v && !rates.value?.binance) fetchRates()
})

const onSubmit = () => submit(() => createTransfer({
  fromAccountId: state.fromAccountId,
  toAccountId: state.toAccountId,
  amount: Number(state.amount),
  receivedAmount: crossCurrency.value ? Number(state.receivedAmount) : null,
  internalFee: Number(state.internalFee) || null,
  externalFee: Number(state.externalFee) || null,
  date: new Date(state.date),
  description: state.description || null,
}))
</script>

<template>
  <UModal v-model:open="open" :title="$t('transfers.modal.title')">
    <template #body>
      <UForm :schema="transferSchema" :state="state" class="space-y-4" @submit="onSubmit">
        <div v-if="routeItems.length" class="space-y-2">
          <p class="text-xs font-medium text-muted">
            {{ $t('transfers.modal.repeatRoute') }}
          </p>
          <div class="flex flex-wrap gap-2">
            <UButton
              v-for="route in routeItems"
              :key="`${route.fromAccountId}:${route.toAccountId}`"
              color="neutral"
              variant="subtle"
              size="xs"
              icon="i-lucide-arrow-right"
              :label="`${accountName(route.fromAccountId)} → ${accountName(route.toAccountId)}`"
              @click="applyRoute(route)"
            />
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <UFormField :label="$t('transfers.modal.from')" name="fromAccountId" required>
            <USelectMenu v-model="state.fromAccountId" :items="fromItems" value-key="value" class="w-full" :placeholder="$t('transfers.modal.source')" />
          </UFormField>
          <UFormField :label="$t('transfers.modal.to')" name="toAccountId" required>
            <USelectMenu v-model="state.toAccountId" :items="toItems" value-key="value" class="w-full" :placeholder="$t('transfers.modal.destination')" />
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

        <template v-if="crossCurrency">
          <UFormField :label="$t('transfers.modal.receivedAmount', { currency: toCurrency })" name="receivedAmount" required>
            <UInput v-model.number="state.receivedAmount" type="number" step="0.01" min="0" placeholder="0.00" class="w-full" />
          </UFormField>
          <p v-if="impliedRate" class="text-xs text-muted">
            {{ $t('transfers.modal.impliedRate', { base: impliedRate.base, rate: formatMoney(impliedRate.rate, impliedRate.quote) }) }}
            <span v-if="isUsdVes && rates?.binance"> · {{ $t('transfers.modal.binanceReference', { rate: formatMoney(rates.binance.rate, 'VES') }) }}</span>
          </p>
        </template>

        <div class="grid grid-cols-2 gap-4">
          <UFormField :label="$t('common.internalFee')" name="internalFee" :hint="$t('common.optional')">
            <FeeInput v-model="state.internalFee" :base-amount="state.amount" :currency="fromCurrency" />
            <UButton
              v-if="internalHint && fromCurrency"
              color="neutral"
              variant="link"
              size="xs"
              class="mt-1 p-0"
              :label="$t('common.lastFee', { amount: formatMoney(internalHint, fromCurrency) })"
              @click="state.internalFee = internalHint"
            />
          </UFormField>
          <UFormField :label="$t('common.externalFee')" name="externalFee" :hint="$t('common.optional')">
            <FeeInput v-model="state.externalFee" :base-amount="destinationAmount" :currency="toCurrency ?? fromCurrency" />
            <UButton
              v-if="externalHint && toCurrency"
              color="neutral"
              variant="link"
              size="xs"
              class="mt-1 p-0"
              :label="$t('common.lastFee', { amount: formatMoney(externalHint, toCurrency) })"
              @click="state.externalFee = externalHint"
            />
          </UFormField>
        </div>

        <UFormField :label="$t('common.description')" name="description">
          <UInput v-model="state.description" :placeholder="$t('common.optionalNote')" class="w-full" />
        </UFormField>

        <p v-if="internalFee > 0 && fromCurrency" class="text-xs text-muted">
          {{ $t('transfers.modal.sourcePaysTotal', {
            total: formatMoney(state.amount + internalFee, fromCurrency),
            fee: formatMoney(internalFee, fromCurrency),
          }) }}
        </p>
        <p v-if="externalFee > 0 && destinationAmount > externalFee && (toCurrency || fromCurrency)" class="text-xs text-muted">
          {{ $t('transfers.modal.netAfterFee', {
            net: formatMoney(destinationAmount - externalFee, toCurrency ?? fromCurrency!),
            fee: formatMoney(externalFee, toCurrency ?? fromCurrency!),
          }) }}
        </p>
        <p v-if="!toItems.length" class="text-xs text-muted">
          {{ $t('transfers.modal.noDestination') }}
        </p>

        <ModalActions
          :submit-label="$t('transfers.modal.submit')"
          :saving="saving"
          :disabled="!toItems.length || (crossCurrency && !(Number(state.receivedAmount) > 0))"
          @cancel="open = false"
        />
      </UForm>
    </template>
  </UModal>
</template>
