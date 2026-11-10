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

export function createClient(): SupabaseClient<Database> {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
