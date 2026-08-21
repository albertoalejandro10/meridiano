<script setup lang="ts">
// The favicon is registered reactively by the `theme` plugin so it tracks the
// primary color (a browser-tab icon can't read the page's CSS variables).
import * as uiLocales from '@nuxt/ui/locale'

const { locale } = useI18n()

// Bridges the active i18n locale into Nuxt UI's built-in component strings
// (calendar, table empty states, aria labels) and the <html> lang/dir attrs.
const uiLocale = computed(() => uiLocales[locale.value as keyof typeof uiLocales])

useHead({
  titleTemplate: title => (title ? `${title} · Meridiano` : 'Meridiano'),
  htmlAttrs: {
    lang: () => uiLocale.value.code,
    dir: () => uiLocale.value.dir,
  },
})
</script>

<template>
  <UApp :locale="uiLocale">
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
