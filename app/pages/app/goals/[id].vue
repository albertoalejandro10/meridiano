<script setup lang="ts">
definePageMeta({ layout: 'dashboard' })

const route = useRoute()
const id = route.params.id as string

const { t } = useI18n()
const { formatMoney, formatFullDate } = useLocaleFormat()

const { data: goal, error } = useGoal(id)
const goalsStore = useGoalsStore()

useSeoMeta({ title: () => goal.value?.name ?? t('goals.goal') })

const accent = computed(() => goalAccent(goal.value?.color))
const target = computed(() => Number(goal.value?.targetAmount ?? 0))
const pct = computed(() => percentOf(Math.max(goal.value?.saved ?? 0, 0), target.value))
const achieved = computed(() => (goal.value?.saved ?? 0) >= target.value && target.value > 0)
const milestone = computed(() => goalMilestone(pct.value))
const pace = computed(() => goal.value ? goalPace(goal.value) : null)
const badge = computed(() => pace.value ? goalPaceBadge(pace.value.status) : null)

const money = (n: number) => formatMoney(n, goal.value?.currency ?? 'USD')

// Honest, encouraging reality-check copy grounded in the user's real saving pace.
const reality = computed(() => {
  const g = goal.value
  const p = pace.value
  if (!g || !p) return null
  switch (p.status) {
    case 'achieved':
      return { title: t('goals.reality.achieved.title'), body: t('goals.reality.achieved.body') }
    case 'on-track':
      return {
        title: t('goals.reality.onTrack.title'),
        body: t('goals.reality.onTrack.body', {
          required: money(p.requiredPerMonth!),
          date: formatFullDate(g.targetDate!),
          pace: money(g.recentMonthlyNet),
        }),
      }
    case 'behind':
      return {
        title: t('goals.reality.behind.title'),
        body: g.recentMonthlyNet > 0
          ? t('goals.reality.behind.body', {
              date: formatFullDate(g.targetDate!),
              required: money(p.requiredPerMonth!),
              pace: money(g.recentMonthlyNet),
              projected: p.projectedDate ? formatFullDate(p.projectedDate) : t('goals.reality.behind.later'),
            })
          : t('goals.reality.behind.noPaceBody', {
              date: formatFullDate(g.targetDate!),
              required: money(p.requiredPerMonth!),
            }),
      }
    case 'past-due':
      return { title: t('goals.reality.pastDue.title'), body: t('goals.reality.pastDue.body', { remaining: money(p.remaining) }) }
    default:
      return { title: t('goals.reality.noDate.title'), body: t('goals.reality.noDate.body', { remaining: money(p.remaining) }) }
  }
})

async function onDelete() {
  // Only leave the page when the delete actually succeeded.
  if (goal.value && await goalsStore.confirmDelete(goal.value)) {
    await navigateTo('/app/goals')
  }
}

const breadcrumbItems = useBreadcrumbs([
  { labelKey: 'goals.title', icon: 'i-lucide-target', to: '/app/goals' },
  { label: () => goal.value?.name },
])
</script>

