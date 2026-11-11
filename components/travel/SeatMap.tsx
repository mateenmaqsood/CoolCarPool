'use client'

import { useState } from 'react'
import { User, Crown, MapPin, ChevronRight, CheckCircle2, XCircle } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { cn, formatPKR } from '@/lib/utils'
import type { TravelMember, Travel, Waypoint, Profile } from '@/types'

export interface SeatMapProps {
  travel: Travel
  members: (TravelMember & { profile?: Profile | null })[]
  waypoints: Waypoint[]
  currentUserId?: string | null
  isHost?: boolean
  onRequestJoin?: (waypointId: string | null, message: string, seatsRequested?: number) => void
  className?: string
}

interface SeatData {
  index: number
  type: 'host' | 'occupied' | 'mid-route' | 'available'
  member?: TravelMember & { profile?: Profile | null }
  waypoint?: Waypoint | null
  /** For multi-seat bookings: which seat of the rider's booking this is */
  seatPart?: number
  seatTotal?: number
}

/**
 * Visual seat grid showing host seat, occupied seats, and available seats.
 * Host seat (position 0) always shows crown. Mid-route seats show waypoint badge.
 * Click available seat → opens JoinRequestModal.
 */
export function SeatMap({
  travel,
  members,
  waypoints,
  currentUserId,
  isHost = false,
  onRequestJoin,
  className,
}: SeatMapProps) {
  const [selectedSeat, setSelectedSeat] = useState<number | null>(null)
  const [showJoinModal, setShowJoinModal] = useState(false)
  const [joinWaypointId, setJoinWaypointId] = useState<string | null>(null)
  const [joinMessage, setJoinMessage] = useState('')
  const [joinSeats, setJoinSeats] = useState(1)

  // Build seat data array
  const seats = useMemo(() => {
    const seatData: SeatData[] = []
    const sortedMembers = [...members].sort((a, b) => {
      // Host first, then by joined_at
      if (a.is_host && !b.is_host) return -1
      if (!a.is_host && b.is_host) return 1
      return new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime()
    })

    // BUG 1: a rider may reserve multiple seats (seats_reserved) — expand each
    // member into consecutive seat slots so the grid shows every reserved seat.
    const occupants: Array<{ member: TravelMember & { profile?: Profile | null }; part: number; total: number }> = []
    for (const m of sortedMembers) {
      const total = Math.max(1, Math.min(4, m.seats_reserved ?? 1))
      for (let k = 0; k < total; k++) occupants.push({ member: m, part: k, total })
    }

    for (let i = 0; i < travel.total_seats; i++) {
      const occ = occupants[i]
      const member = occ?.member
      const isCurrentUser = currentUserId && member?.user_id === currentUserId

      if (!member) {
        seatData.push({ index: i, type: 'available' })
      } else if (member.is_host) {
        seatData.push({ index: i, type: 'host', member })
      } else if (!member.is_full_route && member.km_from_origin > 0) {
        const waypoint = waypoints.find((w) => Math.abs(w.km_from_origin - member.km_from_origin) < 1)
        seatData.push({ index: i, type: 'mid-route', member, waypoint: waypoint ?? null, seatPart: occ.part, seatTotal: occ.total })
      } else {
        seatData.push({ index: i, type: 'occupied', member, seatPart: occ.part, seatTotal: occ.total })
      }
    }

    return seatData
  }, [travel.total_seats, members, waypoints, currentUserId])

  const availableCount = seats.filter((s) => s.type === 'available').length
  const occupiedCount = seats.filter((s) => s.type === 'occupied' || s.type === 'mid-route').length
  const isFull = availableCount === 0

  const handleSeatClick = (index: number) => {
    if (seats[index].type === 'available' && !isFull && onRequestJoin) {
      setSelectedSeat(index)
      setShowJoinModal(true)
    }
  }

  const handleJoinSubmit = () => {
    onRequestJoin?.(joinWaypointId, joinMessage, joinSeats)
    setShowJoinModal(false)
    setSelectedSeat(null)
    setJoinWaypointId(null)
    setJoinMessage('')
    setJoinSeats(1)
  }

  const handleJoinCancel = () => {
    setShowJoinModal(false)
    setSelectedSeat(null)
    setJoinWaypointId(null)
    setJoinMessage('')
    setJoinSeats(1)
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Seat Grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {seats.map((seat) => (
          <SeatCard
            key={seat.index}
            seat={seat}
            travel={travel}
            isSelected={selectedSeat === seat.index}
            onClick={() => handleSeatClick(seat.index)}
            disabled={seat.type !== 'available' || isFull}
            isHost={isHost}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-ink-secondary">
        <SeatLegendItem color="bg-brand" label="Host" icon={<Crown className="h-3 w-3 text-brand-ink" />} />
        <SeatLegendItem color="bg-nav" label="Occupied" icon={<CheckCircle2 className="h-3 w-3 text-white" />} />
        <SeatLegendItem color="bg-brand-soft" label="Mid-route" icon={<MapPin className="h-3 w-3 text-[var(--ok)]" />} />
        <SeatLegendItem color="bg-elevated" label="Available" icon={<User className="h-3 w-3 text-ink-tertiary" />} />
        <span className="ml-auto text-sm font-semibold tabular text-ink">
          {availableCount}/{travel.total_seats} seats left
        </span>
      </div>

      {/* Join Request Modal */}
      {showJoinModal && (
        <JoinRequestModal
          open={showJoinModal}
          onClose={handleJoinCancel}
          onSubmit={handleJoinSubmit}
          waypoints={waypoints}
          travel={travel}
          selectedWaypointId={joinWaypointId}
          onWaypointChange={setJoinWaypointId}
          message={joinMessage}
          onMessageChange={setJoinMessage}
          seatsRequested={joinSeats}
          onSeatsChange={setJoinSeats}
        />
      )}
    </div>
  )
}

import { useMemo } from 'react'

function SeatLegendItem({
  color,
  label,
  icon,
}: {
  color: string
  label: string
  icon: React.ReactNode
}) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`w-5 h-5 rounded-xl ${color} flex items-center justify-center`}>
        {icon}
      </span>
      {label}
    </span>
  )
}

