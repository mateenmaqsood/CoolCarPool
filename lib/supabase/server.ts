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

/**
 * Resolve the Supabase project URL + anon key.
 *
 * During build-time prerendering the env vars may be absent (e.g. a deploy
 * where keys weren't configured yet). Throwing there crashes `next build`
 * while prerendering static pages like /signup and /host. Instead we fall
 * back to placeholders: renders succeed, and any DB/auth call at runtime
 * fails into the app's mock/error guardrails.
 */
let warnedMissingEnv = false

function resolveSupabaseEnv(): { url: string; anonKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (url && anonKey) return { url, anonKey }

  if (!warnedMissingEnv) {
    warnedMissingEnv = true
    console.warn(
      '[supabase] NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY missing — ' +
        'falling back to placeholders. DB calls will fail gracefully.',
    )
  }
  return { url: 'https://placeholder.supabase.co', anonKey: 'placeholder-anon-key' }
}

export function createClient(): SupabaseClient<Database> {
  const cookieStore = cookies()
  const { url, anonKey } = resolveSupabaseEnv()

  return createServerClient<Database>(url, anonKey, {
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
