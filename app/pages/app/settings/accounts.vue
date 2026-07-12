<script setup lang="ts">
definePageMeta({ layout: 'dashboard' })

const { t } = useI18n()

useSeoMeta({ title: () => t('settings.accounts.title') })
</script>

<template>
  <SettingsLayout>
    <SettingsSection :title="$t('settings.accounts.title')" :description="$t('settings.accounts.description')">
      <SettingsPlaceholder
        icon="i-lucide-wallet"
        :title="$t('settings.accounts.placeholderTitle')"
        :description="$t('settings.accounts.placeholderDescription')"
      />
    </SettingsSection>
  </SettingsLayout>
</template>
