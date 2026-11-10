'use client'

import Link from 'next/link'
import {
  ArrowRight,
  CalendarDays,
  MapPin,
  Users,
  Wallet,
} from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Badge, type BadgeProps } from '@/components/ui/Badge'
import type { FeedTravel, FeedHost } from '@/lib/mock-data'
import type { GenderPreference } from '@/types'
import { cn, formatPKR, formatDeparture, timeUntil } from '@/lib/utils'

/* -------------------------------------------------------------------- */
/* Pieces                                                                */
/* -------------------------------------------------------------------- */

export function GenderBadge({ preference, className }: { preference: GenderPreference; className?: string }) {
  const config: Record<GenderPreference, { label: string; variant: BadgeProps['variant'] }> = {
    boys_only: { label: 'Boys Only', variant: 'brand' },
    girls_only: { label: 'Girls Only', variant: 'warning' },
    any: { label: 'Anyone', variant: 'success' },
  }
  const { label, variant } = config[preference]
  return (
    <Badge variant={variant} size="sm" className={cn('uppercase tracking-wide', className)}>
      {label}
    </Badge>
  )
}

function SeatsPill({ available }: { available: number }) {
  if (available <= 0) {
    return (
      <Badge variant="danger" size="sm" icon={<Users className="h-3 w-3" />}>
        Full
      </Badge>
    )
  }
  return (
    <Badge variant="gradient" size="sm" icon={<Users className="h-3 w-3" />}>
      {available} {available === 1 ? 'Seat' : 'Seats'} Left
    </Badge>
  )
}

function RouteLine({ travel }: { travel: FeedTravel }) {
  return (
    <div className="flex w-full items-center gap-2 text-sm">
      <MapPin className="h-4 w-4 shrink-0 text-brand" aria-hidden />
      <span className="truncate font-medium text-ink">{travel.origin_text}</span>

      <span className="relative mx-1 flex flex-1 items-center" aria-hidden>
        <span className="h-px w-full border-t border-dashed border-line" />
        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-pill border border-line bg-elevated px-2 py-0.5 text-[10px] font-semibold text-ink-secondary">
          {Math.round(travel.total_km)} km
        </span>
      </span>

      <span className="truncate font-medium text-ink">{travel.destination_text}</span>
      <ArrowRight className="h-4 w-4 shrink-0 text-ink-tertiary" aria-hidden />
    </div>
  )
}

/* -------------------------------------------------------------------- */
/* Card                                                                  */
/* -------------------------------------------------------------------- */

export interface TravelCardProps {
  travel: FeedTravel
  /** The viewer is the host? then highlight the card. */
  isOwn?: boolean
  className?: string
}

export function TravelCard({ travel, isOwn, className }: TravelCardProps) {
  const isFull = travel.available_seats <= 0
  const host: FeedHost | undefined =
    travel.host ?? { id: travel.host_id, full_name: 'Host', avatar_url: null }

  return (
    <Link
      href={`/travel/${travel.id}`}
      prefetch={true}
      className={cn(
        'group flex flex-col gap-4 rounded-3xl bg-card p-5 shadow-soft transition-all duration-200',
        'hover:-translate-y-0.5 hover:shadow-card',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]',
        isFull && 'opacity-70',
        className,
      )}
      aria-label={`Travel from ${travel.origin_text} to ${travel.destination_text}`}
    >
      {/* Host + gender + time meta */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <Avatar name={host.full_name} src={host.avatar_url} size="sm" />
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-ink">
              {host.full_name}
              {isOwn ? ' (you)' : ''}
            </p>
            <p className="text-[11px] text-ink-tertiary">{timeUntil(travel.departure_at)}</p>
          </div>
        </div>
        <GenderBadge preference={travel.gender_preference} />
      </div>

      {/* Route */}
      <RouteLine travel={travel} />

      {/* Meta row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Badge variant="outline" size="sm" icon={<CalendarDays className="h-3 w-3" />}>
            {formatDeparture(travel.departure_at)}
          </Badge>
          <SeatsPill available={travel.available_seats} />
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Wallet className="h-3.5 w-3.5 text-ink-tertiary" aria-hidden />
          <span className="text-sm font-semibold text-ink">
            ≈ {formatPKR(travel.estimated_cost_pkr ?? 0)}
          </span>
        </div>
      </div>

      {/* CTA row */}
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-xs text-ink-tertiary">
          {travel.is_recurring ? `Repeats weekly · ${(travel.recurring_days ?? []).join(', ')}` : 'One-time ride'}
        </span>
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-pill px-3 py-1.5 text-xs font-semibold transition-colors',
            isFull ? 'bg-sunken text-ink-tertiary' : 'bg-brand text-brand-ink group-hover:bg-brand-hover',
          )}
        >
          {isFull ? 'Ride full' : isOwn ? 'View ride' : 'Request seat'}
        </span>
      </div>
    </Link>
  )
}
