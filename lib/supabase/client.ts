/**
 * CoolCarPool — Supabase browser client.
 *
 * Use in any Client Component ("use client") for auth state, realtime
 * subscriptions (chat, feed) and user-initiated mutations. The browser client
 * stores the session in cookies so it stays in sync with the server/middleware.
 *
 * `createBrowserClient` is a singleton — calling it repeatedly reuses one instance.
 */

import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types'

/**
 * Same missing-env fallback as the server client: prerendering a Client
 * Component executes it on the server, so absent keys must not throw there.
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
  const { url, anonKey } = resolveSupabaseEnv()

  return createBrowserClient<Database>(url, anonKey)
}
