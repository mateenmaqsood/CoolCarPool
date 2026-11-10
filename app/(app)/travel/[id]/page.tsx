import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TravelDetailClient } from './TravelDetailClient'
import { getMockTravelById, getMockMembers, getMockWaypoints } from '@/lib/mock-data'
import type { Travel, Profile } from '@/types'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const resolvedParams = await params
  const travel = await getTravelById(resolvedParams.id)
  if (!travel) return { title: 'Travel Not Found' }
  return {
    title: `${travel.origin_text} → ${travel.destination_text}`,
    description: `${travel.description ?? 'CoolCarPool ride'} · ${Math.round(travel.total_km)} km`,
  }
}

async function getTravelById(id: string): Promise<(Travel & { host?: Profile | null }) | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('travels')
    .select('*, host:profiles!travels_host_id_fkey(*)')
    .eq('id', id)
    .single()

  if (error || !data) {
    // Try mock data (FeedTravel is a demo-shaped Travel; cast for the detail view)
    const mock = getMockTravelById(id)
    return mock ? (mock as unknown as Travel & { host?: Profile | null }) : null
  }

  return data as Travel & { host?: Profile | null }
}

async function getMembers(travelId: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('travel_members')
    .select('*, profile:profiles(*)')
    .eq('travel_id', travelId)
    .order('is_host', { ascending: false })
    .order('joined_at', { ascending: true })

  if (error || !data || data.length === 0) {
    return getMockMembers(travelId)
  }

  return data
}

async function getWaypoints(travelId: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('waypoints')
    .select('*')
    .eq('travel_id', travelId)
    .order('sort_order', { ascending: true })

  if (error || !data || data.length === 0) {
    return getMockWaypoints(travelId)
  }

  return data
}

async function getPendingRequests(travelId: string, isHost: boolean) {
  if (!isHost) return []
  const supabase = createClient()
  const { data } = await supabase
    .from('travel_requests')
    .select('*, requester:profiles!travel_requests_requester_id_fkey(id, full_name, avatar_url, gender, city)')
    .eq('travel_id', travelId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
  return data ?? []
}

export default async function TravelDetailPage({ params }: PageProps) {
  const { id } = await params
  const [travel, members, waypoints] = await Promise.all([
    getTravelById(id),
    getMembers(id),
    getWaypoints(id),
  ])

  if (!travel) {
    notFound()
  }

  const { data: { user } } = await createClient().auth.getUser()
  const isHost = user != null && travel.host_id === user.id
  const isMember = user != null && members.some((m) => m.user_id === user.id)
  const pendingRequests = await getPendingRequests(id, isHost)

  return (
    <TravelDetailClient
      travel={travel}
      members={members}
      waypoints={waypoints}
      currentUserId={user?.id ?? null}
      isHost={isHost}
      isMember={isMember}
      pendingRequests={pendingRequests}
    />
  )
}