// Shape of the nuxt-auth-utils session user (sealed-cookie session).
declare module '#auth-utils' {
  interface User {
    id: string
    email: string
    name: string | null
  }
}

// server/middleware/auth.ts resolves the session and sets `userId` for every
// /api/v1 request (401 otherwise), so handlers under it can read it directly.
// Non-/api/v1 routes never reach a handler that uses it.
declare module 'h3' {
  interface H3EventContext {
    userId: string
  }
}

export {}
