<script setup lang="ts">
// Slideover listing one month + category's transactions (the spending donut /
// category list drill-down). Fetches on open via $fetch instead of useFetch:
// the target changes with every click and the view is transient, so there is
// nothing worth caching under a key.
const props = defineProps<{
  month: string // 'yyyy-MM'
  categoryId: string | null // null = uncategorized
  categoryName: string | null
  categorySlug: string | null // set for seeded categories — translated over categoryName
  currency: string
  type: 'INCOME' | 'EXPENSE'
}>()

const open = defineModel<boolean>('open', { required: true })

const { t } = useI18n()
const { formatMoney, formatMonth, formatFullDate } = useLocaleFormat()
const { categoryLabel } = useCategoryLabel()

const title = computed(() =>
  categoryLabel({ slug: props.categorySlug, name: props.categoryName }) || t('analytics.spending.uncategorized'),
)

type TransactionPage = Awaited<ReturnType<typeof fetchPage>>
const items = ref<TransactionPage['items']>([])
const loading = ref(false)

function fetchPage() {
  const [year, mon] = props.month.split('-').map(Number) as [number, number]
  const lastDay = new Date(year, mon, 0).getDate()
  return $fetch('/api/v1/transactions', {
    query: {
      categoryId: props.categoryId ?? 'none',
      type: props.type,
      from: `${props.month}-01`,
      to: `${props.month}-${String(lastDay).padStart(2, '0')}`,
      limit: 100,
    },
  })
}

watch(open, async (value) => {
  if (!value) return
  loading.value = true
  items.value = []
  try {
    items.value = (await fetchPage()).items
  }
  finally {
    loading.value = false
  }
})

const shown = computed(() => items.value.filter(tx => tx.currency === props.currency))
const total = computed(() => shown.value.reduce((sum, tx) => sum + Number(tx.amount), 0))
</script>

<template>
  <USlideover
    v-model:open="open"
    :title="title"
    :description="`${formatMonth(month)} · ${formatMoney(total, currency)}`"
  >
    <template #body>
      <div v-if="loading" class="space-y-3">
        <USkeleton v-for="i in 5" :key="i" class="h-10 w-full" />
      </div>

      <div v-else-if="shown.length" class="divide-y divide-default">
        <div
          v-for="tx in shown"
          :key="tx.id"
          class="flex items-center justify-between gap-4 py-3"
        >
          <div class="min-w-0">
            <p class="text-sm font-medium truncate">
              {{ tx.description || categoryLabel(tx.category) || (tx.type === 'INCOME' ? t('transactions.income') : t('transactions.expense')) }}
            </p>
            <p class="text-xs text-muted">
              {{ tx.account?.name }} · {{ formatFullDate(tx.date) }}
            </p>
          </div>
          <span class="text-sm font-semibold shrink-0" :class="tx.type === 'INCOME' ? 'text-success' : 'text-error'">
            {{ tx.type === 'INCOME' ? '+' : '−' }}{{ formatMoney(Number(tx.amount), tx.currency) }}
          </span>
        </div>
      </div>

      <p v-else class="text-sm text-muted py-6 text-center">
        {{ t('analytics.spending.noTransactions') }}
      </p>
    </template>
  </USlideover>
</template>
