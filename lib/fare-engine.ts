/**
 * CoolCarPool — KM-based cost split engine (pure functions, no I/O).
 *
 * Domain formula (from CLAUDE.md §3):
 *
 *   STEP 1: per_km_rate     = total_bill / total_km
 *   STEP 2: mid_cost[i]     = (total_km - km_from_origin[i]) * per_km_rate
 *                             (only for mid-route travelers)
 *   STEP 3: mid_total       = Σ mid_cost[i]
 *   STEP 4: remaining_bill  = total_bill - mid_total
 *   STEP 5: full_route_pax  = full-route travelers + 1 (host counts as 1)
 *   STEP 6: full_route_cost = remaining_bill / full_route_pax
 *
 * All PKR amounts are rounded to whole rupees. `rounding_pkr` reports any
 * drift between the allocated sum and the original bill so the UI can show it.
 */

import type { TravelMember } from '@/types'

/** Thrown for caller-fixable input problems (maps to HTTP 422 in the API). */
export class FareEngineError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FareEngineError'
  }
}

export interface TravelMemberCostInput {
  userId: string
  fullName: string
  isHost: boolean
  isFullRoute: boolean
  /** Distance of this traveler's pickup point from the route origin, in km. Use 0 for full-route riders or at the origin. */
  kmFromOrigin: number
}

export interface CalculateFareParams {
  totalBillPkr: number
  totalTripKm: number
  members: TravelMemberCostInput[]
}

export interface MemberFareOutput {
  userId: string
  fullName: string
  isHost: boolean
  isFullRoute: boolean
  kmCovered: number
  farePkr: number
  sharePercentage: number
}

export interface FareEngineResult {
  totalBillPkr: number
  totalTripKm: number
  /** PKR per km, 2 decimals. */
  perKmRatePkr: number
  /** Sum of all mid-route travelers' fares. */
  midRouteTotalPkr: number
  /** Bill left for full-route travelers + host after mid-route fares. */
  remainingBillPkr: number
  /** Per-head fare for each full-route traveler (and the host). */
  fullRouteFareHeadPkr: number
  memberBreakdown: MemberFareOutput[]
  /** Sum of every member's fare — equals the bill unless rounding shifted pennies. */
  totalAllocatedPkr: number
  /** Bill - allocated. Positive means members underpay by this much. */
  roundingPkr: number
}

function sharePercentage(farePkr: number, totalBillPkr: number): number {
  if (totalBillPkr <= 0) return 0
  return Math.round((farePkr / totalBillPkr) * 1000) / 10
}

/** Clamp a pickup distance into [0, totalKm] and reject non-finite values. */
function sanitizeKmFromOrigin(kmFromOrigin: number, totalTripKm: number): number {
  if (!Number.isFinite(kmFromOrigin) || kmFromOrigin < 0) return 0
  return Math.min(kmFromOrigin, totalTripKm)
}

export function calculateTripFares(params: CalculateFareParams): FareEngineResult {
  const { totalBillPkr, totalTripKm, members } = params

  if (!Array.isArray(members) || members.length === 0) {
    throw new FareEngineError('At least one travel member is required')
  }
  if (!Number.isFinite(totalTripKm) || totalTripKm <= 0) {
    throw new FareEngineError('Total trip KM must be greater than 0')
  }
  if (!Number.isFinite(totalBillPkr) || totalBillPkr <= 0) {
    throw new FareEngineError('Total bill PKR must be greater than 0')
  }

  // STEP 1 — the rate everything hangs off of.
  const perKmRatePkr = totalBillPkr / totalTripKm

  const midRouteMembers = members.filter((m) => !m.isHost && !m.isFullRoute)
  const fullRouteMembers = members.filter((m) => m.isHost || m.isFullRoute)

  let midRouteTotalPkr = 0
  const breakdown: MemberFareOutput[] = []

  // STEPS 2–3 — mid-route travelers pay only for the stretch they ride.
  midRouteMembers.forEach((m) => {
    const kmFromOrigin = sanitizeKmFromOrigin(m.kmFromOrigin, totalTripKm)
    const kmCovered = totalTripKm - kmFromOrigin
    const farePkr = Math.round(kmCovered * perKmRatePkr)
    midRouteTotalPkr += farePkr

    breakdown.push({
      userId: m.userId,
      fullName: m.fullName,
      isHost: false,
      isFullRoute: false,
      kmCovered,
      farePkr,
      sharePercentage: sharePercentage(farePkr, totalBillPkr),
    })
  })

  // STEP 4 — what the full-route group still owes.
  const remainingBillPkr = Math.max(0, totalBillPkr - midRouteTotalPkr)

  // STEPS 5–6 — host always rides the full route, so they count as a head.
  const fullRouteCount = Math.max(1, fullRouteMembers.length)
  const fullRouteFareHeadPkr = Math.round(remainingBillPkr / fullRouteCount)

  fullRouteMembers.forEach((m) => {
    breakdown.push({
      userId: m.userId,
      fullName: m.fullName,
      isHost: m.isHost,
      isFullRoute: true,
      kmCovered: totalTripKm,
      farePkr: fullRouteFareHeadPkr,
      sharePercentage: sharePercentage(fullRouteFareHeadPkr, totalBillPkr),
    })
  })

  const totalAllocatedPkr = breakdown.reduce((sum, m) => sum + m.farePkr, 0)

  return {
    totalBillPkr,
    totalTripKm,
    perKmRatePkr: Number(perKmRatePkr.toFixed(2)),
    midRouteTotalPkr,
    remainingBillPkr,
    fullRouteFareHeadPkr,
    memberBreakdown: breakdown,
    totalAllocatedPkr,
    roundingPkr: totalBillPkr - totalAllocatedPkr,
  }
}

