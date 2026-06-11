// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: ['@nuxt/ui', '@nuxtjs/supabase'],
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  css: ['~/assets/css/main.css'],
  supabase: {
    types: false,
    redirectOptions: {
      login: '/login',
      callback: '/confirm',
      include: ['/app(/*)?'],
    },
  },
})
