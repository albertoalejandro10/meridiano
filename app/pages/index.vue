<script setup lang="ts">
useSeoMeta({
  title: 'BetoTrack — Personal finance, fast',
  description: 'Track income, expenses and net worth across multiple currencies. Built for fast entry.',
})

const features = [
  {
    title: 'Fast entry',
    description: 'Log a transaction in seconds. Optimized for daily use on mobile and desktop.',
    icon: 'i-lucide-zap',
  },
  {
    title: 'Multi-currency',
    description: 'USD, EUR and VES side by side. Balances stay in their native currency.',
    icon: 'i-lucide-coins',
  },
  {
    title: 'Net worth at a glance',
    description: 'Accounts, assets and debts consolidated into one clear number.',
    icon: 'i-lucide-trending-up',
  },
]
</script>

<template>
  <div>
    <UPageHero
      title="Your money, clearly."
      description="BetoTrack is a personal finance tracker focused on fast transaction entry and a clear view of your financial status."
      :links="[
        { label: 'Get started', to: '/login', trailingIcon: 'i-lucide-arrow-right', size: 'xl' },
      ]"
    />

    <UPageSection>
      <UPageGrid>
        <UPageCard
          v-for="feature in features"
          :key="feature.title"
          v-bind="feature"
          spotlight
        />
      </UPageGrid>
    </UPageSection>
  </div>
</template>
