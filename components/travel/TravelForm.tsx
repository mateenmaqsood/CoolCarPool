'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  Car,
  Check,
  ClipboardCheck,
  Loader2,
  MapPin,
  Minus,
  Plus,
  Repeat2,
  SlidersHorizontal,
  Sparkles,
  Users,
  Wallet,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Toggle } from '@/components/ui/Toggle'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { DuplicateModal, SimilarRidesBanner, type DuplicateMatchView } from '@/components/travel/DuplicateModal'
import { useToast } from '@/components/ui/Toast'
import { createClient } from '@/lib/supabase/client'
import dynamic from 'next/dynamic'

const LeafletRouteMap = dynamic(
  () => import('@/components/route/LeafletRouteMap').then(m => ({ default: m.LeafletRouteMap })),
  { loading: () => <div className="h-96 animate-pulse rounded-2xl bg-elevated" />, ssr: false }
)
import {
  PK_CITIES,
  RECURRENCE_DAYS,
  GENDER_PREFERENCE_OPTIONS,
  HOST_STEP_FIELDS,
  hostFormSchema,
  type HostFormValues,
} from '@/lib/validations'
import { cn, formatPKR, combineDateAndTime } from '@/lib/utils'
import { searchAddresses, type GeoResult } from '@/lib/geocode'
import { estimateTripCost } from '@/lib/fare-engine'

/* -------------------------------------------------------------------- */
/* Stepper                                                               */
/* -------------------------------------------------------------------- */

const STEPS = [
  { label: 'Route', icon: MapPin },
  { label: 'Details', icon: SlidersHorizontal },
  { label: 'Post', icon: ClipboardCheck },
] as const

