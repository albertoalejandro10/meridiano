<script setup lang="ts">
definePageMeta({ layout: 'dashboard' })

const { t } = useI18n()

useSeoMeta({ title: () => t('settings.rules.title') })
</script>

<template>
  <SettingsLayout>
    <SettingsSection :title="$t('settings.rules.title')" :description="$t('settings.rules.description')">
      <SettingsPlaceholder
        icon="i-lucide-git-branch"
        :title="$t('settings.rules.placeholderTitle')"
        :description="$t('settings.rules.placeholderDescription')"
      />
    </SettingsSection>
  </SettingsLayout>
</template>
