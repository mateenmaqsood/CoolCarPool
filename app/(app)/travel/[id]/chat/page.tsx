import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ChatClient } from '../ChatClient'
import { getMockTravelById, getMockMembers, getMockMessages } from '@/lib/mock-data'
import type { Travel } from '@/types'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const resolvedParams = await params
  const travel = await getTravelById(resolvedParams.id)
  if (!travel) return { title: 'Chat Not Found' }
  return {
    title: `Chat · ${travel.origin_text} → ${travel.destination_text}`,
  }
}

async function getTravelById(id: string): Promise<Travel | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('travels')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !data) {
    return getMockTravelById(id) ?? null
  }

  return data
}

async function getMembersWithProfiles(travelId: string) {
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

async function getMessages(travelId: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('messages')
    .select('*, sender:profiles!messages_sender_id_fkey(*)')
    .eq('travel_id', travelId)
    .order('created_at', { ascending: true })
    .limit(100)

  if (error || !data) {
    return getMockMessages(travelId)
  }

  return data
}

export default async function TravelChatPage({ params }: PageProps) {
  const { id } = await params
  const [travel, members, messages] = await Promise.all([
    getTravelById(id),
    getMembersWithProfiles(id),
    getMessages(id),
  ])

  if (!travel) {
    notFound()
  }

  const { data: { user } } = await createClient().auth.getUser()
  const isMember = user != null && members.some((m) => m.user_id === user.id)
  const isHost = user != null && travel.host_id === user.id

  if (!isMember && !isHost) {
    notFound()
  }

  return (
    <ChatClient
      travel={travel}
      members={members}
      messages={messages}
      currentUserId={user?.id ?? null}
      isHost={isHost}
    />
  )
}