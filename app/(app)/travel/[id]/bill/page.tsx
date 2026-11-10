import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { BillClient } from './BillClient'
import { getMockTravelById, getMockMembers, getMockBillSlip } from '@/lib/mock-data'
import type { Travel, BillSlip } from '@/types'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const resolvedParams = await params
  const travel = await getTravelById(resolvedParams.id)
  if (!travel) return { title: 'Bill Not Found' }
  return {
    title: `Bill · ${travel.origin_text} → ${travel.destination_text}`,
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

async function getBillSlip(travelId: string): Promise<BillSlip | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('bill_slips')
    .select('*')
    .eq('travel_id', travelId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (error || !data) {
    // Return mock if it's the demo travel
    const mockTravel = getMockTravelById(travelId)
    if (mockTravel?.id === 'TRAVEL_A') {
      return getMockBillSlip()
    }
    return null
  }

  return data as BillSlip
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

export default async function TravelBillPage({ params }: PageProps) {
  const { id } = await params
  const [travel, billSlip, members] = await Promise.all([
    getTravelById(id),
    getBillSlip(id),
    getMembersWithProfiles(id),
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
    <BillClient
      travel={travel}
      billSlip={billSlip}
      members={members}
      currentUserId={user?.id ?? null}
      isHost={isHost}
      isMember={isMember}
    />
  )
}