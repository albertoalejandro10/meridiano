<script setup lang="ts">
useHead({
  titleTemplate: title => (title ? `${title} · BetoTrack` : 'BetoTrack'),
})
</script>

<template>
  <UApp>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
