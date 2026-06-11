<script setup lang="ts">
useSeoMeta({ title: 'Sign in' })

const supabase = useSupabaseClient()
const user = useSupabaseUser()
const loading = ref(false)

watch(user, (u) => {
  if (u) navigateTo('/app')
}, { immediate: true })

async function signInWithGoogle() {
  loading.value = true
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}/confirm` },
  })
  if (error) {
    loading.value = false
    useToast().add({ title: 'Sign-in failed', description: error.message, color: 'error' })
  }
}
</script>

<template>
  <div class="flex items-center justify-center py-24">
    <UPageCard class="w-full max-w-md">
      <div class="flex flex-col items-center gap-6 py-4">
        <UIcon name="i-lucide-piggy-bank" class="size-10 text-primary" />
        <div class="text-center">
          <h1 class="text-xl font-semibold">
            Welcome to BetoTracker
          </h1>
          <p class="text-sm text-muted mt-1">
            Sign in to start tracking your finances.
          </p>
        </div>
        <UButton
          label="Continue with Google"
          icon="i-simple-icons-google"
          color="neutral"
          variant="outline"
          size="lg"
          block
          :loading="loading"
          @click="signInWithGoogle"
        />
      </div>
    </UPageCard>
  </div>
</template>
