<script setup lang="ts">
import { motion } from 'motion-v'

// Static mock of the real dashboard (app/pages/app/index.vue) — net worth,
// allocation bar and accounts with fake data, animated when scrolled into view.
const { t } = useI18n()
const { formatMoney } = useLocaleFormat()

const NET_WORTH = 18940.12

// Fake 30-day net-worth series (USD) trending up to NET_WORTH.
const series = [
  17600, 17680, 17620, 17750, 17710, 17840, 17900, 17860, 17980, 18050,
  18010, 18120, 18080, 18190, 18260, 18210, 18340, 18420, 18380, 18510,
  18470, 18600, 18550, 18680, 18760, 18710, 18820, 18860, NET_WORTH
]

const CHART_WIDTH = 560
const CHART_HEIGHT = 160
const CHART_PAD = 8

const points = computed(() => {
  const min = Math.min(...series)
  const max = Math.max(...series)
  return series.map((value, i) => ({
    x: (i / (series.length - 1)) * CHART_WIDTH,
    y: CHART_HEIGHT - CHART_PAD - ((value - min) / (max - min)) * (CHART_HEIGHT - 2 * CHART_PAD)
  }))
})

// Catmull-Rom → cubic Bézier for a smooth line through every point.
function smoothPath(pts: { x: number, y: number }[]) {
  let d = `M ${pts[0]!.x.toFixed(1)} ${pts[0]!.y.toFixed(1)}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(i - 1, 0)]!
    const p1 = pts[i]!
    const p2 = pts[i + 1]!
    const p3 = pts[Math.min(i + 2, pts.length - 1)]!
    const c1x = p1.x + (p2.x - p0.x) / 6
    const c1y = p1.y + (p2.y - p0.y) / 6
    const c2x = p2.x - (p3.x - p1.x) / 6
    const c2y = p2.y - (p3.y - p1.y) / 6
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`
  }
  return d
}

const linePath = computed(() => smoothPath(points.value))
const areaPath = computed(() => `${linePath.value} L ${CHART_WIDTH} ${CHART_HEIGHT} L 0 ${CHART_HEIGHT} Z`)
const lastPoint = computed(() => points.value[points.value.length - 1]!)

// Mock asset accounts, sorted largest-first like the real allocation card.
const accounts = computed(() => [
  { type: 'INVESTMENT', name: t('landing.preview.accounts.indexFunds'), balance: 10500 },
  { type: 'CASH', name: t('landing.preview.accounts.revolut'), balance: 6240 },
  { type: 'CRYPTO', name: t('landing.preview.accounts.bitcoin'), balance: 2200.12 }
].map((account, i) => ({
  ...account,
  icon: accountTypeIcon(account.type),
  color: chartColors[i]!,
  share: (account.balance / NET_WORTH) * 100
})))
</script>

