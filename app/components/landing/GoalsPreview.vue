<script setup lang="ts">
import { useInView } from 'motion-v'

// Static mock of the goals screen (app/pages/app/goals) — two goals with the
// real GoalRing, milestone copy and pace badges, animated when scrolled into
// view. The ring arc animates via its built-in CSS transition once `started`
// flips the value from 0 to the goal's percentage.
const { t } = useI18n()
const { formatMoney } = useLocaleFormat()

const root = ref<HTMLElement>()
const inView = useInView(root, { once: true, amount: 0.4 })
const started = ref(false)
watch(inView, (visible) => {
  if (visible) started.value = true
})

const goals = computed(() => [
  {
    name: t('landing.goals.preview.emergencyFund'),
    icon: 'i-lucide-shield',
    color: 'emerald',
    target: 10000,
    saved: 6840,
    pace: 'on-track' as const,
    perMonth: 395,
    linked: [
      { name: t('landing.preview.accounts.revolut'), type: 'CASH' },
      { name: t('landing.preview.accounts.indexFunds'), type: 'INVESTMENT' }
    ]
  },
  {
    name: t('landing.goals.preview.tripToJapan'),
    icon: 'i-lucide-plane',
    color: 'sky',
    target: 3000,
    saved: 1230,
    pace: 'behind' as const,
    perMonth: 295,
    linked: []
  }
].map((goal) => {
  const pct = percentOf(goal.saved, goal.target)
  return {
    ...goal,
    pct,
    accent: goalAccent(goal.color),
    milestone: goalMilestone(pct),
    badge: goalPaceBadge(goal.pace)
  }
}))

const totalSaved = computed(() => goals.value.reduce((sum, goal) => sum + goal.saved, 0))
</script>

<template>
  <Motion v-bind="scrollMotion(0.15)">
    <div ref="root" class="relative">
      <div class="relative overflow-hidden rounded-xl border border-default bg-elevated/50 backdrop-blur ring-1 ring-white/2 shadow-2xl">
        <!-- Window chrome, same as the terminal -->
        <div class="flex items-center gap-1.5 border-b border-default p-4 sm:px-6">
          <span class="size-2.5 rounded-full border border-default bg-muted" />
          <span class="size-2.5 rounded-full border border-default bg-muted" />
          <span class="size-2.5 rounded-full border border-default bg-muted" />
        </div>

        <div class="p-5 sm:p-6 space-y-4 text-left">
          <div class="flex items-start justify-between gap-4">
            <div>
              <p class="font-semibold text-highlighted">
                {{ t('goals.title') }}
              </p>
              <p class="text-sm text-muted tabular-nums">
                {{ formatMoney(totalSaved, 'USD') }} {{ t('goals.savedLower') }}
              </p>
            </div>
            <UButton :label="t('goals.new')" icon="i-lucide-plus" size="sm" />
          </div>

          <Motion
            v-for="(goal, index) in goals"
            :key="goal.name"
            v-bind="staggerMotion(index)"
            class="rounded-lg p-4 ring ring-default bg-elevated/40"
          >
            <!-- header -->
            <div class="flex items-start justify-between gap-3 mb-4">
              <div class="flex min-w-0 items-center gap-3">
                <span class="flex size-10 shrink-0 items-center justify-center rounded-lg" :class="[goal.accent.soft, goal.accent.text]">
                  <UIcon :name="goal.icon" class="size-5" />
                </span>
                <div class="min-w-0">
                  <p class="truncate font-medium text-highlighted">
                    {{ goal.name }}
                  </p>
                  <p class="text-xs text-muted">
                    USD
                  </p>
                </div>
              </div>
              <UBadge
                v-if="goal.badge"
                :label="t(goal.badge.labelKey)"
                :color="goal.badge.color"
                variant="subtle"
                size="sm"
              />
            </div>

            <!-- ring + numbers -->
            <div class="flex items-center gap-4">
              <GoalRing :value="started ? goal.pct : 0" :color="goal.color" :size="84" :stroke="8">
                <LandingCountUp :value="goal.pct" :delay="0.2 + index * 0.15" #default="{ value }">
                  <span class="text-xl font-semibold tabular-nums">{{ Math.round(value) }}%</span>
                </LandingCountUp>
              </GoalRing>
              <div class="min-w-0 space-y-1">
                <p class="text-lg font-semibold tabular-nums text-highlighted">
                  {{ formatMoney(goal.saved, 'USD') }}
                  <span class="text-sm font-normal text-muted">{{ t('goals.card.of', { amount: formatMoney(goal.target, 'USD') }) }}</span>
                </p>
                <p class="text-sm font-medium" :class="goal.accent.text">
                  {{ t(goal.milestone.titleKey) }}
                </p>
                <p class="text-xs text-muted tabular-nums">
                  {{ t('goals.card.savePerMonth', { amount: formatMoney(goal.perMonth, 'USD') }) }}
                </p>
              </div>
            </div>

            <!-- linked accounts -->
            <div v-if="goal.linked.length" class="flex flex-wrap gap-1.5 mt-4">
              <span
                v-for="account in goal.linked"
                :key="account.name"
                class="inline-flex items-center gap-1 rounded-full bg-accented px-2 py-0.5 text-xs text-muted"
              >
                <UIcon :name="accountTypeIcon(account.type)" class="size-3.5" />
                {{ account.name }}
              </span>
            </div>
          </Motion>
        </div>
      </div>
    </div>
  </Motion>
</template>
