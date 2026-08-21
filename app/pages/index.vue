<script setup lang="ts">
definePageMeta({
  layout: 'landing'
})

const { t } = useI18n()

// Static landing content (this page previously came from @nuxt/content; the
// template's content collection was dropped in favour of an inline object).
// A computed so all copy re-renders when the locale switches.
// Narrow type for the CTA/hero buttons so their literal colors/variants stay
// assignable to UButton's prop unions when spread with `v-bind`.
type NavLink = {
  label: string
  to: string
  color?: 'primary' | 'neutral'
  variant?: 'soft'
  size?: 'xl'
  trailingIcon?: string
}

// Metric values count up from zero; prefix/suffix carry the non-numeric
// framing ("<5s", "3+").
type Metric = {
  value: number
  prefix?: string
  suffix?: string
  label: string
  class: string
}

const page = computed(() => ({
  seo: {
    title: t('landing.seo.title'),
    description: t('landing.seo.description')
  },
  title: t('landing.title'),
  description: t('landing.description'),
  hero: {
    headline: t('landing.hero.headline'),
    links: [
      { label: t('landing.getStarted'), to: '/signup', color: 'primary', size: 'xl', trailingIcon: 'i-lucide-arrow-right' },
      { label: t('auth.signIn'), to: '/login', color: 'neutral', variant: 'soft', size: 'xl' }
    ] satisfies NavLink[]
  },
  terminal: {
    lines: [
      { segments: [
        { text: '$ ', style: 'prompt' },
        { text: 'mrd add', style: 'cmd' },
        { text: ' income', style: 'flag' }
      ] },
      { segments: [
        { text: `→ ${t('landing.terminal.amount')} `, style: 'dim' },
        { text: '1,200.00 USD', style: 'cmd' }
      ] },
      { segments: [
        { text: `→ ${t('landing.terminal.account')} `, style: 'dim' },
        { text: 'Revolut', style: 'cmd' },
        { text: `  ·  ${t('landing.terminal.category')} `, style: 'dim' },
        { text: t('landing.terminal.salary'), style: 'cmd' }
      ] },
      { segments: [
        { text: `→ ${t('landing.terminal.linkedToGoal')} `, style: 'dim' },
        { text: t('landing.terminal.emergencyFund'), style: 'cmd' },
        { text: ' ✓', style: 'success' }
      ] },
      { segments: [
        { text: `→ ${t('landing.terminal.savedIn')} `, style: 'dim' },
        { text: '280ms', style: 'metric-good' }
      ] },
      { segments: [
        { text: ' ', style: 'dim' }
      ] },
      { segments: [
        { text: `✓ ${t('landing.terminal.netWorth')} `, style: 'success' },
        { text: '$18,940.12', style: 'metric-good' },
        { text: ` ${t('landing.terminal.acrossAccounts')}`, style: 'dim' }
      ] }
    ]
  },
  logos: {
    title: t('landing.logos.title'),
    items: [
      'i-simple-icons-visa',
      'i-simple-icons-mastercard',
      'i-simple-icons-paypal',
      'i-simple-icons-wise',
      'i-simple-icons-revolut'
    ]
  },
  preview: {
    headline: t('landing.preview.headline'),
    title: t('landing.preview.title'),
    description: t('landing.preview.description')
  },
  features: {
    headline: t('landing.features.headline'),
    title: t('landing.features.title'),
    description: t('landing.features.description'),
    items: [
      {
        icon: 'i-lucide-zap',
        title: t('landing.features.fastEntry.title'),
        description: t('landing.features.fastEntry.description')
      },
      {
        icon: 'i-lucide-coins',
        title: t('landing.features.multiCurrency.title'),
        description: t('landing.features.multiCurrency.description')
      },
      {
        icon: 'i-lucide-trending-up',
        title: t('landing.features.netWorth.title'),
        description: t('landing.features.netWorth.description')
      },
      {
        icon: 'i-lucide-target',
        title: t('landing.features.goals.title'),
        description: t('landing.features.goals.description')
      },
      {
        icon: 'i-lucide-arrow-left-right',
        title: t('landing.features.transfers.title'),
        description: t('landing.features.transfers.description')
      },
      {
        icon: 'i-lucide-shield-check',
        title: t('landing.features.private.title'),
        description: t('landing.features.private.description')
      }
    ]
  },
  howItWorks: {
    headline: t('landing.howItWorks.headline'),
    title: t('landing.howItWorks.title'),
    description: t('landing.howItWorks.description'),
    items: [
      {
        icon: 'i-lucide-wallet',
        title: t('landing.howItWorks.steps.addAccounts.title'),
        description: t('landing.howItWorks.steps.addAccounts.description')
      },
      {
        icon: 'i-lucide-receipt-text',
        title: t('landing.howItWorks.steps.logDaily.title'),
        description: t('landing.howItWorks.steps.logDaily.description')
      },
      {
        icon: 'i-lucide-chart-line',
        title: t('landing.howItWorks.steps.watchGrow.title'),
        description: t('landing.howItWorks.steps.watchGrow.description')
      }
    ]
  },
  goals: {
    headline: t('landing.goals.headline'),
    title: t('landing.goals.title'),
    description: t('landing.goals.description'),
    highlights: [
      {
        icon: 'i-lucide-target',
        title: t('landing.goals.highlights.target.title'),
        description: t('landing.goals.highlights.target.description')
      },
      {
        icon: 'i-lucide-link',
        title: t('landing.goals.highlights.linked.title'),
        description: t('landing.goals.highlights.linked.description')
      },
      {
        icon: 'i-lucide-gauge',
        title: t('landing.goals.highlights.pace.title'),
        description: t('landing.goals.highlights.pace.description')
      }
    ]
  },
  metrics: {
    headline: t('landing.metrics.headline'),
    title: t('landing.metrics.title'),
    description: t('landing.metrics.description'),
    items: [
      { value: 3, suffix: '+', label: t('landing.metrics.currencies'), class: 'text-primary' },
      { value: 5, prefix: '<', suffix: 's', label: t('landing.metrics.perEntry'), class: 'text-success' },
      { value: 1, label: t('landing.metrics.netWorthNumber'), class: 'text-info' },
      { value: 0, label: t('landing.metrics.spreadsheets'), class: 'text-warning' }
    ] satisfies Metric[]
  },
  cta: {
    title: t('landing.cta.title'),
    description: t('landing.cta.description'),
    links: [
      { label: t('landing.getStarted'), to: '/signup', color: 'primary' }
    ] satisfies NavLink[]
  }
}))

