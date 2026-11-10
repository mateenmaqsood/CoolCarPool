/**
 * CoolCarPool — Duplicate Detector scoring engine (Card 3).
 *
 * Flow:
 *   1. SQL side: `match_duplicate_travels()` (supabase/duplicate-match.sql)
 *      finds OPEN travels reachable via pg_trgm similarity (> 0.25) on
 *      origin_text / destination_text and returns per-row similarity scores.
 *   2. JS side: score each candidate with the weighted matrix:
 *
 *        origin similarity      × 0.30
 *        destination similarity × 0.30
 *        same calendar date     × 0.20
 *        time proximity         × 0.15   (≤1h → 1.0, ≤2h → 0.7, ≤6h → 0.3)
 *        gender pref. match     × 0.05   (exact → 1.0, one 'any' → 0.5)
 *
 *      Score × 100 → percentage.
 *
 *   3. Thresholds: < 40% → dropped | 40–60% → 'banner' | ≥ 60% → 'modal'.
 *
 * Per project guardrails, a failing pg_trgm query degrades to "no matches"
 * instead of blocking the post — posting always succeeds.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  Database,
  GenderPreference,
  Json,
  PickupRadiusKm,
  Travel,
  TravelStatus,
} from '@/types'
import { createClient } from '@/lib/supabase/server'

// ---------------------------------------------------------------------------
// Public types & constants
// ---------------------------------------------------------------------------

export type MatchReason = 'same_route' | 'same_date' | 'time_proximity' | 'gender_match'
export type MatchTier = 'banner' | 'modal'

/** Weights must sum to 1.0 — CLAUDE.md scoring matrix. */
export const SCORE_WEIGHTS = {
  ORIGIN: 0.3,
  DESTINATION: 0.3,
  SAME_DATE: 0.2,
  TIME_PROXIMITY: 0.15,
  GENDER: 0.05,
} as const

/** Minimum pg_trgm similarity for a row to even be considered (SQL side). */
export const SIMILARITY_FLOOR = 0.25

/** Score % below this → candidate is silently dropped. */
export const BANNER_THRESHOLD_PCT = 40
/** Score % at or above this → show the full DuplicateModal. */
export const MODAL_THRESHOLD_PCT = 60

export interface DuplicateCheckInput {
  origin: string
  destination: string
  departure_at: string
  gender_preference: GenderPreference
  /** Travel being posted (excluded from candidates). Null when checking an existing travel. */
  exclude_id?: string | null
}

/** A raw candidate row from `match_duplicate_travels`. */
export interface TravelCandidate {
  travel: Travel
  origin_similarity: number
  destination_similarity: number
}

export interface DuplicateMatchCandidate {
  travel: Travel
  /** 0–100 composite match percentage, 1 decimal place. */
  score: number
  tier: MatchTier
  origin_similarity: number
  destination_similarity: number
  date_match: boolean
  time_proximity_hours: number | null
  time_proximity_score: number
  gender_match_score: number
  /** Pills for the DuplicateModal / banner. */
  reasons: MatchReason[]
}

export interface DuplicateCheckResult {
  matches: DuplicateMatchCandidate[]
  /** Highest score in the list (0 when empty). */
  top_score: number
  /** Any match ≥ 60% → host must see the DuplicateModal. */
  requires_review: boolean
  /** Top match in the 40–60% band → show the subtle "Similar rides exist" banner. */
  shows_banner: boolean
}

export interface DuplicateRunnerOptions {
  /** Inject a client (e.g. from the route handler) or a Sb service client. */
  supabase?: SupabaseClient<Database>
  /** Drop matches below this percentage. Defaults to BANNER_THRESHOLD_PCT. */
  minScorePct?: number
}

const TRAVEL_STATUSES: readonly TravelStatus[] = [
  'open',
  'locked',
  'in_progress',
  'completed',
  'settled',
  'merged',
]

const GENDER_PREFERENCES: readonly GenderPreference[] = ['boys_only', 'girls_only', 'any']

// ---------------------------------------------------------------------------
// Scoring primitives
// ---------------------------------------------------------------------------

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

/** Time-proximity factor: ≤1h → 1.0, ≤2h → 0.7, ≤6h → 0.3, else 0. */
export function timeProximityScore(hoursDiff: number | null): number {
  if (hoursDiff === null || !Number.isFinite(hoursDiff) || hoursDiff < 0) return 0
  if (hoursDiff <= 1) return 1
  if (hoursDiff <= 2) return 0.7
  if (hoursDiff <= 6) return 0.3
  return 0
}

