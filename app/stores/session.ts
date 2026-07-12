export const useSessionStore = defineStore('session', () => {
  const { user, loggedIn } = useUserSession()

  const isAuthenticated = computed(() => loggedIn.value)

  const fullName = computed(() =>
    user.value?.name
    || user.value?.email?.split('@')[0]
    || 'Beto',
  )

  const firstName = computed(() => fullName.value.split(' ')[0]!)

  const email = computed(() => user.value?.email ?? null)

  return { user, isAuthenticated, fullName, firstName, email }
})
