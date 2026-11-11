'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  CalendarDays,
  Car,
  MapPin,
  Users,
  Wallet,
  MessageCircle,
  Lock,
  Check,
  X,
  MoreHorizontal,
  Share2,
  ChevronRight,
} from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Dialog, DialogContent } from '@/components/ui/Dialog'
import { SeatMap } from '@/components/travel/SeatMap'
import dynamic from 'next/dynamic'
import { JoinRequestModal } from '@/components/travel/JoinRequestModal'
import { useToast } from '@/components/ui/Toast'

const LeafletRouteMap = dynamic(
  () => import('@/components/route/LeafletRouteMap').then(m => ({ default: m.LeafletRouteMap })),
  {
    loading: () => (
      <div className="relative" style={{ height: 384, minHeight: 320, width: '100%' }} aria-busy="true">
        <div className="h-full w-full animate-pulse rounded-3xl bg-elevated" />
      </div>
    ),
    ssr: false,
  }
)
import { createClient } from '@/lib/supabase/client'
import type { Travel, TravelMember, Waypoint, Profile } from '@/types'
import { cn, formatPKR, formatDeparture, timeUntil, initials } from '@/lib/utils'

interface TravelDetailClientProps {
  travel: Travel & { host?: Profile | null }
  members: (TravelMember & { profile?: Profile | null })[]
  waypoints: Waypoint[]
  currentUserId: string | null
  isHost: boolean
  isMember: boolean
  pendingRequests: Array<{
    id: string
    travel_id: string
    requester_id: string
    waypoint_id: string | null
    km_from_origin: number
    message: string | null
    status: string
    created_at: string
    requester?: { id: string; full_name: string; avatar_url: string | null; gender: string; city: string | null } | null
  }>
}

const TABS = ['Route', 'Seats', 'Chat'] as const
type TabValue = (typeof TABS)[number]