/** Gender preference match: exact → 1.0, one side 'any' → 0.5, else 0. */
export function genderPreferenceMatchScore(
  a: GenderPreference,
  b: GenderPreference,
): number {
  if (a === b) return 1
  if (a === 'any' || b === 'any') return 0.5
  return 0
}

/** Local calendar-day key (users care about "same day", not same UTC instant). */
export function calendarDateKey(isoTimestamp: string): string | null {
  const parsed = new Date(isoTimestamp)
  if (Number.isNaN(parsed.getTime())) return null
  return `${parsed.getFullYear()}-${parsed.getMonth() + 1}-${parsed.getDate()}`
}

/** Absolute gap between two ISO timestamps in hours, or null when unparseable. */
export function hoursBetween(a: string, b: string): number | null {
  const dateA = new Date(a)
  const dateB = new Date(b)
  if (Number.isNaN(dateA.getTime()) || Number.isNaN(dateB.getTime())) return null
  return Math.abs(dateA.getTime() - dateB.getTime()) / 3_600_000
}

// ---------------------------------------------------------------------------
// Candidate scoring
// ---------------------------------------------------------------------------

export function scoreTravelCandidate(
  candidate: TravelCandidate,
  input: DuplicateCheckInput,
): DuplicateMatchCandidate | null {
  const originSim = clamp01(candidate.origin_similarity)
  const destSim = clamp01(candidate.destination_similarity)

  const dateKeyA = calendarDateKey(input.departure_at)
  const dateKeyB = calendarDateKey(candidate.travel.departure_at)
  const dateMatch = dateKeyA !== null && dateKeyB !== null && dateKeyA === dateKeyB

  const hoursDiff = hoursBetween(input.departure_at, candidate.travel.departure_at)
  const timeScore = timeProximityScore(hoursDiff)

  const genderMatch = genderPreferenceMatchScore(
    input.gender_preference,
    candidate.travel.gender_preference,
  )

  const rawScore =
    originSim * SCORE_WEIGHTS.ORIGIN +
    destSim * SCORE_WEIGHTS.DESTINATION +
    (dateMatch ? 1 : 0) * SCORE_WEIGHTS.SAME_DATE +
    timeScore * SCORE_WEIGHTS.TIME_PROXIMITY +
    genderMatch * SCORE_WEIGHTS.GENDER

  // × 100 → percentage, keep one decimal.
  const score = Math.round(rawScore * 1000) / 10

  // Below the banner floor the candidate is simply ignored.
  if (score < BANNER_THRESHOLD_PCT) return null

  const reasons: MatchReason[] = []
  if (originSim >= 0.5 && destSim >= 0.5) reasons.push('same_route')
  if (dateMatch) reasons.push('same_date')
  if (timeScore > 0) reasons.push('time_proximity')
  if (genderMatch > 0) reasons.push('gender_match')

  return {
    travel: candidate.travel,
    score,
    tier: score >= MODAL_THRESHOLD_PCT ? 'modal' : 'banner',
    origin_similarity: Math.round(originSim * 100) / 100,
    destination_similarity: Math.round(destSim * 100) / 100,
    date_match: dateMatch,
    time_proximity_hours: hoursDiff === null ? null : Math.round(hoursDiff * 10) / 10,
    time_proximity_score: timeScore,
    gender_match_score: genderMatch,
    reasons,
  }
}

// ---------------------------------------------------------------------------
// RPC response parsing (function returns JSONB, response shape is validated)
// ---------------------------------------------------------------------------