// ---------------------------------------------------------------------------
// DB row → engine input adapters
// ---------------------------------------------------------------------------

/** Minimal shape of a `travel_members` row joined with the travel's host row. */
export interface TravelMemberRowLike {
  user_id: string
  is_host: boolean
  is_full_route: boolean
  km_from_origin: number | null
}

/**
 * Convert DB rows (snake_case) into engine inputs (camelCase).
 * `fullNameById` maps user ids → profile.full_name.
 */
export function travelMemberCostInputsFromRows(
  rows: TravelMemberRowLike[],
  fullNameById: Record<string, string>,
): TravelMemberCostInput[] {
  return rows.map((row) => {
    const kmFromOrigin = row.km_from_origin ?? 0
    return {
      userId: row.user_id,
      fullName: fullNameById[row.user_id] ?? 'Traveler',
      isHost: row.is_host,
      // A row sitting at km 0 of the route rides the whole trip.
      isFullRoute: row.is_full_route || kmFromOrigin <= 0,
      kmFromOrigin: row.is_full_route ? 0 : kmFromOrigin,
    }
  })
}

/** Convenience: run the engine directly from DB rows. */
export function calculateTripFaresFromRows(
  totalBillPkr: number,
  totalTripKm: number,
  memberRows: TravelMemberRowLike[],
  fullNameById: Record<string, string>,
): FareEngineResult {
  return calculateTripFares({
    totalBillPkr,
    totalTripKm,
    members: travelMemberCostInputsFromRows(memberRows, fullNameById),
  })
}

export interface TravelLikeForFare {
  total_km: number
  estimated_cost_pkr: number | null
}

/** Optionally derive a duplicate-safe member list from Travel + TravelMember rows. */
export function membersFromTravelRow(
  travel: TravelLikeForFare,
  memberRows: Array<TravelMemberRowLike & { full_name?: string | null }>,
): { totalTripKm: number; members: TravelMemberCostInput[] } {
  if (travel.total_km <= 0) throw new FareEngineError('Travel row has invalid total_km')
  const fullNameById: Record<string, string> = {}
  memberRows.forEach((row) => {
    if (row.full_name) fullNameById[row.user_id] = row.full_name
  })
  return {
    totalTripKm: travel.total_km,
    members: travelMemberCostInputsFromRows(memberRows, fullNameById),
  }
}

export type { TravelMember }

/* ==========================================================================
   Trip cost estimator (pre-posting) — distance-based pricing
   ==========================================================================
   Base Cost (PKR)   = Distance (km) × RATE_PER_KM (12) + BASE_TOLL_PKR (150)
   Min per seat (PKR) = max(Base Cost ÷ seats, Distance × MIN_PER_KM (8))
   ========================================================================== */

/** Rate used for the estimated base trip cost. */
export const RATE_PER_KM_PKR = 12
/** Flat toll/loading fee added on top of the distance rate. */
export const BASE_TOLL_PKR = 150
/** Floor per-seat rate so very short rides still cover fuel. */
export const MIN_PER_KM_PKR = 8

export interface TripCostEstimate {
  /** Estimated total trip cost: km × 12 + 150. */
  totalPkr: number
  /** Minimum fair price per passenger: max(total ÷ seats, km × 8). */
  minPerSeatPkr: number
  distanceKm: number
  seats: number
}

export function haversineKm(a: [number, number], b: [number, number]): number {
  const R = 6371
  const dLat = ((b[0] - a[0]) * Math.PI) / 180
  const dLon = ((b[1] - a[1]) * Math.PI) / 180
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a[0] * Math.PI) / 180) *
      Math.cos((b[0] * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
}

export function estimateTripCost(distanceKm: number, seats: number): TripCostEstimate {
  const km = Math.max(0, Math.round(distanceKm))
  const n = Math.max(1, Math.round(seats))
  const totalPkr = Math.round(km * RATE_PER_KM_PKR + BASE_TOLL_PKR)
  const minPerSeatPkr = Math.max(Math.round(totalPkr / n), km * MIN_PER_KM_PKR)
  return { totalPkr, minPerSeatPkr, distanceKm: km, seats: n }
}
