<script setup lang="ts">
definePageMeta({ layout: 'dashboard' })

const { t, locale, locales, setLocale } = useI18n()

useSeoMeta({ title: () => t('settings.preferences.title') })

const languageItems = computed(() => locales.value.map(l => ({ label: l.name, value: l.code })))

// setLocale swaps the messages in place and persists the choice in the i18n cookie.
const language = computed({
  get: () => locale.value,
  set: code => setLocale(code),
})
</script>

<template>
  <SettingsLayout>
    <SettingsSection :title="$t('settings.preferences.title')" :description="$t('settings.preferences.description')">
      <UPageCard variant="subtle">
        <div class="flex items-center justify-between gap-4">
          <div class="space-y-0.5">
            <p class="text-sm font-medium">
              {{ $t('settings.preferences.language') }}
            </p>
            <p class="text-sm text-muted">
              {{ $t('settings.preferences.languageHint') }}
            </p>
          </div>
          <USelect
            v-model="language"
            :items="languageItems"
            icon="i-lucide-languages"
            class="w-40"
          />
        </div>
      </UPageCard>

      <SettingsPlaceholder
        icon="i-lucide-sliders-horizontal"
        :title="$t('settings.preferences.placeholderTitle')"
        :description="$t('settings.preferences.placeholderDescription')"
      />
    </SettingsSection>
  </SettingsLayout>
</template>
