<script setup lang="ts">
definePageMeta({ layout: 'dashboard' })

const { t } = useI18n()

useSeoMeta({ title: () => t('settings.account.title') })

const { user } = useUserSession()
</script>

<template>
  <SettingsLayout>
    <SettingsSection :title="$t('settings.account.title')" :description="$t('settings.account.description')">
      <UPageCard variant="subtle">
        <dl class="divide-y divide-default">
          <div class="flex items-center justify-between gap-4 py-3 first:pt-0">
            <dt class="text-sm text-muted">
              {{ $t('settings.account.name') }}
            </dt>
            <dd class="text-sm font-medium">
              {{ user?.name || $t('settings.account.notSet') }}
            </dd>
          </div>
          <div class="flex items-center justify-between gap-4 py-3 last:pb-0">
            <dt class="text-sm text-muted">
              {{ $t('settings.account.email') }}
            </dt>
            <dd class="text-sm font-medium">
              {{ user?.email }}
            </dd>
          </div>
        </dl>
      </UPageCard>

      <SettingsPlaceholder
        icon="i-lucide-user-pen"
        :title="$t('settings.account.placeholderTitle')"
        :description="$t('settings.account.placeholderDescription')"
      />
    </SettingsSection>
  </SettingsLayout>
</template>