function Stepper({ current }: { current: number }) {
  return (
    <ol className="flex w-full items-center gap-1.5" aria-label="Form progress">
      {STEPS.map((step, i) => {
        const done = i < current
        const active = i === current
        const nodeClass = done
          ? 'border-transparent bg-brand text-brand-ink'
          : 'border-line bg-elevated text-ink-tertiary'
        const ringClass = active ? 'ring-2 ring-[var(--border-focus)] ring-offset-2 ring-offset-canvas' : ''
        const lineClass = i < current ? 'bg-brand' : 'bg-[var(--border)]'

        return (
          <li key={step.label} className="flex flex-1 flex-col items-center gap-1.5">
            <div className="flex w-full items-center gap-1.5">
              <span
                aria-hidden
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition-all duration-200',
                  nodeClass,
                  ringClass,
                )}
              >
                {done ? <Check className="h-4 w-4" /> : <step.icon className="h-4 w-4" />}
              </span>
              {i < STEPS.length - 1 ? (
                <span className={cn('h-0.5 flex-1 rounded-full transition-colors duration-300', lineClass)} />
              ) : null}
            </div>
            <span className={cn('text-[10px] font-semibold tracking-wide uppercase', active ? 'text-ink' : 'text-ink-tertiary')}>
              {step.label}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

/* -------------------------------------------------------------------- */
/* Small pieces                                                          */
/* -------------------------------------------------------------------- */

function SectionCard({
  title,
  hint,
  children,
}: {
  title?: string
  hint?: string
  children?: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-4">
      {title ? (
        <div>
          <h2 className="text-lg font-bold tracking-tight text-ink">{title}</h2>
          {hint ? <p className="text-sm text-ink-secondary">{hint}</p> : null}
        </div>
      ) : null}
      {children}
    </div>
  )
}

function CityPills({ onSelect, selected }: { onSelect: (city: string) => void; selected: string }) {
  return (
    <div className="flex flex-wrap gap-1.5" aria-label="Quick city picks">
      {PK_CITIES.map((city) => {
        const active = selected.trim().toLowerCase() === city.toLowerCase()
        return (
          <button
            key={city}
            type="button"
            onClick={() => onSelect(city)}
            aria-pressed={active}
            className={cn(
              'rounded-pill px-3 py-1.5 text-xs font-semibold transition-colors',
              active
                ? 'bg-nav text-brand'
                : 'bg-card text-ink-secondary hover:text-ink',
            )}
          >
            {city}
          </button>
        )
      })}
    </div>
  )
}

/**
 * Address combobox — accepts full landmark/address strings (e.g.
 * "Packages Mall, Lahore"), with debounced Nominatim suggestions.
 * Calls onPick with the chosen label and its coordinates (null = unresolved;
 * the route map then falls back to its own CITY_COORDS/Nominatim lookup).
 */
function AddressInput({
  label,
  placeholder,
  value,
  onPick,
  error,
}: {
  label: string
  placeholder: string
  value: string
  onPick: (text: string, coords: [number, number] | null) => void
  error?: string
}) {
  const [query, setQuery] = useState(value)
  const [results, setResults] = useState<GeoResult[]>([])
  const [open, setOpen] = useState(false)
  const [searching, setSearching] = useState(false)

  // Keep the field in sync when the value is set from outside (city pills).
  useEffect(() => {
    setQuery(value)
  }, [value])

  // Debounced Nominatim lookup (>= 3 chars, ~1 req/400ms — within courtesy).
  useEffect(() => {
    if (query.trim() === value.trim()) return
    const t = setTimeout(async () => {
      const q = query.trim()
      if (q.length < 3) {
        setResults([])
        setOpen(false)
        return
      }
      setSearching(true)
      const r = await searchAddresses(q)
      setResults(r)
      setOpen(r.length > 0)
      setSearching(false)
    }, 400)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  function pick(r: GeoResult) {
    setQuery(r.shortLabel)
    setOpen(false)
    setResults([])
    onPick(r.shortLabel, [r.lat, r.lng])
  }

  async function commitFreeText() {
    const q = query.trim()
    if (!q || q === value.trim()) return
    setSearching(true)
    const geo = await searchAddresses(q, 1)
    setSearching(false)
    if (geo.length > 0) {
      setQuery(geo[0].shortLabel)
      onPick(geo[0].shortLabel, [geo[0].lat, geo[0].lng])
    } else {
      // Unresolved — the route map will try CITY_COORDS / full geocode itself.
      onPick(q, null)
    }
  }

  return (
    <div className="relative">
      <Input
        label={label}
        placeholder={placeholder}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        onBlur={() => {
          // Delay so suggestion clicks land before the dropdown closes.
          setTimeout(() => setOpen(false), 150)
          void commitFreeText()
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            if (results.length > 0 && open) pick(results[0])
            else void commitFreeText()
          }
        }}
        leftIcon={<MapPin className="h-4 w-4" />}
        rightSlot={searching ? <Loader2 className="h-4 w-4 animate-spin text-ink-tertiary" /> : null}
        autoComplete="off"
        error={error}
      />
      {open ? (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-2xl bg-elevated shadow-float">
          {results.map((r) => (
            <button
              key={r.label}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(r)}
              className="flex w-full flex-col items-start gap-0.5 px-4 py-2.5 text-left transition-colors hover:bg-sunken"
            >
              <span className="text-sm font-medium text-ink">{r.shortLabel}</span>
              <span className="truncate text-xs text-ink-tertiary">{r.label}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

/* -------------------------------------------------------------------- */
/* Main form                                                             */
/* -------------------------------------------------------------------- */

const DEFAULTS: HostFormValues = {
  origin: '',
  destination: '',
  departure_date: '',
  departure_time: '',
  is_recurring: false,
  recurring_days: [],
  total_seats: 4,
  gender_preference: 'any',
  pickup_radius_km: 2,
  estimated_cost_pkr: undefined as unknown as number,
  description: '',
  vehicle_make: '',
  vehicle_model: '',
  vehicle_color: '',
  vehicle_plate: '',
}

export function TravelForm() {
  const router = useRouter()
  const { toast } = useToast()
  const supabase = useMemo(() => createClient(), [])

  const [step, setStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [dupMatches, setDupMatches] = useState<DuplicateMatchView[] | null>(null)
  const [dupOpen, setDupOpen] = useState(false)
  const [banner, setBanner] = useState<DuplicateMatchView[]>([])
  const [routeKm, setRouteKm] = useState<number>(0)
  // Geocoded coordinates for the route endpoints (null = map resolves itself).
  const [originCoords, setOriginCoords] = useState<[number, number] | null>(null)
  const [destCoords, setDestCoords] = useState<[number, number] | null>(null)

  const form = useForm<HostFormValues>({
    resolver: zodResolver(hostFormSchema),
    defaultValues: DEFAULTS,
    mode: 'onTouched',
  })
  const { register, watch, setValue, getValues, formState } = form
  const errors = formState.errors
  const values = watch()

  /* Load host profile (vehicle info for review step) */
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user || cancelled) return
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      if (!cancelled) {
        // Prefill vehicle fields for the review step (BUG 5)
        if (data) {
          form.reset({
            ...form.getValues(),
            vehicle_make: (data.vehicle_make as string) ?? '',
            vehicle_model: (data.vehicle_model as string) ?? '',
            vehicle_color: (data.vehicle_color as string) ?? '',
            vehicle_plate: (data.vehicle_plate as string) ?? '',
          })
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [supabase])

  const departureIso = useMemo(
    () => combineDateAndTime(values.departure_date, values.departure_time),
    [values.departure_date, values.departure_time],
  )

  const perSeatHint = useMemo(() => {
    if (!values.total_seats || !values.estimated_cost_pkr) return null
    const per = Math.round(values.estimated_cost_pkr / (values.total_seats + 1))
    return `≈ ${formatPKR(per)} per head (incl. you) before the KM split`
  }, [values.total_seats, values.estimated_cost_pkr])

  /* Fare engine (BUG 3): distance-based estimate + fair per-seat floor. */
  const tripEstimate = useMemo(
    () => estimateTripCost(routeKm, values.total_seats ?? 1),
    [routeKm, values.total_seats],
  )

  function goNext() {
    const fields = HOST_STEP_FIELDS[step]
    void form
      .trigger(fields as never)
      .then((ok) => {
        if (ok) {
          // Fare engine minimum: total must cover minPerSeat × seats
          // (km × 12 + 150 toll, floor km × 8 per seat).
          if (step === 2 && tripEstimate.distanceKm > 0) {
            const cost = getValues('estimated_cost_pkr')
            const minTotal = tripEstimate.minPerSeatPkr * (values.total_seats ?? 1)
            if (cost < minTotal) {
              form.setError('estimated_cost_pkr', {
                message: `Minimum is PKR ${minTotal} for this route (${tripEstimate.distanceKm} km → est. PKR ${tripEstimate.totalPkr} total)`
              })
              return
            }
          }
          setStep((s) => Math.min(s + 1, 3))
        }
      })
  }

  function toggleDay(day: string) {
    const current = getValues('recurring_days')
    const next = current.includes(day)
      ? current.filter((d) => d !== day)
      : [...current, day]
    setValue('recurring_days', next, { shouldValidate: true })
  }

  function setSeats(delta: 1 | -1) {
    const current = getValues('total_seats') ?? 4
    const next = Math.min(8, Math.max(1, current + delta))
    setValue('total_seats', next, { shouldValidate: true })
  }

  /* ---------------- Submission + duplicate pipeline ---------------- */

  /**
   * Insert the travel row + host membership. Returns the new travel id,
   * or null on failure (toast shown). No navigation side effects.
   */
  async function insertTravel(): Promise<string | null> {
    setSubmitting(true)
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        toast({ title: 'Session expired — please log in again', variant: 'error' })
        return null
      }
      const v = getValues()
      // BUG 6: travels.host_id FK to profiles fails for legacy accounts whose
      // profile row is missing (pre-trigger signups). Ensure it exists first.
      const { error: profileUpsertError } = await supabase.from('profiles').upsert(
        {
          id: user.id,
          full_name: user.user_metadata?.full_name ?? 'Host',
          gender: (user.user_metadata?.gender as 'male' | 'female' | undefined) ?? 'male',
          city: (user.user_metadata?.city as string | undefined) ?? null,
          phone: (user.user_metadata?.phone as string | undefined) ?? null,
        },
        { onConflict: 'id', ignoreDuplicates: true }
      )
      if (profileUpsertError) {
        console.warn('[host] profile upsert failed:', profileUpsertError.message)
      }
      const { data, error } = await supabase.from('travels').insert({
        host_id: user.id,  // CRITICAL: fresh user.id, not profile?.id
        origin_text: v.origin.trim(),
        origin_lat: originCoords?.[0] ?? null,
        origin_lng: originCoords?.[1] ?? null,
        destination_text: v.destination.trim(),
        destination_lat: destCoords?.[0] ?? null,
        destination_lng: destCoords?.[1] ?? null,
        total_km: routeKm ?? 0,
        departure_at: departureIso ?? new Date().toISOString(),
        is_recurring: v.is_recurring,
        recurring_days: v.is_recurring ? v.recurring_days : null,
        total_seats: v.total_seats,
        available_seats: v.total_seats,
        gender_preference: v.gender_preference,
        pickup_radius_km: v.pickup_radius_km as 1 | 2 | 3,
        estimated_cost_pkr: v.estimated_cost_pkr,
        description: v.description || null,
        status: 'open',
      }).select('id').single()

      if (error || !data) {
        toast({
          title: 'Could not post travel',
          description: error?.message,
          variant: 'error',
        })
        return null
      }

      // Host becomes the first member (full route).
      await supabase.from('travel_members').insert({
        travel_id: data.id,
        user_id: user.id,  // fresh user.id
        is_host: true,
        is_full_route: true,
        km_from_origin: 0,
      })

      // BUG 5: vehicle details are captured in the host form now —
      // persist them to the host profile so riders see them.
      const { error: vehicleError } = await supabase.from('profiles').update({
        vehicle_make: v.vehicle_make?.trim() || null,
        vehicle_model: v.vehicle_model?.trim() || null,
        vehicle_color: v.vehicle_color?.trim() || null,
        vehicle_plate: v.vehicle_plate?.trim().toUpperCase() || null,
      }).eq('id', user.id)
      if (vehicleError) {
        // Never block the post on this.
        console.warn('[host] vehicle update failed:', vehicleError.message)
      }

      return data.id
    } finally {
      setSubmitting(false)
    }
  }

  /** Post the ride as its own travel (the "Keep Separate" path). */
  async function createTravel() {
    const newId = await insertTravel()
    setDupOpen(false)
    setDupMatches(null)
    if (!newId) return

    toast({
      title: 'Travel posted 🎉',
      description: `${getValues('origin')} → ${getValues('destination')} is live on the feed.`,
      variant: 'success',
    })
    router.push('/feed')
    router.refresh()
  }

  /**
   * Merge CTA — posts the new ride as the duplicate *candidate*, then merges it
   * into the matched primary via /api/merge-travel. Per guardrails, a merge
   * failure never blocks the post: the ride falls back to staying separate.
   */
  async function handleMerge() {
    const top = dupMatches?.[0]
    if (!top) {
      // No match to merge into — degrade to a normal post.
      await createTravel()
      return
    }

    const candidateId = await insertTravel()
    if (!candidateId) return

    const fallbackToSeparate = () => {
      toast({
        title: 'Merge could not complete',
        description: 'Your ride was still posted separately on the feed.',
        variant: 'warning',
      })
      setDupOpen(false)
      setDupMatches(null)
      router.push('/feed')
      router.refresh()
    }

    try {
      const res = await fetch('/api/merge-travel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          primary_id: top.travel.id,
          candidate_id: candidateId,
          action: 'merge',
        }),
      })
      const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null

      if (res.ok && json?.ok) {
        toast({
          title: 'Rides merged 🤝',
          description: `Your ride joined ${top.travel.origin_text} → ${top.travel.destination_text}. Riders are pooled into one car.`,
          variant: 'success',
        })
        setDupOpen(false)
        setDupMatches(null)
        router.push(`/travel/${top.travel.id}`)
        router.refresh()
        return
      }

      console.error('[host] merge API failed:', json?.error ?? res.status)
      fallbackToSeparate()
    } catch (error) {
      console.error('[host] merge error:', error)
      fallbackToSeparate()
    }
  }

  /** Card 3 flow: duplicate-check API → modal / banner → post. */
  async function submitTravel() {
    const ok = await form.trigger(HOST_STEP_FIELDS[3] as never)
    if (!ok) return
    if (!departureIso) {
      toast({ title: 'Fix your departure time first', variant: 'warning' })
      setStep(1)
      return
    }

    setSubmitting(true)
    try {
      const v = getValues()
      const res = await fetch('/api/duplicate-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin: v.origin.trim(),
          destination: v.destination.trim(),
          departure_at: departureIso,
          gender_preference: v.gender_preference,
          exclude_id: null,
        }),
      })

      if (!res.ok) {
        // Guardrail: never block posting because of duplicate-check failure.
        console.error('[host] duplicate-check HTTP error:', res.status)
        await createTravel()
        return
      }

      const json = (await res.json()) as {
        ok: boolean
        matches: DuplicateMatchView[]
        top_score: number
        requires_review: boolean
        shows_banner: boolean
      }

      const modals = json.matches.filter((m) => m.tier === 'modal')
      const banners = json.matches.filter((m) => m.tier === 'banner')
      setBanner(banners)

      if (json.requires_review && modals.length > 0) {
        setDupMatches(modals)
        setDupOpen(true)
        return
      }

      await createTravel()
    } catch (error) {
      console.error('[host] pipeline failure — posting anyway per guardrail:', error)
      await createTravel()
    } finally {
      setSubmitting(false)
    }
  }

  const busy = submitting
  const destination_error = errors.destination?.message

  /* ------------------------------------------------------------- */
  /* Render                                                        */
  /* ------------------------------------------------------------- */

  return (
    <div className="flex flex-col gap-6">
      <SectionCard
        title="Host a Travel"
        hint="4 quick steps — we scan for duplicate rides before you post."
      />
      <Stepper current={step} />

      {/* Subtle banner zone (score 40–60%) */}
      {banner.length > 0 && !dupOpen ? (
        <SimilarRidesBanner score={banner[0].score} />
      ) : null}

      <form
        onSubmit={(e) => {
          e.preventDefault()
          void submitTravel()
        }}
        className="rounded-3xl bg-card p-6 shadow-soft"
      >
        {/* key={step} re-runs the entrance animation per step */}
        <div key={step} className="flex flex-col gap-5 animate-slide-up">
          {/* STEP 1 — Route */}
          {step === 0 ? (
            <>
              <div className="flex items-center gap-2 text-sm text-ink-secondary">
                <MapPin className="h-4 w-4 text-brand" />
                Where does this ride run?
              </div>
              <AddressInput
                label="From (origin)"
                placeholder="e.g. Packages Mall, Lahore"
                value={values.origin ?? ''}
                onPick={(text, coords) => {
                  setValue('origin', text, { shouldValidate: true })
                  setOriginCoords(coords)
                }}
                error={errors.origin?.message?.toString()}
              />
              <CityPills
                selected={values.origin ?? ''}
                onSelect={(city) => {
                  setValue('origin', city, { shouldValidate: true })
                  setOriginCoords(null)
                }}
              />
              <AddressInput
                label="To (destination)"
                placeholder="e.g. FAST NUCES CFD Campus"
                value={values.destination ?? ''}
                onPick={(text, coords) => {
                  setValue('destination', text, { shouldValidate: true })
                  setDestCoords(coords)
                }}
                error={destination_error?.toString()}
              />
              <CityPills
                selected={values.destination ?? ''}
                onSelect={(city) => {
                  setValue('destination', city, { shouldValidate: true })
                  setDestCoords(null)
                }}
              />
              {(values.origin?.trim() && values.destination?.trim()) && (
                <div className="mt-4 pt-4 border-t border-line">
                  <p className="text-sm font-medium text-ink-secondary mb-2">Route Preview</p>
                  <LeafletRouteMap
                    origin={values.origin.trim()}
                    destination={values.destination.trim()}
                    waypoints={[]}
                    totalKm={0}
                    originLat={originCoords?.[0] ?? null}
                    originLng={originCoords?.[1] ?? null}
                    destinationLat={destCoords?.[0] ?? null}
                    destinationLng={destCoords?.[1] ?? null}
                    onRouteCalculated={(km) => setRouteKm(km)}
                  />
                </div>
              )}
            </>
          ) : null}

          {/* STEP 2 — Schedule */}
          {step === 1 ? (
            <>
              <div className="flex items-center gap-2 text-sm text-ink-secondary">
                <CalendarClock className="h-4 w-4 text-brand" />
                When are you leaving?
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Departure date"
                  type="date"
                  {...register('departure_date')}
                  error={errors.departure_date?.message?.toString()}
                />
                <Input
                  label="Departure time"
                  type="time"
                  {...register('departure_time')}
                  error={errors.departure_time?.message?.toString()}
                />
              </div>

              <div className="flex items-center justify-between rounded-2xl bg-elevated p-3">
                <div>
                  <p className="text-sm font-medium text-ink">Recurring ride</p>
                  <p className="text-xs text-ink-secondary">Repeat this ride on chosen days</p>
                </div>
                <Toggle
                  label="Recurring ride"
                  checked={values.is_recurring}
                  onChange={(checked) => setValue('is_recurring', checked)}
                />
              </div>

              {values.is_recurring ? (
                <div className="flex flex-col gap-2 animate-slide-up">
                  <div className="flex items-center gap-2 text-xs text-ink-secondary">
                    <Repeat2 className="h-3.5 w-3.5" />
                    Which days?
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {RECURRENCE_DAYS.map((day) => {
                      const active = values.recurring_days?.includes(day)
                      return (
                        <button
                          key={day}
                          type="button"
                          aria-pressed={Boolean(active)}
                          onClick={() => toggleDay(day)}
                          className={cn(
                            'w-12 rounded-pill py-2 text-xs font-semibold transition-all',
                            active
                              ? 'bg-nav text-brand'
                              : 'bg-card text-ink-secondary hover:text-ink',
                          )}
                        >
                          {day}
                        </button>
                      )
                    })}
                  </div>
                  {errors.recurring_days?.message ? (
                    <p className="text-xs text-[var(--error)]">{errors.recurring_days.message}</p>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : null}

          {/* STEP 3 — Details */}
          {step === 2 ? (
            <>
              <div className="flex items-center gap-2 text-sm text-ink-secondary">
                <SlidersHorizontal className="h-4 w-4 text-brand" />
                Seats, who can join & cost
              </div>

              {/* Seats stepper */}
              <div>
                <p className="mb-1.5 text-[13px] font-medium text-ink-secondary">Total seats</p>
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    onClick={() => setSeats(-1)}
                    aria-label="Remove a seat"
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <div className="flex h-10 w-20 items-center justify-center rounded-pill bg-nav text-brand font-semibold">
                    {values.total_seats}
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    onClick={() => setSeats(1)}
                    aria-label="Add a seat"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                  <span className="flex items-center gap-1.5 text-xs text-ink-tertiary">
                    <Users className="h-3.5 w-3.5" /> 1–8
                  </span>
                  {errors.total_seats?.message ? (
                    <p className="text-xs text-[var(--error)]">{errors.total_seats.message}</p>
                  ) : null}
                </div>
              </div>

              {/* Gender preference — SegmentedControl (Male/Female/Any green active) */}
              <div>
                <p className="mb-1.5 text-[13px] font-medium text-ink-secondary">Who can join?</p>
                <SegmentedControl
                  ariaLabel="Gender preference"
                  value={values.gender_preference}
                  onChange={(v) => setValue('gender_preference', v, { shouldValidate: true })}
                  options={GENDER_PREFERENCE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                />
              </div>

              {/* Pickup radius */}
              <div>
                <p className="mb-1.5 text-[13px] font-medium text-ink-secondary">
                  Pickup radius around your route
                </p>
                <SegmentedControl
                  ariaLabel="Pickup radius in kilometers"
                  value={String(values.pickup_radius_km)}
                  onChange={(v) => {
                    const radius = Number(v) as 1 | 2 | 3
                    setValue('pickup_radius_km', radius, { shouldValidate: true })
                  }}
                  options={[
                    { value: '1', label: '1 km' },
                    { value: '2', label: '2 km' },
                    { value: '3', label: '3 km' },
                  ]}
                />
              </div>

              {/* Fare engine estimate — distance-based pricing (BUG 3) */}
              {tripEstimate.distanceKm > 0 ? (
                <div className="flex items-center justify-between gap-3 rounded-2xl bg-elevated p-4">
                  <div>
                    <p className="text-xs text-ink-tertiary">Estimated total trip cost</p>
                    <p className="text-lg font-bold tabular text-ink">
                      {formatPKR(tripEstimate.totalPkr)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-ink-tertiary">Min recommended / passenger</p>
                    <p className="text-lg font-bold tabular text-brand">
                      {formatPKR(tripEstimate.minPerSeatPkr)}
                    </p>
                  </div>
                </div>
              ) : null}

              {/* Estimated cost */}
              <Input
                label="Estimated total cost (PKR)"
                placeholder="2500"
                inputMode="numeric"
                leftIcon={<Wallet className="h-4 w-4" />}
                rightSlot="PKR total"
                helperText={
                  tripEstimate.distanceKm > 0
                    ? `km × PKR 12 + PKR 150 toll = ${formatPKR(tripEstimate.totalPkr)} · floor ${formatPKR(tripEstimate.minPerSeatPkr)}/seat${perSeatHint ? ` · ${perSeatHint}` : ''}`
                    : perSeatHint ?? 'Fuel + tolls for the whole route — split later'
                }
                {...register('estimated_cost_pkr', { valueAsNumber: true })}
                error={errors.estimated_cost_pkr?.message?.toString()}
              />
            </>
          ) : null}

          {/* STEP 4 — Review */}
          {step === 3 ? (
            <>
              <div className="flex items-center gap-2 text-sm text-ink-secondary">
                <ClipboardCheck className="h-4 w-4 text-brand" />
                One last look
              </div>

              <dl className="flex flex-col divide-y divide-line overflow-hidden rounded-3xl bg-elevated">
                <ReviewRow label="Route" value={`${values.origin} → ${values.destination}`} onEdit={() => setStep(0)} />
                <ReviewRow
                  label="Departure"
                  value={departureIso ? formatDepartureSafe(departureIso) : '—'}
                  onEdit={() => setStep(1)}
                />
                <ReviewRow
                  label="Repeats"
                  value={values.is_recurring ? (values.recurring_days ?? []).join(', ') : 'One-time'}
                  onEdit={() => setStep(1)}
                />
                <ReviewRow label="Seats" value={`${values.total_seats} passenger seats`} onEdit={() => setStep(2)} />
                <ReviewRow
                  label="Join policy"
                  value={GENDER_PREFERENCE_OPTIONS.find((g) => g.value === values.gender_preference)?.label ?? '—'}
                  onEdit={() => setStep(2)}
                />
                <ReviewRow label="Pickup radius" value={`${values.pickup_radius_km} km`} onEdit={() => setStep(2)} />
                <ReviewRow
                  label="Est. cost"
                  value={`≈ ${formatPKR(values.estimated_cost_pkr ?? 0)} total`}
                  onEdit={() => setStep(2)}
                />
              </dl>

              {/* Vehicle details — editable here (moved from Profile Edit) */}
              <div className="flex flex-col gap-3 rounded-3xl bg-elevated p-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-soft">
                    <Car className="h-4 w-4 text-brand" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink">Your vehicle</p>
                    <p className="text-xs text-ink-secondary">Visible to riders for trust & safety</p>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input
                    label="Make"
                    placeholder="Toyota"
                    {...register('vehicle_make')}
                    error={errors.vehicle_make?.message?.toString()}
                  />
                  <Input
                    label="Model"
                    placeholder="Corolla"
                    {...register('vehicle_model')}
                    error={errors.vehicle_model?.message?.toString()}
                  />
                  <Input
                    label="Color"
                    placeholder="White"
                    {...register('vehicle_color')}
                    error={errors.vehicle_color?.message?.toString()}
                  />
                  <Input
                    label="Plate number"
                    placeholder="LHR-1234"
                    className="uppercase"
                    {...register('vehicle_plate')}
                    error={errors.vehicle_plate?.message?.toString()}
                  />
                </div>
              </div>

              <Input
                label="Note for riders (optional)"
                placeholder="Extra details — luggage space, stops, vibe…"
                {...register('description')}
                error={errors.description?.message?.toString()}
              />
            </>
          ) : null}
        </div>

        {/* Wizard controls */}
        <div className="mt-6 flex items-center justify-between gap-3 pt-5">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0 || busy}
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>

          {step < 3 ? (
            <Button type="button" onClick={goNext} className="min-w-32">
              Next <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button type="submit" variant="primary" loading={busy} className="min-w-44">
              <Sparkles className="h-4 w-4" aria-hidden />
              Post Travel
            </Button>
          )}
        </div>
      </form>

      {/* TechSOC Card 3 — Duplicate Modal */}
      <DuplicateModal
        open={dupOpen}
        onOpenChange={setDupOpen}
        matches={dupMatches ?? []}
        onKeep={() => void createTravel()}
        onMerge={() => void handleMerge()}
        pending={busy}
      />
    </div>
  )
}

/* -------------------------------------------------------------------- */
/* Helpers                                                               */
/* -------------------------------------------------------------------- */

function ReviewRow({ label, value, onEdit }: { label: string; value: string; onEdit: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5">
      <dt className="shrink-0 text-xs text-ink-tertiary">{label}</dt>
      <dd className="flex min-w-0 items-center gap-2">
        <span className="truncate text-sm font-medium text-ink">{value}</span>
        <button
          type="button"
          onClick={onEdit}
          className="shrink-0 text-[11px] font-medium text-brand hover:underline"
        >
          Edit
        </button>
      </dd>
    </div>
  )
}

function formatDepartureSafe(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-PK', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}
