<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'

definePageMeta({
  layout: 'auth',
})

const { t } = useI18n()

useSeoMeta({
  title: () => t('auth.signup.seoTitle'),
  description: () => t('auth.signup.seoDescription'),
})

const { loggedIn, fetch: refreshSession } = useUserSession()
const toast = useToast()

watch(loggedIn, (v) => {
  if (v) navigateTo('/app')
}, { immediate: true })

const fields = computed(() => [{
  name: 'name',
  type: 'text' as const,
  label: t('auth.name'),
  placeholder: t('auth.enterName'),
}, {
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
  name: z.string().min(1, t('auth.validation.nameRequired')),
  email: z.email(t('auth.validation.invalidEmail')),
  password: z.string().min(8, t('auth.validation.passwordMin')),
}))

type Schema = z.output<typeof schema.value>

const loading = ref(false)

async function onSubmit(payload: FormSubmitEvent<Schema>) {
  loading.value = true
  try {
    await $fetch('/api/auth/register', {
      method: 'POST',
      body: {
        name: payload.data.name,
        email: payload.data.email,
        password: payload.data.password,
      },
    })
    await refreshSession()
    await navigateTo('/app')
  } catch (error) {
    toast.add({
      title: t('auth.signup.failed'),
      description: (error as { data?: { statusMessage?: string } })?.data?.statusMessage ?? t('common.tryAgain'),
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
    :title="$t('auth.signup.title')"
    :submit="{ label: $t('auth.signup.submit') }"
    :loading="loading"
    @submit="onSubmit"
  >
    <template #leading>
      <Logo symbol class="size-9" />
    </template>

    <template #description>
      {{ $t('auth.signup.haveAccount') }} <ULink
        to="/login"
        class="text-primary font-medium"
      >{{ $t('auth.signIn') }}</ULink>.
    </template>

    <template #footer>
      {{ $t('auth.signup.agree') }} <ULink
        to="/"
        class="text-primary font-medium"
      >{{ $t('auth.terms') }}</ULink>.
    </template>
  </UAuthForm>
</template>
