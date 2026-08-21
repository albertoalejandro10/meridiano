<script setup lang="ts">
const props = defineProps<{
  listId: string
  // pg numeric columns arrive as strings; null = no rate saved yet.
  bcvRate: string | null
  binanceRate: string | null
  // What's left to buy (checked items excluded) — drives the USD figures.
  totalVes: number
  // Whole-trip total, only passed once some items are checked off.
  fullTotalVes?: number
}>()

const { formatMoney, formatShortDate } = useLocaleFormat()
const listsStore = useShoppingListsStore()

// Live reference rates; each source is null when its API is down (manual entry
// still works — the inputs are always editable).
const { data: rates, status: ratesStatus, refresh: refreshRates } = useFetch('/api/v1/rates/ves', {
  key: 'ves-rates',
})

// Editable working copies: saved rate wins, live rate fills the gaps.
const bcv = ref<number | undefined>(props.bcvRate != null ? Number(props.bcvRate) : undefined)
const binance = ref<number | undefined>(props.binanceRate != null ? Number(props.binanceRate) : undefined)

// First load with no saved rates: adopt the fetched ones and persist them, so
// reopening the list later shows what you actually planned with.
watch(rates, (r) => {
  if (!r) return
  const patch: { bcvRate?: number, binanceRate?: number } = {}
  if (bcv.value == null && r.bcv) {
    bcv.value = r.bcv.rate
    patch.bcvRate = r.bcv.rate
  }
  if (binance.value == null && r.binance) {
    binance.value = r.binance.rate
    patch.binanceRate = r.binance.rate
  }
  if (Object.keys(patch).length) listsStore.saveRates(props.listId, patch)
}, { immediate: true })

// Manual override: persist on blur/Enter, silently (no toast per keystroke).
function persist(field: 'bcvRate' | 'binanceRate', value: number | undefined) {
  if (value == null || !Number.isFinite(value) || value <= 0) return
  const saved = field === 'bcvRate' ? props.bcvRate : props.binanceRate
  if (saved != null && Number(saved) === value) return
  listsStore.saveRates(props.listId, { [field]: value })
}

const refreshing = ref(false)

// Overwrite both working copies with fresh rates and persist them.
async function onRefresh() {
  refreshing.value = true
  try {
    await refreshRates()
    const r = rates.value
    const patch: { bcvRate?: number, binanceRate?: number } = {}
    if (r?.bcv) {
      bcv.value = r.bcv.rate
      patch.bcvRate = r.bcv.rate
    }
    if (r?.binance) {
      binance.value = r.binance.rate
      patch.binanceRate = r.binance.rate
    }
    if (Object.keys(patch).length) await listsStore.saveRates(props.listId, patch)
  }
  finally {
    refreshing.value = false
  }
}

const usdAtBcv = computed(() => (bcv.value && bcv.value > 0 ? props.totalVes / bcv.value : null))
const usdAtBinance = computed(() => (binance.value && binance.value > 0 ? props.totalVes / binance.value : null))

// The gap between the two rates, and the sell-timing message it implies.
const brecha = computed(() => rateBrecha(bcv.value, binance.value))
const brechaPct = computed(() => (brecha.value ? `${brecha.value.pct.toFixed(1)}%` : ''))

// Dollars saved on this list by selling at the (higher) Binance rate vs BCV.
const usdSaved = computed(() => {
  if (usdAtBcv.value == null || usdAtBinance.value == null) return null
  const saved = usdAtBcv.value - usdAtBinance.value
  return saved > 0 ? saved : null
})
</script>

