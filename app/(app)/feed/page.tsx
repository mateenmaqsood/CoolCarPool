import { createClient } from '@/lib/supabase/server'
import { TravelFeed } from '@/components/travel/TravelFeed'
import { getMockFeed, type FeedTravel } from '@/lib/mock-data'
import type { Gender } from '@/types'

export const revalidate = 60
export const metadata = { title: 'Ride Feed' }

/**
 * Ride feed (RSC).
 *
 * Primary: Supabase query on `travels` — the gender RLS policy automatically
 * scopes rows to the viewer (boys_only / girls_only / any).
 * Fallback: seed-quality MOCK_TRAVELS filtered by the viewer's gender,
 * per the guardrails table in CLAUDE.md.
 */
export default async function FeedPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let travels: FeedTravel[] = []
  let fallback = false
  let userName: string | null = null
  let userAvatarUrl: string | null = null

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('gender, full_name, avatar_url')
      .eq('id', user.id)
      .single()

    userName = (profile?.full_name as string | null) ?? null
    userAvatarUrl = (profile?.avatar_url as string | null) ?? null

    const { data: rows, error } = await supabase
      .from('travels')
      .select('*, host:profiles!travels_host_id_fkey ( id, full_name, avatar_url )')
      .eq('status', 'open')
      .gt('available_seats', 0)
      .order('departure_at', { ascending: true })
      .limit(50)

    if (!error && rows && rows.length > 0) {
      travels = rows as unknown as FeedTravel[]
    } else {
      fallback = true
      const gender = (profile?.gender as Gender | null) ?? null
      travels = getMockFeed(gender)
    }
  } else {
    // Middleware should prevent this, but keep the feed alive regardless.
    fallback = true
    travels = getMockFeed(null)
  }

  return (
    <TravelFeed
      initialTravels={travels}
      fallback={fallback}
      currentUserId={user?.id ?? null}
      userName={userName}
      userAvatarUrl={userAvatarUrl}
    />
  )
}
