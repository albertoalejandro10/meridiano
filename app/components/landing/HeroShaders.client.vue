<script setup lang="ts">
import { Shader, Pixelate, Plasma, SineWave } from 'shaders/vue'

// Pixelated plasma backdrop from the Nuxt UI landing template. WebGL can't read
// CSS variables, so the landing theme's --ui-primary/--ui-bg are resolved to
// rgb() through a probe element — the shader then follows the theme picker's
// primary. The probe must live inside `.landing-theme` (which scopes the dark
// surface vars), so we resolve it against that container rather than a template
// ref on our own root: inside a `.client.vue` the root ref isn't reliably bound
// when onMounted runs, which used to throw `undefined.appendChild`.
const colorA = ref<string>()
const colorB = ref<string>()

function resolveCssColor(name: string) {
  const host = document.querySelector('.landing-theme') ?? document.body
  const probe = document.createElement('span')
  probe.style.color = `var(${name})`
  probe.style.display = 'none'
  host.appendChild(probe)
  const { color } = getComputedStyle(probe)
  probe.remove()
  return color
}

function resolveColors() {
  colorA.value = resolveCssColor('--ui-primary')
  colorB.value = resolveCssColor('--ui-bg')
}

onMounted(resolveColors)

// The landing header hosts the theme picker, so primary/mode can change while
// the shader is on screen — re-resolve after the new CSS variables are applied.
const colorMode = useColorMode()
const { primary, neutral, blackAsPrimary } = useTheme()

watch([() => colorMode.value, primary, neutral, blackAsPrimary], async () => {
  await nextTick()
  resolveColors()
})
</script>

<template>
  <div>
    <Shader class="block size-full">
      <Pixelate
        :gap="{
          type: 'map',
          curve: 0.35,
          source: 'idmmbhthud5inxgebqc',
          channel: 'alphaInverted',
          inputMax: 1,
          inputMin: 0,
          outputMax: 1,
          outputMin: 0.16
        }"
        :roundness="0.2"
        :scale="68"
        :transform="{ rotation: 180 }"
      >
        <Plasma
          v-if="colorA && colorB"
          :balance="57"
          :color-a="colorA"
          :color-b="colorB"
          :contrast="1.6"
          :density="3.3"
          :intensity="1.8"
          :visible="true"
        />
      </Pixelate>
      <SineWave
        id="idmmbhthud5inxgebqc"
        :amplitude="0.1"
        :position="{
          x: 0.5,
          y: 1
        }"
        :softness="0.8"
        :thickness="0.7"
        :visible="false"
      />
    </Shader>
  </div>
</template>
