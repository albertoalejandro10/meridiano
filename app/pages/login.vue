<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'

definePageMeta({
  layout: 'auth',
})

const { t } = useI18n()

useSeoMeta({
  title: () => t('auth.login.seoTitle'),
  description: () => t('auth.login.seoDescription'),
})

const { loggedIn, fetch: refreshSession } = useUserSession()
const toast = useToast()

watch(loggedIn, (v) => {
  if (v) navigateTo('/app')
}, { immediate: true })

const fields = computed(() => [{
  name: 'email',
  type: 'text' as const,
  label: t('auth.email'),
  placeholder: t('auth.enterEmail'),
  required: true,
}, {
  name: 'password',
  label: t('auth.password'),
  type: 'password' as const,
  placeholder: t('auth.enterPassword'),
  required: true,
}])

// computed so the validation messages follow the locale
const schema = computed(() => z.object({
  email: z.email(t('auth.validation.invalidEmail')),
  password: z.string().min(8, t('auth.validation.passwordMin')),
}))

type Schema = z.output<typeof schema.value>

const loading = ref(false)

async function onSubmit(payload: FormSubmitEvent<Schema>) {
  loading.value = true
  try {
    await $fetch('/api/auth/login', {
      method: 'POST',
      body: { email: payload.data.email, password: payload.data.password },
    })
    await refreshSession()
    await navigateTo('/app')
  } catch (error) {
    toast.add({
      title: t('auth.login.failed'),
      description: (error as { data?: { statusMessage?: string } })?.data?.statusMessage ?? t('auth.login.failedHint'),
      color: 'error',
    })
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <UAuthForm
    :fields="fields"
    :schema="schema"
    :title="$t('auth.login.title')"
    :loading="loading"
    @submit="onSubmit"
  >
    <template #leading>
      <Logo symbol class="size-9" />
    </template>

    <template #description>
      {{ $t('auth.login.noAccount') }} <ULink
        to="/signup"
        class="text-primary font-medium"
      >{{ $t('auth.signUp') }}</ULink>.
    </template>

    <template #password-hint>
      <ULink
        to="/forgot-password"
        class="text-primary font-medium"
        tabindex="-1"
      >{{ $t('auth.forgotPassword') }}</ULink>
    </template>

    <template #footer>
      {{ $t('auth.login.agree') }} <ULink
        to="/"
        class="text-primary font-medium"
      >{{ $t('auth.terms') }}</ULink>.
    </template>
  </UAuthForm>
</template>
