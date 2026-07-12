<script setup lang="ts">
const colorMode = useColorMode()

const open = ref(false)

const {
  neutralColors,
  neutral,
  primaryColors,
  primary,
  blackAsPrimary,
  setBlackAsPrimary,
  radiuses,
  radius,
  modes,
  mode,
  resetTheme,
} = useTheme()
</script>

<template>
  <UPopover
    v-model:open="open"
    :ui="{ content: 'w-72 px-6 py-4 flex flex-col gap-4 overflow-y-auto max-h-[calc(100vh-5rem)]' }"
  >
    <UButton
      icon="i-lucide-swatch-book"
      color="neutral"
      :variant="open ? 'soft' : 'ghost'"
      square
      :aria-label="$t('theme.pickerLabel')"
      :ui="{ leadingIcon: 'text-primary' }"
    />

    <template #content>
      <fieldset>
        <legend class="text-[11px] leading-none font-semibold mb-2 select-none">
          {{ $t('theme.primary') }}
        </legend>

        <div class="grid grid-cols-3 gap-1 -mx-2">
          <ThemePickerButton
            :label="$t('theme.black')"
            :selected="blackAsPrimary"
            @click="setBlackAsPrimary(true)"
          >
            <template #leading>
              <span class="inline-block size-2 rounded-full bg-black dark:bg-white" />
            </template>
          </ThemePickerButton>

          <ThemePickerButton
            v-for="color in primaryColors"
            :key="color"
            :label="color"
            :chip="color"
            :selected="!blackAsPrimary && primary === color"
            @click="primary = color"
          />
        </div>
      </fieldset>

      <fieldset>
        <legend class="text-[11px] leading-none font-semibold mb-2 select-none">
          {{ $t('theme.neutral') }}
        </legend>

        <div class="grid grid-cols-3 gap-1 -mx-2">
          <ThemePickerButton
            v-for="color in neutralColors"
            :key="color"
            :label="color"
            :chip="color === 'neutral' ? 'old-neutral' : color"
            :selected="neutral === color"
            @click="neutral = color"
          />
        </div>
      </fieldset>

      <fieldset>
        <legend class="text-[11px] leading-none font-semibold mb-2 select-none">
          {{ $t('theme.radius') }}
        </legend>

        <div class="grid grid-cols-5 gap-1 -mx-2">
          <ThemePickerButton
            v-for="r in radiuses"
            :key="r"
            :label="String(r)"
            class="justify-center px-0"
            :selected="radius === r"
            @click="radius = r"
          />
        </div>
      </fieldset>

      <fieldset>
        <legend class="text-[11px] leading-none font-semibold mb-2 select-none">
          {{ $t('theme.colorMode') }}
        </legend>

        <div class="grid grid-cols-3 gap-1 -mx-2">
          <!-- m.label is the color-mode *value* (light/dark/system) — only the display text is translated -->
          <ThemePickerButton
            v-for="m in modes"
            :key="m.label"
            :label="$t(`theme.mode.${m.label}`)"
            :icon="m.icon"
            :selected="colorMode.preference === m.label"
            @click="mode = m.label"
          />
        </div>
      </fieldset>

      <fieldset>
        <legend class="text-[11px] leading-none font-semibold mb-2 select-none">
          {{ $t('theme.reset') }}
        </legend>

        <div class="-mx-2">
          <UButton
            color="neutral"
            variant="outline"
            size="sm"
            icon="i-lucide-rotate-ccw"
            :label="$t('theme.resetTheme')"
            class="w-full justify-center ring-default rounded-sm text-[11px] hover:bg-elevated/50"
            @click="resetTheme"
          />
        </div>
      </fieldset>
    </template>
  </UPopover>
</template>