export function TravelDetailClient({
  travel,
  members,
  waypoints,
  currentUserId,
  isHost,
  isMember,
  pendingRequests,
}: TravelDetailClientProps) {
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClient()

  const [activeTab, setActiveTab] = useState<TabValue>('Route')
  const [showJoinModal, setShowJoinModal] = useState(false)
  const [pendingRequestId, setPendingRequestId] = useState<string | null>(null)
  const [actionType, setActionType] = useState<'accept' | 'reject' | null>(null)
  const [showLockConfirm, setShowLockConfirm] = useState(false)
  const [locking, setLocking] = useState(false)

  // BUG 11: seats must react to members joining in realtime, not just page load.
  const [availableSeats, setAvailableSeats] = useState(travel.available_seats)
  useEffect(() => setAvailableSeats(travel.available_seats), [travel.available_seats])

  useEffect(() => {
    if (!travel.id) return
    const channel = supabase
      .channel(`travel-members-${travel.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'travel_members', filter: `travel_id=eq.${travel.id}` },
        () => {
          // Optimistic decrement, then authoritative refetch from the DB.
          setAvailableSeats((s) => Math.max(0, s - 1))
          router.refresh()
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [supabase, travel.id, router])

  const isFull = availableSeats <= 0
  const isLocked = travel.status !== 'open'
  const canJoin = !isFull && !isLocked && currentUserId && !isMember && !isHost
  const isCurrentUserHost = isHost
  const host = travel.host ?? { id: travel.host_id, full_name: 'Host', avatar_url: null, gender: 'male' as const }

  // Host: use passed pending requests (from travel_requests table)

  const handleRequestJoin = async (waypointId: string | null, kmToOrigin: number | null, message: string, seatsRequested = 1) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { toast({ title: 'Please log in first', variant: 'error' }); return }

    try {
      // BUG 3: travel_requests.requester_id has an FK to profiles. If the
      // profile row is missing (legacy users), the insert 23503s. Ensure the
      // row exists first — ignoreDuplicates keeps this a no-op normally.
      const { error: profileUpsertError } = await supabase.from('profiles').upsert(
        {
          id: user.id,
          full_name: user.user_metadata?.full_name ?? 'User',
          gender: (user.user_metadata?.gender as 'male' | 'female' | undefined) ?? 'male',
        },
        { onConflict: 'id', ignoreDuplicates: true }
      )
      if (profileUpsertError) {
        console.warn('[join] profile upsert failed:', profileUpsertError.message)
      }

      const selectedWp = waypointId ? waypoints.find(w => w.id === waypointId) : null

      // BUG 1: support multiple seats. If a pending request already exists,
      // bump its seat count instead of blocking with "already requested".
      const { data: pending } = await supabase
        .from('travel_requests')
        .select('id, seats_requested')
        .eq('travel_id', travel.id)
        .eq('requester_id', user.id)
        .eq('status', 'pending')
        .maybeSingle()

      if (pending) {
        const nextSeats = Math.min(4, (pending.seats_requested ?? 1) + seatsRequested)
        const { error } = await supabase
          .from('travel_requests')
          .update({ seats_requested: nextSeats, message: message.trim() || null })
          .eq('id', pending.id)
        if (error) {
          toast({ title: 'Could not update request', description: error.message, variant: 'error' })
          return
        }
        toast({
          title: `Request updated — ${nextSeats} seat${nextSeats > 1 ? 's' : ''} 🚗`,
          description: 'Host will review shortly.',
          variant: 'success',
        })
        router.refresh()
        return
      }

      const { error } = await supabase.from('travel_requests').insert({
        travel_id: travel.id,
        requester_id: user.id,
        waypoint_id: waypointId ?? null,
        km_from_origin: selectedWp?.km_from_origin ?? 0,
        km_to_origin: kmToOrigin,
        message: message.trim() || null,
        status: 'pending',
        seats_requested: seatsRequested,
      })
      if (error) {
        toast({ title: 'Could not send request', description: error.message, variant: 'error' })
        return
      }
      toast({ title: 'Request sent! 🚗', description: 'Host will review shortly.', variant: 'success' })

      // BUG 2: alert the host in real-time — bell badge + notifications page.
      // Schema: notifications(type, travel_id, payload JSONB) — no title/body cols.
      const { data: requesterProfile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single()
      await supabase.from('notifications').insert({
        user_id: travel.host_id,
        type: 'request_received',
        travel_id: travel.id,
        payload: {
          requester_name: requesterProfile?.full_name ?? user.user_metadata?.full_name ?? 'Someone',
          travel_origin: travel.origin_text,
          travel_destination: travel.destination_text,
        },
        read: false,
      })

      router.refresh()
    } catch (err: unknown) {
      toast({ title: 'Request failed', description: err instanceof Error ? err.message : 'Unknown', variant: 'error' })
    }
  }

  const handleAcceptRequest = async (requestId: string) => {
    setPendingRequestId(requestId)
    setActionType('accept')
    try {
      const { error } = await supabase
        .from('travel_requests')
        .update({ status: 'accepted' })
        .eq('id', requestId)

      if (error) throw error

      // Add to travel_members
      const { data: req } = await supabase
        .from('travel_requests')
        .select('*')
        .eq('id', requestId)
        .single()

      if (req) {
        await supabase.from('travel_members').insert({
          travel_id: travel.id,
          user_id: req.requester_id,
          is_host: false,
          is_full_route: req.waypoint_id === null,
          km_from_origin: req.km_from_origin,
          km_to_origin: req.km_to_origin ?? null,
          seats_reserved: req.seats_requested ?? 1,
        })
      }

      toast({ title: 'Request accepted', variant: 'success' })
      router.refresh()
    } catch (error) {
      console.error('[accept] error:', error)
      toast({ title: 'Failed to accept', variant: 'error' })
    } finally {
      setPendingRequestId(null)
      setActionType(null)
    }
  }

  const handleRejectRequest = async (requestId: string) => {
    setPendingRequestId(requestId)
    setActionType('reject')
    try {
      const { error } = await supabase
        .from('travel_requests')
        .update({ status: 'rejected' })
        .eq('id', requestId)

      if (error) throw error
      toast({ title: 'Request rejected', variant: 'success' })
      router.refresh()
    } catch (error) {
      console.error('[reject] error:', error)
      toast({ title: 'Failed to reject', variant: 'error' })
    } finally {
      setPendingRequestId(null)
      setActionType(null)
    }
  }

  const handleLockTravel = async () => {
    setLocking(true)
    try {
      const { error } = await supabase
        .from('travels')
        .update({ status: 'locked' })
        .eq('id', travel.id)

      if (error) throw error
      toast({ title: 'Travel locked', description: 'No more join requests accepted.', variant: 'success' })
      router.refresh()
    } catch (error) {
      console.error('[lock] error:', error)
      toast({ title: 'Failed to lock travel', variant: 'error' })
    } finally {
      setLocking(false)
      setShowLockConfirm(false)
    }
  }

  const handleUnlockTravel = async () => {
    setLocking(true)
    try {
      const { error } = await supabase
        .from('travels')
        .update({ status: 'open' })
        .eq('id', travel.id)

      if (error) throw error
      toast({ title: 'Travel unlocked', description: 'Riders can now request to join again.', variant: 'success' })
      router.refresh()
    } catch (error) {
      console.error('[unlock] error:', error)
      toast({ title: 'Failed to unlock travel', variant: 'error' })
    } finally {
      setLocking(false)
    }
  }

  const handleShare = async () => {
    const url = `${window.location.origin}/travel/${travel.id}`
    if (navigator.share) {
      await navigator.share({ title: 'CoolCarPool Ride', text: `${travel.origin_text} → ${travel.destination_text}`, url })
    } else {
      await navigator.clipboard.writeText(url)
      toast({ title: 'Link copied!', variant: 'success' })
    }
  }

  const genderBadgeVariant = {
    boys_only: 'brand',
    girls_only: 'warning',
    any: 'success',
  }[travel.gender_preference] as 'brand' | 'warning' | 'success'

  return (
    <div className="flex flex-col gap-6">
      {/* Back + host avatar (mockup header) */}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Go back"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-card text-ink transition-colors hover:bg-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]"
        >
          <ChevronRight className="h-5 w-5 rotate-180" />
        </button>
        <Avatar name={host.full_name} src={host.avatar_url} size="md" presence="online" />
      </div>

      {/* Title */}
      <div>
        <h1 className="text-[26px] font-black leading-tight tracking-tight text-ink">
          {travel.origin_text} → {travel.destination_text}
        </h1>
        <p className="mt-1 text-sm text-ink-secondary">
          {travel.description ?? 'No description provided'}
        </p>
      </div>

      {/* Meta chips */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" size="sm" icon={<CalendarDays className="h-3 w-3" />}>
          {formatDeparture(travel.departure_at)}
        </Badge>
        <Badge variant={genderBadgeVariant} size="sm">
          {travel.gender_preference.replace('_', ' ')}
        </Badge>
        <Badge
          variant={isLocked ? 'danger' : 'gradient'}
          size="sm"
          icon={isLocked ? <Lock className="h-3 w-3" /> : <Users className="h-3 w-3" />}
        >
          {isLocked ? travel.status : `${availableSeats} Seats Left`}
        </Badge>
      </div>

      {/* Host + stats row */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        <div className="flex items-center gap-2">
          <div>
            <p className="font-semibold text-ink">{host.full_name} {isCurrentUserHost ? '(you)' : ''}</p>
            <p className="text-xs text-ink-secondary">{timeUntil(travel.departure_at)}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-ink-secondary">
          <Wallet className="h-4 w-4" />
          <span className="font-semibold tabular text-ink">{formatPKR(travel.estimated_cost_pkr ?? 0)}</span>
        </div>
        <div className="flex items-center gap-1.5 text-ink-secondary">
          <Car className="h-4 w-4" />
          <span className="tabular">{Math.round(travel.total_km)} km</span>
        </div>
        {isCurrentUserHost && (
          <Button variant="ghost" size="icon" onClick={handleShare} aria-label="Share" className="ml-auto">
            <Share2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 rounded-pill bg-card p-1" role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab}
            role="tab"
            aria-selected={activeTab === tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'flex-1 rounded-pill px-4 py-2 text-sm font-semibold transition-colors',
              activeTab === tab
                ? 'bg-nav text-brand'
                : 'text-ink-secondary hover:text-ink',
            )}
          >
            {tab === 'Chat' ? (
              <span className="flex items-center justify-center gap-1.5">
                <MessageCircle className="h-4 w-4" />
                Chat
              </span>
            ) : (
              tab
            )}
          </button>
        ))}
      </div>

      {/* Tab Panels */}
      <div className="flex flex-col gap-4">
        {/* Route Tab */}
        {activeTab === 'Route' && (
          <div className="space-y-5">
            <LeafletRouteMap
              origin={travel.origin_text}
              destination={travel.destination_text}
              waypoints={waypoints}
              totalKm={travel.total_km}
              pickupRadiusKm={travel.pickup_radius_km}
              originLat={travel.origin_lat}
              originLng={travel.origin_lng}
              destinationLat={travel.destination_lat}
              destinationLng={travel.destination_lng}
            />

            {/* Route summary — always visible, even if map tiles fail */}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 rounded-2xl bg-elevated px-4 py-3 text-sm">
              <MapPin className="h-4 w-4 shrink-0 text-brand" aria-hidden />
              <span className="font-semibold text-ink">{travel.origin_text}</span>
              {[...waypoints]
                .sort((a, b) => a.sort_order - b.sort_order)
                .map((wp) => (
                  <span key={wp.id} className="flex min-w-0 items-center gap-x-2">
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-ink-tertiary" aria-hidden />
                    <span className="truncate text-ink-secondary">{wp.label}</span>
                  </span>
                ))}
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-ink-tertiary" aria-hidden />
              <span className="font-semibold text-ink">{travel.destination_text}</span>
              <span className="ml-auto shrink-0 tabular text-xs text-ink-tertiary">
                {Math.round(travel.total_km)} km
              </span>
            </div>

            {waypoints.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-brand" />
                    Mid-route Pickups ({waypoints.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {waypoints.map((wp) => (
                      <div
                        key={wp.id}
                        className="flex items-center justify-between rounded-2xl bg-elevated p-3"
                      >
                        <div className="flex items-center gap-3">
                          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand text-sm font-bold text-brand-ink">
                            {wp.sort_order + 1}
                          </span>
                          <div>
                            <p className="font-medium text-ink">{wp.label}</p>
                            <p className="text-xs text-ink-secondary">
                              {wp.km_from_origin} km from origin
                            </p>
                          </div>
                        </div>
                        <Badge variant="brand" size="sm">
                          {travel.pickup_radius_km} km radius
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Host vehicle info */}
            {(isCurrentUserHost || isMember) && 'vehicle_make' in host && host.vehicle_make && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Car className="h-5 w-5 text-brand" />
                    Vehicle Details
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-2 sm:grid-cols-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-ink-secondary">Make</span>
                      <span className="font-medium text-ink ml-auto">{host.vehicle_make}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-ink-secondary">Model</span>
                      <span className="font-medium text-ink ml-auto">{host.vehicle_model}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-ink-secondary">Color</span>
                      <span className="font-medium text-ink ml-auto">{host.vehicle_color}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-ink-secondary">Plate</span>
                      <span className="font-medium text-ink ml-auto">{host.vehicle_plate}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Seats Tab */}
        {activeTab === 'Seats' && (
          <div className="space-y-5">
            <SeatMap
              travel={travel}
              members={members}
              waypoints={waypoints}
              currentUserId={currentUserId}
              isHost={isCurrentUserHost}
              onRequestJoin={handleRequestJoin}
            />

            {/* Host: Pending Requests */}
            {isCurrentUserHost && pendingRequests.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-warn" />
                    Pending Requests ({pendingRequests.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {pendingRequests.map((req) => (
                      <div
                        key={req.id}
                        className="flex items-center justify-between rounded-2xl bg-elevated p-3"
                      >
                        <div className="flex items-center gap-3">
                          <Avatar
                            name={req.requester?.full_name ?? 'Passenger'}
                            src={req.requester?.avatar_url}
                            size="sm"
                          />
                          <div>
                            <p className="font-medium text-ink">{req.requester?.full_name ?? 'Passenger'}</p>
                            <p className="text-xs text-ink-secondary">
                              {req.km_from_origin > 0
                                ? `Mid-route: ${waypoints.find((w) => w.km_from_origin === req.km_from_origin)?.label ?? `${req.km_from_origin} km`}`
                                : 'Full route'}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleAcceptRequest(req.id)}
                            disabled={pendingRequestId === req.id}
                            loading={pendingRequestId === req.id && actionType === 'accept'}
                            className="h-8"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => handleRejectRequest(req.id)}
                            disabled={pendingRequestId === req.id}
                            loading={pendingRequestId === req.id && actionType === 'reject'}
                            className="h-8"
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Lock / Unlock Travel (Host only) */}
            {isCurrentUserHost && !isLocked && (
              <Button
                variant="outline"
                onClick={() => setShowLockConfirm(true)}
                className="w-full justify-start gap-2"
              >
                <Lock className="h-4 w-4 mr-2" />
                Lock Travel — no more join requests
              </Button>
            )}

            {isCurrentUserHost && isLocked && (
              <Button
                variant="secondary"
                onClick={handleUnlockTravel}
                loading={locking}
                className="w-full justify-start gap-2"
              >
                <Lock className="h-4 w-4 mr-2 opacity-50" />
                Unlock Travel — reopen to join requests
              </Button>
            )}
          </div>
        )}

        {/* Chat Tab - Link to chat page */}
        {activeTab === 'Chat' && (
          <Card className="text-center py-12">
            <MessageCircle className="h-12 w-12 mx-auto text-ink-tertiary mb-4" />
            <h3 className="text-lg font-semibold text-ink mb-2">Group Chat</h3>
            <p className="text-ink-secondary mb-6">
              {isMember
                ? 'Join the conversation with your co-riders'
                : 'Chat is available after your join request is accepted'}
            </p>
            <Link href={`/travel/${travel.id}/chat`}>
              <Button variant="primary" disabled={!isMember}>
                <MessageCircle className="h-4 w-4 mr-2" />
                {isMember ? 'Open Chat' : 'Request to join first'}
              </Button>
            </Link>
          </Card>
        )}
      </div>

      {/* Sticky green CTA — visible only to eligible viewers */}
      {canJoin && (
        <div className="fixed bottom-20 left-0 right-0 z-30 flex justify-center px-4 md:bottom-6">
          <Button
            size="lg"
            onClick={() => setShowJoinModal(true)}
            className="w-full max-w-md shadow-float"
          >
            Request to Join
          </Button>
        </div>
      )}

      {/* Lock Confirm Dialog */}
      <Dialog open={showLockConfirm} onOpenChange={setShowLockConfirm}>
        <DialogContent
          title="Lock Travel"
          description="Once locked, no new passengers can request to join. Current members can still leave if needed."
        >
          <div className="mt-4 flex gap-3">
            <Button variant="outline" onClick={() => setShowLockConfirm(false)} className="flex-1">
              Cancel
            </Button>
            <Button variant="danger" onClick={handleLockTravel} loading={locking} className="flex-1">
              <Lock className="h-4 w-4 mr-2" />
              Lock Travel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Join Request Modal */}
      <JoinRequestModal
        open={showJoinModal}
        onOpenChange={setShowJoinModal}
        travel={travel}
        waypoints={waypoints}
        onSubmit={handleRequestJoin}
      />
    </div>
  )
}