<template>
  <Motion v-bind="scrollMotion(0.15)">
    <div class="relative max-w-3xl mx-auto">
      <LandingGradientGlow class="top-1/4 w-full h-1/2" />

      <div class="relative overflow-hidden rounded-xl border border-default bg-elevated/50 backdrop-blur ring-1 ring-white/2 shadow-2xl">
        <!-- Window chrome, same as the terminal -->
        <div class="flex items-center gap-1.5 border-b border-default p-4 sm:px-6">
          <span class="size-2.5 rounded-full border border-default bg-muted" />
          <span class="size-2.5 rounded-full border border-default bg-muted" />
          <span class="size-2.5 rounded-full border border-default bg-muted" />
        </div>

        <div class="p-5 sm:p-6 space-y-6 text-left">
          <div class="flex items-start justify-between gap-4">
            <div>
              <p class="font-semibold text-highlighted">
                {{ $t('landing.preview.welcome') }}
              </p>
              <p class="text-sm text-muted">
                {{ $t('dashboard.subtitle') }}
              </p>
            </div>
            <UButton :label="$t('common.new')" icon="i-lucide-plus" size="sm" />
          </div>

          <!-- Net worth -->
          <div>
            <div class="flex items-baseline justify-between gap-4 mb-3">
              <div class="space-y-1">
                <p class="text-sm text-muted">
                  {{ $t('dashboard.netWorth') }}
                </p>
                <p class="text-3xl font-semibold text-highlighted tabular-nums">
                  <LandingCountUp :value="NET_WORTH" :duration="2" #default="{ value }">
                    {{ formatMoney(value, 'USD') }}
                  </LandingCountUp>
                </p>
                <p class="text-xs text-muted">
                  {{ $t('dashboard.also') }}: {{ formatMoney(9120.44, 'EUR') }}
                </p>
              </div>
            </div>

            <svg
              :viewBox="`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`"
              class="w-full h-32 sm:h-40"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <defs>
                <linearGradient id="landing-preview-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="var(--ui-primary)" stop-opacity="0.25" />
                  <stop offset="100%" stop-color="var(--ui-primary)" stop-opacity="0" />
                </linearGradient>
              </defs>

              <motion.path
                :d="areaPath"
                fill="url(#landing-preview-fill)"
                :initial="{ opacity: 0 }"
                :while-in-view="{ opacity: 1 }"
                :in-view-options="{ once: true, amount: 0.6 }"
                :transition="{ duration: 1.2, delay: 0.9 }"
              />
              <motion.path
                :d="linePath"
                fill="none"
                stroke="var(--ui-primary)"
                stroke-width="2"
                stroke-linecap="round"
                :initial="{ pathLength: 0 }"
                :while-in-view="{ pathLength: 1 }"
                :in-view-options="{ once: true, amount: 0.6 }"
                :transition="{ duration: 1.8, delay: 0.3, ease: 'easeOut' }"
              />
              <motion.circle
                :cx="lastPoint.x"
                :cy="lastPoint.y"
                r="4"
                fill="var(--ui-primary)"
                :initial="{ opacity: 0 }"
                :animate="{ opacity: [0.4, 1, 0.4] }"
                :transition="{ duration: 2, repeat: Infinity, ease: 'easeInOut' }"
              />
            </svg>
          </div>

          <!-- Allocation -->
          <div>
            <p class="text-sm text-muted mb-3">
              {{ $t('dashboard.assets') }}
            </p>

            <div class="flex h-3 w-full overflow-hidden rounded-full bg-elevated mb-4">
              <Motion
                v-for="(account, index) in accounts"
                :key="account.name"
                class="h-full origin-left"
                :style="{ width: `${account.share}%`, backgroundColor: account.color }"
                :initial="{ scaleX: 0 }"
                :while-in-view="{ scaleX: 1 }"
                :in-view-options="{ once: true, amount: 0.6 }"
                :transition="{ duration: 0.7, delay: 0.5 + index * 0.15, ease: 'easeOut' }"
              />
            </div>

            <div class="divide-y divide-default">
              <Motion
                v-for="(account, index) in accounts"
                :key="account.name"
                v-bind="staggerMotion(index)"
                class="flex items-center justify-between gap-4 py-2.5"
              >
                <div class="flex items-center gap-3 min-w-0">
                  <span class="size-2.5 rounded-full shrink-0" :style="{ backgroundColor: account.color }" />
                  <UIcon :name="account.icon" class="size-4 shrink-0 text-muted" />
                  <div class="min-w-0">
                    <p class="text-sm font-medium truncate text-highlighted">
                      {{ account.name }}
                    </p>
                    <p class="text-xs text-muted">
                      {{ $t(accountTypeLabelKey(account.type)) }}
                    </p>
                  </div>
                </div>
                <span class="text-sm font-semibold text-highlighted tabular-nums">
                  {{ formatMoney(account.balance, 'USD') }}
                </span>
              </Motion>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Motion>
</template>