interface SeatCardProps {
  seat: SeatData
  travel: Travel
  isSelected: boolean
  onClick: () => void
  disabled: boolean
  isHost: boolean
}

function SeatCard({ seat, travel, isSelected, onClick, disabled, isHost }: SeatCardProps) {
  const { type, member, waypoint } = seat

  const getSeatStyle = () => {
    switch (type) {
      case 'host':
        return 'bg-brand text-brand-ink shadow-soft'
      case 'occupied':
        return 'bg-nav text-white'
      case 'mid-route':
        return 'bg-brand-soft text-ink'
      case 'available':
        return disabled
          ? 'bg-sunken text-ink-tertiary cursor-not-allowed'
          : 'bg-elevated text-ink-secondary hover:text-ink hover:shadow-card cursor-pointer transition-all'
    }
  }

  const getBadge = () => {
    switch (type) {
      case 'host':
        return <Crown className="h-5 w-5" />
      case 'mid-route':
        return <MapPin className="h-5 w-5" />
      case 'occupied':
        return <User className="h-5 w-5" />
      case 'available':
        return <User className="h-5 w-5 opacity-30" />
    }
  }

  const memberName = member?.profile?.full_name ?? 'Passenger'
  const memberInitials = member?.profile?.full_name ? member.profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase() : '?'

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'relative group h-24 sm:h-28 rounded-3xl p-3 flex flex-col items-center justify-center gap-2 transition-all duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] focus-visible:ring-offset-2',
        'active:scale-[0.98]',
        getSeatStyle(),
        isSelected && 'ring-2 ring-[var(--border-focus)] ring-offset-2 scale-105'
      )}
      aria-label={type === 'available' ? `Request seat ${seat.index + 1}` : `Seat ${seat.index + 1}: ${type}`}
    >
      <div className="flex flex-col items-center gap-1">
        <div className={cn('flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center overflow-hidden rounded-2xl', type === 'available' ? 'bg-sunken' : 'bg-white/20')}>
          {member && member.profile?.avatar_url ? (
            <img
              src={member.profile.avatar_url}
              alt={memberName}
              className="w-full h-full rounded-lg object-cover"
            />
          ) : (
            getBadge()
          )}
        </div>

        <div className="text-center min-w-0">
          <p className="text-sm font-semibold truncate">
            {type === 'host' ? 'Host' : type === 'available' ? `Seat ${seat.index + 1}` : memberName}
          </p>

          {type === 'mid-route' && waypoint && (
            <Badge variant="brand" size="sm" className="mt-0.5">
              {waypoint.label}
            </Badge>
          )}

          {type === 'available' && !disabled && (
            <p className="text-[10px] mt-1 opacity-70">Tap to request</p>
          )}

          {member && !member.is_host && (
            <p className="text-[10px] mt-1 opacity-70">
              {(seat.seatTotal ?? 1) > 1
                ? seat.seatPart === 0
                  ? `Booked ${seat.seatTotal} seats`
                  : `Same rider ×${seat.seatTotal}`
                : member.is_full_route
                  ? 'Full route'
                  : `From ${waypoint?.label ?? `${member.km_from_origin} km`}`}
            </p>
          )}
        </div>
      </div>

      {type === 'host' && (
        <span className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">
          H
        </span>
      )}

      {type === 'mid-route' && waypoint && (
        <span className="absolute bottom-1.5 right-1.5 w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">
          <MapPin className="h-3 w-3" />
        </span>
      )}
    </button>
  )
}

interface JoinRequestModalProps {
  open: boolean
  onClose: () => void
  onSubmit: () => void
  waypoints: Waypoint[]
  travel: Travel
  selectedWaypointId: string | null
  onWaypointChange: (id: string | null) => void
  message: string
  onMessageChange: (msg: string) => void
  seatsRequested: number
  onSeatsChange: (n: number) => void
}

