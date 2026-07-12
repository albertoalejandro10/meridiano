<script setup lang="ts">
import { motion } from 'motion-v'
import type { VariantType } from 'motion-v'

const { loggedIn } = useUserSession()
const { t } = useI18n()
const activeSection = ref<string>()

const items = computed(() => [
  {
    label: t('landing.nav.features'),
    to: '#features',
    exactHash: true,
    active: activeSection.value === 'features'
  },
  {
    label: t('landing.nav.metrics'),
    to: '#metrics',
    exactHash: true,
    active: activeSection.value === 'metrics'
  }
])

// Observe the page sections from mount to unmount — a lingering observer would
// outlive the landing page (leak), and a one-shot hook would never re-arm when
// the user navigates back here.
let observer: IntersectionObserver | undefined

onMounted(() => {
  observer = new IntersectionObserver((entries) => {
    const visible = entries.find(e => e.isIntersecting)
    if (visible) {
      activeSection.value = visible.target.id
    } else if (entries.every(e => !e.isIntersecting)) {
      activeSection.value = undefined
    }
  }, { rootMargin: '-50% 0px -50% 0px' })

  document.querySelectorAll('#features, #metrics').forEach(el => observer!.observe(el))
})

onUnmounted(() => {
  observer?.disconnect()
  observer = undefined
})

const variants: Record<string, VariantType | ((custom: unknown) => VariantType)> = {
  normal: {
    rotate: 0,
    y: 0,
    opacity: 1
  },
  close: (custom: unknown) => {
    const c = custom as number
    return {
      rotate: c === 1 ? 45 : c === 3 ? -45 : 0,
      y: c === 1 ? 6 : c === 3 ? -6 : 0,
      opacity: c === 2 ? 0 : 1,
      transition: {
        type: 'spring',
        stiffness: 260,
        damping: 20
      }
    }
  }
}
</script>

<template>
  <UHeader>
    <template #left>
      <NuxtLink to="/" class="flex items-center">
        <Logo class="text-xl" />
      </NuxtLink>
    </template>

    <UNavigationMenu
      :items="items"
      variant="link"
    />

    <template #right>
      <template v-if="loggedIn">
        <UButton
          :label="$t('nav.dashboard')"
          icon="i-lucide-layout-dashboard"
          color="neutral"
          to="/app"
          class="hidden lg:flex"
        />
      </template>
      <template v-else>
        <UButton
          :label="$t('auth.signIn')"
          color="neutral"
          variant="ghost"
          to="/login"
          class="hidden lg:flex"
        />
        <UButton
          :label="$t('landing.getStarted')"
          color="neutral"
          to="/signup"
          class="hidden lg:flex"
        />
      </template>
    </template>

    <template #toggle="{ open, toggle, ui }">
      <UButton
        size="sm"
        variant="ghost"
        color="neutral"
        square
        :aria-label="open ? $t('landing.nav.close') : $t('landing.nav.open')"
        :aria-expanded="open"
        :class="ui.toggle({ toggleSide: 'right' })"
        @click="toggle"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="size-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <motion.line
            x1="4"
            y1="6"
            x2="20"
            y2="6"
            :variants="variants"
            :animate="open ? 'close' : 'normal'"
            :custom="1"
            class="outline-none"
          />
          <motion.line
            x1="4"
            y1="12"
            x2="20"
            y2="12"
            :variants="variants"
            :animate="open ? 'close' : 'normal'"
            :custom="2"
            class="outline-none"
          />
          <motion.line
            x1="4"
            y1="18"
            x2="20"
            y2="18"
            :variants="variants"
            :animate="open ? 'close' : 'normal'"
            :custom="3"
            class="outline-none"
          />
        </svg>
      </UButton>
    </template>

    <template #body>
      <UNavigationMenu
        :items="items"
        orientation="vertical"
      />

      <div class="mt-4 flex flex-col gap-2">
        <UButton
          v-if="loggedIn"
          :label="$t('nav.dashboard')"
          icon="i-lucide-layout-dashboard"
          to="/app"
          block
        />
        <template v-else>
          <UButton
            :label="$t('auth.signIn')"
            color="neutral"
            variant="soft"
            to="/login"
            block
          />
          <UButton
            :label="$t('landing.getStarted')"
            to="/signup"
            block
          />
        </template>
      </div>
    </template>
  </UHeader>
</template>
