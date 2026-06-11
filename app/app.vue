<script setup lang="ts">
useHead({
  titleTemplate: title => (title ? `${title} · BetoTracker` : 'BetoTracker'),
})
</script>

<template>
  <UApp>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
