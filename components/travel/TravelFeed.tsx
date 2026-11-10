'use client'

import { useMemo, useState, useEffect } from 'react'
import { SearchX, Search } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Skeleton } from '@/components/ui/Skeleton'
import { Badge } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import { TravelCard } from '@/components/travel/TravelCard'
import type { FeedTravel } from '@/lib/mock-data'
import type { GenderPreference } from '@/types'
import { cn } from '@/lib/utils'

type GenderFilter = 'all' | GenderPreference
type SortKey = 'soonest' | 'price'

interface FeedFilters {
  query: string
  date: string
  gender: GenderFilter
  seatsOnly: boolean
  sort: SortKey
}

const INITIAL_FILTERS: FeedFilters = {
  query: '',
  date: '',
  gender: 'all',
  seatsOnly: false,
  sort: 'soonest',
}

export interface TravelFeedProps {
  initialTravels: FeedTravel[]
  /** True when showing MOCK data instead of a live Supabase query. */
  fallback?: boolean
  loading?: boolean
  currentUserId?: string | null
  /** Viewer's name for the greeting header (mockup: "Good Morning, Ali 👋"). */
  userName?: string | null
  userAvatarUrl?: string | null
}

const GENDER_FILTERS: Array<{ value: GenderFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'boys_only', label: 'Boys' },
  { value: 'girls_only', label: 'Girls' },
  { value: 'any', label: 'Anyone' },
]

function matches(travel: FeedTravel, f: FeedFilters): boolean {
  const q = f.query.trim().toLowerCase()
  if (q && !`${travel.origin_text} ${travel.destination_text}`.toLowerCase().includes(q)) return false
  if (f.date && !travel.departure_at.startsWith(f.date)) return false
  if (f.gender !== 'all' && travel.gender_preference !== f.gender) return false
  if (f.seatsOnly && travel.available_seats <= 0) return false
  return true
}

export function TravelFeed({
  initialTravels,
  fallback,
  loading,
  currentUserId,
  userName,
  userAvatarUrl,
}: TravelFeedProps) {
  const [filters, setFilters] = useState<FeedFilters>(INITIAL_FILTERS)
  const [greeting, setGreeting] = useState('Welcome back')

  // Time-of-day greeting, resolved after mount to avoid SSR hydration drift.
  useEffect(() => {
    const h = new Date().getHours()
    setGreeting(h < 12 ? 'Good Morning' : h < 17 ? 'Good Afternoon' : 'Good Evening')
  }, [])

  const firstName = userName?.trim().split(/\s+/)[0] ?? ''

  const travels = useMemo(() => {
    const filtered = initialTravels.filter((t) => matches(t, filters))
    return filtered.sort((a, b) =>
      filters.sort === 'price'
        ? (a.estimated_cost_pkr ?? Infinity) - (b.estimated_cost_pkr ?? Infinity)
        : new Date(a.departure_at).getTime() - new Date(b.departure_at).getTime(),
    )
  }, [initialTravels, filters])

  const set = <K extends keyof FeedFilters>(key: K, value: FeedFilters[K]) =>
    setFilters((f) => ({ ...f, [key]: value }))

  return (
    <div className="flex flex-col gap-5">
      {/* Greeting + avatar (mockup header) */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[26px] font-black leading-tight tracking-tight text-ink">
            {greeting}
            {firstName ? `, ${firstName} 👋` : ''}
          </h1>
          <p className="mt-0.5 text-sm text-ink-secondary">
            {fallback ? 'Live feed unavailable — showing demo rides.' : 'Where are you heading today?'}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {fallback ? (
            <Badge variant="warning" size="sm">
              Demo data
            </Badge>
          ) : null}
          <Avatar name={userName || 'Traveler'} src={userAvatarUrl} size="lg" />
        </div>
      </div>

      {/* Search */}
      <Input
        type="search"
        value={filters.query}
        onChange={(e) => set('query', e.target.value)}
        placeholder="Search by city — try “Lahore” or “Murree”"
        leftIcon={<Search className="h-4 w-4" />}
        aria-label="Search rides"
      />

      {/* Quick filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-pill bg-card p-1">
          {GENDER_FILTERS.map((g) => (
            <button
              key={g.value}
              type="button"
              onClick={() => set('gender', g.value)}
              aria-pressed={filters.gender === g.value}
              className={cn(
                'rounded-pill px-3 py-1.5 text-xs font-semibold transition-colors',
                filters.gender === g.value
                  ? 'bg-nav text-brand'
                  : 'text-ink-secondary hover:text-ink',
              )}
            >
              {g.label}
            </button>
          ))}
        </div>

        <input
          type="date"
          value={filters.date}
          onChange={(e) => set('date', e.target.value)}
          aria-label="Filter by departure date"
          className="h-9 rounded-pill bg-card px-3 text-xs font-medium text-ink outline-none focus:ring-2 focus:ring-brand-soft"
        />

        <button
          type="button"
          onClick={() => set('seatsOnly', !filters.seatsOnly)}
          aria-pressed={filters.seatsOnly}
          className={cn(
            'rounded-pill px-3 py-2 text-xs font-semibold transition-colors',
            filters.seatsOnly
              ? 'bg-nav text-brand'
              : 'bg-card text-ink-secondary hover:text-ink',
          )}
        >
          Seats available
        </button>

        <select
          value={filters.sort}
          onChange={(e) => set('sort', e.target.value as SortKey)}
          aria-label="Sort rides"
          className="h-9 rounded-pill bg-card px-3 text-xs font-medium text-ink outline-none focus:ring-2 focus:ring-brand-soft"
        >
          <option value="soonest">Soonest first</option>
          <option value="price">Cheapest first</option>
        </select>

        {filters !== INITIAL_FILTERS ? (
          <button
            type="button"
            onClick={() => setFilters(INITIAL_FILTERS)}
            className="rounded-pill px-3 py-1.5 text-xs font-semibold text-ink-secondary transition-colors hover:text-ink"
          >
            Reset
          </button>
        ) : null}
      </div>

      {/* Results */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-56 rounded-3xl" />
          ))}
        </div>
      ) : travels.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-3xl bg-card px-6 py-16 text-center">
          <SearchX className="h-10 w-10 text-ink-tertiary" aria-hidden />
          <p className="font-medium text-ink">No rides match your search</p>
          <p className="max-w-xs text-sm text-ink-secondary">
            Nothing heading that way yet. Loosen the filters — or host the ride yourself and let others join you.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {travels.map((travel) => (
            <TravelCard
              key={travel.id}
              travel={travel}
              isOwn={Boolean(currentUserId) && travel.host_id === currentUserId}
            />
          ))}
        </div>
      )}

      {/* Result count */}
      {!loading && travels.length > 0 ? (
        <p className="text-center text-xs text-ink-tertiary">
          {travels.length} ride{travels.length === 1 ? '' : 's'} found
        </p>
      ) : null}
    </div>
  )
}