useSeoMeta({
  title: () => page.value.seo.title,
  ogTitle: () => page.value.seo.title,
  description: () => page.value.seo.description,
  ogDescription: () => page.value.seo.description
})

const heroTitle = computed(() => {
  const [primary = '', ...secondaryParts] = page.value.title.split('\n')

  return {
    primary,
    secondary: secondaryParts.join(' ').trim()
  }
})
</script>

<template>
  <div>
    <!-- Hero -->
    <UPageHero
      :ui="{
        root: 'pb-24 sm:pb-32',
        container: 'relative z-10 lg:py-32',
        wrapper: 'flex flex-col items-center',
        title: 'sm:text-6xl lg:text-7xl xl:text-[80px] tracking-tighter leading-[1.05]',
        description: 'mt-5 max-w-xl mx-auto text-base sm:text-lg leading-relaxed text-default',
        links: 'gap-3'
      }"
    >
      <template #top>
        <Motion v-bind="staggerMotion(0)">
          <LandingHeroShaders class="absolute top-0 inset-x-0 opacity-15 h-full" />
        </Motion>

        <LandingGradientGlow class="top-0 w-2/3 h-1/2" />
      </template>

      <template #headline>
        <Motion v-bind="enterMotion(0.2)">
          <UBadge
            color="neutral"
            variant="soft"
            :label="page.hero.headline"
            class="rounded-full px-3 py-1.5 gap-1.5 bg-elevated/50 backdrop-blur"
          >
            <template #leading>
              <UChip
                inset
                standalone
                :ui="{ base: 'animate-pulse ring-0' }"
              />
            </template>
          </UBadge>
        </Motion>
      </template>

      <template #title>
        <Motion
          as="span"
          v-bind="enterMotion(0.35)"
          class="inline-block"
        >
          {{ heroTitle.primary }}
          <br v-if="heroTitle.secondary">
          <span
            v-if="heroTitle.secondary"
            class="animate-shimmer bg-size-[200%_auto] bg-clip-text text-transparent"
            :style="{
              backgroundImage: 'linear-gradient(135deg, var(--ui-primary), color-mix(in oklch, var(--ui-primary) 45%, var(--ui-text-highlighted)), var(--ui-primary))',
              animationDuration: '10s'
            }"
          >
            {{ heroTitle.secondary }}
          </span>
        </Motion>
      </template>

      <template #description>
        <Motion
          as="span"
          v-bind="enterMotion(0.5)"
          class="inline-block"
        >
          {{ page.description }}
        </Motion>
      </template>

      <template #links>
        <Motion
          class="flex flex-wrap justify-center gap-6"
          v-bind="enterMotion(0.65)"
        >
          <UButton
            v-for="link in page.hero.links"
            :key="link.label"
            v-bind="link"
          />
        </Motion>
      </template>

      <Motion
        as-child
        v-bind="enterMotion(0.85)"
        class="max-w-2xl mx-auto w-full"
      >
        <LandingTerminal :lines="page.terminal.lines" />
      </Motion>

      <Motion
        class="max-w-lg mx-auto w-full"
        v-bind="scrollMotion(0.95)"
      >
        <UPageLogos
          :title="page.logos.title"
          :items="page.logos.items"
          :ui="{
            title: 'font-mono uppercase text-xs tracking-[0.12em] text-dimmed',
            logos: 'gap-0',
            logo: 'text-muted size-6'
          }"
        />
      </Motion>
    </UPageHero>

    <!-- Dashboard preview -->
    <LandingSection
      id="preview"
      :headline="page.preview.headline"
      :title="page.preview.title"
      :description="page.preview.description"
    >
      <LandingDashboardPreview />
    </LandingSection>

    <!-- Features -->
    <LandingSection
      id="features"
      :headline="page.features.headline"
      :title="page.features.title"
      :description="page.features.description"
    >
      <div class="relative">
        <LandingGradientGlow class="top-1/2 -translate-y-1/2 w-[110%] h-[140%]" />

        <div class="relative rounded-2xl border border-default bg-default overflow-hidden">
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px">
            <Motion
              v-for="(feature, index) in page.features.items"
              :key="feature.title"
              v-bind="staggerMotion(index)"
              :while-hover="{ y: -4 }"
              class="h-full"
            >
              <UPageCard
                :icon="feature.icon"
                :title="feature.title"
                :description="feature.description"
                spotlight
                class="rounded-none h-full duration-300"
                :ui="{
                  leading: 'mb-5 flex size-9 justify-center rounded-lg bg-primary/10',
                  title: 'text-sm tracking-tight',
                  description: 'text-sm leading-relaxed sm:line-clamp-2 lg:line-clamp-3 text-dimmed'
                }"
              />
            </Motion>
          </div>
        </div>
      </div>
    </LandingSection>

    <!-- How it works -->
    <LandingSection
      id="how-it-works"
      :headline="page.howItWorks.headline"
      :title="page.howItWorks.title"
      :description="page.howItWorks.description"
    >
      <div class="relative">
        <LandingGradientGlow class="top-1/2 -translate-y-1/2 w-[110%] h-[140%]" />

        <div class="relative grid grid-cols-1 sm:grid-cols-3 gap-6">
          <Motion
            v-for="(step, index) in page.howItWorks.items"
            :key="step.title"
            v-bind="staggerMotion(index)"
            :while-hover="{ y: -4 }"
            class="h-full"
          >
            <UPageCard
              :title="step.title"
              :description="step.description"
              spotlight
              class="h-full duration-300"
              :ui="{
                title: 'text-sm tracking-tight',
                description: 'text-sm leading-relaxed text-dimmed'
              }"
            >
              <template #leading>
                <div class="mb-5 flex items-center justify-between w-full">
                  <span class="flex size-9 items-center justify-center rounded-lg bg-primary/10">
                    <UIcon :name="step.icon" class="size-5 text-primary" />
                  </span>
                  <span class="font-mono text-4xl font-bold leading-none text-muted/40">
                    {{ String(index + 1).padStart(2, '0') }}
                  </span>
                </div>
              </template>
            </UPageCard>
          </Motion>
        </div>
      </div>
    </LandingSection>

    <!-- Goals -->
    <LandingSection
      id="goals"
      :headline="page.goals.headline"
      :title="page.goals.title"
      :description="page.goals.description"
    >
      <div class="relative">
        <LandingGradientGlow class="top-1/2 -translate-y-1/2 w-[110%] h-[140%]" />

        <div class="relative grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14 items-center">
          <div class="flex flex-col gap-8 max-w-md max-lg:mx-auto">
            <Motion
              v-for="(highlight, index) in page.goals.highlights"
              :key="highlight.title"
              v-bind="staggerMotion(index)"
            >
              <UPageFeature
                :icon="highlight.icon"
                :title="highlight.title"
                :description="highlight.description"
                orientation="horizontal"
                :ui="{
                  root: 'gap-4',
                  leading: 'flex size-9 items-center justify-center rounded-lg bg-primary/10 p-0',
                  leadingIcon: 'size-5',
                  title: 'text-sm tracking-tight',
                  description: 'text-sm leading-relaxed text-dimmed'
                }"
              />
            </Motion>
          </div>

          <LandingGoalsPreview />
        </div>
      </div>
    </LandingSection>

    <!-- Metrics -->
    <LandingSection
      id="metrics"
      :headline="page.metrics.headline"
      :title="page.metrics.title"
      :description="page.metrics.description"
    >
      <div class="relative">
        <LandingGradientGlow class="top-1/2 -translate-y-1/2 w-[110%] h-[140%]" />

        <div class="relative rounded-2xl border border-default bg-default overflow-hidden">
          <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-px">
            <Motion
              v-for="(metric, index) in page.metrics.items"
              :key="metric.label"
              v-bind="staggerMotion(index)"
              class="h-full"
            >
              <UPageCard
                :description="metric.label"
                class="rounded-none h-full duration-300"
                :ui="{
                  root: 'text-center',
                  wrapper: 'items-center',
                  title: ['text-4xl font-bold tracking-tight leading-none tabular-nums', metric.class],
                  description: 'font-mono text-xs uppercase tracking-[0.06em] text-dimmed mt-3'
                }"
              >
                <template #title>
                  {{ metric.prefix }}<LandingCountUp :value="metric.value" />{{ metric.suffix }}
                </template>
              </UPageCard>
            </Motion>
          </div>
        </div>
      </div>
    </LandingSection>

    <!-- CTA -->
    <UPageCTA
      variant="naked"
      :ui="{
        root: 'py-24 sm:py-32',
        container: 'max-w-3xl text-center',
        title: 'lg:text-5xl tracking-tighter whitespace-pre-line',
        description: 'mx-auto max-w-sm leading-relaxed text-dimmed'
      }"
    >
      <template #top>
        <LandingGradientGlow class="bottom-0 w-2/3 h-1/2" />
      </template>

      <template #title>
        <Motion
          as="span"
          v-bind="scrollMotion()"
          class="inline-block"
        >
          {{ page.cta.title }}
        </Motion>
      </template>

      <template #description>
        <Motion
          as="span"
          v-bind="scrollMotion(0.1)"
          class="inline-block"
        >
          {{ page.cta.description }}
        </Motion>
      </template>

      <template #links>
        <Motion
          class="flex flex-col items-center justify-center gap-6"
          v-bind="scrollMotion(0.2)"
        >
          <UButton
            v-for="link in page.cta.links"
            :key="link.label"
            v-bind="link"
            size="xl"
          />
        </Motion>
      </template>
    </UPageCTA>
  </div>
</template>