function isJsonObject(
  value: Json | undefined,
): value is { [key: string]: Json | undefined } {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function optionalString(value: Json | undefined): string | null {
  return typeof value === 'string' ? value : null
}

function optionalNumber(value: Json | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function optionalStringArray(value: Json | undefined): string[] | null {
  if (!Array.isArray(value)) return null
  return value.every((item) => typeof item === 'string') ? (value as string[]) : null
}

/** Parse and validate one JSONB row from `match_duplicate_travels`. */
export function parseTravelCandidate(raw: Json | undefined): TravelCandidate | null {
  if (!isJsonObject(raw)) return null

  const id = optionalString(raw.id)
  const hostId = optionalString(raw.host_id)
  const originText = optionalString(raw.origin_text)
  const destinationText = optionalString(raw.destination_text)
  const departureAt = optionalString(raw.departure_at)
  const totalKm = optionalNumber(raw.total_km)
  const totalSeats = optionalNumber(raw.total_seats)
  const availableSeats = optionalNumber(raw.available_seats)
  const genderPreference = optionalString(raw.gender_preference)
  const status = optionalString(raw.status)
  const originSim = optionalNumber(raw.origin_sim) ?? 0
  const destSim = optionalNumber(raw.dest_sim) ?? 0

  if (
    !id ||
    !hostId ||
    !originText ||
    !destinationText ||
    !departureAt ||
    totalKm === null ||
    totalSeats === null ||
    availableSeats === null ||
    !GENDER_PREFERENCES.includes(genderPreference as GenderPreference) ||
    !TRAVEL_STATUSES.includes(status as TravelStatus)
  ) {
    return null
  }

  const travel: Travel = {
    id,
    host_id: hostId,
    origin_text: originText,
    origin_lat: optionalNumber(raw.origin_lat),
    origin_lng: optionalNumber(raw.origin_lng),
    destination_text: destinationText,
    destination_lat: optionalNumber(raw.destination_lat),
    destination_lng: optionalNumber(raw.destination_lng),
    total_km: totalKm,
    departure_at: departureAt,
    is_recurring: raw.is_recurring === true,
    recurring_days: optionalStringArray(raw.recurring_days),
    total_seats: totalSeats,
    available_seats: availableSeats,
    gender_preference: genderPreference as GenderPreference,
    pickup_radius_km: (raw.pickup_radius_km === 1 || raw.pickup_radius_km === 3
      ? raw.pickup_radius_km
      : 2) as PickupRadiusKm,
    estimated_cost_pkr: optionalNumber(raw.estimated_cost_pkr),
    description: optionalString(raw.description),
    status: status as TravelStatus,
    merged_into_id: optionalString(raw.merged_into_id),
    created_at: optionalString(raw.created_at) ?? new Date().toISOString(),
  }

  return { travel, origin_similarity: originSim, destination_similarity: destSim }
}

/** Validate the full RPC payload: `{ matches: Travel[] }`. */
export function parseDuplicateCandidates(raw: Json | null): TravelCandidate[] {
  if (raw === null || !isJsonObject(raw)) return []
  const list = raw.matches
  if (!Array.isArray(list)) return []
  return list
    .map((item) => parseTravelCandidate(item))
    .filter((candidate): candidate is TravelCandidate => candidate !== null)
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export async function findDuplicateTravels(
  input: DuplicateCheckInput,
  options: DuplicateRunnerOptions = {},
): Promise<DuplicateCheckResult> {
  const supabase = options.supabase ?? createClient()
  const minScorePct = options.minScorePct ?? BANNER_THRESHOLD_PCT

  // The PostgREST RPC returns raw JSONB (parsed and validated below), so the
  // typed client's strict Functions generic is bypassed with a local contract.
  interface RpcMatchResponse {
    data: Json | null
    error: { message: string } | null
  }
  type RpcCaller = (fn: string, args: Record<string, unknown>) => Promise<RpcMatchResponse>

  const { data, error } = await (supabase.rpc as unknown as RpcCaller)(
    'match_duplicate_travels',
    {
      p_origin: input.origin,
      p_destination: input.destination,
      p_exclude_id: input.exclude_id ?? null,
    },
  )

  if (error) {
    // Guardrail: duplicate check must never block a post. Log and degrade.
    console.error('[duplicate-detector] match_duplicate_travels failed:', error.message)
    return { matches: [], top_score: 0, requires_review: false, shows_banner: false }
  }

  const candidates = parseDuplicateCandidates(data)

  const emptyResult: DuplicateCheckResult = {
    matches: [],
    top_score: 0,
    requires_review: false,
    shows_banner: false,
  }

  if (candidates.length === 0) return emptyResult

  const matches = candidates
    .map((candidate) => scoreTravelCandidate(candidate, input))
    .filter((match): match is DuplicateMatchCandidate => match !== null)
    .filter((match) => match.score >= minScorePct)
    .sort((a, b) => b.score - a.score || a.travel.id.localeCompare(b.travel.id))

  const topScore = matches.length > 0 ? matches[0].score : 0

  return {
    matches,
    top_score: topScore,
    requires_review: matches.some((m) => m.tier === 'modal'),
    shows_banner: topScore >= BANNER_THRESHOLD_PCT && topScore < MODAL_THRESHOLD_PCT,
  }
}
