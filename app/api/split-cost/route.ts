/**
 * CoolCarPool — POST /api/split-cost
 *
 * Thin, validated wrapper around `calculateTripFares` in lib/fare-engine.ts.
 *
 * Expected JSON body:
 * {
 *   "totalBillPkr": 2500,
 *   "totalTripKm": 310,
 *   "members": [
 *     { "userId": "<uuid>", "fullName": "Ali Hassan", "isHost": true,  "isFullRoute": true,  "kmFromOrigin": 0   },
 *     { "userId": "<uuid>", "fullName": "Usman Tariq", "isHost": false, "isFullRoute": false, "kmFromOrigin": 280 }
 *   ]
 * }
 *
 * Responses:
 *   200 → { ok: true,  result: FareEngineResult }
 *   400 → { ok: false, error, issues }   (malformed JSON or validation failure)
 *   422 → { ok: false, error }           (domain error from the fare engine)
 *   405 → method not allowed
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { calculateTripFares, FareEngineError } from '@/lib/fare-engine'

export const dynamic = 'force-dynamic'

const memberInputSchema = z.object({
  userId: z
    .string({ required_error: 'userId is required' })
    .uuid('userId must be a valid UUID'),
  fullName: z
    .string({ required_error: 'fullName is required' })
    .min(1, 'fullName cannot be empty')
    .max(120),
  isHost: z.boolean().default(false),
  isFullRoute: z.boolean().default(false),
  kmFromOrigin: z.number().min(0, 'kmFromOrigin cannot be negative').default(0),
})

const splitCostBodySchema = z
  .object({
    totalBillPkr: z
      .number({ required_error: 'totalBillPkr is required' })
      .int('totalBillPkr must be a whole number of PKR')
      .positive('totalBillPkr must be greater than 0')
      .max(10_000_000, 'totalBillPkr looks unrealistic'),
    totalTripKm: z
      .number({ required_error: 'totalTripKm is required' })
      .positive('totalTripKm must be greater than 0')
      .max(50_000, 'totalTripKm looks unrealistic'),
    members: z.array(memberInputSchema).min(1, 'At least one member is required'),
  })
  .superRefine((body, ctx) => {
    const hostCount = body.members.filter((m) => m.isHost).length
    if (hostCount === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['members'],
        message: 'Members must include the host (exactly one member with isHost=true)',
      })
    }
    if (hostCount > 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['members'],
        message: `Exactly one host is allowed, found ${hostCount}`,
      })
    }

    body.members.forEach((m, index) => {
      if (m.isFullRoute && m.kmFromOrigin !== 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['members', index, 'kmFromOrigin'],
          message: 'Full-route members must have kmFromOrigin = 0',
        })
      }
      if (m.kmFromOrigin > body.totalTripKm) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['members', index, 'kmFromOrigin'],
          message: `kmFromOrigin cannot exceed totalTripKm (${body.totalTripKm})`,
        })
      }
    })
  })

type SplitCostBody = z.infer<typeof splitCostBodySchema>

export async function POST(request: Request) {
  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Request body must be valid JSON' },
      { status: 400 },
    )
  }

  const parsed = splitCostBodySchema.safeParse(payload)
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'Invalid request body', issues: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const body: SplitCostBody = parsed.data

  try {
    const result = calculateTripFares({
      totalBillPkr: body.totalBillPkr,
      totalTripKm: body.totalTripKm,
      members: body.members,
    })
    return NextResponse.json({ ok: true, result }, { status: 200 })
  } catch (error) {
    if (error instanceof FareEngineError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 422 })
    }
    console.error('[POST /api/split-cost] Unexpected failure:', error)
    return NextResponse.json(
      { ok: false, error: 'Internal error while splitting the bill' },
      { status: 500 },
    )
  }
}

export function GET() {
  return NextResponse.json(
    { ok: false, error: 'Method not allowed. Use POST with trip parameters.' },
    { status: 405 },
  )
}
