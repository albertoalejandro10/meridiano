import { backupImportSchema } from '~~/shared/schemas'

// Restores a backup produced by export.get.ts. Merge-only — it never deletes
// or overwrites, so re-importing the same file is close to a no-op (categories
// match by slug/name, budgets skip on conflict). Returns per-entity counts,
// which the settings page renders as a summary.
//
// A wrong-shape file fails in readValidatedBody, which h3 surfaces as a 400
// whose statusMessage is the bare untranslated "Validation Error" — the client
// maps any 400 here to its own localized "not a valid backup file" copy rather
// than showing that.
export default defineEventHandler(async (event) => {
  const userId = event.context.userId
  const body = await readValidatedBody(event, backupImportSchema.parse)

  return await importUserData(userId, body)
})