<template>
  <UPageCard variant="subtle">
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <h3 class="font-medium">
          {{ $t('shoppingLists.rates.title') }}
        </h3>
        <UButton
          :label="$t('shoppingLists.rates.refresh')"
          icon="i-lucide-refresh-cw"
          color="neutral"
          variant="ghost"
          size="xs"
          :loading="refreshing || ratesStatus === 'pending'"
          @click="onRefresh"
        />
      </div>

      <div class="grid gap-4 sm:grid-cols-2">
        <UFormField :label="$t('shoppingLists.rates.bcv')" :help="rates?.bcv ? $t('shoppingLists.rates.updated', { date: formatShortDate(rates.bcv.updatedAt) }) : $t('shoppingLists.rates.unavailable')">
          <UInput
            v-model.number="bcv"
            type="number"
            step="0.0001"
            min="0"
            class="w-full"
            :placeholder="$t('shoppingLists.rates.perUsd')"
            @change="persist('bcvRate', bcv)"
            @keydown.enter.prevent="persist('bcvRate', bcv)"
          >
            <template #trailing>
              <span class="text-xs text-muted">{{ $t('shoppingLists.rates.perUsd') }}</span>
            </template>
          </UInput>
        </UFormField>

        <UFormField :label="$t('shoppingLists.rates.binance')" :help="rates?.binance ? $t('shoppingLists.rates.updated', { date: formatShortDate(rates.binance.updatedAt) }) : $t('shoppingLists.rates.unavailable')">
          <UInput
            v-model.number="binance"
            type="number"
            step="0.0001"
            min="0"
            class="w-full"
            :placeholder="$t('shoppingLists.rates.perUsd')"
            @change="persist('binanceRate', binance)"
            @keydown.enter.prevent="persist('binanceRate', binance)"
          >
            <template #trailing>
              <span class="text-xs text-muted">{{ $t('shoppingLists.rates.perUsd') }}</span>
            </template>
          </UInput>
        </UFormField>
      </div>

      <!-- the answer: total in bolívares and the dollars to sell at each rate -->
      <div class="grid gap-3 border-t border-default pt-4 sm:grid-cols-3">
        <div>
          <p class="text-xs text-muted">
            {{ $t('shoppingLists.summary.totalVes') }}
          </p>
          <p class="text-lg font-semibold tabular-nums">
            {{ formatMoney(totalVes, 'VES') }}
          </p>
          <p v-if="fullTotalVes != null" class="text-xs text-muted tabular-nums">
            {{ $t('shoppingLists.summary.ofFullTotal', { amount: formatMoney(fullTotalVes, 'VES') }) }}
          </p>
        </div>
        <div>
          <p class="text-xs text-muted">
            {{ $t('shoppingLists.summary.usdAtBcv') }}
          </p>
          <p class="text-lg font-semibold tabular-nums text-primary">
            {{ usdAtBcv != null ? formatMoney(usdAtBcv, 'USD') : '—' }}
          </p>
        </div>
        <div>
          <p class="text-xs text-muted">
            {{ $t('shoppingLists.summary.usdAtBinance') }}
          </p>
          <p class="text-lg font-semibold tabular-nums text-primary">
            {{ usdAtBinance != null ? formatMoney(usdAtBinance, 'USD') : '—' }}
          </p>
        </div>
      </div>

      <!-- brecha: the gap between the two rates + a sell-timing nudge -->
      <div
        v-if="brecha"
        class="flex items-start gap-3 rounded-lg p-3"
        :class="brecha.status === 'wide' ? 'bg-success/10' : brecha.status === 'moderate' ? 'bg-warning/10' : 'bg-elevated'"
      >
        <UIcon
          :name="brecha.status === 'wide' ? 'i-lucide-trending-up' : brecha.status === 'inverted' ? 'i-lucide-triangle-alert' : 'i-lucide-arrow-left-right'"
          class="mt-0.5 size-5 shrink-0"
          :class="brecha.status === 'wide' ? 'text-success' : brecha.status === 'moderate' ? 'text-warning' : 'text-muted'"
        />
        <div class="min-w-0 space-y-1">
          <div class="flex items-center gap-2">
            <span class="text-sm font-medium">{{ $t('shoppingLists.brecha.title', { pct: brechaPct }) }}</span>
            <UBadge :label="$t(brecha.badge.labelKey)" :color="brecha.badge.color" variant="subtle" size="sm" />
          </div>
          <p class="text-sm text-muted">
            {{ $t(brecha.messageKey, { pct: brechaPct }) }}
            <template v-if="usdSaved != null">
              {{ $t('shoppingLists.brecha.saves', { amount: formatMoney(usdSaved, 'USD') }) }}
            </template>
          </p>
        </div>
      </div>
    </div>
  </UPageCard>
</template>
