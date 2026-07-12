<script setup lang="ts">
// /app/settings has no page of its own — land on the first General item.
definePageMeta({
  layout: 'dashboard',
  middleware: () => navigateTo('/app/settings/account', { replace: true }),
})
</script>

<template>
  <div />
</template>
