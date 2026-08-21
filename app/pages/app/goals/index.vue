<script setup lang="ts">
definePageMeta({ layout: 'dashboard' })

const { t } = useI18n()
const { formatMoney } = useLocaleFormat()

useSeoMeta({ title: () => t('goals.title') })

const goalsStore = useGoalsStore()
const { goals } = storeToRefs(goalsStore)

// Per-currency overview: how much you've saved of everything you're aiming for.
const summary = computed(() => {
  const map = new Map<string, { saved: number, target: number, count: number }>()
  for (const g of goals.value) {
    const e = map.get(g.currency) ?? { saved: 0, target: 0, count: 0 }
    e.saved += Math.max(g.saved, 0)
    e.target += Number(g.targetAmount)
    e.count += 1
    map.set(g.currency, e)
  }
  return [...map].map(([currency, v]) => ({ currency, ...v, pct: percentOf(v.saved, v.target) }))
})

const breadcrumbItems = useBreadcrumbs([
  { labelKey: 'goals.title', icon: 'i-lucide-target', to: '/app/goals' },
])
</script>

<template>
  <UDashboardPanel id="goals">
    <template #body>
      <UBreadcrumb :items="breadcrumbItems" class="mb-4" />

      <div class="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 class="text-xl font-semibold">
            {{ $t('goals.title') }}
          </h1>
          <p class="text-sm text-muted">
            {{ $t('goals.subtitle') }}
          </p>
        </div>
        <UButton :label="$t('goals.new')" icon="i-lucide-plus" @click="goalsStore.openCreate()" />
      </div>

      <!-- overview: saved of target, per currency -->
      <div v-if="goals.length" class="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <UPageCard v-for="s in summary" :key="s.currency" variant="subtle">
          <div class="space-y-2">
            <div class="flex items-baseline justify-between">
              <span class="text-sm text-muted">{{ $t('goals.saved') }} · {{ s.currency }}</span>
              <span class="text-xs font-medium">{{ formatPercent(s.saved, s.target) }}</span>
            </div>
            <p class="text-2xl font-semibold tabular-nums">
              {{ formatMoney(s.saved, s.currency) }}
            </p>
            <p class="text-xs text-muted">
              {{ $t('goals.summaryOf', { target: formatMoney(s.target, s.currency), count: s.count }, s.count) }}
            </p>
            <UProgress :model-value="s.pct" />
          </div>
        </UPageCard>
      </div>

      <UPageGrid v-if="goals.length" class="lg:grid-cols-3">
        <GoalCard
          v-for="goal in goals"
          :key="goal.id"
          :goal="goal"
          @edit="goalsStore.openEdit(goal)"
          @delete="goalsStore.confirmDelete(goal)"
        />
      </UPageGrid>

      <div v-else class="flex flex-col items-center gap-4 py-24 text-center">
        <UIcon name="i-lucide-target" class="size-10 text-muted" />
        <p class="text-muted">
          {{ $t('goals.empty') }}
        </p>
        <UButton :label="$t('goals.new')" icon="i-lucide-plus" @click="goalsStore.openCreate()" />
      </div>
    </template>
  </UDashboardPanel>
</template>
