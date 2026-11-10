/**
 * CoolCarPool — Supabase server client.
 *
 * For use in Server Components, Server Actions and Route Handlers.
 * Reads/writes the session through Next.js' `cookies()` store so Server
 * Components always see the freshest auth state after redirects.
 *
 * The `setAll` call throws inside a Server Component render (where cookie
 * writes are not allowed) — that is safe to ignore because the middleware
 * refreshes the session before any protected page renders.
 */

import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types'

export function createClient(): SupabaseClient<Database> {
  const cookieStore = cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // Called from a Server Component — the middleware refreshes
            // sessions, so this can be safely ignored.
          }
        },
      },
    },
  )
}

type AuthUser = Awaited<ReturnType<SupabaseClient<Database>['auth']['getUser']>>['data']['user']

/**
 * Convenience wrapper for Server Components / Route Handlers that must have
 * an authenticated user. Returns both the user (or null) and the client so
 * callers don't create a second instance.
 */
export async function getAuthenticatedUser(): Promise<{
  user: AuthUser
  client: SupabaseClient<Database>
}> {
  const client = createClient()
  const { data } = await client.auth.getUser()
  return { user: data.user, client }
}
