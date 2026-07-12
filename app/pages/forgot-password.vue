<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'

definePageMeta({
  layout: 'auth',
})

const { t } = useI18n()

useSeoMeta({
  title: () => t('auth.forgot.seoTitle'),
  description: () => t('auth.forgot.seoDescription'),
})

const { loggedIn } = useUserSession()
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
}])

// computed so the validation messages follow the locale
const schema = computed(() => z.object({
  email: z.email(t('auth.validation.invalidEmail')),
}))

type Schema = z.output<typeof schema.value>

const loading = ref(false)
const submitted = ref(false)

async function onSubmit(payload: FormSubmitEvent<Schema>) {
  loading.value = true
  try {
    await $fetch('/api/auth/password/request', {
      method: 'POST',
      body: { email: payload.data.email },
    })
    submitted.value = true
  } catch {
    toast.add({
      title: t('common.somethingWrong'),
      description: t('common.tryAgain'),
      color: 'error',
    })
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div v-if="submitted" class="text-center space-y-4">
    <UIcon name="i-lucide-mail-check" class="size-10 text-primary mx-auto" />
    <h1 class="text-xl font-semibold">
      {{ $t('auth.forgot.checkEmail') }}
    </h1>
    <p class="text-muted">
      {{ $t('auth.forgot.checkEmailBody') }}
    </p>
    <UButton
      to="/login"
      :label="$t('auth.backToLogin')"
      color="neutral"
      variant="subtle"
      block
    />
  </div>

  <UAuthForm
    v-else
    :fields="fields"
    :schema="schema"
    :title="$t('auth.forgot.title')"
    icon="i-lucide-piggy-bank"
    :submit="{ label: $t('auth.forgot.submit') }"
    :loading="loading"
    @submit="onSubmit"
  >
    <template #description>
      {{ $t('auth.forgot.description') }}
    </template>

    <template #footer>
      {{ $t('auth.rememberedIt') }} <ULink
        to="/login"
        class="text-primary font-medium"
      >{{ $t('auth.backToLogin') }}</ULink>.
    </template>
  </UAuthForm>
</template>
