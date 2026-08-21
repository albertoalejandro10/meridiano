import { categoryLabel, groupCategoryItems, sortCategories, type CategoryLabelSource, type PickerCategory } from '~/utils/categories'
import { NUMBER_LOCALES } from '~/composables/useLocaleFormat'

/**
 * Locale-aware drop-ins for the category helpers in `~/utils/categories`.
 * Destructure in component setup — the setup binding shadows the auto-imported
 * util, so call sites read `categoryLabel(c)` and re-render on locale switch
 * (the closures read the active locale at call time). Same pattern as
 * `useLocaleFormat()`. Pinia stores can't use this — they call the util with
 * `useNuxtApp().$i18n.t` inside the action body instead.
 */
export function useCategoryLabel() {
  const { t, locale } = useI18n()

  return {
    categoryLabel: (category: CategoryLabelSource | null | undefined) => categoryLabel(category, t),
    sortCategories: <T extends CategoryLabelSource>(list: T[]) =>
      sortCategories(list, t, NUMBER_LOCALES[locale.value]),
    groupCategoryItems: (list: PickerCategory[]) =>
      groupCategoryItems(list, t, NUMBER_LOCALES[locale.value]),
  }
}
