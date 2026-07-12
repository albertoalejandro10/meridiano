<script setup lang="ts">
const props = defineProps<{ goal: GoalView }>()
defineEmits<{ edit: [], delete: [] }>()

const { t } = useI18n()
const { formatMoney, formatFullDate } = useLocaleFormat()

const accent = computed(() => goalAccent(props.goal.color))
const target = computed(() => Number(props.goal.targetAmount))
const pct = computed(() => percentOf(Math.max(props.goal.saved, 0), target.value))
const achieved = computed(() => props.goal.saved >= target.value)
const milestone = computed(() => goalMilestone(pct.value))
const pace = computed(() => goalPace(props.goal))
const badge = computed(() => goalPaceBadge(pace.value.status))

const paceLine = computed(() => {
  const p = pace.value
  const money = (n: number) => formatMoney(n, props.goal.currency)
  switch (p.status) {
    case 'achieved':
      return t('goals.card.targetReached')
    case 'past-due':
      return t('goals.card.stillToGo', { amount: money(p.remaining) })
    case 'on-track':
    case 'behind':
      if (p.requiredPerMonth == null) return t('goals.card.toGo', { amount: money(p.remaining) })
      return props.goal.targetDate
        ? t('goals.card.savePerMonthBy', { amount: money(p.requiredPerMonth), date: formatFullDate(props.goal.targetDate) })
        : t('goals.card.savePerMonth', { amount: money(p.requiredPerMonth) })
    default:
      return t('goals.card.toGo', { amount: money(p.remaining) })
  }
})
</script>

<template>
  <div class="relative flex flex-col gap-4 rounded-lg p-5 ring ring-default bg-elevated/40 transition-colors hover:bg-elevated">
    <NuxtLink :to="`/app/goals/${goal.id}`" class="absolute inset-0 rounded-lg" :aria-label="$t('goals.card.view', { name: goal.name })" />

    <!-- header -->
    <div class="flex items-start justify-between gap-3">
      <div class="flex min-w-0 items-center gap-3">
        <span class="flex size-10 items-center justify-center rounded-lg" :class="[accent.soft, accent.text]">
          <UIcon :name="goal.icon ?? 'i-lucide-target'" class="size-5" />
        </span>
        <div class="min-w-0">
          <p class="truncate font-medium">
            {{ goal.name }}
          </p>
          <p class="text-xs text-muted">
            {{ goal.currency }}
          </p>
        </div>
      </div>
      <div class="relative z-10 flex gap-1">
        <UButton icon="i-lucide-pencil" color="neutral" variant="ghost" size="xs" @click="$emit('edit')" />
        <UButton icon="i-lucide-trash-2" color="error" variant="ghost" size="xs" @click="$emit('delete')" />
      </div>
    </div>

    <!-- ring + numbers -->
    <div class="flex items-center gap-4">
      <GoalRing :value="pct" :color="goal.color" :achieved="achieved" :size="84" :stroke="8" />
      <div class="min-w-0 space-y-1">
        <p class="text-lg font-semibold tabular-nums">
          {{ formatMoney(goal.saved, goal.currency) }}
          <span class="text-sm font-normal text-muted">{{ $t('goals.card.of', { amount: formatMoney(target, goal.currency) }) }}</span>
        </p>
        <p class="text-sm font-medium" :class="achieved ? 'text-success' : accent.text">
          {{ $t(milestone.titleKey) }}
        </p>
        <div class="flex items-center gap-2 text-xs text-muted">
          <UBadge v-if="badge" :label="$t(badge.labelKey)" :color="badge.color" variant="subtle" size="sm" />
          <span class="truncate">{{ paceLine }}</span>
        </div>
      </div>
    </div>

    <!-- linked assets -->
    <div v-if="goal.linkedAccounts.length" class="flex flex-wrap gap-1.5">
      <span
        v-for="a in goal.linkedAccounts"
        :key="a.id"
        class="inline-flex items-center gap-1 rounded-full bg-accented px-2 py-0.5 text-xs text-muted"
      >
        <UIcon :name="accountTypeIcon(a.type)" class="size-3.5" />
        {{ a.name }}
      </span>
    </div>
    <p v-else class="inline-flex items-center gap-1 text-xs text-muted">
      <UIcon name="i-lucide-link" class="size-3.5" /> {{ $t('goals.card.noAssets') }}
    </p>
  </div>
</template>
