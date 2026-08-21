import type { BackupImportResult } from '~~/server/utils/backup'

// Settings → Import & Export: full account backup (export a JSON snapshot,
// import it back in later). No existing precedent in the app for either browser
// file download or file upload — see server/utils/backup.ts for the data model.
export function useBackup() {
  const { t } = useI18n()
  const toast = useToast()
  const { confirm } = useConfirm()

  const exporting = ref(false)
  const importing = ref(false)

  async function exportData() {
    exporting.value = true
    try {
      const data = await $fetch('/api/v1/backup/export')
      // Not pretty-printed: a backup can carry tens of thousands of rows, and
      // indentation roughly doubles the file for something no one reads by hand.
      const blob = new Blob([JSON.stringify(data)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `meridiano-backup-${new Date().toISOString().slice(0, 10)}.json`
      // Appended before clicking (Firefox ignores clicks on detached links) and
      // the URL revoked on the next tick — revoking synchronously after click()
      // can cancel the download that click just started.
      document.body.appendChild(link)
      link.click()
      link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 0)
    }
    catch (err) {
      const e = err as { data?: { statusMessage?: string } }
      toast.add({ title: t('settings.imports.export.failed'), description: e.data?.statusMessage, color: 'error' })
    }
    finally {
      exporting.value = false
    }
  }

  // Resolves with the server's per-entity counts so the page can show what
  // actually landed, or null if the import didn't happen.
  async function importData(file: File): Promise<BackupImportResult | null> {
    const confirmed = await confirm({
      title: t('settings.imports.import.confirmTitle'),
      message: t('settings.imports.import.confirmMessage'),
      // Additive, not destructive — the default red confirm would contradict
      // the message's "nothing is deleted or changed".
      confirmColor: 'primary',
    })
    if (!confirmed) return null

    importing.value = true
    try {
      const parsed = JSON.parse(await file.text())
      const result = await $fetch('/api/v1/backup/import', { method: 'POST', body: parsed })
      // A restore can touch nearly every loaded list (accounts, transactions,
      // goals, budgets, recurring, rules, tasks, shopping lists...).
      await refreshNuxtData()
      toast.add({ title: t('settings.imports.import.success'), color: 'success', icon: 'i-lucide-check' })
      return result
    }
    catch (err) {
      toast.add({ title: t('settings.imports.import.failed'), description: importErrorMessage(err), color: 'error' })
      return null
    }
    finally {
      importing.value = false
    }
  }

  // Map by status rather than surfacing statusMessage blindly: the likeliest
  // failure (a JSON file that isn't a backup) fails Zod validation, and h3
  // renders that as the bare untranslated string "Validation Error".
  function importErrorMessage(err: unknown): string | undefined {
    if (err instanceof SyntaxError) return t('settings.imports.import.invalidFile')
    const e = err as { statusCode?: number, data?: { statusMessage?: string } }
    if (e.statusCode === 400) return t('settings.imports.import.invalidFile')
    if (e.statusCode === 409) return t('settings.imports.import.conflict')
    return e.data?.statusMessage
  }

  return { exporting, importing, exportData, importData }
}
