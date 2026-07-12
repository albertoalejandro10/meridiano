// Runtime theme controls (primary/neutral palette, border radius, color mode) —
// mirrors the theme picker on ui.nuxt.com. State is shared via `useState` and
// persisted in cookies so a choice survives reloads and is applied during SSR
// (no flash of the default theme).
//
// This composable only owns state + persistence. The effects are applied once,
// globally, by `app/plugins/theme.ts`, which reads the same shared state:
//   - primary/neutral are mirrored onto the reactive `appConfig.ui.colors`, which
//     Nuxt UI watches to regenerate the palette CSS variables.
//   - radius and the optional black-as-primary override are injected as a <style>.

// Selectable primary palettes — Tailwind's standard colors (minus the neutrals).
export const primaryColors = [
  'red', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald', 'teal',
  'cyan', 'sky', 'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose',
] as const

// Selectable neutral palettes — Tailwind 4.2+ ships taupe/mauve/mist/olive
// alongside the classic grays.
export const neutralColors = [
  'slate', 'gray', 'zinc', 'neutral', 'stone', 'taupe', 'mauve', 'mist', 'olive',
] as const

export const radiuses = [0, 0.125, 0.25, 0.375, 0.5] as const

export const modes = [
  { label: 'light', icon: 'i-lucide-sun' },
  { label: 'dark', icon: 'i-lucide-moon' },
  { label: 'system', icon: 'i-lucide-monitor' },
] as const

// Defaults must mirror app/app.config.ts (colors) and app/assets/css/main.css (radius).
const DEFAULT_PRIMARY = 'sky'
const DEFAULT_NEUTRAL = 'mist'
const DEFAULT_RADIUS = 0

const cookieOpts = { sameSite: 'lax', maxAge: 60 * 60 * 24 * 365 } as const

export function useTheme() {
  const colorMode = useColorMode()

  // Cookies persist the choice and seed the initial (SSR) value; `useState` keeps
  // every caller — including the theme plugin — reactively in sync.
  const primaryCookie = useCookie<string>('theme-primary', cookieOpts)
  const neutralCookie = useCookie<string>('theme-neutral', cookieOpts)
  const radiusCookie = useCookie<string>('theme-radius', cookieOpts)
  const blackCookie = useCookie<string>('theme-black', cookieOpts)

  const primaryState = useState('theme:primary', () => primaryCookie.value || DEFAULT_PRIMARY)
  const neutralState = useState('theme:neutral', () => neutralCookie.value || DEFAULT_NEUTRAL)
  const radiusState = useState('theme:radius', () => (radiusCookie.value != null ? Number(radiusCookie.value) : DEFAULT_RADIUS))
  const blackState = useState('theme:black', () => blackCookie.value === 'true')

  const primary = computed({
    get: () => primaryState.value,
    set: (value) => {
      // Picking a palette color clears the black-as-primary override.
      blackState.value = false
      blackCookie.value = 'false'
      primaryState.value = value
      primaryCookie.value = value
    },
  })

  const neutral = computed({
    get: () => neutralState.value,
    set: (value) => {
      neutralState.value = value
      neutralCookie.value = value
    },
  })

  const radius = computed({
    get: () => radiusState.value,
    set: (value) => {
      radiusState.value = value
      radiusCookie.value = String(value)
    },
  })

  const blackAsPrimary = computed(() => blackState.value)
  function setBlackAsPrimary(value: boolean) {
    blackState.value = value
    blackCookie.value = String(value)
  }

  const mode = computed({
    get: () => colorMode.preference,
    set: (value: string) => {
      colorMode.preference = value
    },
  })

  function resetTheme() {
    primary.value = DEFAULT_PRIMARY // also clears black-as-primary
    neutral.value = DEFAULT_NEUTRAL
    radius.value = DEFAULT_RADIUS
    mode.value = 'system'
  }

  return {
    primaryColors,
    primary,
    neutralColors,
    neutral,
    blackAsPrimary,
    setBlackAsPrimary,
    radiuses,
    radius,
    modes,
    mode,
    resetTheme,
  }
}
