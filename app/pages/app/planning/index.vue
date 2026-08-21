<script setup lang="ts">
definePageMeta({ layout: 'dashboard' })

const { t } = useI18n()

useSeoMeta({ title: () => t('planning.title') })

const breadcrumbItems = useBreadcrumbs([
  { labelKey: 'planning.title', icon: 'i-lucide-route', to: '/app/planning' },
])
</script>

<template>
  <UDashboardPanel id="planning">
    <template #body>
      <div class="space-y-6">
        <UBreadcrumb :items="breadcrumbItems" />

        <div>
          <h1 class="text-xl font-semibold">
            {{ $t('planning.title') }}
          </h1>
          <p class="text-sm text-muted">
            {{ $t('planning.subtitle') }}
          </p>
        </div>

        <PlanningDebtPayoff />
        <PlanningWhatIf />
      </div>
    </template>
  </UDashboardPanel>
</template>
