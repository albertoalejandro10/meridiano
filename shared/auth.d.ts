// Shape of the nuxt-auth-utils session user (sealed-cookie session).
declare module '#auth-utils' {
  interface User {
    id: string
    email: string
    name: string | null
  }
}

export {}
