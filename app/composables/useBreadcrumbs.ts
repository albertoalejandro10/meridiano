export interface BreadcrumbCrumb {
  /** i18n key for static labels (preferred). */
  labelKey?: string
  /** Reactive label for dynamic crumbs (e.g. a record's name); used when no labelKey. */
  label?: MaybeRefOrGetter<string | undefined>
  icon?: string
  to?: string
}

/**
 * Home-rooted breadcrumb trail for dashboard pages, ready for `<UBreadcrumb>`.
 * Computed so labels re-render on locale switch (and track reactive `label`s).
 */
export function useBreadcrumbs(trail: BreadcrumbCrumb[] = []) {
  const { t } = useI18n()
  return computed(() => [
    { label: t('dashboard.title'), icon: 'i-lucide-house', to: '/app' },
    ...trail
      .map(crumb => ({
        label: crumb.labelKey ? t(crumb.labelKey) : toValue(crumb.label) ?? '',
        icon: crumb.icon,
        to: crumb.to,
      }))
      // Dynamic crumbs can be empty while the record loads (or 404s) — drop them.
      .filter(crumb => crumb.label || crumb.icon),
  ])
}
