/**
 * CoolCarPool — POST /api/duplicate-check (TechSOC Card 3)
 *
 * Called by the host travel form before a travel is committed. Returns
 * scored, sorted duplicate candidates so the UI can render:
 *   - score ≥ 60%   → full <DuplicateModal> (`requires_review: true`)
 *   - score 40–60%  → subtle "Similar rides exist" banner (`shows_banner: true`)
 *   - score < 40%   → candidates dropped; post silently
 *
 * Expected JSON body:
 * {
 *   "origin": "Lahore",
 *   "destination": "Murree",
 *   "departure_at": "2026-11-12T15:00:00+05:00",
 *   "gender_preference": "boys_only",
 *   "exclude_id": "<optional uuid of the travel being posted>"
 * }
 *
 * Responses:
 *   200 → { ok, matches, top_score, requires_review, shows_banner }
 *   400 → malformed JSON / invalid body
 *   401 → no authenticated session
 *   405 → wrong verb
 *
 * Fails open: if the pg_trgm RPC errors, matches return empty so the
 * travel can still be posted (project guardrail).
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { findDuplicateTravels, type DuplicateCheckInput } from '@/lib/duplicate-detector'

export const dynamic = 'force-dynamic'

const duplicateCheckBodySchema = z.object({
  origin: z
    .string({ required_error: 'origin is required' })
    .min(2, 'origin must be at least 2 characters')
    .max(160),
  destination: z
    .string({ required_error: 'destination is required' })
    .min(2, 'destination must be at least 2 characters')
    .max(160),
  departure_at: z
    .string({ required_error: 'departure_at is required' })
    .refine(
      (value) => !Number.isNaN(new Date(value).getTime()),
      'departure_at must be a valid ISO timestamp',
    ),
  gender_preference: z.enum(['boys_only', 'girls_only', 'any'], {
    errorMap: () => ({ message: 'gender_preference must be boys_only, girls_only or any' }),
  }),
  exclude_id: z.string().uuid('exclude_id must be a UUID').nullable().optional(),
})

export async function POST(request: Request) {
  // Auth gate — only signed-in hosts may run duplicate scans.
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json(
      { ok: false, error: 'Authentication required' },
      { status: 401 },
    )
  }

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Request body must be valid JSON' },
      { status: 400 },
    )
  }

  const parsed = duplicateCheckBodySchema.safeParse(payload)
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'Invalid request body', issues: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const input: DuplicateCheckInput = {
    origin: parsed.data.origin,
    destination: parsed.data.destination,
    departure_at: parsed.data.departure_at,
    gender_preference: parsed.data.gender_preference,
    exclude_id: parsed.data.exclude_id ?? null,
  }

  try {
    const result = await findDuplicateTravels(input, { supabase })
    return NextResponse.json({ ok: true, ...result }, { status: 200 })
  } catch (error) {
    console.error('[POST /api/duplicate-check] Unexpected failure:', error)
    // Fail open per guardrails — posting must never be blocked by this check.
    return NextResponse.json(
      { ok: true, matches: [], top_score: 0, requires_review: false, shows_banner: false },
      { status: 200 },
    )
  }
}

export function GET() {
  return NextResponse.json(
    { ok: false, error: 'Method not allowed. Use POST with travel parameters.' },
    { status: 405 },
  )
}
