import colors from 'tailwindcss/colors'

// Applies the persisted theme (see app/composables/useTheme.ts) globally and during
// SSR, so a saved choice is reflected on first paint with no flash.
//
//  - primary/neutral are mirrored onto the reactive Nuxt UI `appConfig.ui.colors`,
//    which Nuxt UI's color runtime watches to regenerate the palette variables.
//  - radius and the optional black-as-primary override are CSS-variable overrides
//    injected as a <style> tag. Doubling `:root` raises specificity above Nuxt UI's
//    own `--ui-*` variables and the base value in main.css, so head order is irrelevant.
//  - the favicon is rebuilt as a data-URI copy of the brand mark (app/utils/brand.ts)
//    tinted with the resolved primary color, because a browser-tab icon is rendered in
//    isolation and can't read the page's CSS variables. Tailwind's color values are the
//    exact ones the theme uses.
const palettes = colors as unknown as Record<string, Record<string, string>>

export default defineNuxtPlugin(() => {
  const appConfig = useAppConfig()
  const colorMode = useColorMode()
  const { primary, neutral, radius, blackAsPrimary } = useTheme()

  watch(primary, value => { appConfig.ui.colors.primary = value }, { immediate: true })
  watch(neutral, value => { appConfig.ui.colors.neutral = value }, { immediate: true })

  const css = computed(() => {
    let out = `:root:root{--ui-radius:${radius.value}rem}`
    if (blackAsPrimary.value) {
      out += ':root:root{--ui-primary:#000}:root:root.dark{--ui-primary:#fff}'
    }
    return out
  })

  // Effective primary color: shade 500 in light mode, 400 in dark (matching `--ui-primary`).
  const faviconFill = computed(() => {
    if (blackAsPrimary.value) return colorMode.value === 'dark' ? '#fff' : '#000'
    const shade = colorMode.value === 'dark' ? '400' : '500'
    return palettes[primary.value]?.[shade] ?? palettes.sky?.[shade] ?? '#0ea5e9'
  })

  const faviconHref = computed(() => {
    const paths = BRAND_MARK_PATHS
      .map(d => `<path d="${d}" fill="${faviconFill.value}"/>`)
      .join('')
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${BRAND_MARK_VIEWBOX}">${paths}</svg>`
    return `data:image/svg+xml,${encodeURIComponent(svg)}`
  })

  useHead({
    style: [{ innerHTML: css, id: 'meridiano-theme-vars' }],
    link: [{ key: 'favicon', rel: 'icon', type: 'image/svg+xml', href: faviconHref }],
  })
})
