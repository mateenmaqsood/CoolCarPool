'use client'

import { useEffect, useState } from 'react'
import {
  CalendarCheck2,
  CarFront,
  Clock3,
  Repeat2,
  ShieldAlert,
  Split,
  UserRoundCheck,
} from 'lucide-react'
import { Dialog, DialogContent } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { cn, formatDeparture, minutesLabel } from '@/lib/utils'

/* ------------------------------------------------------------------ */
/* Types — mirrors POST /api/duplicate-check response shape            */
/* ------------------------------------------------------------------ */

export interface DuplicateMatchView {
  travel: {
    id: string
    origin_text: string
    destination_text: string
    departure_at: string
    total_km: number
    available_seats: number
    gender_preference: string
  }
  score: number
  tier: 'banner' | 'modal'
  reasons: string[]
  time_proximity_hours: number | null
}

export interface DuplicateModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  matches: DuplicateMatchView[]
  onKeep: () => void
  onMerge?: (match: DuplicateMatchView) => void
  pending?: boolean
}

/* ------------------------------------------------------------------ */
/* Score ring (animated)                                               */
/* ------------------------------------------------------------------ */

function ScoreRing({ score, label }: { score: number; label?: string }) {
  const radius = 44
  const circumference = 2 * Math.PI * radius
  const [progress, setProgress] = useState(0)

  // Trigger the ring sweep after mount so the transition runs.
  useEffect(() => {
    const raf = requestAnimationFrame(() => setProgress(score / 100))
    return () => cancelAnimationFrame(raf)
  }, [score])

  return (
    <div className="relative flex h-28 w-28 items-center justify-center" aria-label={`${Math.round(score)} percent match`}>
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <defs>
          <linearGradient id="dupRingGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--accent-from)" />
            <stop offset="100%" stopColor="var(--accent-to)" />
          </linearGradient>
        </defs>
        {/* Track */}
        <circle cx="50" cy="50" r={radius} fill="none" stroke="var(--border)" strokeWidth="7" />
        {/* Progress */}
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="url(#dupRingGradient)"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - progress)}
          style={{ transition: 'stroke-dashoffset 0.9s cubic-bezier(0.3, 0.8, 0.3, 1)' }}
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center">
        <span className="accent-text-gradient text-2xl font-bold">{Math.round(score)}%</span>
        <span className="text-[9px] font-medium uppercase tracking-widest text-ink-secondary">
          {label ?? 'Match'}
        </span>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Reason pills                                                        */
/* ------------------------------------------------------------------ */

function reasonPills(match: DuplicateMatchView): Array<{ key: string; label: string; icon: typeof Clock3 }> {
  const pills: Array<{ key: string; label: string; icon: typeof Clock3 }> = []
  if (match.reasons.includes('same_route')) {
    pills.push({ key: 'same_route', label: 'Same Route', icon: Repeat2 })
  }
  if (match.reasons.includes('same_date')) {
    pills.push({ key: 'same_date', label: 'Same Date', icon: CalendarCheck2 })
  }
  if (match.reasons.includes('time_proximity')) {
    const label = minutesLabel(match.time_proximity_hours) ?? 'Close timing'
    pills.push({ key: 'time_proximity', label, icon: Clock3 })
  }
  if (match.reasons.includes('gender_match')) {
    pills.push({ key: 'gender_match', label: 'Same Gender Pref.', icon: UserRoundCheck })
  }
  return pills
}

/* ------------------------------------------------------------------ */
/* Modal                                                               */
/* ------------------------------------------------------------------ */

export function DuplicateModal({
  open,
  onOpenChange,
  matches,
  onKeep,
  onMerge,
  pending = false,
}: DuplicateModalProps) {
  const top = matches[0]
  const others = matches.slice(1)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Similar Rides Found" description="Review these open rides before you post yours.">
        {/* Warning header band */}
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-[color-mix(in_srgb,var(--warn)_35%,transparent)] bg-[color-mix(in_srgb,var(--warn)_10%,transparent)] p-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--warn)_18%,transparent)]">
            <ShieldAlert className="h-5 w-5 text-warn" aria-hidden />
          </span>
          <div>
            <p className="text-sm font-semibold text-ink">
              A ride like yours may already be running
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-ink-secondary">
              Merge to combine riders into one car — or keep it separate if your timing or route differs.
            </p>
          </div>
        </div>

        {top ? (
          <>
            {/* Top match hero */}
            <div className="flex items-center gap-4 rounded-xl border border-line bg-sunken p-4">
              <ScoreRing score={top.score} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-sm">
                  <CarFront className="h-4 w-4 shrink-0 text-brand" aria-hidden />
                  <p className="truncate font-semibold text-ink">
                    {top.travel.origin_text} → {top.travel.destination_text}
                  </p>
                </div>
                <p className="mt-1 text-xs text-ink-secondary">
                  {formatDeparture(top.travel.departure_at)} · {Math.round(top.travel.total_km)} km
                </p>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {reasonPills(top).map((pill) => (
                    <Badge key={pill.key} variant="warning" size="sm" icon={<pill.icon className="h-3 w-3" />}>
                      {pill.label}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>

            {/* Secondary matches */}
            {others.length > 0 ? (
              <div className="mt-3">
                <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-ink-tertiary">
                  Other similar rides
                </p>
                <ul className="flex flex-col gap-2">
                  {others.slice(0, 3).map((m) => (
                    <li
                      key={m.travel.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-line bg-elevated px-3 py-2"
                    >
                      <span className="min-w-0 text-xs">
                        <span className="truncate font-medium text-ink">
                          {m.travel.origin_text} → {m.travel.destination_text}
                        </span>
                        <span className="ml-2 text-ink-tertiary">{formatDeparture(m.travel.departure_at)}</span>
                      </span>
                      <Badge variant="default" size="sm" className="shrink-0">
                        {Math.round(m.score)}%
                      </Badge>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </>
        ) : null}

        {/* Actions */}
        <div className="mt-6 flex flex-col gap-2.5">
          <Button
            variant="gradient"
            loading={pending}
            onClick={() => top && onMerge?.(top)}
            className="h-11 w-full"
          >
            <Split className="h-4 w-4" aria-hidden />
            Merge Travel
          </Button>
          <Button variant="outline" onClick={onKeep} disabled={pending} className="h-11 w-full">
            Keep Separate
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** Inline banner for the subtle 40–60% score zone. */
export function SimilarRidesBanner({ score, className }: { score: number; className?: string }) {
  return (
    <div
      className={cn(
        'flex items-center gap-2.5 rounded-xl border border-[color-mix(in_srgb,var(--warn)_30%,transparent)] bg-[color-mix(in_srgb,var(--warn)_8%,transparent)] px-3.5 py-2.5',
        className,
      )}
      role="status"
    >
      <ShieldAlert className="h-4 w-4 shrink-0 text-warn" aria-hidden />
      <p className="text-xs text-ink-secondary">
        <span className="font-semibold text-ink">Heads up:</span> similar rides exist ({Math.round(score)}% match) — yours will still post.
      </p>
    </div>
  )
}
