// How a category turns into a user-facing label. Seeded categories carry a
// stable `slug` (server/utils/defaultCategories.ts) and are translated through
// `categories.defaults.<slug>`; categories the user created have a NULL slug and
// render their own `name`. Prose never lives here — only the key.
//
// `t` is a parameter rather than a `useI18n()` call so stores can pass
// `useNuxtApp().$i18n.t` at event time. In components, prefer the pre-bound
// `useCategoryLabel()` composable.
export interface CategoryLabelSource {
  slug?: string | null
  name?: string | null
}

type Translate = (key: string) => string

export function categoryLabelKey(slug: string): string {
  return `categories.defaults.${slug}`
}

export function categoryLabel(category: CategoryLabelSource | null | undefined, t: Translate): string {
  if (!category) return ''
  if (category.slug) return t(categoryLabelKey(category.slug))
  return category.name ?? ''
}

// Pickers get their order here, not from the API: /api/v1/categories sorts by
// the English `name`, which reads as scrambled once the labels are translated.
export function sortCategories<T extends CategoryLabelSource>(list: T[], t: Translate, locale?: string): T[] {
  const collator = new Intl.Collator(locale, { sensitivity: 'base' })
  return [...list].sort((a, b) => collator.compare(categoryLabel(a, t), categoryLabel(b, t)))
}

export interface PickerCategory extends CategoryLabelSource {
  id: string
  icon?: string | null
  type?: string | null
}

// One USelectMenu item. `value` stays optional so option rows and the
// `type: 'label'` headers share a single type — a union would narrow the
// component's `value-key` to the keys they have in common ('label').
export interface CategoryPickerItem {
  label: string
  value?: string
  icon?: string
  type?: 'label'
}

/**
 * Income/Expense-headed groups for the two pickers that offer *both* types (the
 * transactions filter and the rule modal) — the rest already narrow by type.
 * Returns USelectMenu's array-of-arrays form, where each inner array is one
 * ComboboxGroup: a flat list with inline `type: 'label'` items would collapse
 * both headers to the top while the user types, because filtering scores
 * structural items above every match.
 *
 * Empty groups are omitted rather than emitted empty — with no search term
 * Nuxt UI passes the groups straight through and an empty one renders as
 * stray padding.
 */
export function groupCategoryItems(list: PickerCategory[], t: Translate, locale?: string): CategoryPickerItem[][] {
  const optionsFor = (type: string | null): CategoryPickerItem[] =>
    sortCategories(list.filter(c => (c.type ?? null) === type), t, locale)
      .map(c => ({ label: categoryLabel(c, t), value: c.id, icon: c.icon ?? undefined }))

  const income = optionsFor('INCOME')
  const expense = optionsFor('EXPENSE')
  // Untyped categories fit either side, so they get no header of their own.
  const untyped = optionsFor(null)

  return [
    ...(income.length ? [[{ label: t('transactions.income'), type: 'label' as const }, ...income]] : []),
    ...(expense.length ? [[{ label: t('transactions.expense'), type: 'label' as const }, ...expense]] : []),
    ...(untyped.length ? [untyped] : []),
  ]
}
