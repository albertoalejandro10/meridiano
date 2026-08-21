<script setup lang="ts">
import {
  currencies,
  employmentTypes,
  maritalStatuses,
  riskTolerances,
  userProfileSchema,
  type EmploymentType,
  type MaritalStatus,
  type RiskTolerance,
} from '~~/shared/schemas'

type Currency = (typeof currencies)[number]

definePageMeta({ layout: 'dashboard' })

const { t } = useI18n()

useSeoMeta({ title: () => t('settings.financialProfile.title') })

const { data: profile, refresh } = useFetch('/api/v1/profile', {
  key: 'profile',
  default: () => ({
    jobTitle: null,
    income: null,
    incomeCurrency: null,
    employmentType: null,
    maritalStatus: null,
    dependents: null,
    riskTolerance: null,
    financialNotes: null,
  }),
})

const state = reactive({
  jobTitle: '',
  income: undefined as number | undefined,
  incomeCurrency: 'USD' as Currency,
  employmentType: null as EmploymentType | null,
  maritalStatus: null as MaritalStatus | null,
  dependents: undefined as number | undefined,
  riskTolerance: null as RiskTolerance | null,
  financialNotes: '',
})

watch(profile, (p) => {
  state.jobTitle = p?.jobTitle ?? ''
  state.income = p?.income ?? undefined
  state.incomeCurrency = (p?.incomeCurrency as Currency) ?? 'USD'
  state.employmentType = (p?.employmentType as EmploymentType) ?? null
  state.maritalStatus = (p?.maritalStatus as MaritalStatus) ?? null
  state.dependents = p?.dependents ?? undefined
  state.riskTolerance = (p?.riskTolerance as RiskTolerance) ?? null
  state.financialNotes = p?.financialNotes ?? ''
}, { immediate: true })

// Each optional single-select gets a "not set" option so a filled-in field
// can be cleared again — same pattern as the categoryId/longTaskId pickers.
const employmentTypeItems = computed(() => [
  { label: t('settings.account.notSet'), value: null },
  ...employmentTypes.map(v => ({ label: t(`settings.financialProfile.employmentTypes.${v}`), value: v })),
])
const maritalStatusItems = computed(() => [
  { label: t('settings.account.notSet'), value: null },
  ...maritalStatuses.map(v => ({ label: t(`settings.financialProfile.maritalStatuses.${v}`), value: v })),
])
const riskToleranceItems = computed(() => [
  { label: t('settings.account.notSet'), value: null },
  ...riskTolerances.map(v => ({ label: t(`settings.financialProfile.riskTolerances.${v}`), value: v })),
])

const toast = useToast()
const saving = ref(false)

async function onSubmit() {
  saving.value = true
  try {
    await $fetch('/api/v1/profile', {
      method: 'PATCH',
      body: {
        jobTitle: state.jobTitle.trim() || null,
        income: state.income || null,
        incomeCurrency: state.income ? state.incomeCurrency : null,
        employmentType: state.employmentType,
        maritalStatus: state.maritalStatus,
        dependents: state.dependents ?? null,
        riskTolerance: state.riskTolerance,
        financialNotes: state.financialNotes.trim() || null,
      },
    })
    await refresh()
    toast.add({ title: t('settings.financialProfile.saved'), color: 'success' })
  }
  catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string } }
    toast.add({ title: t('common.toasts.saveFailed'), description: err.data?.statusMessage, color: 'error' })
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <SettingsLayout>
    <SettingsSection :title="$t('settings.financialProfile.title')" :description="$t('settings.financialProfile.description')">
      <UForm :schema="userProfileSchema" :state="state" class="space-y-4" @submit="onSubmit">
        <UPageCard :title="$t('settings.financialProfile.jobIncome')" variant="subtle">
          <div class="space-y-4">
            <UFormField :label="$t('settings.financialProfile.jobTitle')" name="jobTitle" :hint="$t('common.optional')">
              <UInput v-model="state.jobTitle" :placeholder="$t('settings.financialProfile.jobTitlePlaceholder')" class="w-full" />
            </UFormField>

            <div class="grid grid-cols-2 gap-4">
              <UFormField :label="$t('settings.financialProfile.income')" name="income" :hint="$t('common.optional')">
                <UInput
                  v-model.number="state.income"
                  type="number"
                  step="0.01"
                  min="0"
                  :placeholder="$t('settings.financialProfile.incomePlaceholder')"
                  class="w-full"
                />
              </UFormField>
              <UFormField :label="$t('common.currency')" name="incomeCurrency">
                <USelect v-model="state.incomeCurrency" :items="[...currencies]" class="w-full" :disabled="!state.income" />
              </UFormField>
            </div>
          </div>
        </UPageCard>

        <UPageCard :title="$t('settings.financialProfile.aboutYou')" variant="subtle">
          <div class="space-y-4">
            <UFormField :label="$t('settings.financialProfile.employmentType')" name="employmentType" :hint="$t('common.optional')">
              <USelectMenu v-model="state.employmentType" :items="employmentTypeItems" value-key="value" class="w-full" />
            </UFormField>

            <div class="grid grid-cols-2 gap-4">
              <UFormField :label="$t('settings.financialProfile.maritalStatus')" name="maritalStatus" :hint="$t('common.optional')">
                <USelectMenu v-model="state.maritalStatus" :items="maritalStatusItems" value-key="value" class="w-full" />
              </UFormField>
              <UFormField :label="$t('settings.financialProfile.dependents')" name="dependents" :hint="$t('settings.financialProfile.dependentsHint')">
                <UInput v-model.number="state.dependents" type="number" step="1" min="0" class="w-full" />
              </UFormField>
            </div>

            <UFormField :label="$t('settings.financialProfile.riskTolerance')" name="riskTolerance" :hint="$t('common.optional')">
              <USelectMenu v-model="state.riskTolerance" :items="riskToleranceItems" value-key="value" class="w-full" />
            </UFormField>

            <UFormField :label="$t('settings.financialProfile.financialNotes')" name="financialNotes" :hint="$t('common.optional')">
              <UTextarea
                v-model="state.financialNotes"
                :rows="3"
                autoresize
                :maxrows="6"
                :placeholder="$t('settings.financialProfile.financialNotesPlaceholder')"
                class="w-full"
              />
            </UFormField>
          </div>
        </UPageCard>

        <p class="text-xs text-muted">
          {{ $t('settings.financialProfile.disclosure') }}
        </p>

        <div class="flex justify-end pt-2">
          <UButton type="submit" :label="$t('common.save')" :loading="saving" />
        </div>
      </UForm>
    </SettingsSection>
  </SettingsLayout>
</template>
