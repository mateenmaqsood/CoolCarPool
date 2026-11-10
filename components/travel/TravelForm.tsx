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
import {
  PK_CITIES,
  RECURRENCE_DAYS,
  GENDER_PREFERENCE_OPTIONS,
  HOST_STEP_FIELDS,
  hostFormSchema,
  type HostFormValues,
} from '@/lib/validations'
import type { Profile } from '@/types'
import { cn, formatPKR, combineDateAndTime } from '@/lib/utils'

/* -------------------------------------------------------------------- */
/* Stepper                                                               */
/* -------------------------------------------------------------------- */

const STEPS = [
  { label: 'Route', icon: MapPin },
  { label: 'Schedule', icon: CalendarClock },
  { label: 'Details', icon: SlidersHorizontal },
  { label: 'Review', icon: ClipboardCheck },
] as const

function Stepper({ current }: { current: number }) {
  return (
    <ol className="flex w-full items-center gap-1.5" aria-label="Form progress">
      {STEPS.map((step, i) => {
        const done = i < current
        const active = i === current
        return (
          <li key={step.label} className="flex flex-1 flex-col items-center gap-1.5">
            <div className="flex w-full items-center gap-1.5">
              {/* Connector before node (except first) handled by flex-1 line below */}
              <span
                aria-hidden
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition-all duration-200',
                  done && 'border-transparent bg-brand text-white',
                  active && 'border-transparent accent-gradient text-white shadow-soft',
                  !done && !active && 'border-line bg-elevated text-ink-tertiary',
                )}
              >
                {done ? <Check className="h-4 w-4" /> : <step.icon className="h-4 w-4" />}
              </span>
              {i < STEPS.length - 1 ? (
                <span
                  className={cn(
                    'h-0.5 flex-1 rounded-full transition-colors duration-300',
                    i < current ? 'bg-brand' : 'bg-[var(--border)]',
                  )}
                />
              ) : null}
            </div>
            <span
              className={cn(
                'text-[10px] font-medium tracking-wide uppercase',
                active ? 'text-ink' : 'text-ink-tertiary',
              )}
            >
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
              'rounded-pill border px-3 py-1.5 text-xs font-medium transition-all duration-150',
              active
                ? 'border-transparent bg-brand text-white shadow-soft'
                : 'border-line bg-elevated text-ink-secondary hover:border-brand hover:text-brand',
            )}
          >
            {city}
          </button>
        )
      })}
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
}

export function TravelForm() {
  const router = useRouter()
  const { toast } = useToast()
  const supabase = useMemo(() => createClient(), [])

  const [step, setStep] = useState(0)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [dupMatches, setDupMatches] = useState<DuplicateMatchView[] | null>(null)
  const [dupOpen, setDupOpen] = useState(false)
  const [banner, setBanner] = useState<DuplicateMatchView[]>([])

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
      if (!cancelled) setProfile((data as Profile) ?? null)
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

  function goNext() {
    const fields = HOST_STEP_FIELDS[step]
    void form
      .trigger(fields as never)
      .then((ok) => {
        if (ok) setStep((s) => Math.min(s + 1, 3))
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
      const v = getValues()
      const { data, error } = await supabase
        .from('travels')
        .insert({
          host_id: profile?.id,
          origin_text: v.origin.trim(),
          destination_text: v.destination.trim(),
          total_km: 0, // refined with maps later (SVG simulation today)
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
        })
        .select('id')
        .single()

      if (error || !data) {
        toast({
          title: 'Could not post travel',
          description: error?.message ?? 'Please try again.',
          variant: 'error',
        })
        return null
      }

      // Host becomes the first member (full route).
      await supabase.from('travel_members').insert({
        travel_id: data.id,
        user_id: profile?.id,
        is_host: true,
        is_full_route: true,
        km_from_origin: 0,
      })

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
        className="rounded-2xl border border-line bg-elevated p-6 shadow-soft"
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
              <Input
                label="From (origin)"
                placeholder="e.g. Lahore"
                leftIcon={<MapPin className="h-4 w-4" />}
                {...register('origin')}
                error={errors.origin?.message?.toString()}
              />
              <CityPills
                selected={values.origin ?? ''}
                onSelect={(city) => setValue('origin', city, { shouldValidate: true })}
              />
              <Input
                label="To (destination)"
                placeholder="e.g. Murree"
                leftIcon={<ArrowRight className="h-4 w-4" />}
                {...register('destination')}
                error={destination_error?.toString()}
              />
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

              <div className="flex items-center justify-between rounded-xl border border-line bg-sunken px-4 py-3">
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
                            'w-12 rounded-xl border py-2 text-xs font-semibold transition-all',
                            active
                              ? 'border-transparent bg-brand text-white'
                              : 'border-line bg-elevated text-ink-secondary hover:border-brand',
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
                  <div className="flex h-10 w-20 items-center justify-center rounded-xl border border-line bg-elevated font-semibold text-ink">
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

              {/* Gender preference */}
              <div>
                <p className="mb-1.5 text-[13px] font-medium text-ink-secondary">Who can join?</p>
                <div className="grid gap-2 sm:grid-cols-3">
                  {GENDER_PREFERENCE_OPTIONS.map((option) => {
                    const active = values.gender_preference === option.value
                    return (
                      <button
                        key={option.value}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setValue('gender_preference', option.value, { shouldValidate: true })}
                        className={cn(
                          'flex flex-col items-start gap-0.5 rounded-xl border p-3 text-left transition-all',
                          active
                            ? 'border-brand bg-brand-soft'
                            : 'border-line bg-elevated hover:border-[color-mix(in_srgb,var(--brand)_40%,var(--border))]',
                        )}
                      >
                        <span className={cn('text-sm font-semibold', active ? 'text-brand' : 'text-ink')}>
                          {option.label}
                        </span>
                        <span className="text-[11px] leading-snug text-ink-secondary">{option.hint}</span>
                      </button>
                    )
                  })}
                </div>
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

              {/* Estimated cost */}
              <Input
                label="Estimated total cost (PKR)"
                placeholder="2500"
                inputMode="numeric"
                leftIcon={<Wallet className="h-4 w-4" />}
                rightSlot="PKR total"
                helperText={perSeatHint ?? 'Fuel + tolls for the whole route — split automatically later'}
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

              <dl className="flex flex-col divide-y divide-[var(--border)] overflow-hidden rounded-xl border border-line bg-sunken">
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

              {/* Vehicle info (read-only from profile) */}
              <div className="flex items-start gap-3 rounded-xl border border-line bg-sunken p-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-soft">
                  <Car className="h-4 w-4 text-brand" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink">Your vehicle</p>
                  <p className="text-xs text-ink-secondary">
                    {vehicleSummary(profile) ?? 'Add vehicle details in your profile for rider trust.'}
                  </p>
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
        <div className="mt-6 flex items-center justify-between gap-3 border-t border-line pt-5">
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

function vehicleSummary(profile: Profile | null): string | null {
  if (!profile) return null
  const parts = [profile.vehicle_make, profile.vehicle_model, profile.vehicle_color].filter(Boolean)
  if (parts.length === 0) return null
  const plate = profile.vehicle_plate ? ` · ${profile.vehicle_plate}` : ''
  return `${parts.join(' ')}${plate}`
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