function JoinRequestModal({
  open,
  onClose,
  onSubmit,
  waypoints,
  travel,
  selectedWaypointId,
  onWaypointChange,
  message,
  onMessageChange,
  seatsRequested,
  onSeatsChange,
}: JoinRequestModalProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-overlay backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl bg-elevated p-6 shadow-float animate-scale-in">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-ink">Request to Join</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-ink-tertiary hover:bg-sunken transition-colors"
            aria-label="Close"
          >
            <XCircle className="h-5 w-5" />
          </button>
        </div>

        <p className="text-sm text-ink-secondary mb-4">
          {travel.origin_text} → {travel.destination_text} · {formatPKR(travel.estimated_cost_pkr ?? 0)}
        </p>

        <div className="space-y-4">
          <fieldset>
            <legend className="text-sm font-medium text-ink mb-2">How would you like to join?</legend>
            <div className="space-y-2">
              <label className="flex items-center gap-3 rounded-2xl bg-card p-3 cursor-pointer transition-colors hover:ring-2 hover:ring-brand-soft">
                <input
                  type="radio"
                  name="joinType"
                  value="full"
                  checked={!selectedWaypointId}
                  onChange={() => onWaypointChange(null)}
                  className="sr-only peer"
                />
                <div className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-line transition-all peer-checked:border-brand peer-checked:bg-brand peer-checked:after:content-[''] peer-checked:after:block peer-checked:after:h-1.5 peer-checked:after:w-1.5 peer-checked:after:rounded-full peer-checked:after:bg-brand-ink" />
                <div className="flex-1">
                  <p className="font-medium text-ink">Full route</p>
                  <p className="text-xs text-ink-secondary mt-0.5">
                    📍 {travel.origin_text} → {travel.destination_text}
                  </p>
                  <p className="text-xs text-ink-tertiary mt-0.5">
                    {Math.round(travel.total_km)} km · est. {(travel.estimated_cost_pkr ?? 0).toLocaleString('en-PK')} PKR total
                  </p>
                </div>
              </label>

              {waypoints.map((wp) => {
                const rideKm = Math.max(0, Math.round(travel.total_km - wp.km_from_origin))
                const estShare = travel.total_km > 0
                  ? Math.round(((travel.total_km - wp.km_from_origin) / travel.total_km) * (travel.estimated_cost_pkr ?? 0))
                  : 0
                return (
                  <label key={wp.id} className="flex items-center gap-3 rounded-2xl bg-card p-3 cursor-pointer transition-colors hover:ring-2 hover:ring-brand-soft">
                    <input
                      type="radio"
                      name="joinType"
                      value={wp.id}
                      checked={selectedWaypointId === wp.id}
                      onChange={() => onWaypointChange(wp.id)}
                      className="sr-only peer"
                    />
                    <div className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-line transition-all peer-checked:border-brand peer-checked:bg-brand peer-checked:after:content-[''] peer-checked:after:block peer-checked:after:h-1.5 peer-checked:after:w-1.5 peer-checked:after:rounded-full peer-checked:after:bg-brand-ink" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-ink truncate">
                        Mid-route: <span className="text-brand">{wp.label}</span>
                      </p>
                      {/* Full route context: origin → pickup → destination (BUG 2) */}
                      <p className="text-xs text-ink-secondary mt-0.5 truncate">
                        📍 {travel.origin_text} → <strong>{wp.label}</strong> → {travel.destination_text}
                      </p>
                      <p className="text-xs text-ink-tertiary mt-0.5">
                        Join at km {Math.round(wp.km_from_origin)} · ride {rideKm} km · est. {estShare.toLocaleString('en-PK')} PKR
                      </p>
                    </div>
                  </label>
                )
              })}
            </div>
          </fieldset>

          {/* BUG 1: how many seats? */}
          <div>
            <label className="block text-sm font-medium text-ink mb-2">
              How many seats? <span className="text-ink-tertiary text-xs">(max {Math.max(1, Math.min(4, travel.available_seats))})</span>
            </label>
            <div className="flex gap-2">
              {[1, 2, 3, 4]
                .filter((n) => n <= Math.max(1, Math.min(4, travel.available_seats)))
                .map((n) => (
                  <button
                    key={n}
                    type="button"
                    aria-pressed={seatsRequested === n}
                    onClick={() => onSeatsChange(n)}
                    className={cn(
                      'h-10 w-10 rounded-xl text-sm font-semibold transition-colors',
                      seatsRequested === n
                        ? 'bg-brand text-brand-ink'
                        : 'bg-card text-ink-secondary hover:text-ink'
                    )}
                  >
                    {n}
                  </button>
                ))}
            </div>
          </div>

          <div>
            <label htmlFor="join-message" className="block text-sm font-medium text-ink mb-1">
              Message to host (optional)
            </label>
            <textarea
              id="join-message"
              value={message}
              onChange={(e) => onMessageChange(e.target.value)}
              rows={3}
              className="w-full rounded-2xl bg-card px-4 py-3 text-sm text-ink outline-none focus:ring-2 focus:ring-brand-soft resize-none"
              placeholder="Hi! I'd like to join your ride..."
            />
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button variant="primary" onClick={onSubmit} className="flex-1">
            Send Request
          </Button>
        </div>
      </div>
    </div>
  )
}