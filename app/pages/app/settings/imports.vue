<script setup lang="ts">
import type { BackupImportResult } from '~~/server/utils/backup'

definePageMeta({ layout: 'dashboard' })

const { t } = useI18n()
useSeoMeta({ title: () => t('settings.imports.title') })

const { exporting, importing, exportData, importData } = useBackup()

const importFile = ref<File | null>(null)
const lastResult = ref<BackupImportResult | null>(null)

async function runImport() {
  if (!importFile.value) return
  const result = await importData(importFile.value)
  if (result) {
    lastResult.value = result
    importFile.value = null
  }
}

// The server counts every entity it touched; a toast can't carry that, so the
// summary lists what actually landed. Zero-count rows are dropped — a backup
// with no shopping lists shouldn't report "0 shopping lists".
//
// Categories and task categories report added/matched separately: the import
// merges them against the user's existing set (see mergeCategories in
// server/utils/backup.ts), so "matched" is the interesting number on a
// re-import, not a failure.
const resultRows = computed(() => {
  const r = lastResult.value
  if (!r) return []
  const entries: { key: string, count: number }[] = [
    { key: 'accounts', count: r.accounts },
    { key: 'transactions', count: r.transactions },
    { key: 'categoriesAdded', count: r.categoriesAdded },
    { key: 'categoriesMatched', count: r.categoriesMatched },
    { key: 'goals', count: r.goals },
    { key: 'goalAccounts', count: r.goalAccounts },
    { key: 'budgets', count: r.budgets },
    { key: 'budgetIncomes', count: r.budgetIncomes },
    { key: 'recurringTransactions', count: r.recurringTransactions },
    { key: 'recurringOccurrences', count: r.recurringOccurrences },
    { key: 'transactionRules', count: r.transactionRules },
    { key: 'accountReconciliations', count: r.accountReconciliations },
    { key: 'shoppingLists', count: r.shoppingLists },
    { key: 'shoppingListItems', count: r.shoppingListItems },
    { key: 'taskCategoriesAdded', count: r.taskCategoriesAdded },
    { key: 'taskCategoriesMatched', count: r.taskCategoriesMatched },
    { key: 'longTasks', count: r.longTasks },
    { key: 'tasks', count: r.tasks },
    { key: 'notes', count: r.notes },
  ]
  return entries
    .filter(e => e.count > 0)
    .map(e => ({ ...e, label: t(`settings.imports.import.result.${e.key}`) }))
})
</script>

<template>
  <SettingsLayout>
    <SettingsSection :title="$t('settings.imports.title')" :description="$t('settings.imports.description')">
      <UPageCard
        :title="$t('settings.imports.export.title')"
        :description="$t('settings.imports.export.description')"
        variant="subtle"
      >
        <template #footer>
          <UButton
            :label="$t('settings.imports.export.button')"
            icon="i-lucide-download"
            color="neutral"
            variant="subtle"
            :loading="exporting"
            @click="exportData"
          />
        </template>
      </UPageCard>

      <UPageCard
        :title="$t('settings.imports.import.title')"
        :description="$t('settings.imports.import.description')"
        variant="subtle"
      >
        <div class="space-y-3">
          <UFileUpload
            v-model="importFile"
            accept="application/json,.json"
            :label="$t('settings.imports.import.dropLabel')"
            :description="$t('settings.imports.import.fileHint')"
            icon="i-lucide-upload"
          />
          <UButton
            v-if="importFile"
            :label="$t('settings.imports.import.button')"
            icon="i-lucide-upload"
            color="neutral"
            variant="subtle"
            :loading="importing"
            @click="runImport"
          />
        </div>
      </UPageCard>

      <!-- aria-live so the outcome is announced, not just flashed in a toast. -->
      <div aria-live="polite">
        <UPageCard
          v-if="lastResult"
          :title="$t('settings.imports.import.result.title')"
          :description="$t('settings.imports.import.result.description')"
          variant="subtle"
        >
          <dl v-if="resultRows.length" class="divide-y divide-default">
            <div
              v-for="row in resultRows"
              :key="row.key"
              class="flex items-center justify-between gap-4 py-2"
            >
              <dt class="text-sm text-muted">
                {{ row.label }}
              </dt>
              <dd class="text-sm font-semibold tabular-nums">
                {{ row.count }}
              </dd>
            </div>
          </dl>
          <p v-else class="text-sm text-muted">
            {{ $t('settings.imports.import.result.empty') }}
          </p>
        </UPageCard>
      </div>
    </SettingsSection>
  </SettingsLayout>
</template>
