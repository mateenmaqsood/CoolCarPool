/**
 * CoolCarPool — POST /api/merge-travel
 *
 * Handles the "Merge" action from DuplicateModal.
 * Two initiator directions are supported:
 *   1. Primary host merges a duplicate candidate into their ride.
 *   2. Candidate host (posting flow) merges their new ride into the
 *      matched primary — this is the DuplicateModal "Merge Travel" path.
 *
 * On merge:
 *  - Candidate status = 'merged', merged_into_id = primary
 *  - Candidate's pending join requests transfer to the primary
 *  - Every host/member affected is notified (except the initiator)
 *  - The decision is recorded in duplicate_matches
 *
 * Body: { primary_id, candidate_id, action: 'merge' | 'keep' }
 * Response: { ok, travel_id }
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Authentication required' }, { status: 401 })
  }

  let body: { primary_id: string; candidate_id: string; action: 'merge' | 'keep' }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const { primary_id, candidate_id, action } = body

  if (!primary_id || !candidate_id || !action) {
    return NextResponse.json({ ok: false, error: 'Missing required fields' }, { status: 400 })
  }

  if (primary_id === candidate_id) {
    return NextResponse.json({ ok: false, error: 'A travel cannot merge into itself' }, { status: 400 })
  }

  if (action === 'keep') {
    // Just record the decision — no side effects.
    await supabase.from('duplicate_matches').insert({
      primary_id,
      candidate_id,
      action: 'kept',
      resolved_at: new Date().toISOString(),
    })

    return NextResponse.json({ ok: true, travel_id: primary_id })
  }

  // Action is 'merge' — verify the user is host of either travel.
  const [primaryRes, candidateRes] = await Promise.all([
    supabase
      .from('travels')
      .select('id, host_id, origin_text, destination_text, status')
      .eq('id', primary_id)
      .single(),
    supabase
      .from('travels')
      .select('id, host_id, origin_text, destination_text, status')
      .eq('id', candidate_id)
      .single(),
  ])

  const primaryTravel = primaryRes.data
  const candidateTravel = candidateRes.data

  if (!primaryTravel) {
    return NextResponse.json({ ok: false, error: 'Primary travel not found' }, { status: 404 })
  }
  if (!candidateTravel) {
    return NextResponse.json({ ok: false, error: 'Candidate travel not found' }, { status: 404 })
  }

  const isPrimaryHost = primaryTravel.host_id === user.id
  const isCandidateHost = candidateTravel.host_id === user.id

  if (!isPrimaryHost && !isCandidateHost) {
    return NextResponse.json(
      { ok: false, error: 'Only the host of one of the merged travels can merge' },
      { status: 403 },
    )
  }

  // Already-resolved duplicates are idempotent no-ops.
  if (candidateTravel.status === 'merged') {
    return NextResponse.json({ ok: true, travel_id: primary_id, already_merged: true })
  }
  if (primaryTravel.status === 'merged') {
    return NextResponse.json({ ok: false, error: 'Primary travel is already merged' }, { status: 409 })
  }

  try {
    // 1. Transfer pending requests from candidate → primary.
    const { data: pendingRequests, error: reqError } = await supabase
      .from('travel_requests')
      .select('requester_id, waypoint_id, km_from_origin, message')
      .eq('travel_id', candidate_id)
      .eq('status', 'pending')

    if (reqError) throw reqError

    if (pendingRequests && pendingRequests.length > 0) {
      const transfers = pendingRequests.map((req) => ({
        travel_id: primary_id,
        requester_id: req.requester_id,
        waypoint_id: req.waypoint_id,
        km_from_origin: req.km_from_origin,
        message: req.message,
        status: 'pending',
      }))

      const { error: insertError } = await supabase.from('travel_requests').insert(transfers)
      if (insertError) throw insertError

      // Remove the originals — the copies under the primary carry the transfer.
      // (The status CHECK constraint doesn't allow a 'transferred' value.)
      const { error: deleteError } = await supabase
        .from('travel_requests')
        .delete()
        .eq('travel_id', candidate_id)
        .eq('status', 'pending')
      if (deleteError) throw deleteError
    }

    // 2. Mark the candidate as merged into the primary.
    const { error: updateError } = await supabase
      .from('travels')
      .update({
        status: 'merged',
        merged_into_id: primary_id,
        available_seats: 0,
      })
      .eq('id', candidate_id)

    if (updateError) throw updateError

    // 3. Notify everyone affected except the initiator.
    const routeLabel = `${candidateTravel.origin_text} → ${candidateTravel.destination_text}`
    const notifications: Array<{
      user_id: string
      type: string
      travel_id: string
      payload: { message: string }
    }> = []

    // Candidate host (when someone else merged their ride away).
    if (!isCandidateHost) {
      notifications.push({
        user_id: candidateTravel.host_id,
        type: 'travel_merged',
        travel_id: primary_id,
        payload: {
          message: `Your travel "${routeLabel}" was merged into another ride. Your riders were transferred automatically.`,
        },
      })
    }

    // Primary host (when the candidate host initiated the merge).
    if (!isPrimaryHost) {
      notifications.push({
        user_id: primaryTravel.host_id,
        type: 'merge_received',
        travel_id: primary_id,
        payload: {
          message: `A similar ride ("${routeLabel}") was merged into your travel. More seats may now be pooled together.`,
        },
      })
    }

    // Candidate's pending requesters — their request now targets the primary.
    if (pendingRequests) {
      for (const req of pendingRequests) {
        notifications.push({
          user_id: req.requester_id,
          type: 'request_transferred',
          travel_id: primary_id,
          payload: {
            message: `Your join request was transferred to a merged ride: ${primaryTravel.origin_text} → ${primaryTravel.destination_text}`,
          },
        })
      }
    }

    // Primary members — heads-up that the pool grew.
    const { data: primaryMembers } = await supabase
      .from('travel_members')
      .select('user_id')
      .eq('travel_id', primary_id)

    if (primaryMembers) {
      for (const member of primaryMembers) {
        if (member.user_id === user.id) continue
        notifications.push({
          user_id: member.user_id,
          type: 'travel_merged',
          travel_id: primary_id,
          payload: {
            message: 'A similar ride was merged into this travel. More seats may be available.',
          },
        })
      }
    }

    if (notifications.length > 0) {
      await supabase.from('notifications').insert(notifications)
    }

    // 4. Record the merge decision.
    await supabase.from('duplicate_matches').insert({
      primary_id,
      candidate_id,
      action: 'merged',
      resolved_at: new Date().toISOString(),
    })

    return NextResponse.json({ ok: true, travel_id: primary_id })
  } catch (error) {
    console.error('[merge-travel] error:', error)
    return NextResponse.json({ ok: false, error: 'Failed to merge travels' }, { status: 500 })
  }
}

export function GET() {
  return NextResponse.json({ ok: false, error: 'Method not allowed' }, { status: 405 })
}