<template>
  <UDashboardPanel id="goal-detail">
    <template #body>
      <UBreadcrumb :items="breadcrumbItems" class="mb-4" />

      <div v-if="error" class="flex flex-col items-center gap-4 py-24 text-center">
        <UIcon name="i-lucide-search-x" class="size-10 text-muted" />
        <p class="text-muted">
          {{ $t('goals.notFound') }}
        </p>
        <UButton to="/app/goals" :label="$t('goals.backToGoals')" />
      </div>

      <div v-else-if="goal" class="space-y-6">
        <!-- header -->
        <div class="flex items-start justify-between gap-4">
          <div class="flex min-w-0 items-center gap-3">
            <span class="flex size-12 items-center justify-center rounded-xl" :class="[accent.soft, accent.text]">
              <UIcon :name="goal.icon ?? 'i-lucide-target'" class="size-6" />
            </span>
            <div class="min-w-0">
              <h1 class="truncate text-xl font-semibold">
                {{ goal.name }}
              </h1>
              <p class="text-sm text-muted">
                {{ $t('goals.savingSince', { date: formatFullDate(goal.startDate) }) }}
                <template v-if="goal.targetDate"> · {{ $t('goals.targetOn', { date: formatFullDate(goal.targetDate) }) }}</template>
              </p>
            </div>
          </div>
          <div class="flex gap-1">
            <UButton icon="i-lucide-pencil" color="neutral" variant="ghost" @click="goalsStore.openEdit(goal)" />
            <UButton icon="i-lucide-trash-2" color="error" variant="ghost" @click="onDelete" />
          </div>
        </div>

        <!-- hero: ring + milestone -->
        <UPageCard variant="subtle">
          <div class="flex flex-col items-center gap-6 py-2 sm:flex-row sm:gap-8">
            <GoalRing :value="pct" :color="goal.color" :achieved="achieved" :size="180" :stroke="14">
              <span class="text-3xl font-bold tabular-nums">{{ Math.round(pct) }}%</span>
              <span class="text-xs text-muted">{{ $t('goals.savedLower') }}</span>
            </GoalRing>

            <div class="flex-1 space-y-3 text-center sm:text-left">
              <div class="flex items-center justify-center gap-2 sm:justify-start">
                <UIcon v-if="achieved" name="i-lucide-party-popper" class="size-5 text-success" />
                <h2 class="text-lg font-semibold" :class="achieved ? 'text-success' : accent.text">
                  {{ $t(milestone.titleKey) }}
                </h2>
              </div>
              <p class="text-sm text-muted">
                {{ $t(milestone.toneKey) }}
              </p>
              <div class="grid grid-cols-3 gap-3 pt-2">
                <div>
                  <p class="text-xs text-muted">
                    {{ $t('goals.saved') }}
                  </p>
                  <p class="font-semibold tabular-nums">
                    {{ money(goal.saved) }}
                  </p>
                </div>
                <div>
                  <p class="text-xs text-muted">
                    {{ $t('goals.target') }}
                  </p>
                  <p class="font-semibold tabular-nums">
                    {{ money(target) }}
                  </p>
                </div>
                <div>
                  <p class="text-xs text-muted">
                    {{ achieved ? $t('goals.surplus') : $t('goals.toGo') }}
                  </p>
                  <p class="font-semibold tabular-nums" :class="achieved ? 'text-success' : ''">
                    {{ money(Math.abs(target - goal.saved)) }}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </UPageCard>

        <!-- reality check -->
        <UPageCard v-if="reality" variant="subtle">
          <div class="flex items-start gap-3">
            <UIcon name="i-lucide-compass" class="mt-0.5 size-5 shrink-0 text-muted" />
            <div class="space-y-1">
              <div class="flex items-center gap-2">
                <h3 class="font-medium">
                  {{ reality.title }}
                </h3>
                <UBadge v-if="badge" :label="$t(badge.labelKey)" :color="badge.color" variant="subtle" size="sm" />
              </div>
              <p class="text-sm text-muted">
                {{ reality.body }}
              </p>
            </div>
          </div>
        </UPageCard>

        <!-- linked assets -->
        <UPageCard variant="subtle">
          <div class="mb-3 flex items-center justify-between">
            <h3 class="font-medium">
              {{ $t('goals.modal.linkedAssets') }}
            </h3>
            <UButton :label="$t('goals.manage')" icon="i-lucide-settings-2" color="neutral" variant="ghost" size="xs" @click="goalsStore.openEdit(goal)" />
          </div>

          <div v-if="goal.linkedAccounts.length" class="divide-y divide-default">
            <div v-for="a in goal.linkedAccounts" :key="a.id" class="flex items-center gap-3 py-2.5">
              <span class="flex size-8 items-center justify-center rounded-lg bg-accented text-muted">
                <UIcon :name="accountTypeIcon(a.type)" class="size-4" />
              </span>
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-medium">
                  {{ a.name }}
                </p>
                <p class="text-xs text-muted">
                  {{ $t(accountTypeLabelKey(a.type)) }}
                </p>
              </div>
              <span class="text-sm font-medium tabular-nums" :class="a.balance < 0 ? 'text-error' : ''">
                {{ money(a.balance) }}
              </span>
            </div>
          </div>
          <div v-else class="flex flex-col items-center gap-3 py-8 text-center">
            <UIcon name="i-lucide-link" class="size-8 text-muted" />
            <p class="text-sm text-muted">
              {{ $t('goals.noAssetsLinked') }}
            </p>
            <UButton :label="$t('goals.linkAssets')" icon="i-lucide-plus" size="sm" @click="goalsStore.openEdit(goal)" />
          </div>
        </UPageCard>
      </div>
    </template>
  </UDashboardPanel>
</template>
