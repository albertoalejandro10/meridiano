<script setup lang="ts">
definePageMeta({ layout: 'dashboard' })

const { t } = useI18n()
const { categoryLabel, sortCategories } = useCategoryLabel()

useSeoMeta({ title: () => t('settings.categories.title') })

// Shares the 'categories' useFetch key with every picker in the app, so a
// restore lands in an already-open transaction modal too.
const { data: categories, refresh } = useCategories()

const groups = computed(() => {
  const all = categories.value ?? []
  const groupFor = (type: string | null) => sortCategories(all.filter(c => (c.type ?? null) === type))
  return [
    { key: 'INCOME', labelKey: 'transactions.income', items: groupFor('INCOME') },
    { key: 'EXPENSE', labelKey: 'transactions.expense', items: groupFor('EXPENSE') },
    // Untyped categories fit either side, so they get no header of their own.
    { key: 'ANY', labelKey: null, items: groupFor(null) },
  ].filter(g => g.items.length)
})

const toast = useToast()
const restoring = ref(false)

async function restore() {
  restoring.value = true
  try {
    const { added } = await $fetch('/api/v1/categories/restore-defaults', { method: 'POST' })
    // Categories are leaf data here — nothing derived depends on them, so refresh
    // this key rather than every loaded list.
    await refresh()
    toast.add({
      title: added > 0
        ? t('settings.categories.restored', { count: added }, added)
        : t('settings.categories.upToDate'),
      color: 'success',
      icon: 'i-lucide-check',
    })
  }
  catch (err) {
    const e = err as { data?: { statusMessage?: string } }
    toast.add({ title: t('common.toasts.saveFailed'), description: e.data?.statusMessage, color: 'error' })
  }
  finally {
    restoring.value = false
  }
}
</script>

<template>
  <SettingsLayout>
    <SettingsSection :title="$t('settings.categories.title')" :description="$t('settings.categories.description')">
      <UPageCard variant="subtle">
        <div class="flex items-center justify-between gap-4">
          <div class="space-y-0.5">
            <p class="text-sm font-medium">
              {{ $t('settings.categories.restore') }}
            </p>
            <p class="text-sm text-muted">
              {{ $t('settings.categories.restoreHint') }}
            </p>
          </div>
          <UButton
            :label="$t('settings.categories.restore')"
            icon="i-lucide-rotate-ccw"
            color="neutral"
            variant="subtle"
            :loading="restoring"
            class="shrink-0"
            @click="restore"
          />
        </div>
      </UPageCard>

      <UPageCard variant="subtle">
        <div v-if="groups.length" class="space-y-5">
          <div v-for="group in groups" :key="group.key" class="space-y-1">
            <p v-if="group.labelKey" class="px-2 text-xs font-medium uppercase tracking-wide text-muted">
              {{ $t(group.labelKey) }}
            </p>
            <div
              v-for="category in group.items"
              :key="category.id"
              class="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-elevated/50"
            >
              <span class="flex size-7 items-center justify-center rounded-md bg-elevated">
                <UIcon :name="category.icon ?? 'i-lucide-shapes'" class="size-4 text-muted" />
              </span>
              <span class="min-w-0 flex-1 truncate text-sm">{{ categoryLabel(category) }}</span>
              <UBadge
                v-if="!category.slug"
                :label="$t('settings.categories.custom')"
                color="neutral"
                variant="subtle"
                size="sm"
              />
            </div>
          </div>
        </div>
        <p v-else class="py-6 text-center text-sm text-muted">
          {{ $t('settings.categories.empty') }}
        </p>
      </UPageCard>

      <SettingsPlaceholder
        icon="i-lucide-shapes"
        :title="$t('settings.categories.placeholderTitle')"
        :description="$t('settings.categories.placeholderDescription')"
      />
    </SettingsSection>
  </SettingsLayout>
</template>
