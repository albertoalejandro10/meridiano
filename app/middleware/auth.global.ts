export default defineNuxtRouteMiddleware((to) => {
  if (!to.path.startsWith('/app')) return

  const { loggedIn } = useUserSession()
  if (loggedIn.value) return

  return navigateTo('/login')
})
