<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'

definePageMeta({
  layout: 'auth',
})

const { t } = useI18n()

useSeoMeta({
  title: () => t('auth.reset.seoTitle'),
  description: () => t('auth.reset.seoDescription'),
})

const route = useRoute()
const toast = useToast()

const token = computed(() => (typeof route.query.token === 'string' ? route.query.token : ''))

const fields = computed(() => [{
  name: 'password',
  label: t('auth.reset.newPassword'),
  type: 'password' as const,
  placeholder: t('auth.reset.enterNewPassword'),
  required: true,
}, {
  name: 'confirmPassword',
  label: t('auth.reset.confirmPassword'),
  type: 'password' as const,
  placeholder: t('auth.reset.reEnterPassword'),
  required: true,
}])

// computed so the validation messages follow the locale
const schema = computed(() => z.object({
  password: z.string().min(8, t('auth.validation.passwordMin')).max(128),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: t('auth.validation.passwordsMismatch'),
  path: ['confirmPassword'],
}))

type Schema = z.output<typeof schema.value>

const loading = ref(false)

async function onSubmit(payload: FormSubmitEvent<Schema>) {
  loading.value = true
  try {
    await $fetch('/api/auth/password/reset', {
      method: 'POST',
      body: { token: token.value, password: payload.data.password },
    })
    toast.add({
      title: t('auth.reset.updated'),
      description: t('auth.reset.updatedBody'),
      color: 'success',
    })
    await navigateTo('/login')
  } catch (error) {
    toast.add({
      title: t('auth.reset.failed'),
      description: (error as { data?: { statusMessage?: string } })?.data?.statusMessage ?? t('auth.reset.failedHint'),
      color: 'error',
    })
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div v-if="!token" class="text-center space-y-4">
    <UIcon name="i-lucide-link-2-off" class="size-10 text-error mx-auto" />
    <h1 class="text-xl font-semibold">
      {{ $t('auth.reset.invalidLink') }}
    </h1>
    <p class="text-muted">
      {{ $t('auth.reset.invalidLinkBody') }}
    </p>
    <UButton
      to="/forgot-password"
      :label="$t('auth.reset.requestNew')"
      color="neutral"
      variant="subtle"
      block
    />
  </div>

  <UAuthForm
    v-else
    :fields="fields"
    :schema="schema"
    :title="$t('auth.reset.title')"
    icon="i-lucide-piggy-bank"
    :submit="{ label: $t('auth.reset.submit') }"
    :loading="loading"
    @submit="onSubmit"
  >
    <template #description>
      {{ $t('auth.reset.description') }}
    </template>

    <template #footer>
      {{ $t('auth.rememberedIt') }} <ULink
        to="/login"
        class="text-primary font-medium"
      >{{ $t('auth.backToLogin') }}</ULink>.
    </template>
  </UAuthForm>
</template>
